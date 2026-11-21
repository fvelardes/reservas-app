# Salidas semana 8 — TP 8 variante B (namespace reservas-app)

Registro de comandos ejecutados el 2026-11-20 (consignas 0 a 6) y el 2026-11-21 (consigna 7). Las horas son locales (UTC-3).

## Consigna 0 — Estado inicial

**23:42:54** — `kubectl get all,cm,secret,pvc,ingress,hpa -n reservas-app`

```
NAME                                    READY   STATUS    RESTARTS   AGE
pod/reservas-api-66745b4f4c-ptlpf       1/1     Running   0          24h
pod/reservas-api-66745b4f4c-vx872       1/1     Running   0          24h
pod/reservas-db-6fc6f5bcd4-rq8st        1/1     Running   0          24h
pod/reservas-frontend-fd4b97554-9jnvl   1/1     Running   0          24h
pod/reservas-frontend-fd4b97554-dhtd4   1/1     Running   0          24h

NAME                            TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
service/reservas-api            ClusterIP   10.102.62.218    <none>        3000/TCP         22d
service/reservas-api-nodeport   NodePort    10.97.208.162    <none>        3000:30501/TCP   22d
service/reservas-db             ClusterIP   10.109.153.97    <none>        3306/TCP         22d
service/reservas-frontend       NodePort    10.103.188.223   <none>        8080:30301/TCP   22d

NAME                                READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/reservas-api        2/2     2            2           22d
deployment.apps/reservas-db         1/1     1            1           22d
deployment.apps/reservas-frontend   2/2     2            2           22d

NAME                                           DESIRED   CURRENT   READY   AGE
replicaset.apps/reservas-api-5747c98444        0         0         0       24h
replicaset.apps/reservas-api-58bcd7496b        0         0         0       22d
replicaset.apps/reservas-api-66745b4f4c        2         2         2       24h
replicaset.apps/reservas-api-67bdf89db8        0         0         0       20d
replicaset.apps/reservas-api-cf78b7f4f         0         0         0       21d
replicaset.apps/reservas-db-686794c888         0         0         0       24h
replicaset.apps/reservas-db-6fc6f5bcd4         1         1         1       24h
replicaset.apps/reservas-db-c46464d69          0         0         0       22d
replicaset.apps/reservas-frontend-58fd9d9d46   0         0         0       22d
replicaset.apps/reservas-frontend-fd4b97554    2         2         2       24h

NAME                                 DATA   AGE
configmap/kube-root-ca.crt           1      29d
configmap/reservas-api-config        5      24h
configmap/reservas-frontend-config   2      24h

NAME                        TYPE     DATA   AGE
secret/reservas-db-secret   Opaque   3      24h

NAME                                    STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/reservas-db-pvc   Bound    pvc-2da70d89-56e4-48d1-9e16-5a67f2f70d82   1Gi        RWO            local-path     <unset>                 24h

NAME                                             CLASS   HOSTS            ADDRESS         PORTS   AGE
ingress.networking.k8s.io/reservas-app-ingress   nginx   reservas.local   172.16.21.227   80      24h
```

**23:42:55** — `kubectl get deploy metrics-server -n kube-system`

```
NAME             READY   UP-TO-DATE   AVAILABLE   AGE
metrics-server   1/1     1            1           7d4h
```

**23:42:55** — `kubectl top pods -n reservas-app`

```
NAME                                CPU(cores)   MEMORY(bytes)   
reservas-api-66745b4f4c-ptlpf       1m           28Mi            
reservas-api-66745b4f4c-vx872       1m           26Mi            
reservas-db-6fc6f5bcd4-rq8st        4m           477Mi           
reservas-frontend-fd4b97554-9jnvl   1m           2Mi             
reservas-frontend-fd4b97554-dhtd4   0m           4Mi             
```

**23:42:55** — `kubectl get hpa -n reservas-app`

```
No resources found in reservas-app namespace.
```

**23:42:55** — `helm version`

```
version.BuildInfo{Version:"v4.3.2", GitCommit:"8346aaa55e7161f7c547212d0a87f01367976727", GitTreeState:"dirty", GoVersion:"go1.27.4", KubeClientVersion:"v1.37"}
```

## Consigna 1 — resources.requests en reservas-api

**23:43:05** — `kubectl apply -f k8s/deploy-reservas-api.yaml`

```
deployment.apps/reservas-api configured
```

**23:43:06** — `kubectl rollout status deployment/reservas-api -n reservas-app --timeout=120s`

