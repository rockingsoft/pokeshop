#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(dirname "$script_dir")
k3d=${repo_dir}/.bin/k3d
kubeconfig=${repo_dir}/.bin/kubeconfig-pokeshop.yaml
lamplight=${LAMPLIGHT:-lamplight}
output=${LAMPLIGHT_OUTPUT:-pretty}

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

KUBECONFIG="$kubeconfig" "$lamplight" run --target k3s --output "$output" </dev/null
