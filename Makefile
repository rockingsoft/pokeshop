COMPOSE = docker compose -f docker-compose.yml -f docker-compose.stream.yml
K3D_VERSION ?= v5.9.0
LAMPLIGHT ?= lamplight
LAMPLIGHT_OUTPUT ?= pretty

.PHONY: run stop clean test test-k3s install-k3s k3s

run:
	$(COMPOSE) up --build --detach --remove-orphans

stop:
	$(COMPOSE) stop

clean:
	$(COMPOSE) down --volumes --remove-orphans
	./scripts/k3s.sh down

test:
	@$(MAKE) --no-print-directory run >&2
	@$(LAMPLIGHT) run --output $(LAMPLIGHT_OUTPUT)

test-k3s:
	@$(MAKE) --no-print-directory k3s >&2
	@LAMPLIGHT="$(LAMPLIGHT)" LAMPLIGHT_OUTPUT="$(LAMPLIGHT_OUTPUT)" ./scripts/test-k3s.sh

k3s: install-k3s
	./scripts/k3s.sh up

install-k3s:
	K3D_VERSION=$(K3D_VERSION) ./scripts/install-k3s.sh