```
Waiting for deployment spec update to be observed...
Waiting for deployment spec update to be observed...
Waiting for deployment "reservas-api" rollout to finish: 0 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "reservas-api" rollout to finish: 1 old replicas are pending termination...
Waiting for deployment "reservas-api" rollout to finish: 1 old replicas are pending termination...
deployment "reservas-api" successfully rolled out
```

**23:43:39** — `kubectl get deploy reservas-api -n reservas-app -o jsonpath='{.spec.template.spec.containers[0].resources}'; echo`

```
{"limits":{"cpu":"500m","memory":"256Mi"},"requests":{"cpu":"100m","memory":"128Mi"}}
```

## Consigna 2 — reservas-api-hpa

**23:43:39** — `kubectl apply -f k8s/hpa-reservas-api.yaml`

```
horizontalpodautoscaler.autoscaling/reservas-api-hpa created
```

**23:44:34** — `kubectl get hpa -n reservas-app`

```
NAME               REFERENCE                 TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
reservas-api-hpa   Deployment/reservas-api   cpu: 1%/50%   2         6         2          56s
```

## Consigna 3 — Carga real

**23:44:35** — `for i in 1 2 3 4; do kubectl run carga-$i --image=busybox --restart=Never -n reservas-app -- /bin/sh -c "while true; do wget -q -O- http://reservas-api:3000/reservas >/dev/null; done"; done`

```
pod/carga-1 created
pod/carga-2 created
pod/carga-3 created
pod/carga-4 created
```

**23:46:14** — `kubectl get pods -n reservas-app -l run`

```
NAME      READY   STATUS    RESTARTS   AGE
carga-1   1/1     Running   0          99s
carga-2   1/1     Running   0          99s
carga-3   1/1     Running   0          99s
carga-4   1/1     Running   0          99s
```

**23:46:14** — `kubectl top pods -n reservas-app`

```
NAME                                CPU(cores)   MEMORY(bytes)   
carga-1                             171m         1Mi             
carga-2                             142m         1Mi             
carga-3                             142m         3Mi             
carga-4                             165m         1Mi             
reservas-api-745b9ff5c-4kbx6        143m         30Mi            
reservas-api-745b9ff5c-929nb        107m         28Mi            
reservas-api-745b9ff5c-chl9m        110m         30Mi            
reservas-api-745b9ff5c-hn8sr        138m         27Mi            
reservas-api-745b9ff5c-jkwfx        104m         28Mi            
reservas-api-745b9ff5c-nc8nq        107m         30Mi            
reservas-db-6fc6f5bcd4-rq8st        161m         500Mi           
reservas-frontend-fd4b97554-9jnvl   0m           2Mi             
reservas-frontend-fd4b97554-dhtd4   0m           2Mi             
```

**23:46:14** — `kubectl get hpa -n reservas-app`

```
NAME               REFERENCE                 TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
reservas-api-hpa   Deployment/reservas-api   cpu: 118%/50%   2         6         6          2m35s
```

**23:46:14** — `kubectl get pods -n reservas-app -l app=reservas-api -o wide`

```
NAME                           READY   STATUS    RESTARTS   AGE     IP             NODE        NOMINATED NODE   READINESS GATES
reservas-api-745b9ff5c-4kbx6   1/1     Running   0          48s     10.244.0.105   fvelardes   <none>           <none>
reservas-api-745b9ff5c-929nb   1/1     Running   0          63s     10.244.0.102   fvelardes   <none>           <none>
reservas-api-745b9ff5c-chl9m   1/1     Running   0          2m56s   10.244.0.97    fvelardes   <none>           <none>
reservas-api-745b9ff5c-hn8sr   1/1     Running   0          48s     10.244.0.104   fvelardes   <none>           <none>
reservas-api-745b9ff5c-jkwfx   1/1     Running   0          3m8s    10.244.0.96    fvelardes   <none>           <none>
reservas-api-745b9ff5c-nc8nq   1/1     Running   0          63s     10.244.0.103   fvelardes   <none>           <none>
```

**23:46:14** — `kubectl delete pod carga-1 carga-2 carga-3 carga-4 -n reservas-app --wait=false`

```
pod "carga-1" deleted from reservas-app namespace
pod "carga-2" deleted from reservas-app namespace
pod "carga-3" deleted from reservas-app namespace
pod "carga-4" deleted from reservas-app namespace
```

