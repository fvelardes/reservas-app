# reservas-app

## Arquitectura

    navegador ──► reservas-frontend ──────► reservas-api ──────► reservas-db
                  React + Vite             Node 20 + Express     MySQL 8.4
                  nginx :8080              :3000                 :3306
                  (host 3000)              (host 3001, solo      (sin puerto
                                            depuración)           publicado)

| Capa | Imagen | Puerto interno | Puerto publicado |
| --- | --- | --- | --- |
| `reservas-frontend` | React + Vite servido por nginx | 8080 | 3000 |
| `reservas-api` | Node 20 + Express | 3000 | 3001 (solo depuración) |
| `reservas-db` | MySQL 8.4 | 3306 | — |

El frontend es el único punto de entrada: nadie le habla a la base
directamente, y a la API le habla el frontend.

## Medición de imágenes (TP 2)

| Imagen                  | Base                              | Tamaño   | Reducción |
|-------------------------|-----------------------------------|----------|-----------|
| reservas-api:naive      | node:20                           | 1.59 GB  | —         |
| reservas-api:v1         | node:20-slim (multi-stage)        | 324 MB   | ~80%      |
| reservas-frontend:v1    | nginx-unprivileged:1.27-alpine    | 76.2 MB  | ~95% *    |

### Qué aportó cada decisión

- **Base mínima (node:20 → node:20-slim):** es la palanca que más pesa.
  La base completa arrastra ~1 GB de compiladores que en runtime no se usan.
- **Multi-stage (API):** la etapa `deps` instala con todo el toolchain y la
  etapa final solo copia `node_modules`; el andamiaje de instalación no queda
  en la imagen publicada.
- **Multi-stage (frontend):** la etapa Node compila el SPA y la etapa final
  (nginx) recibe solo `dist/`. En la imagen final no hay Node, ni npm, ni
  node_modules, ni código fuente. Verificado con `node --version` → not found.
- **.dockerignore:** no reduce el tamaño de la imagen, sino el del contexto de
  build (bajó a ~289 B); evita que node_modules local viaje al daemon y pise
  el instalado con binarios de otro sistema operativo.
- **npm ci --omit=dev (API):** instalación reproducible desde el lock, sin las
  dependencias de desarrollo, que en el backend no se usan en runtime.
- **Usuario no-root:** la API usa `USER node`; el frontend hereda el uid 101 de
  nginx-unprivileged. Defensa en profundidad: limita el daño ante un escape.
- **ARG + ENV APP_VERSION:** hornea la versión dentro de la imagen para que sea observable en runtime
- **Configuración al arrancar (frontend):** API_HOST/API_PORT + envsubst
  resuelven el backend en runtime, no en el build.


### Efecto del cache de construcción

Al modificar solo el código (server.js), la capa `RUN npm ci` sale del
cache (CACHED) y no reinstala dependencias: el `COPY . .` está por debajo
de la instalación, así que un cambio de código no la invalida.

Al modificar el manifiesto (package.json / package-lock.json), la capa de
instalación se reconstruye, porque el `COPY package.json package-lock.json`
está por encima del `npm ci`. Docker reutiliza una capa solo si su
instrucción y su entrada no cambiaron; al cambiar la entrada del COPY del
manifiesto, esa capa y todas las de arriba se rehacen (invalidación en
cascada). Por eso el manifiesto va arriba y el código abajo.
## docker history reservas-api:v1

La capa que más aporta es la instalación de Node (NODE_VERSION=20.20.2),
~126 MB, seguida de la base Debian bookworm, ~108 MB. Ambas forman la base
node:20-slim: juntas ~234 MB de los ~324 MB totales.

En contraste, el código (COPY . .) pesa 81.9 kB y las dependencias
(node_modules: express, mysql2) 9.85 MB. ~97% del tamaño es la base.

Conclusión: tras el multi-stage, que ya quita el toolchain de instalación,
el peso restante es el runtime de Node. Reducir más exigiría una base aún
más chica (alpine), con las advertencias de compatibilidad musl.

