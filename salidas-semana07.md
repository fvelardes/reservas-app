# Salidas semana 7 — TP 7 variante B (namespace reservas-app)

Registro de comandos ejecutados el 2026-11-19.

## Consigna 0 — Estado inicial

**23:06:28** — `kubectl get all,cm,secret,pvc,ingress -n reservas-app`

```
NAME                                     READY   STATUS    RESTARTS         AGE
pod/reservas-api-67bdf89db8-d9rnv        1/1     Running   14 (7d10h ago)   19d
pod/reservas-api-67bdf89db8-gtwxv        1/1     Running   15 (7d10h ago)   19d
pod/reservas-api-67bdf89db8-zk9m6        1/1     Running   15 (7d10h ago)   19d
pod/reservas-db-c46464d69-pqwt9          1/1     Running   2 (7d10h ago)    19d
pod/reservas-frontend-58fd9d9d46-4dz74   1/1     Running   25 (7d10h ago)   21d
pod/reservas-frontend-58fd9d9d46-gz2pt   1/1     Running   27 (7d10h ago)   21d

NAME                            TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
service/reservas-api            ClusterIP   10.102.62.218    <none>        3000/TCP         21d
service/reservas-api-nodeport   NodePort    10.97.208.162    <none>        3000:30501/TCP   20d
service/reservas-db             ClusterIP   10.109.153.97    <none>        3306/TCP         21d
service/reservas-frontend       NodePort    10.103.188.223   <none>        8080:30301/TCP   21d

NAME                                READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/reservas-api        3/3     3            3           21d
deployment.apps/reservas-db         1/1     1            1           21d
deployment.apps/reservas-frontend   2/2     2            2           21d

NAME                                           DESIRED   CURRENT   READY   AGE
replicaset.apps/reservas-api-58bcd7496b        0         0         0       21d
replicaset.apps/reservas-api-67bdf89db8        3         3         3       19d
replicaset.apps/reservas-api-cf78b7f4f         0         0         0       20d
replicaset.apps/reservas-db-c46464d69          1         1         1       21d
replicaset.apps/reservas-frontend-58fd9d9d46   2         2         2       21d

NAME                         DATA   AGE
configmap/kube-root-ca.crt   1      28d
```

**23:06:28** — `kubectl get pods -n kube-system`

```
NAME                                READY   STATUS    RESTARTS          AGE
coredns-559f6c778d-gqrzb            1/1     Running   5 (7d10h ago)     37d
coredns-559f6c778d-qsnv5            1/1     Running   7 (7d10h ago)     37d
etcd-fvelardes                      1/1     Running   0                 7d10h
kube-apiserver-fvelardes            1/1     Running   103 (7d10h ago)   37d
kube-controller-manager-fvelardes   1/1     Running   1 (7d10h ago)     7d10h
kube-proxy-m5hvg                    1/1     Running   4 (7d10h ago)     37d
kube-scheduler-fvelardes            1/1     Running   0                 7d10h
metrics-server-6694d85c44-rgxxt     1/1     Running   0                 6d3h
```

**23:06:28** — `kubectl get svc -n nginx-ingress nginx-ingress-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'; echo`

```
172.16.21.227
```

IP-LB = 172.16.21.227 · IP del nodo = 172.16.21.22

## Consigna 1

**23:06:41** — `kubectl apply -f k8s/cm-reservas-api.yaml -f k8s/cm-reservas-frontend.yaml -f k8s/secret-reservas-db.yaml`

```
configmap/reservas-api-config created
configmap/reservas-frontend-config created
secret/reservas-db-secret created
```

**23:06:42** — `kubectl get cm,secret -n reservas-app`

```
NAME                                 DATA   AGE
configmap/kube-root-ca.crt           1      28d
configmap/reservas-api-config        5      0s
configmap/reservas-frontend-config   2      0s

NAME                        TYPE     DATA   AGE
secret/reservas-db-secret   Opaque   3      0s
```

**23:06:42** — `kubectl describe cm reservas-api-config reservas-frontend-config -n reservas-app`

