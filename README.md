# Pokeshop

Minimal OpenTelemetry test subject for Lamplight. The basic browser UI is
available at `http://localhost:3000` and the API at `http://localhost:8081`.

It contains only the services exercised by the tests in `lamplight/`: an HTTP
API, PostgreSQL, Redis, RabbitMQ, Kafka, two background workers, an
OpenTelemetry Collector, and Jaeger.

## Run

```sh
make run
```

Use `DETACHED=true` to start in the background and `BUILD=true` to rebuild the
application image. Once the stack is healthy, run the Lamplight suite:

```sh
make test
```

Stop everything with `make down`.
