# Registro: concurrencia con tres réplicas de la API

Ejecutado el 2026-11-21 sobre la release de Helm `reservas-app` (namespace `reservas-app`), a través del Ingress `reservas.local` (172.16.21.227). Horas locales (UTC-3).

**16:17:26** — `kubectl scale deployment reservas-api -n reservas-app --replicas=3`

```
deployment.apps/reservas-api scaled
```

**16:17:27** — `kubectl rollout status deployment/reservas-api -n reservas-app --timeout=120s`

```
Waiting for deployment "reservas-api" rollout to finish: 2 of 3 updated replicas are available...
deployment "reservas-api" successfully rolled out
```

**16:17:29** — `kubectl get pods -n reservas-app -l app=reservas-api -o wide`

```
NAME                            READY   STATUS    RESTARTS   AGE   IP             NODE        NOMINATED NODE   READINESS GATES
reservas-api-76cfd9c6c6-c76rx   1/1     Running   0          20m   10.244.0.116   fvelardes   <none>           <none>
reservas-api-76cfd9c6c6-jrspn   1/1     Running   0          2s    10.244.0.117   fvelardes   <none>           <none>
reservas-api-76cfd9c6c6-q7hrc   1/1     Running   0          20m   10.244.0.115   fvelardes   <none>           <none>
```

**16:17:29** — `curl -s -H "Host: reservas.local" http://172.16.21.227/api/salas; echo`

```
[{"id":7,"nombre":"Aula Magna","capacidad":120,"ubicacion":"Edificio central"},{"id":1,"nombre":"Laboratorio 1","capacidad":24,"ubicacion":"Planta baja, ala este"},{"id":3,"nombre":"Laboratorio 2","capacidad":24,"ubicacion":"Planta baja, ala oeste"},{"id":5,"nombre":"Laboratorio de Redes","capacidad":16,"ubicacion":"Primer piso"},{"id":9,"nombre":"Sala de Reuniones","capacidad":10,"ubicacion":"Primer piso"}]
```

**16:17:38** — `kubectl get hpa -n reservas-app`

```
NAME               REFERENCE                 TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
reservas-api-hpa   Deployment/reservas-api   cpu: 0%/50%   2         6         3          16h
```

**16:17:38** — `for i in $(seq 1 30); do curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Host: reservas.local' -H 'Content-Type: application/json' -d '{"sala_id":7,"fecha":"2026-12-02","franja":3,"responsable":"R'$i'"}' http://172.16.21.227/api/reservas & done | sort | uniq -c; wait`

```
   1 201
  29 409
```

**16:17:39** — `kubectl exec deploy/reservas-db -n reservas-app -- sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" reservasdb -e "SELECT id, sala_id, fecha, franja, responsable FROM reservas WHERE sala_id=7 AND fecha=\"2026-12-02\" AND franja=3;"' 2>/dev/null`

```
id	sala_id	fecha	franja	responsable
22	7	2026-12-02	3	R11
```

**16:17:41** — `kubectl exec deploy/reservas-db -n reservas-app -- sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" reservasdb -e "SHOW CREATE TABLE reservas\\G"' 2>/dev/null | grep -E 'UNIQUE|FOREIGN'`

```
  UNIQUE KEY `sin_solapamiento` (`sala_id`,`fecha`,`franja`),
  CONSTRAINT `fk_reserva_sala` FOREIGN KEY (`sala_id`) REFERENCES `salas` (`id`) ON DELETE RESTRICT
```

**16:17:55** — `kubectl scale deployment reservas-api -n reservas-app --replicas=2`

```
deployment.apps/reservas-api scaled
```

**16:17:55** — `kubectl get pods -n reservas-app -l app=reservas-api`

```
NAME                            READY   STATUS        RESTARTS   AGE
reservas-api-76cfd9c6c6-c76rx   1/1     Running       0          21m
reservas-api-76cfd9c6c6-jrspn   1/1     Terminating   0          29s
reservas-api-76cfd9c6c6-q7hrc   1/1     Running       0          21m
```