```
Name:         reservas-api-config
Namespace:    reservas-app
Labels:       <none>
Annotations:  <none>

Data
====
DB_HOST:
----
reservas-db

DB_NAME:
----
reservasdb

DB_PORT:
----
3306

PORT:
----
3000

SEED_DEMO:
----
true


BinaryData
====



Name:         reservas-frontend-config
Namespace:    reservas-app
Labels:       <none>
Annotations:  <none>

Data
====
API_HOST:
----
reservas-api

API_PORT:
----
3000


BinaryData
====
```


## Consigna 2

**23:06:42** — `kubectl describe secret reservas-db-secret -n reservas-app`

```
Name:         reservas-db-secret
Namespace:    reservas-app
Labels:       <none>
Annotations:  <none>

Type:  Opaque

Data
====
MYSQL_PASSWORD:       20 bytes
MYSQL_ROOT_PASSWORD:  21 bytes
MYSQL_USER:           13 bytes
```


## Consigna 3

**23:06:42** — `kubectl get secret reservas-db-secret -n reservas-app -o jsonpath='{.data.MYSQL_PASSWORD}' | base64 -d; echo`

```
rsv_************ (contraseña real, tapada para el repositorio)
```


## Consigna 5


### 5.a — PVC recién creado

**23:06:52** — `kubectl apply -f k8s/pvc-reservas-db.yaml`

```
persistentvolumeclaim/reservas-db-pvc created
```

**23:06:52** — `kubectl get pvc,pv -n reservas-app`

```
NAME                                    STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/reservas-db-pvc   Pending                                      local-path     <unset>                 0s
```


### 5.b — Pod preparar-volumen

**23:06:52** — `kubectl apply -f k8s/pod-preparar-volumen.yaml`

```
pod/preparar-volumen created
```

**23:07:07** — `kubectl get pod preparar-volumen -n reservas-app`

```
NAME               READY   STATUS      RESTARTS   AGE
preparar-volumen   0/1     Completed   0          16s
```

**23:07:08** — `kubectl logs preparar-volumen -n reservas-app`

```
total 12
drwxrwxrwx    2 root     root          4096 Nov 20 02:07 .
drwxr-xr-x    1 root     root          4096 Nov 20 02:07 ..
-rw-r--r--    1 root     root             7 Nov 20 02:07 viejo.txt
```

**23:07:08** — `kubectl get pvc,pv -n reservas-app`

```
NAME                                    STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/reservas-db-pvc   Bound    pvc-2da70d89-56e4-48d1-9e16-5a67f2f70d82   1Gi        RWO            local-path     <unset>                 16s

NAME                                                        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                          STORAGECLASS   VOLUMEATTRIBUTESCLASS   REASON   AGE
persistentvolume/pvc-2da70d89-56e4-48d1-9e16-5a67f2f70d82   1Gi        RWO            Delete           Bound    reservas-app/reservas-db-pvc   local-path     <unset>                          9s
```

**23:07:08** — `kubectl delete pod preparar-volumen -n reservas-app`

```
pod "preparar-volumen" deleted from reservas-app namespace
```


### 5.c — Error deliberado: base montada sin subPath

**23:07:16** — `kubectl apply -f k8s/deploy-reservas-db-sin-subpath.yaml`

```
deployment.apps/reservas-db configured
```

**23:08:31** — `kubectl get pods -n reservas-app -l app=reservas-db`

```
NAME                           READY   STATUS   RESTARTS      AGE
reservas-db-686794c888-hclp2   0/1     Error    3 (44s ago)   63s
```

**23:08:32** — `kubectl logs deploy/reservas-db -n reservas-app --tail=30`

```
2026-11-20 02:08:15+00:00 [Note] [Entrypoint]: Entrypoint script for MySQL Server 8.4.13-1.el9 started.
2026-11-20 02:08:15+00:00 [Note] [Entrypoint]: Switching to dedicated user 'mysql'
2026-11-20 02:08:15+00:00 [Note] [Entrypoint]: Entrypoint script for MySQL Server 8.4.13-1.el9 started.
2026-11-20 02:08:15+00:00 [Note] [Entrypoint]: Initializing database files
2026-11-20T02:08:15.828264Z 0 [System] [MY-015017] [Server] MySQL Server Initialization - start.
2026-11-20T02:08:15.829674Z 0 [System] [MY-013169] [Server] /usr/sbin/mysqld (mysqld 8.4.13) initializing of server in progress as process 79
2026-11-20T02:08:15.829675Z 0 [System] [MY-015150] [Server] Server version with update: '8.4.13.0'
2026-11-20T02:08:15.830811Z 0 [ERROR] [MY-010457] [Server] --initialize specified but the data directory has files in it. Aborting.
2026-11-20T02:08:15.830815Z 0 [ERROR] [MY-013236] [Server] The designated data directory /var/lib/mysql/ is unusable. You can remove all files that the server added to it.
2026-11-20T02:08:15.830859Z 0 [ERROR] [MY-010119] [Server] Aborting
2026-11-20T02:08:15.831154Z 0 [System] [MY-015018] [Server] MySQL Server Initialization - end.
```


