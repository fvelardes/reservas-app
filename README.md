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



# Semana 04 
---

## 1. Red y volumen reproducidos de la semana 3

El `docker-compose.yml` declara la red `reservas-net` y el volumen `reservas-db-data`,
ambos con `name:` explícito. El `name:` evita que Compose les anteponga el prefijo del
proyecto (`reservas-app_`): así son **exactamente** la red y el volumen de la semana 3,
con los datos adentro.

Antes del primer `docker compose up` se eliminaron los contenedores y la red de la
semana 3:

```bash
docker rm -f reservas-db reservas-api reservas-frontend
docker network rm reservas-net
```

**Por qué se borra la red pero no el volumen.** La red de la semana 3 fue creada a mano
(`docker network create`), sin la etiqueta de propiedad de Compose. Al encontrarla,
Compose falla (versiones 2.x: `network reservas-net was found but has incorrect label`)
o advierte y la reutiliza (versiones nuevas: `a network with name reservas-net exists
but was not created by compose`). Eliminarla deja la red a cargo de Compose, que la
recrea como suya. El **volumen** no se toca: contiene los datos, y Compose lo reutiliza
conservándolos (solo advierte: `volume ... already exists but was not created by
Docker Compose`).

La base de datos se declara **sin `ports`**: es la capa más interna y solo debe
alcanzarse desde `reservas-net`. En `docker compose ps` aparece como `3306/tcp` **sin
flecha** (expuesta en la red, no publicada en el host).

---

## 2. Healthcheck de reservas-db (MySQL)

```yaml
healthcheck:
  test:
    - CMD-SHELL
    - mysqladmin ping -h 127.0.0.1 -u root -p"$$MYSQL_ROOT_PASSWORD" --silent
  interval: 5s
  timeout: 5s
  retries: 20
  start_period: 40s
```

**a) Por qué `$$` y no `$`.** Con un solo `$`, la interpolación la hace **Compose** al
leer el archivo, y la contraseña queda escrita en texto plano en la línea de comando del
healthcheck, visible con `docker inspect`. Con `$$`, Compose escribe un `$` literal y la
variable la expande el intérprete **dentro del contenedor**, al ejecutar el healthcheck.
La contraseña nunca queda grabada en el comando. (Además, con un solo `$` la variable
—que existe dentro del contenedor, no a nivel Compose— llega vacía y `mysqladmin` falla
por contraseña, dejando la base `unhealthy`.)

**b) Por qué `start_period: 40s`.** La primera inicialización del directorio de datos de
MySQL es lenta (crea el datadir, la base, el usuario, apaga el servidor temporal y
levanta el definitivo). `start_period` es un período de gracia en el que los fallos no
cuentan: sin él, el contenedor quedaría marcado `unhealthy` cuando en realidad estaba
arrancando normalmente.

**c) Por qué `-h 127.0.0.1` y no `-h localhost`.** MySQL inicializa en dos tiempos:
primero un servidor **temporal** sin red, que solo atiende por *socket*; recién después
el servidor definitivo, que atiende por TCP. Con `-h localhost` el cliente se conecta por
socket, el servidor temporal responde y el healthcheck informa `healthy` durante la
inicialización, cuando la base aún no está disponible para nadie. Con `-h 127.0.0.1` la
conexión es por TCP, que el temporal no atiende: el ping recién responde con el servidor
definitivo, cuando la base y el usuario ya existen. `127.0.0.1` se refiere al propio
contenedor (loopback), porque el healthcheck corre dentro de la base.

*Síntoma de diagnóstico:* si la API registra `ECONNREFUSED` con la base ya en `healthy`,
el healthcheck está usando `-h localhost`.

---

## 3. Healthcheck de reservas-api (Node) — sin instalar curl

```yaml
healthcheck:
  test:
    - CMD
    - node
    - -e
    - "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
```

