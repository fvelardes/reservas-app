# ARQUITECTURA — reservas-app (variante B)

Sistema de reserva de salas por franja horaria: React + Vite servido por nginx, API Node 20 + Express y MySQL 8.4. Este documento explica **por qué** el proyecto es como es. La evidencia de que funciona está en [`INFORME.md`](INFORME.md).

```
                         Ingress reservas.local (nginx-ingress, 172.16.21.227)
                                         │
navegador ──HTTP──► reservas-frontend (Service NodePort 30301 → :8080, 2 réplicas)
                    nginx: sirve la SPA y hace proxy de /api/ → http://${API_HOST}:${API_PORT}/
                                         │
                    reservas-api (Service ClusterIP :3000, 2 a 6 réplicas con HPA)
                    Node 20 + Express, sin estado
                                         │
                    reservas-db (Service ClusterIP :3306, 1 réplica, Recreate)
                    MySQL 8.4, datadir en el PVC reservas-db-pvc (subPath mysql)
```

Doce objetos: 3 Deployments, 3 Services, 2 ConfigMaps, 1 Secret, 1 PVC, 1 Ingress y 1 HPA. Están como manifiestos individuales en [`k8s/`](k8s/) y como plantillas parametrizadas en el chart [`reservas-app/`](reservas-app/).

---

## 1. Las tres preguntas obligatorias del curso

### a) ¿Por qué el frontend se configura con `API_HOST` en tiempo de ejecución y no con `VITE_API_URL` en tiempo de construcción?

**Porque una variable `VITE_*` no es una variable de entorno del contenedor: es texto que Vite pega dentro del JavaScript al compilar.** `import.meta.env.VITE_API_URL` se reemplaza literalmente por su valor durante `npm run build`, y el resultado queda congelado en los archivos de `dist/`. Cuando ese bundle llega al navegador, ya no existe ningún proceso que pueda leer una variable: el navegador ejecuta texto estático. La dirección de la API pasaría a ser parte de la imagen.

En este proyecto la SPA no conoce ninguna dirección. Todas sus llamadas van a la ruta relativa `/api` (`frontend/src/api.js`: `const BASE = "/api"`), es decir, al mismo servidor que le entregó la página. Quien resuelve a dónde va ese pedido es **nginx**, del lado del servidor:

```nginx
location /api/ {
    proxy_pass http://${API_HOST}:${API_PORT}/;
}
```

La imagen oficial de nginx procesa `/etc/nginx/templates/*.template` con `envsubst` **cada vez que arranca el contenedor**, así que `API_HOST` y `API_PORT` se leen del entorno del Pod. En Compose valen `reservas-api:3000`, en Kubernetes salen del ConfigMap `reservas-frontend-config`, y la imagen `fvelardes/reservas-frontend:v1` es **la misma** en los dos casos. `NGINX_ENVSUBST_FILTER=^API_` limita la sustitución a esas dos variables: sin el filtro, `envsubst` también vaciaría `$uri`, `$host` y el resto de las variables propias de nginx, y la configuración quedaría rota sin aviso.

**Si fuera al revés**, pasar de desarrollo a producción obligaría a:

1. **Reconstruir la imagen** con `--build-arg VITE_API_URL=https://api.produccion...` (o un `.env.production`), una vez por entorno. Desarrollo, staging y producción tendrían **imágenes distintas**.
2. Por lo tanto, **lo que se probó no sería lo que se despliega**: la imagen validada en staging no es la que corre en producción, aunque el código sea el mismo. Se rompe el principio que sostiene todo el curso desde la semana 2: un artefacto versionado e inmutable que se promueve entre entornos cambiando solo su configuración.
3. **Volver a publicar** cada variante en el registry con tags que distingan entorno además de versión (`v1-dev`, `v1-prod`), y mantener esa matriz en los manifiestos.
4. Además, como la SPA hablaría directamente con una URL absoluta de la API, esa API tendría que estar **publicada** fuera del clúster y habría que resolver **CORS** (ver la pregunta siguiente).

