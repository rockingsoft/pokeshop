# Pokeshop

Zero-code instrumentation test subject for Lamplight. You do not have to
instrument or reconfigure the application: there is no telemetry SDK, OTEL
environment configuration, Collector, Jaeger, or other tracing backend in the
stack. The basic browser UI is
available at `http://localhost:3000` and the API at `http://localhost:8081`.

It contains only the services exercised by the tests in `lamplight/`: an HTTP
API, PostgreSQL, Redis, RabbitMQ, Kafka, and two background workers. Pokeshop
does not include any tracing component; Lamplight starts OBI and its embedded
OTLP receiver for each trace-based test run and cleans them up afterwards.

## Run

```sh
make run
```

Run the complete six-scenario suite with one command:

```sh
make test
```

`make test` starts the application stack. Lamplight uses the `compose` Docker
Compose target by default and creates an
ephemeral runner and OBI agent on the existing Compose network, so application
images, source code, and environment variables do not need telemetry changes.
The HTTP-facing scenarios assert the spans OBI observes. The gRPC and Kafka
scenarios retain their functional response contracts because OBI does not
currently correlate those protocol triggers in this stack.

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
