# Registro: Compose en una sola máquina e imágenes de contenedor

Ejecutado el 2026-11-21 en la Mac del alumno (Docker 29.8.0), en la raíz del repositorio. Horas locales (UTC-3). Las credenciales de Compose salen de `.env` (no versionado; plantilla en `.env.example`).

## Imágenes

**16:20:59** — `docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep -E "REPOSITORY|reservas"`

```
REPOSITORY:TAG                   SIZE
fvelardes/reservas-frontend:v1   21MB
fvelardes/reservas-api:v1        73.1MB
fvelardes/reservas-api:v2        73.1MB
reservas-frontend:v1             76.2MB
reservas-api:v1                  324MB
reservas-api:v2                  324MB
reservas-api:naive               1.59GB
```

**16:20:59** — `docker run --rm --entrypoint sh reservas-api:v1 -c "whoami; node --version; echo APP_VERSION=\$APP_VERSION; ls /app"`

```
node
v20.20.2
APP_VERSION=v1
Dockerfile
README.md
db.js
node_modules
package-lock.json
package.json
server.js
```

**16:21:01** — `docker run --rm --entrypoint sh reservas-frontend:v1 -c "whoami; node --version 2>&1; npm --version 2>&1; ls /usr/share/nginx/html"`

```
nginx
sh: node: not found
sh: npm: not found
50x.html
assets
index.html
```

**16:21:01** — `docker run --rm --entrypoint sh reservas-api:v1 -c "env | grep -iE \"pass|secret|user\" || echo sin credenciales en el entorno de la imagen"`

```
sin credenciales en el entorno de la imagen
```

**16:21:01** — `docker history --no-trunc --format "{{.CreatedBy}}" reservas-api:v1 | grep -icE "password|secret" || true`

```
0
```

**16:21:01** — `docker run --rm --entrypoint cat reservas-frontend:v1 /etc/nginx/templates/default.conf.template | grep -n proxy_pass`

```
22:        # OJO: la barra final de proxy_pass es la que ELIMINA el prefijo /api.
24:        proxy_pass http://${API_HOST}:${API_PORT}/;
35:    # nginx resuelve el upstream de proxy_pass UNA sola vez, al arrancar: si
46:    #       rewrite ^/api/(.*)$ /$1 break;   # con variable, proxy_pass NO reescribe la URI
47:    #       proxy_pass $upstream;
```

## Compose

**16:21:01** — `docker compose config --quiet && echo "docker-compose.yml válido"`

```
docker-compose.yml válido
```

**16:21:01** — `docker compose up -d --wait 2>&1 | tail -8`

```
 Container reservas-app-reservas-frontend-1 Starting 
 Container reservas-app-reservas-frontend-1 Started 
 Container reservas-app-reservas-api-1 Waiting 
 Container reservas-app-reservas-frontend-1 Waiting 
 Container reservas-app-reservas-db-1 Waiting 
 Container reservas-app-reservas-db-1 Healthy 
 Container reservas-app-reservas-api-1 Healthy 
 Container reservas-app-reservas-frontend-1 Healthy 
```

**16:21:18** — `docker compose ps`

```
NAME                               IMAGE                  COMMAND                  SERVICE             CREATED       STATUS                    PORTS
reservas-app-reservas-api-1        reservas-api:v1        "docker-entrypoint.s…"   reservas-api        4 weeks ago   Up 11 seconds (healthy)   0.0.0.0:3001->3000/tcp, [::]:3001->3000/tcp
reservas-app-reservas-db-1         mysql:8.4              "docker-entrypoint.s…"   reservas-db         4 weeks ago   Up 16 seconds (healthy)   3306/tcp, 33060/tcp
reservas-app-reservas-frontend-1   reservas-frontend:v1   "/docker-entrypoint.…"   reservas-frontend   4 weeks ago   Up 5 seconds (healthy)    0.0.0.0:3000->8080/tcp, [::]:3000->8080/tcp
```

**16:21:18** — `docker network ls --filter name=reservas-net; docker volume ls --filter name=reservas-db-data`

```
NETWORK ID     NAME           DRIVER    SCOPE
1e1412f97887   reservas-net   bridge    local
DRIVER    VOLUME NAME
local     reservas-db-data
```

**16:21:18** — `curl -s localhost:3000/api/health; echo`

```
{"status":"ok","db":"ok","version":"v1"}
```

**16:21:18** — `docker compose exec reservas-frontend sh -c "grep -n proxy_pass /etc/nginx/conf.d/default.conf"`

```
22:        # OJO: la barra final de proxy_pass es la que ELIMINA el prefijo /api.
24:        proxy_pass http://reservas-api:3000/;
35:    # nginx resuelve el upstream de proxy_pass UNA sola vez, al arrancar: si
46:    #       rewrite ^/api/(.*)$ /$1 break;   # con variable, proxy_pass NO reescribe la URI
47:    #       proxy_pass $upstream;
```

**16:21:18** — `docker inspect reservas-app-reservas-db-1 --format '{{json .Config.Healthcheck.Test}}'`

```
["CMD-SHELL","mysqladmin ping -h 127.0.0.1 -u root -p\"$MYSQL_ROOT_PASSWORD\" --silent"]
```

**16:21:30** — `curl -s localhost:3000/api/salas | head -c 200; echo`

```
[{"id":4,"nombre":"Aula Magna","capacidad":120,"ubicacion":"Edificio central"},{"id":1,"nombre":"Laboratorio 1","capacidad":24,"ubicacion":"Planta baja, ala este"},{"id":2,"nombre":"Laboratorio 2","ca
```

**16:21:30** — `docker compose down`

```
 Container reservas-app-reservas-frontend-1 Stopping 
 Container reservas-app-reservas-frontend-1 Stopped 
 Container reservas-app-reservas-frontend-1 Removing 
 Container reservas-app-reservas-frontend-1 Removed 
 Container reservas-app-reservas-api-1 Stopping 
 Container reservas-app-reservas-api-1 Stopped 
 Container reservas-app-reservas-api-1 Removing 
 Container reservas-app-reservas-api-1 Removed 
 Container reservas-app-reservas-db-1 Stopping 
 Container reservas-app-reservas-db-1 Stopped 
 Container reservas-app-reservas-db-1 Removing 
 Container reservas-app-reservas-db-1 Removed 
 Network reservas-net Removing 
 Network reservas-net Removed 
```

**16:21:35** — `docker volume ls --filter name=reservas-db-data`

```
DRIVER    VOLUME NAME
local     reservas-db-data
```