Cambiar de entorno, que hoy es editar un ConfigMap, pasaría a ser un ciclo completo de build, push y redeploy.

### b) ¿Por qué esta arquitectura no necesita CORS? ¿Qué habría que agregar si la SPA se comunicara directamente con la API?

**CORS es una restricción del navegador sobre pedidos entre orígenes distintos**, donde el origen es la terna esquema + host + puerto. Cuando un script cargado desde un origen hace `fetch` a otro, el navegador exige que el servidor de destino lo autorice explícitamente con encabezados `Access-Control-Allow-*`. Si no lo hace, el navegador bloquea la respuesta.

En esta arquitectura **no hay un segundo origen**. El navegador carga la página desde `http://reservas.local` y la SPA pide `http://reservas.local/api/reservas`: mismo esquema, mismo host, mismo puerto. Para el navegador es un pedido al mismo sitio, así que no hay preflight `OPTIONS` ni verificación de encabezados. El salto a la API ocurre **después**, de servidor a servidor: nginx (dentro del Pod del frontend) reenvía a `reservas-api:3000` por la red del clúster, y en ese tramo no interviene ningún navegador. CORS no se aplica entre servidores.

Esto además permite que la API **no esté publicada**: su Service es `ClusterIP`, inalcanzable desde fuera del clúster. Solo el frontend la ve. El NodePort `30501` de la semana 6 existía únicamente para depuración y no forma parte del proyecto.

**Si la SPA hablara directamente con la API** (por ejemplo `http://reservas.local` → `http://api.reservas.local`), habría que agregar:

1. **Publicar la API**: un Ingress (o NodePort/LoadBalancer) propio para `reservas-api`, con su nombre de host. La API pasaría a estar expuesta a Internet y se convertiría en superficie de ataque.
2. **Encabezados CORS en la API**: `Access-Control-Allow-Origin` con el origen exacto del frontend (no `*` si algún día hay cookies o credenciales), `Access-Control-Allow-Methods` (`GET, POST, DELETE`) y `Access-Control-Allow-Headers: Content-Type`. En Express, el middleware `cors` configurado con la lista de orígenes permitidos.
3. **Responder el preflight**: los `POST` con `Content-Type: application/json` no son "pedidos simples", así que el navegador envía primero un `OPTIONS` y solo si la respuesta autoriza hace el `POST` real. La API (o el Ingress) tiene que contestar esos `OPTIONS`.
4. **Una lista de orígenes por entorno**: el origen permitido en desarrollo (`http://localhost:3000`) no es el de producción. Esa lista pasaría a ser configuración de la API (otro valor en su ConfigMap).
5. **Que la SPA conozca la URL de la API**, lo que nos devuelve al problema de la pregunta anterior: o se hornea con `VITE_API_URL` en el build, o se agrega un mecanismo de configuración en runtime (por ejemplo un `config.js` generado al arrancar).

### c) ¿Por qué hay un solo autoescalador entre los doce objetos? ¿Qué ocurriría si se le asignara uno a `reservas-db`? ¿Y por qué tampoco lo tiene el frontend?

Un HorizontalPodAutoscaler tiene sentido sobre una carga de trabajo que cumpla **dos condiciones**: que se pueda multiplicar sin coordinación (cualquier réplica atiende cualquier pedido) y que su consumo crezca con la demanda en la métrica que se mide. De los doce objetos, nueve no son cargas de trabajo (Services, ConfigMaps, Secret, PVC, Ingress y el propio HPA) y no tienen réplicas. Quedan tres Deployments, y solo uno cumple ambas condiciones.

**`reservas-api` sí.** No guarda estado: cada pedido lee y escribe en MySQL y no depende de lo que la réplica haya hecho antes. El Service reparte los pedidos entre las réplicas sin afinidad. Y su CPU crece con la demanda, porque cada `GET /reservas` arma un `JOIN` y serializa el resultado. En la prueba de carga pasó de 1m a más de 100m por réplica y el HPA la llevó de 2 a 6 réplicas (ver `INFORME.md`, evidencia 2).