### 5.d — Base corregida con subPath

**23:08:39** — `kubectl apply -f k8s/deploy-reservas-db.yaml`

```
deployment.apps/reservas-db configured
```

**23:08:39** — `kubectl rollout status deployment/reservas-db -n reservas-app --timeout=300s`

```
Waiting for deployment "reservas-db" rollout to finish: 0 out of 1 new replicas have been updated...
Waiting for deployment "reservas-db" rollout to finish: 0 out of 1 new replicas have been updated...
Waiting for deployment "reservas-db" rollout to finish: 0 out of 1 new replicas have been updated...
Waiting for deployment "reservas-db" rollout to finish: 0 out of 1 new replicas have been updated...
Waiting for deployment "reservas-db" rollout to finish: 0 of 1 updated replicas are available...
deployment "reservas-db" successfully rolled out
```

**23:10:09** — `kubectl logs deploy/reservas-db -n reservas-app | grep 'ready for connections'`

```
2026-11-20T02:09:49.372844Z 0 [System] [MY-011323] [Server] X Plugin ready for connections. Socket: /var/run/mysqld/mysqlx.sock
2026-11-20T02:09:49.373199Z 0 [System] [MY-010931] [Server] /usr/sbin/mysqld: ready for connections. Version: '8.4.13'  socket: '/var/run/mysqld/mysqld.sock'  port: 0  MySQL Community Server - GPL.
2026-11-20T02:10:04.802093Z 0 [System] [MY-011323] [Server] X Plugin ready for connections. Bind-address: '::' port: 33060, socket: /var/run/mysqld/mysqlx.sock
2026-11-20T02:10:04.802352Z 0 [System] [MY-010931] [Server] /usr/sbin/mysqld: ready for connections. Version: '8.4.13'  socket: '/var/run/mysqld/mysqld.sock'  port: 3306  MySQL Community Server - GPL.
```

**23:10:09** — `kubectl get pods,pvc,pv -n reservas-app`

```
NAME                                     READY   STATUS    RESTARTS         AGE
pod/reservas-api-67bdf89db8-d9rnv        1/1     Running   14 (7d10h ago)   19d
pod/reservas-api-67bdf89db8-gtwxv        1/1     Running   15 (7d10h ago)   19d
pod/reservas-api-67bdf89db8-zk9m6        1/1     Running   15 (7d10h ago)   19d
pod/reservas-db-6fc6f5bcd4-9hpbt         1/1     Running   0                90s
pod/reservas-frontend-58fd9d9d46-4dz74   1/1     Running   25 (7d10h ago)   21d
pod/reservas-frontend-58fd9d9d46-gz2pt   1/1     Running   27 (7d10h ago)   21d

NAME                                    STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/reservas-db-pvc   Bound    pvc-2da70d89-56e4-48d1-9e16-5a67f2f70d82   1Gi        RWO            local-path     <unset>                 3m18s

NAME                                                        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                          STORAGECLASS   VOLUMEATTRIBUTESCLASS   REASON   AGE
persistentvolume/pvc-2da70d89-56e4-48d1-9e16-5a67f2f70d82   1Gi        RWO            Delete           Bound    reservas-app/reservas-db-pvc   local-path     <unset>                          3m11s
```


## Consigna 4

**23:10:23** — `kubectl apply -f k8s/deploy-reservas-api.yaml -f k8s/deploy-reservas-frontend.yaml`

```
deployment.apps/reservas-api configured
deployment.apps/reservas-frontend configured
```

**23:10:23** — `kubectl rollout restart deployment/reservas-api -n reservas-app`

```
deployment.apps/reservas-api restarted
```

**23:10:24** — `kubectl rollout status deployment/reservas-api -n reservas-app --timeout=300s`

