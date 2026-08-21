#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(dirname "$script_dir")
k3d=${repo_dir}/.bin/k3d
kubeconfig=${repo_dir}/.bin/kubeconfig-pokeshop.yaml
lamplight=${LAMPLIGHT:-lamplight}
output=${LAMPLIGHT_OUTPUT:-pretty}
server_node=k3d-pokeshop-server-0

if [ ! -x "$k3d" ]; then
	echo "k3d is not installed; run 'make install-k3s'" >&2
	exit 1
fi

lamplight_images=$(docker image ls \
	--filter 'reference=ghcr.io/rockingsoft/lamplight:*' \
	--format '{{.Repository}}:{{.Tag}}')
if [ -z "$lamplight_images" ]; then
	echo "No local Lamplight executor image found." >&2
	echo "Build one in the Lamplight repository before running make test-k3s." >&2
	exit 1
fi

# Word splitting is intentional: k3d accepts one or more image names.
# shellcheck disable=SC2086
"$k3d" image import --cluster pokeshop $lamplight_images >&2

for image in $lamplight_images; do
	if ! docker exec "$server_node" ctr --namespace k8s.io images list --quiet | grep -Fxq "$image"; then
		echo "Image import failed: '$image' is not present in K3s containerd" >&2
		exit 1
	fi
done

KUBECONFIG="$kubeconfig" "$lamplight" run --target k3s --tag zero-code --output "$output" </dev/null
