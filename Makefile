DETACHED      ?= false
BUILD         ?= false
export FLAGS

help: Makefile ## show list of commands
	@echo "Choose a command run:"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /[a-zA-Z_-]+:.*?## / {sub("\\\\n",sprintf("\n%22c"," "), $$2);printf "\033[36m%-40s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST) | sort

ifeq ($(DETACHED),true)
  FLAGS+= --detach
endif

ifeq ($(BUILD),true)
  FLAGS+= --build
endif

run: ## run the minimal Pokeshop stack used by Lamplight
	docker compose -f docker-compose.yml -f ./docker-compose.stream.yml up ${FLAGS}

down: ## stop the minimal Pokeshop stack
	docker compose -f docker-compose.yml -f ./docker-compose.stream.yml  down

test: ## run Lamplight against an already-running stack
	docker compose -f docker-compose.yml -f ./docker-compose.stream.yml -f ./docker-compose.test.yml up -d
	lamplight run

build/docker: # build docker image locally
	docker build . -t kubeshop/demo-pokemon-api:latest