**`reservas-db` no, y asignarle un HPA rompería el sistema.** Supongamos que bajo carga el HPA sube `reservas-db` a 3 réplicas:

- **El volumen no se puede compartir.** El PVC es `ReadWriteOnce` y el Deployment usa `strategy: Recreate` justamente para que nunca haya dos MySQL sobre el mismo datadir. Con `local-path` el volumen es un directorio de un nodo. En el mejor caso las réplicas nuevas no arrancan; en un clúster donde el volumen sí se pudiera montar varias veces, **dos `mysqld` escribiendo los mismos archivos de InnoDB corromperían la base**. MySQL no está diseñado para que dos procesos independientes compartan un datadir.
- **Si cada réplica tuviera su propio volumen, serían bases distintas.** Tres MySQL independientes, sin replicación entre ellos, detrás de un mismo Service que reparte las conexiones al azar. Una reserva escrita en una réplica no existiría en las otras dos. Y lo más grave para esta variante: **cada réplica tendría su propio índice `UNIQUE (sala_id, fecha, franja)`**, así que dos pedidos que caigan en réplicas distintas podrían reservar la misma sala en la misma franja. La única garantía contra la doble reserva (pregunta 2) desaparecería.
- **Al bajar réplicas se perderían datos**: el HPA elimina Pods sin saber cuál tiene qué datos.
- Escalar una base relacional de verdad requiere **replicación** (un primario que acepta escrituras y réplicas de solo lectura), identidad estable por Pod y un volumen por Pod: un StatefulSet con un operador, o una base gestionada. No es algo que un HPA pueda hacer agregando Pods idénticos.

**`reservas-frontend` tampoco, pero por otro motivo: no tendría nada que medir.** El frontend es nginx sirviendo archivos estáticos ya compilados y reenviando `/api/` a la API. Las dos cosas son de las más baratas que hace nginx. Durante la prueba de carga, con la API al máximo, los Pods del frontend marcaron **0m a 1m** de CPU (`kubectl top pods` en `salidas-semana08.md`). El cuello de botella está en la API y en la base, nunca en el proxy. Un HPA sobre el frontend se quedaría siempre en su mínimo; dos réplicas fijas ya cubren la disponibilidad ante la caída de un Pod.

---

## 2. Pregunta de la variante B: ¿qué deja de estar garantizado al pasar de una réplica de la API a tres?

**Deja de estar garantizado que la verificación que hace el código impida la doble reserva.** `POST /reservas` (`backend/server.js`) hace dos operaciones separadas:

```js
const [tomadas] = await pool.query(
  'SELECT id FROM reservas WHERE sala_id = ? AND fecha = ? AND franja = ?', ...);
if (tomadas.length > 0) { res.status(409) ... return; }

const [resultado] = await pool.query('INSERT INTO reservas (...) VALUES (...)', ...);
```

Es el patrón **check-then-act**: primero pregunta "¿está libre?" y después actúa. Entre la respuesta del `SELECT` y la ejecución del `INSERT` hay una ventana, y nada impide que otro pedido pase por esa misma ventana. Con tres réplicas hay **tres procesos independientes**, cada uno con su propio pool de conexiones, que no comparten memoria ni se coordinan. Si tres pedidos por la misma sala, fecha y franja llegan a la vez, cada uno a una réplica distinta, **los tres pueden ejecutar el `SELECT` antes de que cualquiera haya hecho el `INSERT`, los tres leen "libre" y los tres avanzan al `INSERT`**. Ningún lock de aplicación puede evitarlo, porque un lock en memoria de Node solo existe dentro de un proceso.

Con una sola réplica el problema ya estaba latente: Node atiende pedidos concurrentes intercalándolos en cada `await`, así que dos pedidos pueden quedar suspendidos entre su `SELECT` y su `INSERT` dentro del mismo proceso. Pero con varias réplicas la carrera deja de ser un caso raro y pasa a ser lo esperable bajo concurrencia, porque los pedidos se ejecutan en paralelo de verdad, en procesos distintos y repartidos por el Service. Con el HPA, además, la cantidad de réplicas ni siquiera es fija: va de 2 a 6 según la carga.