**23:44:43 a 23:52:27** — `kubectl get hpa reservas-api-hpa -n reservas-app -w` (con hora local antepuesta a cada línea; los Pods de carga se crearon a las 23:44:35 y se eliminaron a las 23:46:14)

```
23:44:43  NAME               REFERENCE                 TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
23:44:43  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%   2         6         2          64s
23:44:55  reservas-api-hpa   Deployment/reservas-api   cpu: 9%/50%   2         6         2          77s
23:45:11  reservas-api-hpa   Deployment/reservas-api   cpu: 349%/50%   2         6         2          92s
23:45:26  reservas-api-hpa   Deployment/reservas-api   cpu: 300%/50%   2         6         4          107s
23:45:41  reservas-api-hpa   Deployment/reservas-api   cpu: 167%/50%   2         6         6          2m2s
23:45:56  reservas-api-hpa   Deployment/reservas-api   cpu: 105%/50%   2         6         6          2m17s
23:46:11  reservas-api-hpa   Deployment/reservas-api   cpu: 118%/50%   2         6         6          2m33s
23:46:26  reservas-api-hpa   Deployment/reservas-api   cpu: 114%/50%   2         6         6          2m48s
23:46:42  reservas-api-hpa   Deployment/reservas-api   cpu: 107%/50%   2         6         6          3m3s
23:46:57  reservas-api-hpa   Deployment/reservas-api   cpu: 101%/50%   2         6         6          3m18s
23:47:12  reservas-api-hpa   Deployment/reservas-api   cpu: 20%/50%    2         6         6          3m33s
23:47:27  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%     2         6         6          3m48s
23:51:57  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%     2         6         6          8m18s
23:52:12  reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%     2         6         3          8m33s
23:52:27  reservas-api-hpa   Deployment/reservas-api   cpu: 1%/50%     2         6         2          8m48s
```

**En paralelo** — `kubectl top pods -n reservas-app -l app=reservas-api` cada 30 s

