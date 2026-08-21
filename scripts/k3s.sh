#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(dirname "$script_dir")
cluster=pokeshop
manifest=${repo_dir}/k8s/k3s.yaml
kubeconfig=${repo_dir}/.bin/kubeconfig-${cluster}.yaml
server_node=k3d-${cluster}-server-0

if [ -x "${repo_dir}/.bin/k3d" ]; then
	k3d=${repo_dir}/.bin/k3d
elif command -v k3d >/dev/null 2>&1; then
	k3d=$(command -v k3d)
else
	k3d=
fi

require() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

cluster_exists() {
	"$k3d" cluster list --no-headers 2>/dev/null | awk '{print $1}' | grep -Fxq "$cluster"
}

require_imported_image() {
	image=$1
	if ! docker exec "$server_node" ctr --namespace k8s.io images list --quiet | grep -Fxq "$image"; then
		echo "Image import failed: '$image' is not present in K3s containerd" >&2
		return 1
	fi
}

wait_for_containerd() {
	attempt=0
	stable=0
	while [ "$attempt" -lt 60 ]; do
		if docker exec "$server_node" sh -c 'test -S /run/k3s/containerd/containerd.sock' >/dev/null 2>&1 &&
			docker exec "$server_node" ctr --namespace k8s.io version >/dev/null 2>&1; then
			stable=$((stable + 1))
			if [ "$stable" -ge 3 ]; then
				return
			fi
		else
			stable=0
		fi
		sleep 1
		attempt=$((attempt + 1))
	done
	echo "K3s containerd did not become stable within 60 seconds" >&2
	return 1
}

wait_for_deployments() {
	attempt=0
	while [ "$attempt" -lt 60 ]; do
		pending=$(kubectl --kubeconfig "$kubeconfig" get deployment \
			--namespace pokeshop \
			--output custom-columns=NAME:.metadata.name,DESIRED:.spec.replicas,UPDATED:.status.updatedReplicas,AVAILABLE:.status.availableReplicas \
			--no-headers | awk '$2 != $3 || $2 != $4 {printf "%s ", $1}')
		if [ -z "$pending" ]; then
			return
		fi
		echo "Waiting for deployments: $pending"
		sleep 5
		attempt=$((attempt + 1))
	done

	echo "Deployments did not become available within 5 minutes" >&2
	kubectl --kubeconfig "$kubeconfig" get deployment,pod --namespace pokeshop >&2
	return 1
}

up() {
	require docker
	require kubectl
	if [ -z "$k3d" ]; then
		echo "k3d is not installed; run 'make install-k3s'" >&2
		exit 1
	fi

	if ! cluster_exists; then
		"$k3d" cluster create "$cluster" \
			--servers 1 \
			--agents 0 \
			--port '127.0.0.1:3000:30080@server:0' \
			--port '127.0.0.1:8081:30081@server:0' \
			--k3s-arg '--disable=traefik@server:0' \
			--k3s-arg '--disable=servicelb@server:0' \
			--k3s-arg '--disable=metrics-server@server:0' \
			--k3s-arg '--disable=local-storage@server:0' \
			--wait
	else
		"$k3d" cluster start "$cluster" >/dev/null 2>&1 || true
	fi
	wait_for_containerd

	docker build --tag pokeshop-api:k3s .
	docker build --tag pokeshop-web:k3s ./web
	"$k3d" image import --cluster "$cluster" \
		pokeshop-api:k3s \
		pokeshop-web:k3s
	require_imported_image docker.io/library/pokeshop-api:k3s
	require_imported_image docker.io/library/pokeshop-web:k3s
	"$k3d" kubeconfig get "$cluster" > "$kubeconfig"

	kubectl --kubeconfig "$kubeconfig" apply -f "$manifest"
	kubectl --kubeconfig "$kubeconfig" rollout restart \
		deployment/api \
		deployment/web \
		deployment/rpc \
		deployment/worker \
		deployment/streaming-worker \
		--namespace pokeshop
	wait_for_deployments

	echo "Pokeshop is available at http://localhost:3000"
	echo "Pokeshop API is available at http://localhost:8081"
	echo "Kubeconfig: $kubeconfig"
}

down() {
	if [ -z "$k3d" ]; then
		echo "k3d is not installed; no K3s cluster to delete"
		return
	fi
	if cluster_exists; then
		"$k3d" cluster delete "$cluster"
	else
		echo "K3s cluster '$cluster' does not exist"
	fi
}

case "${1:-up}" in
	up) up ;;
	down) down ;;
	*)
		echo "Usage: $0 [up|down]" >&2
		exit 2
		;;
esac