## Versión horneada (ARG + ENV)

    docker build -t reservas-api:v1 ./backend
    docker build --build-arg APP_VERSION=v2 -t reservas-api:v2 ./backend
    docker run --rm --entrypoint sh reservas-api:v2 -c 'echo $APP_VERSION'  # imprime v2

Si la v2 imprimiera v1, faltaría ENV APP_VERSION=${APP_VERSION}: el ARG no
sobrevive al build. Sin esto, el rolling update de la semana 6 no mostraría
cambio observable.

## Frontend: verificación (consigna 7)

    docker run --rm reservas-frontend:v1 whoami         # nginx (no root)
    docker run --rm reservas-frontend:v1 node --version # DEBE fallar: node not found
    docker images reservas-frontend                      # 76.2 MB

NGINX_ENVSUBST_FILTER=^API_ no es opcional: sin él, envsubst vaciaría las
variables propias de nginx ($uri, $host, $proxy_add_x_forwarded_for) y
generaría una config inválida en silencio. El filtro limita la sustitución
a las variables API_*, que se resuelven al arrancar (una imagen, todos los
entornos).

## Publicación en Docker Hub

    docker login
    docker tag reservas-api:v1       fvelardes/reservas-api:v1
    docker tag reservas-frontend:v1  fvelardes/reservas-frontend:v1
    docker push fvelardes/reservas-api:v1
    docker push fvelardes/reservas-frontend:v1

Publicadas:
- docker.io/fvelardes/reservas-api:v1
- docker.io/fvelardes/reservas-frontend:v1




##TP3-SEMANA 03
## 1. Red y volumen

Se crean los dos objetos de Docker con ciclo de vida propio, independientes
del contenedor: la red (para que las capas se encuentren por nombre) y el
volumen (para que los datos de la base sobrevivan).

### Comandos

    docker network create reservas-net
    docker volume create reservas-db-data

### Verificación

`docker network ls` — reservas-net creada con driver bridge (custom, con DNS interno):

    NETWORK ID     NAME           DRIVER    SCOPE
    5ed0ff35f535   bridge         bridge    local
    b4292581e1f8   host           host      local
    0c0e3cc69e52   none           null      local
    f60e97cdcea2   reservas-net   bridge    local

`docker volume ls` — reservas-db-data creado con driver local:

    DRIVER    VOLUME NAME
    local     reservas-db-data

La red usa el driver bridge en su variante custom (creada a mano), que a
diferencia de la red bridge por defecto incluye un servidor DNS interno capaz
de resolver los nombres de los contenedores conectados.
## 2. Base de datos (reservas-db)

MySQL 8.4 en la red reservas-net, con el volumen nombrado montado sobre su
directorio de datos, y SIN publicar ningún puerto.

### Comando

    docker run -d --name reservas-db --network reservas-net \
      -e MYSQL_DATABASE=reservasdb \
      -e MYSQL_USER=reservas_user \
      -e MYSQL_PASSWORD=reservas_pass \
      -e MYSQL_ROOT_PASSWORD=reservas_root_pass \
      -v reservas-db-data:/var/lib/mysql \
      mysql:8.4

### Por qué no se publica puerto (-p)

La base de datos es la capa más interna de la aplicación. No debe ser
accesible desde el anfitrión ni desde fuera de la máquina: solo los
contenedores conectados a reservas-net deben poder alcanzarla, resolviéndola
por su nombre (reservas-db) a través del DNS interno de la red. Publicar el
3306 al host abriría la base al exterior sin necesidad. Por eso se omite -p
de forma deliberada.

### Verificación

docker ps — el contenedor está Up y PORTS muestra 3306/tcp sin mapeo al host,
confirmando que el puerto está expuesto solo dentro de la red:

    CONTAINER ID   IMAGE       STATUS         PORTS                 NAMES
    5c062add2a17   mysql:8.4   Up 5 seconds   3306/tcp, 33060/tcp   reservas-db

En la primera inicialización, el log muestra dos veces "ready for connections":
el primero con port: 0 corresponde a un servidor temporal que MySQL usa para
inicializar el datadir y aplicar las variables MYSQL_* (crear la base, el
usuario y sus permisos); el definitivo informa port: 3306 y es el que acepta
conexiones. La base solo está lista cuando aparece este último.



## 3. API (reservas-api)