**Lo que impide la doble reserva no está en la API: es la restricción de unicidad que aplica el motor de base de datos.**

```sql
CREATE TABLE IF NOT EXISTS reservas (
  ...
  CONSTRAINT sin_solapamiento UNIQUE (sala_id, fecha, franja)
)
```

Esa restricción la hace cumplir **MySQL**, que es un **único proceso** y verifica el índice de forma atómica al insertar. De todos los `INSERT` concurrentes con la misma terna, InnoDB deja pasar exactamente uno; los demás fallan con `ER_DUP_ENTRY`, sin importar de qué réplica vinieron ni cuántas réplicas haya. La API traduce ese error al mismo `409` que devuelve cuando el `SELECT` encuentra la franja ocupada (`traducirError` en `server.js`). Para el cliente las dos rutas son indistinguibles: algunos `409` salen del `SELECT` (pedidos que llegaron cuando la fila ya existía) y otros del `UNIQUE` (pedidos que se colaron por la ventana).

En consecuencia, el `SELECT` previo queda como una **optimización** que evita intentos de inserción condenados a fallar y da un mensaje claro en el caso común. **No es una garantía.** Si se lo quitara, la invariante se seguiría cumpliendo; si se quitara el `UNIQUE`, el `SELECT` no alcanzaría.

**La prueba** (detalle completo en `INFORME.md`, evidencia 5): 30 pedidos `POST /reservas` simultáneos por la misma sala, fecha y franja, con 3 réplicas de la API.

| Ejecución | Réplicas | Resultado HTTP | Filas en la base |
|---|---|---|---|
| Sexta entrega (NodePort de depuración) | 3 | 1 × `201`, 29 × `409` | 1 |
| Repetición sobre la release de Helm (por el Ingress) | 3 | 1 × `201`, 29 × `409` | 1 |

Exactamente una reserva creada y una fila en la tabla. `SHOW CREATE TABLE reservas` confirma que la restricción `UNIQUE KEY sin_solapamiento (sala_id, fecha, franja)` está aplicada en el motor.

**Esto explica también por qué la base se queda en una réplica:** la garantía depende de que haya **un solo** MySQL con **un solo** índice. Escalar la API es seguro precisamente porque la integridad no vive en ella.

Otras cosas que dejan de ser únicas con varias réplicas, y cómo quedan cubiertas:

- **La inicialización corre en cada réplica a la vez.** Al arrancar, cada réplica ejecuta `CREATE TABLE IF NOT EXISTS` y siembra las salas de demo. Dos réplicas sembrando en paralelo es la misma carrera; la cubre `CONSTRAINT sala_nombre_unico UNIQUE (nombre)` junto con `INSERT ... ON DUPLICATE KEY UPDATE`. Quedan exactamente 5 salas, aunque los `id` presentan huecos (1, 3, 5, 7, 9), porque cada inserción descartada consume un valor de `AUTO_INCREMENT`.
- **Las conexiones a MySQL se multiplican**: cada réplica abre su propio pool, así que el total de conexiones crece con `maxReplicas`. Con 6 réplicas sigue lejos del límite de MySQL, pero es un número que hay que vigilar si se sube el máximo del HPA.

---

## 3. Dificultades propias de MySQL durante el curso

Las dos primeras se presentaron efectivamente y quedaron registradas con sus logs. La tercera es una trampa de MySQL que se tuvo en cuenta al diseñar la comprobación de estado de Compose.

### 3.1 El `subPath` que exige el directorio de datos vacío (semana 7)

**Cómo se manifestó.** Al montar el PVC directamente en `/var/lib/mysql`, el Pod de la base alternaba entre `Error` y `CrashLoopBackOff`.

**Cómo se diagnosticó.** `kubectl logs deploy/reservas-db` mostró:

