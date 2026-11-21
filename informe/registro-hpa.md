# Registro: el autoescalador bajo carga real (release de Helm)

Ejecutado el 2026-11-21 sobre la release de Helm `reservas-app` (revisión 3). Horas locales (UTC-3). La primera corrida, de la semana 8 y sobre los manifiestos aplicados con `kubectl`, está en `salidas-semana08.md`.

## Estado previo

**16:22:23** — `helm list -n reservas-app`

```
NAME        	NAMESPACE   	REVISION	UPDATED                             	STATUS  	CHART             	APP VERSION
reservas-app	reservas-app	3       	2026-11-21 15:56:30.300929 -0300 -03	deployed	reservas-app-0.1.0	v1         
```

**16:22:24** — `kubectl get deploy reservas-api -n reservas-app -o jsonpath='{.spec.template.spec.containers[0].resources}'; echo`

```
{"limits":{"cpu":"500m","memory":"256Mi"},"requests":{"cpu":"100m","memory":"128Mi"}}
```

**16:22:24** — `kubectl get hpa -n reservas-app`

```
NAME               REFERENCE                 TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
reservas-api-hpa   Deployment/reservas-api   cpu: 1%/50%   2         6         2          16h
```

**16:22:24** — `kubectl top pods -n reservas-app`

```
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-c76rx        1m           27Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           32Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           507Mi           
reservas-frontend-5c986b9474-88zmn   0m           3Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
```

## Carga: cuatro Pods que piden GET /reservas en bucle

**16:22:27** — `for i in 1 2 3 4; do kubectl run carga-$i --image=busybox --restart=Never -n reservas-app -- /bin/sh -c "while true; do wget -q -O- http://reservas-api:3000/reservas >/dev/null; done"; done`

```
pod/carga-1 created
pod/carga-2 created
pod/carga-3 created
pod/carga-4 created
```

**16:24:30** — `kubectl get hpa -n reservas-app`

```
NAME               REFERENCE                 TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
reservas-api-hpa   Deployment/reservas-api   cpu: 117%/50%   2         6         6          16h
```

**16:24:30** — `kubectl top pods -n reservas-app`

```
NAME                                 CPU(cores)   MEMORY(bytes)   
carga-1                              168m         2Mi             
carga-2                              166m         1Mi             
carga-3                              170m         1Mi             
carga-4                              161m         1Mi             
reservas-api-76cfd9c6c6-5n5n7        98m          30Mi            
reservas-api-76cfd9c6c6-c76rx        97m          33Mi            
reservas-api-76cfd9c6c6-fcmbh        119m         31Mi            
reservas-api-76cfd9c6c6-q7hrc        95m          34Mi            
reservas-api-76cfd9c6c6-r2rrt        114m         28Mi            
reservas-api-76cfd9c6c6-rqnx2        104m         28Mi            
reservas-db-6bbb6cb6cb-ptm69         153m         509Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
```

**16:24:31** — `kubectl get pods -n reservas-app -l app=reservas-api`

```
NAME                            READY   STATUS    RESTARTS   AGE
reservas-api-76cfd9c6c6-5n5n7   1/1     Running   0          74s
reservas-api-76cfd9c6c6-c76rx   1/1     Running   0          27m
reservas-api-76cfd9c6c6-fcmbh   1/1     Running   0          59s
reservas-api-76cfd9c6c6-q7hrc   1/1     Running   0          27m
reservas-api-76cfd9c6c6-r2rrt   1/1     Running   0          59s
reservas-api-76cfd9c6c6-rqnx2   1/1     Running   0          74s
```

## Fin de la carga

**16:24:31** — `kubectl delete pod carga-1 carga-2 carga-3 carga-4 -n reservas-app --wait=false`

```
pod "carga-1" deleted from reservas-app namespace
pod "carga-2" deleted from reservas-app namespace
pod "carga-3" deleted from reservas-app namespace
pod "carga-4" deleted from reservas-app namespace
```

**16:31:11** — `kubectl get pods -n reservas-app`

```
NAME                                 READY   STATUS    RESTARTS   AGE
reservas-api-76cfd9c6c6-c76rx        1/1     Running   0          34m
reservas-api-76cfd9c6c6-q7hrc        1/1     Running   0          34m
reservas-db-6bbb6cb6cb-ptm69         1/1     Running   0          16h
reservas-frontend-5c986b9474-88zmn   1/1     Running   0          16h
reservas-frontend-5c986b9474-srkk4   1/1     Running   0          16h
```