```
Waiting for deployment spec update to be observed...
Waiting for deployment spec update to be observed...
Waiting for deployment "reservas-api" rollout to finish: 0 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 0 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 0 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 0 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 1 old replicas are pending termination...
Waiting for deployment "reservas-api" rollout to finish: 1 old replicas are pending termination...
deployment "reservas-api" successfully rolled out
```

**23:10:36** — `kubectl rollout status deployment/reservas-frontend -n reservas-app --timeout=300s`

```
Waiting for deployment "reservas-frontend" rollout to finish: 1 old replicas are pending termination...
deployment "reservas-frontend" successfully rolled out
```

**23:10:36** — `kubectl get pods -n reservas-app`

```
NAME                                 READY   STATUS        RESTARTS         AGE
reservas-api-66745b4f4c-ptlpf        1/1     Running       0                12s
reservas-api-66745b4f4c-vx872        1/1     Running       0                8s
reservas-api-67bdf89db8-d9rnv        1/1     Terminating   14 (7d10h ago)   19d
reservas-api-67bdf89db8-gtwxv        1/1     Terminating   15 (7d10h ago)   19d
reservas-api-67bdf89db8-zk9m6        1/1     Terminating   15 (7d10h ago)   19d
reservas-db-6fc6f5bcd4-9hpbt         1/1     Running       0                116s
reservas-frontend-58fd9d9d46-4dz74   1/1     Terminating   25 (7d10h ago)   21d
reservas-frontend-fd4b97554-9jnvl    1/1     Running       0                12s
reservas-frontend-fd4b97554-dhtd4    1/1     Running       0                8s
```


### Verificación

**23:10:36** — `kubectl exec deploy/reservas-api -n reservas-app -- env | grep -E '^DB_(HOST|PORT|NAME|USER)='`

```
DB_HOST=reservas-db
DB_NAME=reservasdb
DB_PORT=3306
DB_USER=reservas_user
```

**23:10:37** — `kubectl exec deploy/reservas-frontend -n reservas-app -- env | grep API_`

```
API_HOST=reservas-api
API_PORT=3000
NGINX_ENVSUBST_FILTER=^API_
RESERVAS_API_NODEPORT_PORT_3000_TCP_PORT=3000
RESERVAS_API_NODEPORT_PORT_3000_TCP_ADDR=10.97.208.162
RESERVAS_API_PORT_3000_TCP_PROTO=tcp
RESERVAS_API_NODEPORT_PORT_3000_TCP=tcp://10.97.208.162:3000
RESERVAS_API_SERVICE_PORT=3000
RESERVAS_API_PORT_3000_TCP_ADDR=10.102.62.218
RESERVAS_API_NODEPORT_PORT_3000_TCP_PROTO=tcp
RESERVAS_API_PORT=tcp://10.102.62.218:3000
RESERVAS_API_NODEPORT_SERVICE_PORT=3000
RESERVAS_API_PORT_3000_TCP=tcp://10.102.62.218:3000
RESERVAS_API_PORT_3000_TCP_PORT=3000
RESERVAS_API_NODEPORT_SERVICE_HOST=10.97.208.162
RESERVAS_API_SERVICE_HOST=10.102.62.218
RESERVAS_API_NODEPORT_PORT=tcp://10.97.208.162:3000
```

**23:10:38** — `grep -n "value:" k8s/deploy-reservas-*.yaml; echo "exit=$?"`

```
exit=1
```

**23:10:38** — `curl -s http://172.16.21.22:30301/api/health; echo`

```
<html>
<head><title>502 Bad Gateway</title></head>
<body>
<center><h1>502 Bad Gateway</h1></center>
<hr><center>nginx/1.27.5</center>
</body>
</html>
```

**23:11:03** — `curl -s http://172.16.21.22:30301/api/health; echo`

```
{"status":"ok","db":"ok","version":"v1"}
```

**23:11:03** — `kubectl logs deploy/reservas-api -n reservas-app --tail=20`

```
Found 3 pods, using pod/reservas-api-67bdf89db8-d9rnv
[2026-11-12T15:54:27.932Z] esquema listo en reservas-db/reservasdb
[2026-11-12T15:54:28.490Z] datos de demo sembrados (5 salas)
[2026-11-12T15:54:28.492Z] reservas-api v1 escuchando en :3000
```