```
--- 23:44:42
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-chl9m   0m           18Mi            
reservas-api-745b9ff5c-jkwfx   0m           23Mi            
--- 23:45:13
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-chl9m   358m         42Mi            
reservas-api-745b9ff5c-jkwfx   340m         35Mi            
--- 23:45:43
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-929nb   197m         27Mi            
reservas-api-745b9ff5c-chl9m   152m         29Mi            
reservas-api-745b9ff5c-jkwfx   148m         31Mi            
reservas-api-745b9ff5c-nc8nq   202m         28Mi            
--- 23:46:13
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   143m         30Mi            
reservas-api-745b9ff5c-929nb   107m         28Mi            
reservas-api-745b9ff5c-chl9m   110m         30Mi            
reservas-api-745b9ff5c-hn8sr   138m         27Mi            
reservas-api-745b9ff5c-jkwfx   104m         28Mi            
reservas-api-745b9ff5c-nc8nq   107m         30Mi            
--- 23:46:43
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   108m         29Mi            
reservas-api-745b9ff5c-929nb   107m         30Mi            
reservas-api-745b9ff5c-chl9m   107m         28Mi            
reservas-api-745b9ff5c-hn8sr   109m         29Mi            
reservas-api-745b9ff5c-jkwfx   109m         29Mi            
reservas-api-745b9ff5c-nc8nq   106m         29Mi            
--- 23:47:13
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   35m          17Mi            
reservas-api-745b9ff5c-929nb   4m           18Mi            
reservas-api-745b9ff5c-chl9m   39m          18Mi            
reservas-api-745b9ff5c-hn8sr   14m          18Mi            
reservas-api-745b9ff5c-jkwfx   4m           18Mi            
reservas-api-745b9ff5c-nc8nq   29m          18Mi            
--- 23:47:43
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   1m           24Mi            
reservas-api-745b9ff5c-929nb   1m           18Mi            
reservas-api-745b9ff5c-chl9m   1m           18Mi            
reservas-api-745b9ff5c-hn8sr   0m           17Mi            
reservas-api-745b9ff5c-jkwfx   0m           18Mi            
reservas-api-745b9ff5c-nc8nq   1m           18Mi            
--- 23:48:14
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   1m           19Mi            
reservas-api-745b9ff5c-929nb   1m           18Mi            
reservas-api-745b9ff5c-chl9m   1m           18Mi            
reservas-api-745b9ff5c-hn8sr   1m           17Mi            
reservas-api-745b9ff5c-jkwfx   0m           18Mi            
reservas-api-745b9ff5c-nc8nq   0m           18Mi            
--- 23:48:44
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   0m           17Mi            
reservas-api-745b9ff5c-929nb   1m           18Mi            
reservas-api-745b9ff5c-chl9m   1m           18Mi            
reservas-api-745b9ff5c-hn8sr   1m           17Mi            
reservas-api-745b9ff5c-jkwfx   1m           18Mi            
reservas-api-745b9ff5c-nc8nq   1m           18Mi            
--- 23:49:14
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   0m           17Mi            
reservas-api-745b9ff5c-929nb   1m           18Mi            
reservas-api-745b9ff5c-chl9m   1m           18Mi            
reservas-api-745b9ff5c-hn8sr   1m           17Mi            
reservas-api-745b9ff5c-jkwfx   1m           18Mi            
reservas-api-745b9ff5c-nc8nq   0m           18Mi            
--- 23:49:44
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   1m           17Mi            
reservas-api-745b9ff5c-929nb   0m           18Mi            
reservas-api-745b9ff5c-chl9m   1m           18Mi            
reservas-api-745b9ff5c-hn8sr   0m           17Mi            
reservas-api-745b9ff5c-jkwfx   1m           18Mi            
reservas-api-745b9ff5c-nc8nq   1m           18Mi            
--- 23:50:14
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   0m           17Mi            
reservas-api-745b9ff5c-929nb   0m           18Mi            
reservas-api-745b9ff5c-chl9m   1m           18Mi            
reservas-api-745b9ff5c-hn8sr   0m           17Mi            
reservas-api-745b9ff5c-jkwfx   0m           18Mi            
reservas-api-745b9ff5c-nc8nq   1m           18Mi            
--- 23:50:44
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   0m           18Mi            
reservas-api-745b9ff5c-929nb   1m           18Mi            
reservas-api-745b9ff5c-chl9m   0m           18Mi            
reservas-api-745b9ff5c-hn8sr   0m           17Mi            
reservas-api-745b9ff5c-jkwfx   1m           18Mi            
reservas-api-745b9ff5c-nc8nq   1m           18Mi            
--- 23:51:14
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   0m           18Mi            
reservas-api-745b9ff5c-929nb   1m           18Mi            
reservas-api-745b9ff5c-chl9m   1m           18Mi            
reservas-api-745b9ff5c-hn8sr   0m           17Mi            
reservas-api-745b9ff5c-jkwfx   0m           18Mi            
reservas-api-745b9ff5c-nc8nq   1m           18Mi            
--- 23:51:44
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   0m           18Mi            
reservas-api-745b9ff5c-929nb   1m           18Mi            
reservas-api-745b9ff5c-chl9m   1m           18Mi            
reservas-api-745b9ff5c-hn8sr   0m           17Mi            
reservas-api-745b9ff5c-jkwfx   0m           18Mi            
reservas-api-745b9ff5c-nc8nq   1m           18Mi            
--- 23:52:15
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-4kbx6   1m           18Mi            
reservas-api-745b9ff5c-929nb   1m           18Mi            
reservas-api-745b9ff5c-chl9m   0m           18Mi            
reservas-api-745b9ff5c-hn8sr   1m           17Mi            
reservas-api-745b9ff5c-jkwfx   1m           18Mi            
reservas-api-745b9ff5c-nc8nq   1m           18Mi            
--- 23:52:45
NAME                           CPU(cores)   MEMORY(bytes)   
reservas-api-745b9ff5c-929nb   1m           18Mi            
reservas-api-745b9ff5c-nc8nq   1m           18Mi
```

## Consignas 4, 5 y 6 — Chart de Helm, parametrización y renderizado

**23:46:26** — `find reservas-app -type f | sort`

```
reservas-app/.helmignore
reservas-app/Chart.yaml
reservas-app/templates/_helpers.tpl
reservas-app/templates/configmap-api.yaml
reservas-app/templates/configmap-frontend.yaml
reservas-app/templates/deployment-api.yaml
reservas-app/templates/deployment-db.yaml
reservas-app/templates/deployment-frontend.yaml
reservas-app/templates/hpa-api.yaml
reservas-app/templates/ingress.yaml
reservas-app/templates/pvc-db.yaml
reservas-app/templates/secret-db.yaml
reservas-app/templates/service-api.yaml
reservas-app/templates/service-db.yaml
reservas-app/templates/service-frontend.yaml
reservas-app/values.yaml
```

**23:46:26** — `helm lint reservas-app`

```
==> Linting reservas-app
[INFO] Chart.yaml: icon is recommended

1 chart(s) linted, 0 chart(s) failed
```

