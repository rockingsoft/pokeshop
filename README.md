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

Lamplight uses the `compose` Docker Compose target by default. It creates an
ephemeral runner on the existing Compose network, so the tracing and application
ports do not need to be exposed.

Stop and remove everything with `make clean`.

## Run on K3s

With Docker and `kubectl` installed, start the same stack on a minimal
single-server K3s cluster:

```sh
make k3s
```

The `install-k3s` dependency installs the pinned, official multi-platform `k3d`
binary under `.bin/` and verifies its release checksum. It does not require
`sudo` or modify the system installation. It can also be run independently with
`make install-k3s`.

Every service runs in its own Deployment and Pod. The K3s cluster disables
Traefik, ServiceLB, metrics-server, and local storage; PostgreSQL uses ephemeral
storage, just like the development stack. The web UI and API remain available
at `http://localhost:3000` and `http://localhost:8081`.

Delete both the Compose stack and the K3s cluster with `make clean`.

Compose is the default Lamplight target. To run the same suite through an
ephemeral executor Pod in K3s, use the cluster's isolated kubeconfig:

```sh
KUBECONFIG="$PWD/.bin/kubeconfig-pokeshop.yaml" lamplight run --target k3s
```

To import the local Lamplight executor image and run the suite in one command:

```sh
make test-k3s
```

`test-k3s` imports every local `ghcr.io/rockingsoft/lamplight:*` image so that
snapshot binaries work without publishing their matching executor image.
Set `LAMPLIGHT_OUTPUT=json` when the result must be machine-validated.