_Nota: el primer 502 fue transitorio, mientras terminaban los Pods viejos del rollout; 20 s después /api/health responde ok. El log anterior salió de un Pod viejo en Terminating; abajo, los Pods nuevos._
**23:11:10** — `kubectl get pods -n reservas-app`

```
NAME                                READY   STATUS    RESTARTS   AGE
reservas-api-66745b4f4c-ptlpf       1/1     Running   0          46s
reservas-api-66745b4f4c-vx872       1/1     Running   0          42s
reservas-db-6fc6f5bcd4-9hpbt        1/1     Running   0          2m30s
reservas-frontend-fd4b97554-9jnvl   1/1     Running   0          46s
reservas-frontend-fd4b97554-dhtd4   1/1     Running   0          42s
```

**23:11:10** — `for p in $(kubectl get pods -n reservas-app -l app=reservas-api -o name); do echo "== $p"; kubectl logs $p -n reservas-app --tail=10; done`

```
== pod/reservas-api-66745b4f4c-ptlpf
[2026-11-20T02:10:41.962Z] esquema listo en reservas-db/reservasdb
[2026-11-20T02:10:42.828Z] datos de demo sembrados (5 salas)
[2026-11-20T02:10:42.932Z] reservas-api v1 escuchando en :3000
== pod/reservas-api-66745b4f4c-vx872
[2026-11-20T02:10:42.117Z] esquema listo en reservas-db/reservasdb
[2026-11-20T02:10:42.926Z] datos de demo sembrados (5 salas)
[2026-11-20T02:10:42.930Z] reservas-api v1 escuchando en :3000
```


## Consigna 6

**23:11:14** — `curl -s http://172.16.21.22:30301/api/salas; echo`

```
[{"id":7,"nombre":"Aula Magna","capacidad":120,"ubicacion":"Edificio central"},{"id":1,"nombre":"Laboratorio 1","capacidad":24,"ubicacion":"Planta baja, ala este"},{"id":3,"nombre":"Laboratorio 2","capacidad":24,"ubicacion":"Planta baja, ala oeste"},{"id":5,"nombre":"Laboratorio de Redes","capacidad":16,"ubicacion":"Primer piso"},{"id":9,"nombre":"Sala de Reuniones","capacidad":10,"ubicacion":"Primer piso"}]
```

**23:11:14** — `curl -s http://172.16.21.22:30301/api/franjas; echo`

```
[{"numero":1,"desde":"08:00","hasta":"10:00"},{"numero":2,"desde":"10:00","hasta":"12:00"},{"numero":3,"desde":"12:00","hasta":"14:00"},{"numero":4,"desde":"14:00","hasta":"16:00"},{"numero":5,"desde":"16:00","hasta":"18:00"},{"numero":6,"desde":"18:00","hasta":"20:00"}]
```

**23:11:22** — `curl -s -X POST http://172.16.21.22:30301/api/reservas -H 'Content-Type: application/json' -d '{"sala_id":1,"fecha":"2026-12-15","franja":2,"responsable":"Facundo (prueba persistencia TP7)","motivo":"semana 7"}'; echo`

```
{"id":7,"sala_id":1,"sala":"Laboratorio 1","fecha":"2026-12-15","franja":2,"responsable":"Facundo (prueba persistencia TP7)","motivo":"semana 7","creada_en":"2026-11-20 02:11:22"}
```

**23:11:22** — `curl -s http://172.16.21.22:30301/api/reservas; echo`

```
[{"id":1,"sala_id":1,"sala":"Laboratorio 1","fecha":"2026-11-20","franja":2,"responsable":"Cátedra de Sistemas Operativos","motivo":"Práctica de procesos","creada_en":"2026-11-20 02:10:42"},{"id":3,"sala_id":5,"sala":"Laboratorio de Redes","fecha":"2026-11-20","franja":4,"responsable":"Cátedra de Redes","motivo":"Laboratorio de routing","creada_en":"2026-11-20 02:10:42"},{"id":5,"sala_id":7,"sala":"Aula Magna","fecha":"2026-11-20","franja":5,"responsable":"Secretaría Académica","motivo":"Charla de egresados","creada_en":"2026-11-20 02:10:42"},{"id":7,"sala_id":1,"sala":"Laboratorio 1","fecha":"2026-12-15","franja":2,"responsable":"Facundo (prueba persistencia TP7)","motivo":"semana 7","creada_en":"2026-11-20 02:11:22"}]
```

