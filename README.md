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