**23:46:26** — `helm template reservas-app reservas-app -n reservas-app | grep -E '^kind:|^  name:' | paste - - | sort`

```
kind: ConfigMap	  name: reservas-api-config
kind: ConfigMap	  name: reservas-frontend-config
kind: Deployment	  name: reservas-api
kind: Deployment	  name: reservas-db
kind: Deployment	  name: reservas-frontend
kind: HorizontalPodAutoscaler	  name: reservas-api-hpa
kind: Ingress	  name: reservas-app-ingress
kind: PersistentVolumeClaim	  name: reservas-db-pvc
kind: Secret	  name: reservas-db-secret
kind: Service	  name: reservas-api
kind: Service	  name: reservas-db
kind: Service	  name: reservas-frontend
```

**23:46:26** — `helm template reservas-app reservas-app -n reservas-app | grep -c '^kind:'`

```
12
```

**23:46:26** — `diff <(helm template reservas-app reservas-app -n reservas-app) <(helm template reservas-app reservas-app -n reservas-app --set api.image.tag=v2) | grep image`

```
<           image: "fvelardes/reservas-api:v1"
>           image: "fvelardes/reservas-api:v2"
```

**23:46:26** — `diff <(helm template reservas-app reservas-app -n reservas-app) <(helm template reservas-app reservas-app -n reservas-app --set frontend.image.tag=v2) | grep image`

```
<           image: "fvelardes/reservas-frontend:v1"
>           image: "fvelardes/reservas-frontend:v2"
```

**23:46:26** — `diff <(helm template reservas-app reservas-app -n reservas-app) <(helm template reservas-app reservas-app -n reservas-app --set frontend.replicas=3) | grep replicas`

```
<   replicas: 2
>   replicas: 3
```

**23:46:26** — `diff <(helm template reservas-app reservas-app -n reservas-app) <(helm template reservas-app reservas-app -n reservas-app --set hpa.minReplicas=3,hpa.maxReplicas=8,hpa.cpuUtilization=70) | grep -E 'Replicas|Utilization'`

```
<   minReplicas: 2
<   maxReplicas: 6
>   minReplicas: 3
>   maxReplicas: 8
<           averageUtilization: 50
>           averageUtilization: 70
```

**23:46:26** — `diff <(helm template reservas-app reservas-app -n reservas-app) <(helm template reservas-app reservas-app -n reservas-app --set api.replicas=4); echo "exit=$?"`

```
exit=0
```

**23:46:26** — `diff <(helm template reservas-app reservas-app -n reservas-app) <(helm template reservas-app reservas-app -n reservas-app --set hpa.enabled=false,api.replicas=4) | grep -E '^[<>] (kind|  replicas|  name: reservas-api-hpa)'`

```
>   replicas: 4
< kind: HorizontalPodAutoscaler
<   name: reservas-api-hpa
```

**23:46:26** — `diff <(helm template reservas-app reservas-app -n reservas-app) <(helm template reservas-app reservas-app -n reservas-app --set ingress.host=reservas.example) | grep host`

```
<     - host: reservas.local
>     - host: reservas.example
```

**23:46:26** — `helm template reservas-app reservas-app -n reservas-app --set hpa.enabled=false,ingress.enabled=false | grep -c '^kind:'`

```
10
```

**23:54:07** — `helm template reservas-app reservas-app -n reservas-app | grep '^kind:'`

```
kind: Secret
kind: ConfigMap
kind: ConfigMap
kind: PersistentVolumeClaim
kind: Service
kind: Service
kind: Service
kind: Deployment
kind: Deployment
kind: Deployment
kind: HorizontalPodAutoscaler
kind: Ingress
```

## Consigna 6 — Instalación de la release

**23:54:07** — `kubectl delete namespace reservas-app --timeout=180s`

```
namespace "reservas-app" deleted
```

**23:54:56** — `kubectl get ns reservas-app`

```
Error from server (NotFound): namespaces "reservas-app" not found
```

**23:54:56** — `helm install reservas-app ./reservas-app -n reservas-app --create-namespace -f reservas-app/values-secret.yaml --wait --timeout 5m`

```
NAME: reservas-app
LAST DEPLOYED: Fri Nov 20 23:54:56 2026
NAMESPACE: reservas-app
STATUS: deployed
REVISION: 1
DESCRIPTION: Install complete
TEST SUITE: None
```

**23:55:28** — `kubectl get all,cm,secret,pvc,ingress,hpa -n reservas-app`