**23:11:22** — `kubectl get pods -n reservas-app -l app=reservas-db -o wide`

```
NAME                           READY   STATUS    RESTARTS   AGE     IP            NODE        NOMINATED NODE   READINESS GATES
reservas-db-6fc6f5bcd4-9hpbt   1/1     Running   0          2m42s   10.244.0.89   fvelardes   <none>           <none>
```

**23:11:22** — `kubectl delete pod -l app=reservas-db -n reservas-app`

```
pod "reservas-db-6fc6f5bcd4-9hpbt" deleted from reservas-app namespace
```

**23:11:43** — `timeout 60 kubectl get pods -n reservas-app -w`

```
(eval):1: command not found: timeout
```

**23:11:53** — `kubectl logs deploy/reservas-db -n reservas-app | grep 'ready for connections'`

```
2026-11-20T02:11:49.384038Z 0 [System] [MY-011323] [Server] X Plugin ready for connections. Bind-address: '::' port: 33060, socket: /var/run/mysqld/mysqlx.sock
2026-11-20T02:11:49.384051Z 0 [System] [MY-010931] [Server] /usr/sbin/mysqld: ready for connections. Version: '8.4.13'  socket: '/var/run/mysqld/mysqld.sock'  port: 3306  MySQL Community Server - GPL.
```

**23:11:53** — `kubectl get pods -n reservas-app -l app=reservas-db -o wide`

```
NAME                           READY   STATUS    RESTARTS   AGE   IP            NODE        NOMINATED NODE   READINESS GATES
reservas-db-6fc6f5bcd4-f85v6   1/1     Running   0          31s   10.244.0.94   fvelardes   <none>           <none>
```

**23:11:53** — `curl -s http://172.16.21.22:30301/api/reservas; echo`

```
[{"id":1,"sala_id":1,"sala":"Laboratorio 1","fecha":"2026-11-20","franja":2,"responsable":"Cátedra de Sistemas Operativos","motivo":"Práctica de procesos","creada_en":"2026-11-20 02:10:42"},{"id":3,"sala_id":5,"sala":"Laboratorio de Redes","fecha":"2026-11-20","franja":4,"responsable":"Cátedra de Redes","motivo":"Laboratorio de routing","creada_en":"2026-11-20 02:10:42"},{"id":5,"sala_id":7,"sala":"Aula Magna","fecha":"2026-11-20","franja":5,"responsable":"Secretaría Académica","motivo":"Charla de egresados","creada_en":"2026-11-20 02:10:42"},{"id":7,"sala_id":1,"sala":"Laboratorio 1","fecha":"2026-12-15","franja":2,"responsable":"Facundo (prueba persistencia TP7)","motivo":"semana 7","creada_en":"2026-11-20 02:11:22"}]
```

**23:11:53** — `curl -s http://172.16.21.22:30301/api/health; echo`

```
{"status":"ok","db":"ok","version":"v1"}
```

_Nota: macOS no trae `timeout`, así que el watch de arriba no corrió. La persistencia ya quedó demostrada; repito el borrado del Pod de la base con un watch de 60 s hecho con un kill en segundo plano._

### 6 — Segunda corrida del borrado, con watch

**23:12:03** — `kubectl delete pod -l app=reservas-db -n reservas-app --wait=false; ( kubectl get pods -n reservas-app -w & W=$!; sleep 60; kill $W )`

```
pod "reservas-db-6fc6f5bcd4-f85v6" deleted from reservas-app namespace
NAME                                READY   STATUS        RESTARTS   AGE
reservas-api-66745b4f4c-ptlpf       1/1     Running       0          99s
reservas-api-66745b4f4c-vx872       1/1     Running       0          95s
reservas-db-6fc6f5bcd4-f85v6        1/1     Terminating   0          41s
reservas-db-6fc6f5bcd4-rq8st        0/1     Pending       0          0s
reservas-frontend-fd4b97554-9jnvl   1/1     Running       0          99s
reservas-frontend-fd4b97554-dhtd4   1/1     Running       0          95s
reservas-db-6fc6f5bcd4-rq8st        0/1     ContainerCreating   0          0s
reservas-db-6fc6f5bcd4-rq8st        0/1     ContainerCreating   0          1s
reservas-db-6fc6f5bcd4-rq8st        1/1     Running             0          2s
reservas-db-6fc6f5bcd4-f85v6        0/1     Completed           0          47s
reservas-db-6fc6f5bcd4-f85v6        0/1     Completed           0          48s
reservas-db-6fc6f5bcd4-f85v6        0/1     Completed           0          48s
```