```
[Note] [Entrypoint]: Initializing database files
[ERROR] [MY-010457] [Server] --initialize specified but the data directory has files in it. Aborting.
[ERROR] [MY-013236] [Server] The designated data directory /var/lib/mysql/ is unusable.
```

El entrypoint de MySQL, al no encontrar una base inicializada, ejecuta `mysqld --initialize`, que **solo acepta un directorio completamente vacío**. La raíz del volumen tenía un archivo (en la práctica se dejó `viejo.txt` a propósito con un Pod `busybox`; en un caso real suele ser el `lost+found` que muchos sistemas de archivos crean en la raíz de cada volumen). `kubectl logs` de ese Pod auxiliar confirmó el contenido de la raíz.

**Cómo se resolvió.** Montando un subdirectorio del volumen en lugar de su raíz:

```yaml
volumeMounts:
  - name: datos
    mountPath: /var/lib/mysql
    subPath: mysql
```

El kubelet crea `mysql/` vacío dentro del volumen y MySQL solo ve ese subdirectorio. El archivo extraño sigue en la raíz, pero queda fuera de su vista. Los logs pasaron a mostrar `ready for connections ... port: 0` (servidor temporal) y luego `port: 3306` (definitivo). El `subPath` quedó tanto en `k8s/deploy-reservas-db.yaml` como en la plantilla del chart.

### 3.2 La inicialización lenta de MySQL frente a la API al instalar el chart (semana 8)

**Cómo se manifestó.** En la primera instalación con `helm install`, con un PVC nuevo y vacío, el Ingress respondió `502 Bad Gateway` durante más de un minuto y los Pods de la API aparecieron con `RESTARTS 1`.

**Cómo se diagnosticó.** `kubectl logs deploy/reservas-api` mostró los reintentos agotándose: `intento 8/15 de conexión falló: connect ECONNREFUSED 10.105.234.180:3306`. Helm crea los objetos en orden por tipo (Secret, ConfigMap, PVC, Service, Deployment, HPA, Ingress), pero crea los tres Deployments casi a la vez y **no espera** a que MySQL termine de inicializar el datadir.

**Cómo se resolvió.** No hizo falta cambiar nada: la API agotó sus 15 reintentos, terminó con error, Kubernetes la reinició, y en el segundo arranque encontró la base lista (`esquema listo en reservas-db/reservasdb`). La conclusión de diseño es que el orden de creación que da Helm no reemplaza la tolerancia a fallos de cada componente. En Compose esa espera la daba `depends_on: condition: service_healthy`; en Kubernetes no existe ese mecanismo entre Deployments, y la lleva la propia aplicación con sus reintentos más la política de reinicio. Una mejora natural sería una `readinessProbe` en la API que dependa de la conexión a la base, para que el Service no le envíe tráfico mientras no está lista.

### 3.3 El `$` en la comprobación de estado y el período de gracia inicial (semana 4)

La comprobación de estado de `reservas-db` en Compose necesita la contraseña de root, que la imagen de MySQL exige siempre (sin `MYSQL_ROOT_PASSWORD`, o una de sus alternativas explícitas, el contenedor se niega a inicializar):

```yaml
test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -u root -p\"$$MYSQL_ROOT_PASSWORD\" --silent"]
```

- **`$$` y no `$`.** Con un solo `$`, **Compose** interpola la variable al leer el archivo, buscándola en su propio entorno (el shell y `.env`). Ahí no existe `MYSQL_ROOT_PASSWORD` (en `.env` se llama `DB_ROOT_PASSWORD`), así que llegaría vacía, `mysqladmin` fallaría por autenticación, la base quedaría `unhealthy` y, por `depends_on: condition: service_healthy`, ni la API ni el frontend arrancarían. Y si existiera, la contraseña quedaría escrita en texto plano en la definición de la comprobación, visible con `docker inspect`. Con `$$`, Compose escribe un `$` literal y la variable la expande el shell **dentro del contenedor**, donde sí existe.
- **`start_period: 40s`.** La primera inicialización del datadir es lenta: MySQL crea los archivos del sistema, levanta un servidor temporal, crea la base y el usuario, lo apaga y arranca el definitivo. Sin período de gracia, los fallos de esos primeros segundos cuentan como reintentos y el contenedor se marca `unhealthy` cuando en realidad está arrancando normalmente.
- **`-h 127.0.0.1` y no `-h localhost`.** Con `localhost` el cliente se conecta por socket, y el **servidor temporal** (que no escucha TCP) respondería el ping: la comprobación declararía `healthy` antes de que existiera el usuario de la aplicación, y la API recibiría `ECONNREFUSED`. Con `127.0.0.1` la conexión es TCP y solo responde el servidor definitivo.

