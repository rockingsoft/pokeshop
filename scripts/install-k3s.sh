#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(dirname "$script_dir")
install_dir=${repo_dir}/.bin
version=${K3D_VERSION:-v5.9.0}
installer_url=https://raw.githubusercontent.com/k3d-io/k3d/${version}/install.sh

if [ -x "${install_dir}/k3d" ]; then
	installed_version=$(${install_dir}/k3d version | awk '/k3d version/ {print $3; exit}')
	if [ "$installed_version" = "$version" ]; then
		echo "k3d $version is already installed in $install_dir"
		exit 0
	fi
fi

mkdir -p "$install_dir"

run_installer() {
	env \
		TAG="$version" \
		K3D_INSTALL_DIR="$install_dir" \
		USE_SUDO=false \
		PATH="$install_dir:$PATH" \
		bash -s -- --no-sudo
}

if command -v curl >/dev/null 2>&1; then
	curl --proto '=https' --tlsv1.2 --fail --show-error --silent --location "$installer_url" | run_installer
elif command -v wget >/dev/null 2>&1; then
	wget --https-only --quiet --output-document=- "$installer_url" | run_installer
else
	echo "curl or wget is required to install k3d" >&2
	exit 1
fi