API Express en la red reservas-net, configurada para alcanzar la base por
nombre mediante DB_HOST=reservas-db. Publica su puerto en el 3001 del host
solo para depuración.

### Comando

    docker run -d --name reservas-api --network reservas-net -p 3001:3000 \
      -e PORT=3000 \
      -e DB_HOST=reservas-db \
      -e DB_PORT=3306 \
      -e DB_NAME=reservasdb \
      -e DB_USER=reservas_user \
      -e DB_PASSWORD=reservas_pass \
      -e APP_VERSION=v1 \
      -e SEED_DEMO=true \
      reservas-api:v1

### Comprobaciones

a) Resolución de nombre por el DNS interno de la red:

    $ docker exec reservas-api getent hosts reservas-db
    172.18.0.2      reservas-db

El nombre reservas-db se resuelve a la IP del contenedor de la base. En la red
bridge por defecto esta resolución no funcionaría (no tiene DNS por nombre).

b) Estado de la API y de su conexión a la base:

    $ curl -s localhost:3001/health
    {"status":"ok","db":"ok","version":"v1"}

"db":"ok" confirma que la API se conectó a MySQL a través del nombre reservas-db.

c) Tablas creadas por la siembra de datos (SEED_DEMO=true):

    $ docker exec reservas-db mysql -ureservas_user -preservas_pass reservasdb -e 'SHOW TABLES;'
    Tables_in_reservasdb
    reservas
    salas



## 4. Error deliberado: frontend fuera de la red

Se ejecuta el frontend OMITIENDO --network, para reproducir a propósito el
error que vuelve a aparecer (con otro disfraz) en las semanas 4, 5 y 6.

### Comando (sin --network, de forma deliberada)

    docker run -d --name reservas-frontend -p 3000:8080 \
      -e API_HOST=reservas-api -e API_PORT=3000 \
      reservas-frontend:v1

### Resultado

docker ps -a — el contenedor termina con Exited (1):

    CONTAINER ID   IMAGE                  STATUS                     NAMES
    7cc2cdd27c36   reservas-frontend:v1   Exited (1) 5 seconds ago   reservas-frontend

Mensaje textual del log (docker logs reservas-frontend):

    nginx: [emerg] host not found in upstream "reservas-api" in /etc/nginx/conf.d/default.conf:24

### Por qué el proceso termina en lugar de arrancar degradado

nginx resuelve el nombre del upstream (reservas-api) del proxy_pass UNA SOLA
VEZ, al iniciar. Al faltar --network reservas-net, el contenedor quedó en la
red bridge por defecto, que no tiene DNS por nombre, de modo que reservas-api
no resuelve. nginx no reintenta: levanta un error [emerg] y mata el proceso, y
como nginx es el proceso principal del contenedor, este muere con Exited (1).
Reiniciarlo sin conectarlo a la red daría el mismo resultado.




## 5. Frontend recreado en la red + verificación en el navegador

Se elimina el contenedor que quedó en Exited y se vuelve a crear con las MISMAS
opciones, agregando solo --network reservas-net. La imagen es la misma; no se
reconstruye nada. Lo único que cambia es la red.

### Comando

    docker rm -f reservas-frontend
    docker run -d --name reservas-frontend --network reservas-net -p 3000:8080 \
      -e API_HOST=reservas-api -e API_PORT=3000 \
      reservas-frontend:v1

Esta vez nginx resuelve reservas-api por DNS al arrancar y el contenedor queda Up.

### Verificación en el navegador (pestaña Network)

Al reservar una sala en http://localhost:3000, el pedido observado es:

    Request URL:    http://localhost:3000/api/reservas
    Request Method: POST
    Status Code:    201 Created
    Remote Address: [::1]:3000

El pedido se dirige al MISMO origen que sirvió la página (localhost:3000), no a
localhost:3001. No aparece ninguna solicitud OPTIONS: al no haber cruce de
origen, el navegador no realiza preflight de CORS. nginx recibe el pedido en
/api/reservas y lo reenvía internamente a reservas-api:3000; el navegador nunca
habla con la API directamente.



## 6. El proxy elimina el prefijo /api

