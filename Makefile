COMPOSE = docker compose -f docker-compose.yml -f docker-compose.stream.yml

.PHONY: run stop clean test

run:
	$(COMPOSE) up --build --detach --remove-orphans

stop:
	$(COMPOSE) stop

clean:
	$(COMPOSE) down --volumes --remove-orphans

test: run
	lamplight run