```
NAME                                     READY   STATUS    RESTARTS   AGE
pod/reservas-api-76cfd9c6c6-926m6        1/1     Running   0          33s
pod/reservas-api-76cfd9c6c6-f5lcx        1/1     Running   0          33s
pod/reservas-db-6bbb6cb6cb-ptm69         1/1     Running   0          33s
pod/reservas-frontend-5c986b9474-88zmn   1/1     Running   0          33s
pod/reservas-frontend-5c986b9474-srkk4   1/1     Running   0          33s

NAME                        TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
service/reservas-api        ClusterIP   10.99.209.234    <none>        3000/TCP         33s
service/reservas-db         ClusterIP   10.105.234.180   <none>        3306/TCP         33s
service/reservas-frontend   NodePort    10.111.231.55    <none>        8080:30301/TCP   33s

NAME                                READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/reservas-api        2/2     2            2           33s
deployment.apps/reservas-db         1/1     1            1           33s
deployment.apps/reservas-frontend   2/2     2            2           33s

NAME                                           DESIRED   CURRENT   READY   AGE
replicaset.apps/reservas-api-76cfd9c6c6        2         2         2       33s
replicaset.apps/reservas-db-6bbb6cb6cb         1         1         1       33s
replicaset.apps/reservas-frontend-5c986b9474   2         2         2       33s

NAME                                                   REFERENCE                 TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
horizontalpodautoscaler.autoscaling/reservas-api-hpa   Deployment/reservas-api   cpu: 2%/50%   2         6         2          33s

NAME                                 DATA   AGE
configmap/kube-root-ca.crt           1      33s
configmap/reservas-api-config        5      33s
configmap/reservas-frontend-config   2      33s

NAME                                        TYPE                 DATA   AGE
secret/reservas-db-secret                   Opaque               3      33s
secret/sh.helm.release.v1.reservas-app.v1   helm.sh/release.v1   1      33s

NAME                                    STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/reservas-db-pvc   Bound    pvc-f9aaf18f-6aca-4f62-9331-8a3ab18ce52c   1Gi        RWO            local-path     <unset>                 33s

NAME                                             CLASS   HOSTS            ADDRESS         PORTS   AGE
ingress.networking.k8s.io/reservas-app-ingress   nginx   reservas.local   172.16.21.227   80      33s
```

**23:55:29** — `helm list -n reservas-app`

```
NAME        	NAMESPACE   	REVISION	UPDATED                             	STATUS  	CHART             	APP VERSION
reservas-app	reservas-app	1       	2026-11-20 23:54:56.299879 -0300 -03	deployed	reservas-app-0.1.0	v1         
```

**23:55:29** — `curl -s -H "Host: reservas.local" http://172.16.21.227/api/health; echo`

```
<html>
<head><title>502 Bad Gateway</title></head>
<body>
<center><h1>502 Bad Gateway</h1></center>
<hr><center>nginx/1.27.5</center>
</body>
</html>
```

**23:55:29** — `curl -s -H "Host: reservas.local" http://172.16.21.227/api/salas | head -c 300; echo`

```
<html>
<head><title>502 Bad Gateway</title></head>
<body>
<center><h1>502 Bad Gateway</h1></center>
<hr><center>nginx/1.27.5</center>
</body>
</html>
```

**23:56:45** — `kubectl logs deploy/reservas-api -n reservas-app --tail=4`

```
Found 2 pods, using pod/reservas-api-76cfd9c6c6-926m6
[2026-11-21T02:56:39.518Z] intento 10/15 de conexión falló: connect ECONNREFUSED 10.105.234.180:3306
[2026-11-21T02:56:44.880Z] esquema listo en reservas-db/reservasdb
[2026-11-21T02:56:45.430Z] datos de demo sembrados (5 salas)
[2026-11-21T02:56:45.434Z] reservas-api v1 escuchando en :3000
```

**23:56:45** — `kubectl get pods -n reservas-app`

```
NAME                                 READY   STATUS    RESTARTS      AGE
reservas-api-76cfd9c6c6-926m6        1/1     Running   1 (47s ago)   109s
reservas-api-76cfd9c6c6-f5lcx        1/1     Running   1 (46s ago)   109s
reservas-db-6bbb6cb6cb-ptm69         1/1     Running   0             109s
reservas-frontend-5c986b9474-88zmn   1/1     Running   0             109s
reservas-frontend-5c986b9474-srkk4   1/1     Running   0             109s
```