**Por qué no se instala curl.** Node incluye `fetch` nativo desde la versión 18, así que
el healthcheck se resuelve con el runtime que ya está en la imagen. Instalar `curl` solo
para chequear engordaría la imagen y le sumaría superficie de ataque, en contra de la
lección de tamaño de la semana 2. El script distingue dos fallas: `.then(r.ok?0:1)`
cubre "la API respondió, pero con error" (exit 1), y `.catch` cubre "no se pudo conectar"
(exit 1). Solo un 2xx da exit 0.

---

## 4. Healthcheck de reservas-frontend (nginx)

```yaml
healthcheck:
  test:
    - CMD-SHELL
    - wget -q -O - http://127.0.0.1:8080/healthz || exit 1
```

Usa `wget`, incluido en BusyBox y ya presente en Alpine (no se instala nada). Chequea
`/healthz` —una ruta del propio nginx— y **no** `/api/health`: cada healthcheck mide su
propia capa. Si midiera la API, la salud del frontend dependería de la de la API.

---

## 5. depends_on con condición — los dos casos no son equivalentes

```yaml
# en reservas-api
depends_on:
  reservas-db:
    condition: service_healthy

# en reservas-frontend
depends_on:
  reservas-api:
    condition: service_healthy
```

**a) reservas-api → reservas-db.** La API debe **conectarse** a la base, y la primera
inicialización de MySQL demora. La forma corta (`depends_on: [reservas-db]`) solo espera
a que el contenedor *arranque*, no a que la base esté *lista*: la API intentaría
conectarse al servidor temporal (que no atiende TCP) y fallaría con `ECONNREFUSED`. Por
eso necesita `service_healthy`. La API además reintenta la conexión ~60 s, que es lo
único que subsistirá en Kubernetes, donde no existe `depends_on`.

**b) reservas-frontend → reservas-api.** Lo que no puede faltar es **algún**
`depends_on`: sin él, el frontend arranca antes que la API, nginx no resuelve el upstream
y termina con `host not found in upstream`. A nginx le basta con que el nombre resuelva
—la forma corta también funcionaría—; se usa `service_healthy` además para que arranque
con la API ya en funcionamiento, sin respuestas 502 en los primeros segundos.

---

## 6. Validación y arranque

```bash
docker compose config        # valida y muestra la versión resuelta (siempre antes del up)
docker compose up --build -d # construye y arranca en orden, esperando cada healthcheck
docker compose ps            # estado y salud de cada servicio
docker compose logs -f reservas-api
```

Los tres servicios alcanzan `Up (healthy)`. El arranque es escalonado (db → api →
frontend), cada uno espera a que el anterior esté `healthy`. Los logs de la API confirman
la conexión: `esquema listo`, `datos de demo sembrados`, `escuchando en :3000`.

---

## 7. Ciclo de vida de los datos: down vs down -v

```bash
docker compose down     # elimina contenedores y red; CONSERVA el volumen
docker compose up -d
curl -s localhost:3000/api/reservas   # las reservas anteriores siguen respondiendo
docker compose down -v  # elimina además el volumen: BORRA los datos
```

- `docker compose down` elimina lo que el próximo `up` recrea idéntico (contenedores,
  red). El volumen `reservas-db-data` **sobrevive**: tras `down` + `up`, el `curl`
  devolvió reservas creadas días atrás, prueba de la persistencia.
- `docker compose down -v` elimina también el volumen (`Volume reservas-db-data
  Removed`). Los datos se pierden de forma **irreversible**; sirve para empezar de cero a
  propósito, y para nada más.

Como MySQL solo inicializa sobre un volumen vacío, tras `down` el `up` no reinicializa (los
datos están); tras `down -v` el `up` reinicializa desde cero y quedan solo los datos de
demo que siembra el código.

---

## 8. Variables sensibles: .env, .env.example y .gitignore

