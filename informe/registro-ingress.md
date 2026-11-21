# Registro: la aplicación a través del Ingress

Ejecutado el 2026-11-21 sobre la release de Helm `reservas-app`. Horas locales (UTC-3). `reservas.local` resuelve a la IP del controlador de Ingress (172.16.21.227) por `/etc/hosts`.

**16:21:35** — `grep reservas.local /etc/hosts`

```
172.16.21.227 reservas.local
```

**16:21:35** — `kubectl get ingress -n reservas-app`

```
NAME                   CLASS   HOSTS            ADDRESS         PORTS   AGE
reservas-app-ingress   nginx   reservas.local   172.16.21.227   80      16h
```

**16:21:36** — `kubectl describe ingress reservas-app-ingress -n reservas-app | sed -n "1,20p"`

```
Name:             reservas-app-ingress
Labels:           app.kubernetes.io/instance=reservas-app
                  app.kubernetes.io/managed-by=Helm
                  app.kubernetes.io/part-of=reservas-app
                  helm.sh/chart=reservas-app-0.1.0
Namespace:        reservas-app
Address:          172.16.21.227
Ingress Class:    nginx
Default backend:  <default>
Rules:
  Host            Path  Backends
  ----            ----  --------
  reservas.local  
                  /   reservas-frontend:8080 (10.244.0.109:8080,10.244.0.108:8080)
Annotations:      meta.helm.sh/release-name: reservas-app
                  meta.helm.sh/release-namespace: reservas-app
Events:           <none>
```

**16:21:36** — `curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://reservas.local/`

```
200 text/html
```

**16:21:41** — `curl -s http://reservas.local/api/health; echo`

```
{"status":"ok","db":"ok","version":"v1"}
```

**16:21:46** — `curl -s -o /dev/null -w "%{http_code}\n" http://172.16.21.227/`

```
404
```

**16:21:47** — `curl -s "http://reservas.local/api/reservas?fecha=2026-11-21"; echo`

```
[{"id":1,"sala_id":1,"sala":"Laboratorio 1","fecha":"2026-11-21","franja":2,"responsable":"Cátedra de Sistemas Operativos","motivo":"Práctica de procesos","creada_en":"2026-11-21 02:56:45"},{"id":3,"sala_id":5,"sala":"Laboratorio de Redes","fecha":"2026-11-21","franja":4,"responsable":"Cátedra de Redes","motivo":"Laboratorio de routing","creada_en":"2026-11-21 02:56:45"},{"id":5,"sala_id":7,"sala":"Aula Magna","fecha":"2026-11-21","franja":5,"responsable":"Secretaría Académica","motivo":"Charla de egresados","creada_en":"2026-11-21 02:56:45"}]
```

## La reserva creada desde el navegador

**16:38:00** — `curl -s "http://reservas.local/api/reservas?fecha=2026-12-03"; echo`

```
[{"id":64,"sala_id":3,"sala":"Laboratorio 2","fecha":"2026-12-03","franja":1,"responsable":"Facundo Velardes","motivo":"Clase Ing de Software","creada_en":"2026-11-21 19:37:28"}]
```