**23:56:45** — `curl -s -H "Host: reservas.local" http://172.16.21.227/api/health; echo`

```
{"status":"ok","db":"ok","version":"v1"}
```

**23:56:45** — `curl -s -H "Host: reservas.local" http://172.16.21.227/api/salas | head -c 300; echo`

```
[{"id":7,"nombre":"Aula Magna","capacidad":120,"ubicacion":"Edificio central"},{"id":1,"nombre":"Laboratorio 1","capacidad":24,"ubicacion":"Planta baja, ala este"},{"id":3,"nombre":"Laboratorio 2","capacidad":24,"ubicacion":"Planta baja, ala oeste"},{"id":5,"nombre":"Laboratorio de Redes","capacidad
```

## Consigna 7 — Ciclo de vida de la release

**15:53:36** — `curl -s -H "Host: reservas.local" http://172.16.21.227/api/health; echo`

```
{"status":"ok","db":"ok","version":"v1"}
```

**15:53:36** — `helm upgrade reservas-app ./reservas-app -n reservas-app -f reservas-app/values-secret.yaml --set api.image.tag=v2 --wait --timeout 5m`

```
Release "reservas-app" has been upgraded. Happy Helming!
NAME: reservas-app
LAST DEPLOYED: Sat Nov 21 15:53:37 2026
NAMESPACE: reservas-app
STATUS: deployed
REVISION: 2
DESCRIPTION: Upgrade complete
TEST SUITE: None
```

**15:53:46** — `kubectl get pods -n reservas-app`

```
NAME                                 READY   STATUS        RESTARTS      AGE
reservas-api-68d96d6f6c-7gmf7        1/1     Running       0             8s
reservas-api-68d96d6f6c-wrzsq        1/1     Running       0             5s
reservas-api-76cfd9c6c6-926m6        1/1     Terminating   1 (15h ago)   15h
reservas-api-76cfd9c6c6-f5lcx        1/1     Terminating   1 (15h ago)   15h
reservas-db-6bbb6cb6cb-ptm69         1/1     Running       0             15h
reservas-frontend-5c986b9474-88zmn   1/1     Running       0             15h
reservas-frontend-5c986b9474-srkk4   1/1     Running       0             15h
```

**15:53:46** — `curl -s -H "Host: reservas.local" http://172.16.21.227/api/health; echo`

```
{"status":"ok","db":"ok","version":"v1"}
```

**15:53:46** — `helm history reservas-app -n reservas-app`

```
REVISION	UPDATED                 	STATUS    	CHART             	APP VERSION	DESCRIPTION     
1       	Fri Nov 20 23:54:56 2026	superseded	reservas-app-0.1.0	v1         	Install complete
2       	Sat Nov 21 15:53:37 2026	deployed  	reservas-app-0.1.0	v1         	Upgrade complete
```

**15:54:20** — `kubectl get deploy -n reservas-app -o 'custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image'`

```
NAME                IMAGE
reservas-api        fvelardes/reservas-api:v2
reservas-db         mysql:8.4
reservas-frontend   fvelardes/reservas-frontend:v1
```

**15:54:20** — `kubectl get pods -n reservas-app`

```
NAME                                 READY   STATUS    RESTARTS   AGE
reservas-api-68d96d6f6c-7gmf7        1/1     Running   0          42s
reservas-api-68d96d6f6c-wrzsq        1/1     Running   0          39s
reservas-db-6bbb6cb6cb-ptm69         1/1     Running   0          15h
reservas-frontend-5c986b9474-88zmn   1/1     Running   0          15h
reservas-frontend-5c986b9474-srkk4   1/1     Running   0          15h
```

**15:54:20** — `for i in 1 2 3 4 5; do curl -s -H "Host: reservas.local" http://172.16.21.227/api/health; echo; done`

```
{"status":"ok","db":"ok","version":"v2"}
{"status":"ok","db":"ok","version":"v2"}
{"status":"ok","db":"ok","version":"v2"}
{"status":"ok","db":"ok","version":"v2"}
{"status":"ok","db":"ok","version":"v2"}
```

**15:56:29** — `helm rollback reservas-app 1 -n reservas-app --wait --timeout 5m`

```
E1121 15:56:36.331327   70792 request.go:1198] "Unexpected error when reading response body" err="context canceled"
Rollback was a success! Happy Helming!
```

**15:57:10** — `helm history reservas-app -n reservas-app`