- `.env.example` (versionado) documenta el contrato de variables de las tres capas.
- `.env` (en `.gitignore`) tiene los valores reales y **no** viaja a git.
- Las dos contraseñas del usuario de la app deben coincidir entre capas
  (`MYSQL_PASSWORD` de la base = `DB_PASSWORD` de la API); la de root
  (`MYSQL_ROOT_PASSWORD`) solo la usa la base y su healthcheck.

**Qué sigue siendo un problema en producción.** El `.env` saca la contraseña de **git**,
pero no del **contenedor**: `docker compose config` y `docker inspect` la siguen mostrando
en texto plano, y cualquiera con acceso al host la ve. Es higiene de repositorio, no
gestión de secretos. La solución real llega en la semana 7 con los objetos **Secret**
(valores sensibles, gestionados aparte) y **ConfigMap** (configuración no sensible) de
Kubernetes.

---




##9d Escaneo de vulnerabilidades (Trivy)

Escaneo ejecutado como contenedor, sin instalar nada:

    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image reservas-api:v1
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image reservas-frontend:v1

Las vulnerabilidades con parche se contaron con el flag `--ignore-unfixed`.

| Imagen | Origen | Hallazgos totales | Con parche (Fixed Version) |
|---|---|---|---|
| `reservas-api:v1` | sistema base (Debian 12.13) | 289 (6 critical, 68 high) | 61 (5 critical) |
| `reservas-api:v1` | dependencias Node | 40 (2 critical, 22 high) | 39 (2 critical) |
| `reservas-frontend:v1` | sistema base (Alpine 3.21.3) | 200 (2 critical, 51 high) | 200 (todas) |

**Lectura:**
- **Frontend (Alpine):** las 200 tienen parche → la base fijada quedó vieja. Se arregla reconstruyendo sobre una imagen base más nueva.
- **Base de la API (Debian):** solo 61 de 289 tienen parche; las ~228 restantes no tienen corrección disponible hoy. Las 61 accionables (5 critical) se mitigan actualizando la base; el resto se documenta y se decide.
- **Dependencias Node:** 39 de 40 tienen parche → se corrigen actualizando las librerías de la app (regenerar `package-lock.json`).

## 10. Mínimo privilegio (cap_drop / cap_add)

Se aplicó `cap_drop: [ALL]` a los tres servicios. Las dos imágenes propias
(`reservas-api`, `reservas-frontend`) siguieron en `healthy`: ya corren como
usuario no-root (`node` uid 1000 y `nginx` uid 101), no hacen operaciones
privilegiadas y no necesitan ninguna capability.

`reservas-db` falló al arrancar:

    [ERROR] [MY-010126] [Server] setgid: Operation not permitted
    [ERROR] [MY-010119] [Server] Aborting

La imagen de MySQL arranca como root para preparar el directorio de datos
(`/var/lib/mysql`) y luego baja a su propio usuario `mysql`. Ese cambio de
usuario/grupo y el ajuste de permisos requieren capabilities que `cap_drop: [ALL]`
había quitado. Se devolvieron solo las necesarias:

    reservas-db:
      cap_drop: [ALL]
      cap_add: [CHOWN, SETGID, SETUID, DAC_OVERRIDE, FOWNER]

- CHOWN: cambiar el dueño de archivos del datadir
- SETGID / SETUID: cambiar de grupo/usuario (bajar de root a mysql) — SETGID es la
  que el error señalaba
- DAC_OVERRIDE / FOWNER: ajustar permisos y operar sobre archivos del datadir

Con ese `cap_add`, la base alcanzó `healthy` y la cadena completa volvió a levantar.

**Por qué la base requiere capabilities y las otras dos no:** la base *elige*
arrancar como root para inicializarse y luego degradar a un usuario sin privilegios;
ese procedimiento necesita permisos concretos. Las imágenes propias ya son no-root
desde el arranque, así que no tienen nada que degradar ni ningún permiso privilegiado
que ejercer.