**16:31:12** — `kubectl get hpa -n reservas-app`

```
NAME               REFERENCE                 TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
reservas-api-hpa   Deployment/reservas-api   cpu: 1%/50%   2         6         2          16h
```

## Salida completa del seguimiento

**16:22:25 a 16:30:47** — `kubectl get hpa reservas-api-hpa -n reservas-app -w` (con la hora local antepuesta a cada línea). Pods de carga creados a las 16:22:28 y eliminados a las 16:24:32.

```
16:22:25  NAME               REFERENCE                 TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
16:22:25  reservas-api-hpa   Deployment/reservas-api   cpu: 1%/50%   2         6         2          16h
16:22:31  reservas-api-hpa   Deployment/reservas-api   cpu: 1%/50%   2         6         2          16h
16:22:46  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%   2         6         2          16h
16:23:16  reservas-api-hpa   Deployment/reservas-api   cpu: 250%/50%   2         6         2          16h
16:23:31  reservas-api-hpa   Deployment/reservas-api   cpu: 324%/50%   2         6         4          16h
16:23:47  reservas-api-hpa   Deployment/reservas-api   cpu: 247%/50%   2         6         6          16h
16:24:02  reservas-api-hpa   Deployment/reservas-api   cpu: 112%/50%   2         6         6          16h
16:24:17  reservas-api-hpa   Deployment/reservas-api   cpu: 117%/50%   2         6         6          16h
16:24:32  reservas-api-hpa   Deployment/reservas-api   cpu: 104%/50%   2         6         6          16h
16:24:47  reservas-api-hpa   Deployment/reservas-api   cpu: 102%/50%   2         6         6          16h
16:25:17  reservas-api-hpa   Deployment/reservas-api   cpu: 101%/50%   2         6         6          16h
16:25:32  reservas-api-hpa   Deployment/reservas-api   cpu: 31%/50%    2         6         6          16h
16:25:47  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%     2         6         6          16h
16:27:32  reservas-api-hpa   Deployment/reservas-api   cpu: 1%/50%     2         6         6          16h
16:27:47  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%     2         6         6          16h
16:30:17  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%     2         6         6          16h
16:30:32  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%     2         6         4          16h
16:30:47  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%     2         6         2          16h
16:31:03  reservas-api-hpa   Deployment/reservas-api   cpu: 1%/50%     2         6         2          16h
```

**En paralelo, cada 30 s** — `kubectl top pods -n reservas-app`