```
REVISION	UPDATED                 	STATUS    	CHART             	APP VERSION	DESCRIPTION     
1       	Fri Nov 20 23:54:56 2026	superseded	reservas-app-0.1.0	v1         	Install complete
2       	Sat Nov 21 15:53:37 2026	superseded	reservas-app-0.1.0	v1         	Upgrade complete
3       	Sat Nov 21 15:56:30 2026	deployed  	reservas-app-0.1.0	v1         	Rollback to 1   
```

**15:57:11** — `kubectl get deploy -n reservas-app -o 'custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image'`

```
NAME                IMAGE
reservas-api        fvelardes/reservas-api:v1
reservas-db         mysql:8.4
reservas-frontend   fvelardes/reservas-frontend:v1
```

**15:57:11** — `kubectl get pods -n reservas-app`

```
NAME                                 READY   STATUS    RESTARTS   AGE
reservas-api-76cfd9c6c6-c76rx        1/1     Running   0          38s
reservas-api-76cfd9c6c6-q7hrc        1/1     Running   0          40s
reservas-db-6bbb6cb6cb-ptm69         1/1     Running   0          16h
reservas-frontend-5c986b9474-88zmn   1/1     Running   0          16h
reservas-frontend-5c986b9474-srkk4   1/1     Running   0          16h
```

**15:57:11** — `for i in 1 2 3; do curl -s -H "Host: reservas.local" http://172.16.21.227/api/health; echo; done`

```
{"status":"ok","db":"ok","version":"v1"}
{"status":"ok","db":"ok","version":"v1"}
{"status":"ok","db":"ok","version":"v1"}
```

**15:57:12** — `kubectl get all,cm,secret,pvc,ingress,hpa -n reservas-app`

```
NAME                                     READY   STATUS    RESTARTS   AGE
pod/reservas-api-76cfd9c6c6-c76rx        1/1     Running   0          38s
pod/reservas-api-76cfd9c6c6-q7hrc        1/1     Running   0          40s
pod/reservas-db-6bbb6cb6cb-ptm69         1/1     Running   0          16h
pod/reservas-frontend-5c986b9474-88zmn   1/1     Running   0          16h
pod/reservas-frontend-5c986b9474-srkk4   1/1     Running   0          16h

NAME                        TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
service/reservas-api        ClusterIP   10.99.209.234    <none>        3000/TCP         16h
service/reservas-db         ClusterIP   10.105.234.180   <none>        3306/TCP         16h
service/reservas-frontend   NodePort    10.111.231.55    <none>        8080:30301/TCP   16h

NAME                                READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/reservas-api        2/2     2            2           16h
deployment.apps/reservas-db         1/1     1            1           16h
deployment.apps/reservas-frontend   2/2     2            2           16h

NAME                                           DESIRED   CURRENT   READY   AGE
replicaset.apps/reservas-api-68d96d6f6c        0         0         0       3m34s
replicaset.apps/reservas-api-76cfd9c6c6        2         2         2       16h
replicaset.apps/reservas-db-6bbb6cb6cb         1         1         1       16h
replicaset.apps/reservas-frontend-5c986b9474   2         2         2       16h

NAME                                                   REFERENCE                 TARGETS              MINPODS   MAXPODS   REPLICAS   AGE
horizontalpodautoscaler.autoscaling/reservas-api-hpa   Deployment/reservas-api   cpu: <unknown>/50%   2         6         2          16h

NAME                                 DATA   AGE
configmap/kube-root-ca.crt           1      16h
configmap/reservas-api-config        5      16h
configmap/reservas-frontend-config   2      16h

NAME                                        TYPE                 DATA   AGE
secret/reservas-db-secret                   Opaque               3      16h
secret/sh.helm.release.v1.reservas-app.v1   helm.sh/release.v1   1      16h
secret/sh.helm.release.v1.reservas-app.v2   helm.sh/release.v1   1      3m35s
secret/sh.helm.release.v1.reservas-app.v3   helm.sh/release.v1   1      43s

NAME                                    STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/reservas-db-pvc   Bound    pvc-f9aaf18f-6aca-4f62-9331-8a3ab18ce52c   1Gi        RWO            local-path     <unset>                 16h

NAME                                             CLASS   HOSTS            ADDRESS         PORTS   AGE
ingress.networking.k8s.io/reservas-app-ingress   nginx   reservas.local   172.16.21.227   80      16h
```

**15:57:28** — `kubectl get hpa -n reservas-app`

```
NAME               REFERENCE                 TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
reservas-api-hpa   Deployment/reservas-api   cpu: 1%/50%   2         6         2          16h
```