Se comprueba que la ruta directa a la API y la ruta a través del proxy del
frontend devuelven el mismo contenido.

### Comandos y salida

a) Directo contra la API (puerto de depuración):

    $ curl -s localhost:3001/salas
    [{"id":4,"nombre":"Aula Magna",...},{"id":1,"nombre":"Laboratorio 1",...}, ...]

b) A través del proxy del frontend (con prefijo /api):

    $ curl -s localhost:3000/api/salas
    [{"id":4,"nombre":"Aula Magna",...},{"id":1,"nombre":"Laboratorio 1",...}, ...]

Ambas respuestas son idénticas. nginx recibe /api/salas y, gracias a la barra
final del proxy_pass (http://${API_HOST}:${API_PORT}/;), reenvía /salas a la
API quitando el prefijo /api. Si faltara esa barra, Express recibiría
/api/salas —ruta que no conoce— y devolvería 404.



## 7. Persistencia del dato

Se destruye el contenedor de la base y se vuelve a crear con las mismas
opciones del punto 2 (mismo volumen). Los datos deben sobrevivir.

### Pasos

    docker rm -f reservas-db
    docker volume ls            # reservas-db-data sigue existiendo
    docker run -d --name reservas-db --network reservas-net \
      -e MYSQL_DATABASE=reservasdb -e MYSQL_USER=reservas_user \
      -e MYSQL_PASSWORD=reservas_pass -e MYSQL_ROOT_PASSWORD=reservas_root_pass \
      -v reservas-db-data:/var/lib/mysql mysql:8.4
    docker restart reservas-api

### Verificación

    docker exec reservas-db mysql -ureservas_user -preservas_pass reservasdb \
      -e 'SELECT id, fecha, franja, responsable, creada_en FROM reservas;'

La reserva creada desde el navegador en el punto 5 (id 7, "Carlos Albaca",
creada_en 2026-10-11 23:41:12) continúa presente con su marca de tiempo
original, pese a haberse destruido y recreado el contenedor de la base. Esto
prueba que los datos viven en el volumen reservas-db-data, no en el contenedor:
el volumen tiene ciclo de vida propio y sobrevive a docker rm.

Nota: la API conservaba la conexión al contenedor anterior (otra IP) y requirió
docker restart para reconectar. Esta limitación se resuelve en la semana 4 con
depends_on y condition: service_healthy.



## 8. Orden de arranque

La aplicación debe levantarse en este orden, porque cada pieza depende de que
la anterior ya exista:

    red → volumen → base → API → frontend

### Qué falla al invertir cada paso

1. Red primero: sin reservas-net creada, los contenedores no tienen DNS por
   nombre. Un contenedor levantado sin --network cae en la red bridge por
   defecto y no resuelve a los demás por nombre (ver punto 4).

2. Volumen antes que la base: la base monta reservas-db-data para persistir sus
   datos. Debe existir antes de crear el contenedor de la base.

3. Base antes que la API: si la API arranca antes de que MySQL acepte
   conexiones, obtiene ECONNREFUSED. No es fatal: la API reintenta la conexión
   (se observaron 15 reintentos) hasta que la base está lista.

4. API antes que el frontend: este es el punto crítico. nginx resuelve el
   nombre del upstream (reservas-api) UNA SOLA VEZ, al arrancar. Si la API no
   existe todavía, nginx falla con [emerg] host not found in upstream y el
   contenedor muere con Exited (1). A diferencia de la API, nginx NO reintenta.

### Asimetría entre los dos fallos

- Base ↔ API: fallo tolerable. La API reintenta y se recupera sola.
- API ↔ Frontend: fallo fatal. nginx muere y no vuelve por sí mismo.

Esta diferencia explica por qué el orden API → frontend no admite inversión.

### Limitación actual

Este orden reside hoy en la memoria de quien levanta la aplicación y en una
secuencia de comandos docker run ejecutados a mano: no está declarado en ningún
archivo ejecutable. Nada impide levantarlos en el orden equivocado. Esta
limitación se resuelve en la semana 4 con Docker Compose, que declara las
dependencias con depends_on y condition: service_healthy, y levanta todo el
stack en el orden correcto con un solo comando.