---

## 4. Qué quedaría pendiente para un entorno de producción real

### Observabilidad

Hoy lo único que hay son `kubectl logs`, `kubectl top` y el endpoint `/health`. Faltaría:

- **Métricas** con Prometheus y tableros en Grafana: latencia y tasa de errores por endpoint, conexiones del pool, uso de CPU y memoria por Pod, y métricas de MySQL (consultas lentas, conexiones, espacio en disco). Con alertas sobre esas métricas, no solo sobre la caída de un Pod.
- **Logs centralizados** (Loki, o el stack de ELK): cuando un Pod se reinicia, sus logs anteriores se pierden salvo `--previous`. Con el HPA creando y destruyendo réplicas, reconstruir qué pasó requiere que los logs vivan fuera de los Pods. La API debería loguear cada pedido en formato estructurado (JSON), con un identificador de pedido que nginx propague.
- **Sondas de Kubernetes**: el chart no declara `readinessProbe` ni `livenessProbe`. El `/health` de la API (que verifica la base) y el `/healthz` de nginx ya existen y se usan en Compose; faltaría declararlos en los Deployments para que el Service no envíe tráfico a un Pod que todavía no se conectó a la base (el `502` de la sección 3.2).

### Integración y despliegue continuos

Las imágenes se construyeron y publicaron a mano (`docker build`, `docker push`) y el chart se instala desde la máquina del alumno. En producción:

- Un pipeline (GitHub Actions, GitLab CI) que en cada cambio ejecute tests, construya las imágenes con el tag del commit o de la versión, las **escanee** (Trivy, como en la semana 4) y las publique solo si pasan.
- `helm lint` y `helm template` como validación del chart en el mismo pipeline.
- Despliegue declarativo con **GitOps** (Argo CD, Flux): el estado del clúster lo define el repositorio, y nadie ejecuta `helm upgrade` a mano. El `helm rollback` de la semana 8 pasa a ser un `git revert`.
- Entornos separados (desarrollo, staging, producción) que reciben **la misma imagen** con distintos valores, lo que el diseño de la pregunta 1a ya permite.

### Gestión externa de secretos

El Secret `reservas-db-secret` se entrega con **valores de laboratorio**. En el repositorio solo hay plantillas (`k8s/secret-reservas-db.example.yaml`, y valores de ejemplo en `values.yaml`); las credenciales reales del clúster del curso se pasan con un archivo de valores que no se versiona (`reservas-app/values-secret.yaml`, en `.gitignore`). Aun así:

- Un Secret de Kubernetes **no está cifrado**: está en base64, que es una codificación, no un cifrado. Cualquiera con permiso de lectura sobre Secrets en el namespace lo decodifica, y si etcd no tiene cifrado en reposo habilitado, la contraseña está en texto plano en el disco del plano de control.
- Además, Helm guarda cada revisión de la release, con los valores renderizados, en un Secret propio (`sh.helm.release.v1.reservas-app.vN`): la contraseña queda copiada en cada revisión.
- En un entorno real las credenciales vivirían en un **gestor externo** (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault) y se sincronizarían al clúster con **External Secrets Operator** o el Secrets Store CSI Driver. El chart no contendría ningún valor sensible, solo la referencia al secreto externo. Si lo que se quiere es versionar el secreto en Git, existen **Sealed Secrets** o **SOPS**, que lo guardan cifrado con una clave que solo tiene el clúster.
- Con eso se ganan **rotación** (cambiar la contraseña sin tocar el repositorio ni el chart), **auditoría** de quién leyó cada secreto y permisos finos con RBAC. Además, la API no debería conectarse con un usuario de MySQL con permisos de DDL: lo ideal es separar un usuario de migraciones de uno de aplicación con permisos mínimos.

