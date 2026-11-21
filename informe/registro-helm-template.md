# Registro: la misma plantilla renderizada dos veces con valores distintos

Ejecutado el 2026-11-21 en la raíz del repositorio. Horas locales (UTC-3). Ningún comando de este registro toca el clúster: `helm template` solo renderiza.

## Render 1: valores por defecto

**16:18:12** — `helm template reservas-app ./reservas-app -n reservas-app -s templates/hpa-api.yaml`

```
---
# Source: reservas-app/templates/hpa-api.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: reservas-api-hpa
  namespace: reservas-app
  labels:
    app.kubernetes.io/part-of: reservas-app
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/instance: reservas-app
    helm.sh/chart: reservas-app-0.1.0
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: reservas-api
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50
```

**16:18:12** — `helm template reservas-app ./reservas-app -n reservas-app -s templates/deployment-frontend.yaml | grep -E "replicas|image:"`

```
  replicas: 2
          image: "fvelardes/reservas-frontend:v1"
```

## Render 2: la misma plantilla con --set

**16:18:12** — `helm template reservas-app ./reservas-app -n reservas-app -s templates/hpa-api.yaml --set hpa.minReplicas=3,hpa.maxReplicas=10,hpa.cpuUtilization=70`

```
---
# Source: reservas-app/templates/hpa-api.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: reservas-api-hpa
  namespace: reservas-app
  labels:
    app.kubernetes.io/part-of: reservas-app
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/instance: reservas-app
    helm.sh/chart: reservas-app-0.1.0
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: reservas-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

**16:18:12** — `helm template reservas-app ./reservas-app -n reservas-app -s templates/deployment-frontend.yaml --set frontend.replicas=4,frontend.image.tag=v2 | grep -E "replicas|image:"`

```
  replicas: 4
          image: "fvelardes/reservas-frontend:v2"
```

## Diferencias, con diff

**16:18:12** — `diff <(helm template reservas-app ./reservas-app -n reservas-app -s templates/deployment-api.yaml) <(helm template reservas-app ./reservas-app -n reservas-app -s templates/deployment-api.yaml --set api.image.tag=v2)`

```
27c27
<           image: "fvelardes/reservas-api:v1"
---
>           image: "fvelardes/reservas-api:v2"
```

**16:18:12** — `diff <(helm template reservas-app ./reservas-app -n reservas-app -s templates/ingress.yaml) <(helm template reservas-app ./reservas-app -n reservas-app -s templates/ingress.yaml --set ingress.host=reservas.example)`

```
16c16
<     - host: reservas.local
---
>     - host: reservas.example
```

**16:18:12** — `diff <(helm template reservas-app ./reservas-app -n reservas-app -s templates/deployment-api.yaml) <(helm template reservas-app ./reservas-app -n reservas-app -s templates/deployment-api.yaml --set api.replicas=4); echo "exit=$?"`

```
exit=0
```

**16:18:12** — `diff <(helm template reservas-app ./reservas-app -n reservas-app -s templates/deployment-api.yaml) <(helm template reservas-app ./reservas-app -n reservas-app -s templates/deployment-api.yaml --set hpa.enabled=false,api.replicas=4)`

```
13a14
>   replicas: 4
```

**16:18:12** — `helm template reservas-app ./reservas-app -n reservas-app | grep -c '^kind:'`

```
12
```