`privileged: true` no se usa nunca para una aplicación: otorga *todas* las
capabilities y el host entero, cuando la base solo necesita cinco específicas. El
principio es el opuesto: sacar todo y devolver únicamente lo justo.




######################
## 11. Comparación: docker-compose.yml vs los tres `docker run` de la semana 3

En la semana 3, levantar el proyecto requería crear la red y el volumen a mano y
después ejecutar tres `docker run` largos, en un orden que había que recordar y con
una espera manual entre la base y la API:

    docker network create reservas-net
    docker volume create reservas-db-data

    docker run -d --name reservas-db --network reservas-net \
      -e MYSQL_DATABASE=reservasdb -e MYSQL_USER=reservas_user \
      -e MYSQL_PASSWORD=reservas_pass -e MYSQL_ROOT_PASSWORD=reservas_root_pass \
      -v reservas-db-data:/var/lib/mysql mysql:8.4
    # (esperar a mano el mensaje "ready for connections" con port: 3306)
    docker run -d --name reservas-api --network reservas-net \
      -e DB_HOST=reservas-db -e DB_PORT=3306 -e DB_NAME=reservasdb \
      -e DB_USER=reservas_user -e DB_PASSWORD=reservas_pass \
      -p 3001:3000 reservas-api:v1
    docker run -d --name reservas-frontend --network reservas-net \
      -p 3000:8080 reservas-frontend:v1

Hoy todo eso es un único `docker-compose.yml` versionado y un `docker compose up`.

### Qué desapareció

- **Los comandos manuales.** Cuatro comandos (`network create`, `volume create` y
  tres `run`) con sus flags se reemplazan por un archivo y un `up`.
- **El orden en la memoria.** El orden red → volumen → base → API → frontend ya no
  reside en la cabeza de quien levanta el proyecto: lo declara `depends_on` y lo
  resuelve Compose.
- **La espera manual.** Ya no hace falta mirar los logs y esperar el `ready for
  connections` antes de lanzar la API: los `healthcheck` + `condition:
  service_healthy` hacen que cada servicio espere a que el anterior esté sano.
- **Los flags sueltos.** Cada `-e`, `-p`, `-v`, `--network`, `--name` pasa a ser una
  clave declarada en el archivo.

### Qué apareció

- **Un archivo versionado**, que vive en el repositorio junto al código y es la fuente
  única de verdad de cómo se levanta el proyecto.
- **Los healthchecks**: cada servicio declara qué significa estar sano (`mysqladmin
  ping`, `node fetch`, `wget`). Antes un contenedor solo estaba `Up` o no; no había
  noción de salud.
- **`depends_on` con condición**: el orden y la espera, antes implícitos, ahora son
  declaración explícita.
- **Un solo comando para todo el ciclo**: `up`, `down`, `logs`, `ps`, `config` operan
  sobre el proyecto entero.

### Mapa de traducción

| Semana 3 (`docker run`) | Semana 4 (`docker-compose.yml`) |
|---|---|
| `--name reservas-db` | nombre del servicio (`reservas-db:`) |
| `--network reservas-net` | `networks: [reservas-net]` + bloque `networks:` |
| `-v reservas-db-data:/var/lib/mysql` | `volumes: [...]` + bloque `volumes:` |
| `-e VAR=valor` | `environment:` |
| `-p 3001:3000` | `ports: ["3001:3000"]` |
| el orden en que se tipean los comandos | `depends_on:` + `healthcheck:` |

La última fila es la única que no es una traducción literal: el orden de los comandos
no era un flag, era **memoria**. Ahora es una declaración, y es la ganancia central de
esta etapa.

### Hacia adelante

Este archivo es la referencia contra la que se compararán los manifiestos de Kubernetes
desde la semana 5: cada servicio se vuelve un manifiesto, y `depends_on` desaparece
(Kubernetes no lo tiene). Por eso la API conserva su reintento de conexión (~60 s), que
es lo único de la espera que sobrevive al cambio de orquestador.
########################################