**23:13:03** — `kubectl logs deploy/reservas-db -n reservas-app | grep 'ready for connections'`

```
2026-11-20T02:12:16.933866Z 0 [System] [MY-011323] [Server] X Plugin ready for connections. Bind-address: '::' port: 33060, socket: /var/run/mysqld/mysqlx.sock
2026-11-20T02:12:16.933910Z 0 [System] [MY-010931] [Server] /usr/sbin/mysqld: ready for connections. Version: '8.4.13'  socket: '/var/run/mysqld/mysqld.sock'  port: 3306  MySQL Community Server - GPL.
```

**23:13:03** — `kubectl get pods -n reservas-app -l app=reservas-db -o wide`

```
NAME                           READY   STATUS    RESTARTS   AGE   IP            NODE        NOMINATED NODE   READINESS GATES
reservas-db-6fc6f5bcd4-rq8st   1/1     Running   0          60s   10.244.0.95   fvelardes   <none>           <none>
```

**23:13:03** — `curl -s http://172.16.21.22:30301/api/reservas; echo`

```
[{"id":1,"sala_id":1,"sala":"Laboratorio 1","fecha":"2026-11-20","franja":2,"responsable":"Cátedra de Sistemas Operativos","motivo":"Práctica de procesos","creada_en":"2026-11-20 02:10:42"},{"id":3,"sala_id":5,"sala":"Laboratorio de Redes","fecha":"2026-11-20","franja":4,"responsable":"Cátedra de Redes","motivo":"Laboratorio de routing","creada_en":"2026-11-20 02:10:42"},{"id":5,"sala_id":7,"sala":"Aula Magna","fecha":"2026-11-20","franja":5,"responsable":"Secretaría Académica","motivo":"Charla de egresados","creada_en":"2026-11-20 02:10:42"},{"id":7,"sala_id":1,"sala":"Laboratorio 1","fecha":"2026-12-15","franja":2,"responsable":"Facundo (prueba persistencia TP7)","motivo":"semana 7","creada_en":"2026-11-20 02:11:22"}]
```

**23:13:03** — `curl -s http://172.16.21.22:30301/api/health; echo`

```
{"status":"ok","db":"ok","version":"v1"}
```


## Consigna 7

**23:13:14** — `kubectl apply -f k8s/ingress-reservas-app.yaml`

```
ingress.networking.k8s.io/reservas-app-ingress created
```

**23:13:20** — `kubectl get ingress -n reservas-app`

```
NAME                   CLASS   HOSTS            ADDRESS         PORTS   AGE
reservas-app-ingress   nginx   reservas.local   172.16.21.227   80      5s
```

**23:13:20** — `kubectl describe ingress reservas-app-ingress -n reservas-app`

```
Name:             reservas-app-ingress
Labels:           <none>
Namespace:        reservas-app
Address:          172.16.21.227
Ingress Class:    nginx
Default backend:  <default>
Rules:
  Host            Path  Backends
  ----            ----  --------
  reservas.local  
                  /   reservas-frontend:8080 (10.244.0.90:8080,10.244.0.92:8080)
Annotations:      <none>
Events:
  Type    Reason          Age   From                      Message
  ----    ------          ----  ----                      -------
  Normal  AddedOrUpdated  5s    nginx-ingress-controller  Configuration for reservas-app/reservas-app-ingress was added or updated
```

**23:13:20** — `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' --resolve reservas.local:80:172.16.21.227 http://reservas.local/api/reservas`

```
200 application/json; charset=utf-8
```

**23:13:20** — `curl -s --resolve reservas.local:80:172.16.21.227 http://reservas.local/api/reservas | head -c 600; echo`