### Copias de respaldo de la base de datos

Hoy **no hay ningún respaldo**. El PVC protege los datos ante la muerte del Pod (semana 7, consigna 6), pero no ante nada más:

- El PV lo aprovisiona `local-path`: es un directorio en el disco de **un nodo**. Si el nodo muere, los datos mueren con él.
- La política de recuperación es `Delete`: si se borra el PVC, o el namespace, los datos se borran. Ocurrió de forma deliberada al instalar el chart en la semana 8: las reservas de la semana 7 se perdieron.
- Un error humano o de la aplicación (un `DELETE` sin `WHERE`) se persiste igual que cualquier otra escritura.

Haría falta: respaldos lógicos periódicos (un CronJob con `mysqldump` o, para bases grandes, respaldos físicos con Percona XtraBackup) enviados **fuera del clúster** (almacenamiento de objetos), retención definida, binlogs para recuperar hasta un punto en el tiempo y, sobre todo, **pruebas periódicas de restauración**: un respaldo que nunca se restauró no es un respaldo comprobado. Más snapshots del volumen si la StorageClass los soporta (VolumeSnapshot de CSI).

### Por qué un Deployment con un volumen no es la solución que se usaría en un entorno serio

El Deployment de `reservas-db` funciona en el curso porque se lo restringió deliberadamente: `replicas: 1`, `strategy: Recreate` y un PVC `ReadWriteOnce`. Pero el Deployment es un controlador pensado para **Pods intercambiables**, y una base de datos es exactamente lo contrario:

- **Sin identidad estable.** Los Pods de un Deployment tienen nombres aleatorios (`reservas-db-6bbb6cb6cb-ptm69`) y no tienen un nombre DNS propio. Una base replicada necesita saber cuál Pod es el primario y cuál cada réplica, y que esa identidad sobreviva a los reinicios. Un **StatefulSet** da nombres ordinales estables (`reservas-db-0`, `reservas-db-1`) con DNS propio a través de un Service *headless*.
- **Un solo volumen para todos.** Un Deployment referencia **un** PVC compartido por todas sus réplicas, por eso solo puede tener una. Un StatefulSet usa `volumeClaimTemplates`: **un PVC por Pod**, que lo sigue aunque se reprograme en otro nodo.
- **Sin orden.** Un Deployment crea y destruye Pods en paralelo; un StatefulSet los arranca y los detiene en orden, lo que necesita un clúster de base de datos para levantar primero el primario.
- **Sin alta disponibilidad.** Con `Recreate`, cada actualización (o cada vez que el Pod muere) deja la aplicación **sin base** hasta que el Pod nuevo arranca y MySQL termina su recuperación. Con una sola réplica no hay a quién pasarle el tráfico.
- **Aun un StatefulSet no alcanza solo**: no sabe configurar la replicación de MySQL, promover una réplica cuando cae el primario ni orquestar respaldos. Eso lo hace un **operador** (MySQL Operator de Oracle, Percona Operator for MySQL, Vitess) que codifica ese conocimiento operativo. La alternativa más habitual es directamente **no correr la base en el clúster**: usar una base gestionada (Amazon RDS, Cloud SQL, Azure Database for MySQL) con replicación, respaldos automáticos, recuperación a un punto en el tiempo y conmutación por error ya resueltos. La aplicación solo cambia el valor de `DB_HOST` en el ConfigMap.

En resumen: el Deployment con PVC demuestra en el curso que los datos pueden sobrevivir al Pod. En producción la pregunta deja de ser si los datos sobreviven al Pod y pasa a ser si sobreviven al nodo, al error humano y a una actualización sin que la aplicación se caiga, y eso el Deployment no lo resuelve.