```
--- 16:22:25
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-c76rx        1m           27Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           32Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           507Mi           
reservas-frontend-5c986b9474-88zmn   0m           3Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:22:55
NAME                                 CPU(cores)   MEMORY(bytes)   
carga-1                              207m         3Mi             
carga-2                              209m         0Mi             
carga-3                              194m         0Mi             
carga-4                              192m         0Mi             
reservas-api-76cfd9c6c6-c76rx        0m           27Mi            
reservas-api-76cfd9c6c6-q7hrc        0m           32Mi            
reservas-db-6bbb6cb6cb-ptm69         8m           503Mi           
reservas-frontend-5c986b9474-88zmn   0m           3Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:23:26
NAME                                 CPU(cores)   MEMORY(bytes)   
carga-1                              202m         3Mi             
carga-2                              200m         1Mi             
carga-3                              199m         1Mi             
carga-4                              200m         0Mi             
reservas-api-76cfd9c6c6-c76rx        328m         36Mi            
reservas-api-76cfd9c6c6-q7hrc        320m         39Mi            
reservas-db-6bbb6cb6cb-ptm69         171m         506Mi           
reservas-frontend-5c986b9474-88zmn   0m           3Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:23:57
NAME                                 CPU(cores)   MEMORY(bytes)   
carga-1                              151m         1Mi             
carga-2                              154m         1Mi             
carga-3                              158m         1Mi             
carga-4                              158m         2Mi             
reservas-api-76cfd9c6c6-5n5n7        99m          30Mi            
reservas-api-76cfd9c6c6-c76rx        136m         32Mi            
reservas-api-76cfd9c6c6-fcmbh        142m         25Mi            
reservas-api-76cfd9c6c6-q7hrc        101m         34Mi            
reservas-api-76cfd9c6c6-r2rrt        145m         26Mi            
reservas-api-76cfd9c6c6-rqnx2        199m         27Mi            
reservas-db-6bbb6cb6cb-ptm69         141m         516Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:24:27
NAME                                 CPU(cores)   MEMORY(bytes)   
carga-1                              168m         2Mi             
carga-2                              166m         1Mi             
carga-3                              170m         1Mi             
carga-4                              161m         1Mi             
reservas-api-76cfd9c6c6-5n5n7        98m          30Mi            
reservas-api-76cfd9c6c6-c76rx        97m          33Mi            
reservas-api-76cfd9c6c6-fcmbh        119m         31Mi            
reservas-api-76cfd9c6c6-q7hrc        95m          34Mi            
reservas-api-76cfd9c6c6-r2rrt        114m         28Mi            
reservas-api-76cfd9c6c6-rqnx2        104m         28Mi            
reservas-db-6bbb6cb6cb-ptm69         153m         509Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:24:58
NAME                                 CPU(cores)   MEMORY(bytes)   
carga-1                              164m         2Mi             
carga-2                              165m         1Mi             
carga-3                              169m         1Mi             
carga-4                              165m         1Mi             
reservas-api-76cfd9c6c6-5n5n7        100m         30Mi            
reservas-api-76cfd9c6c6-c76rx        106m         33Mi            
reservas-api-76cfd9c6c6-fcmbh        109m         29Mi            
reservas-api-76cfd9c6c6-q7hrc        99m          32Mi            
reservas-api-76cfd9c6c6-r2rrt        100m         28Mi            
reservas-api-76cfd9c6c6-rqnx2        102m         28Mi            
reservas-db-6bbb6cb6cb-ptm69         159m         508Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:25:28
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        4m           19Mi            
reservas-api-76cfd9c6c6-c76rx        9m           24Mi            
reservas-api-76cfd9c6c6-fcmbh        56m          29Mi            
reservas-api-76cfd9c6c6-q7hrc        52m          22Mi            
reservas-api-76cfd9c6c6-r2rrt        40m          18Mi            
reservas-api-76cfd9c6c6-rqnx2        28m          18Mi            
reservas-db-6bbb6cb6cb-ptm69         39m          506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:25:59
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        0m           20Mi            
reservas-api-76cfd9c6c6-c76rx        0m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        1m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        1m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        1m           18Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:26:29
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        1m           19Mi            
reservas-api-76cfd9c6c6-c76rx        1m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        1m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        0m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        1m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        0m           17Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:27:00
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        0m           19Mi            
reservas-api-76cfd9c6c6-c76rx        1m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        1m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        1m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        1m           17Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:27:30
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        1m           19Mi            
reservas-api-76cfd9c6c6-c76rx        1m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        1m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        1m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        1m           17Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:28:01
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        0m           19Mi            
reservas-api-76cfd9c6c6-c76rx        0m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        1m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        0m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        0m           18Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           505Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:28:31
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        0m           19Mi            
reservas-api-76cfd9c6c6-c76rx        1m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        1m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        1m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        0m           18Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:29:02
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        0m           19Mi            
reservas-api-76cfd9c6c6-c76rx        1m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        1m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        1m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        0m           18Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:29:32
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        1m           19Mi            
reservas-api-76cfd9c6c6-c76rx        1m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        1m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        1m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        0m           18Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:30:03
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        0m           19Mi            
reservas-api-76cfd9c6c6-c76rx        1m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        1m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        0m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        1m           18Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:30:33
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        1m           19Mi            
reservas-api-76cfd9c6c6-c76rx        0m           21Mi            
reservas-api-76cfd9c6c6-fcmbh        0m           18Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-r2rrt        1m           18Mi            
reservas-api-76cfd9c6c6-rqnx2        1m           18Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           506Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi             
--- 16:31:04
NAME                                 CPU(cores)   MEMORY(bytes)   
reservas-api-76cfd9c6c6-5n5n7        1m           19Mi            
reservas-api-76cfd9c6c6-c76rx        1m           21Mi            
reservas-api-76cfd9c6c6-q7hrc        1m           22Mi            
reservas-api-76cfd9c6c6-rqnx2        1m           18Mi            
reservas-db-6bbb6cb6cb-ptm69         4m           513Mi           
reservas-frontend-5c986b9474-88zmn   0m           2Mi             
reservas-frontend-5c986b9474-srkk4   0m           2Mi
```