```
[{"id":1,"sala_id":1,"sala":"Laboratorio 1","fecha":"2026-11-20","franja":2,"responsable":"Cátedra de Sistemas Operativos","motivo":"Práctica de procesos","creada_en":"2026-11-20 02:10:42"},{"id":3,"sala_id":5,"sala":"Laboratorio de Redes","fecha":"2026-11-20","franja":4,"responsable":"Cátedra de Redes","motivo":"Laboratorio de routing","creada_en":"2026-11-20 02:10:42"},{"id":5,"sala_id":7,"sala":"Aula Magna","fecha":"2026-11-20","franja":5,"responsable":"Secretaría Académica","motivo":"Charla de egresados","creada_en":"2026-11-20 02:10:42"},{"id":7,"sala_id":1,"sala":"Laboratorio 1","fe
```

**23:13:20** — `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' --resolve reservas.local:80:172.16.21.227 http://reservas.local/reservas`

```
200 text/html
```

**23:13:20** — `curl -s --resolve reservas.local:80:172.16.21.227 http://reservas.local/reservas | head -15`

```
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>reservas-app</title>
    <script type="module" crossorigin src="/assets/index-CmBwZinU.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-DNR_emin.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

**23:13:20** — `curl -s -o /dev/null -w '%{http_code}\n' http://172.16.21.227/api/reservas`

```
404
```


## Estado final

**23:13:25** — `kubectl get all,cm,secret,pvc,ingress -n reservas-app`

```
NAME                                    READY   STATUS    RESTARTS   AGE
pod/reservas-api-66745b4f4c-ptlpf       1/1     Running   0          3m2s
pod/reservas-api-66745b4f4c-vx872       1/1     Running   0          2m58s
pod/reservas-db-6fc6f5bcd4-rq8st        1/1     Running   0          83s
pod/reservas-frontend-fd4b97554-9jnvl   1/1     Running   0          3m2s
pod/reservas-frontend-fd4b97554-dhtd4   1/1     Running   0          2m58s

NAME                            TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
service/reservas-api            ClusterIP   10.102.62.218    <none>        3000/TCP         21d
service/reservas-api-nodeport   NodePort    10.97.208.162    <none>        3000:30501/TCP   20d
service/reservas-db             ClusterIP   10.109.153.97    <none>        3306/TCP         21d
service/reservas-frontend       NodePort    10.103.188.223   <none>        8080:30301/TCP   21d

NAME                                READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/reservas-api        2/2     2            2           21d
deployment.apps/reservas-db         1/1     1            1           21d
deployment.apps/reservas-frontend   2/2     2            2           21d

NAME                                           DESIRED   CURRENT   READY   AGE
replicaset.apps/reservas-api-5747c98444        0         0         0       3m2s
replicaset.apps/reservas-api-58bcd7496b        0         0         0       21d
replicaset.apps/reservas-api-66745b4f4c        2         2         2       3m2s
replicaset.apps/reservas-api-67bdf89db8        0         0         0       19d
replicaset.apps/reservas-api-cf78b7f4f         0         0         0       20d
replicaset.apps/reservas-db-686794c888         0         0         0       5m57s
replicaset.apps/reservas-db-6fc6f5bcd4         1         1         1       4m46s
replicaset.apps/reservas-db-c46464d69          0         0         0       21d
replicaset.apps/reservas-frontend-58fd9d9d46   0         0         0       21d
replicaset.apps/reservas-frontend-fd4b97554    2         2         2       3m2s

NAME                                 DATA   AGE
configmap/kube-root-ca.crt           1      28d
configmap/reservas-api-config        5      6m44s
configmap/reservas-frontend-config   2      6m44s

NAME                        TYPE     DATA   AGE
secret/reservas-db-secret   Opaque   3      6m44s

NAME                                    STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/reservas-db-pvc   Bound    pvc-2da70d89-56e4-48d1-9e16-5a67f2f70d82   1Gi        RWO            local-path     <unset>                 6m34s

NAME                                             CLASS   HOSTS            ADDRESS         PORTS   AGE
ingress.networking.k8s.io/reservas-app-ingress   nginx   reservas.local   172.16.21.227   80      11s
```

**23:13:26** — `kubectl get pv`

```
NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                          STORAGECLASS   VOLUMEATTRIBUTESCLASS   REASON   AGE
pvc-2da70d89-56e4-48d1-9e16-5a67f2f70d82   1Gi        RWO            Delete           Bound    reservas-app/reservas-db-pvc   local-path     <unset>                          6m27s
```

