#!/usr/bin/env bash
set -euo pipefail
# Called in a fresh user/network namespace: these addresses cannot reach the Internet.
[[ "${REZICS_CIMD_NETWORK_NAMESPACE:-}" == 1 ]]
[[ "$(readlink /proc/self/ns/net)" != "$(readlink /proc/1/ns/net)" ]]
ip link set lo up
ip address add 8.8.8.8/32 dev lo
ip -6 address add 2606:4700::1111/128 dev lo
mkdir -p ../../.temp
fixture_directory=$(mktemp -d ../../.temp/cimd-transport.XXXXXX)
trap 'rm -rf -- "$fixture_directory"' EXIT
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$fixture_directory/key.pem" \
  -out "$fixture_directory/cert.pem" -days 1 -subj '/CN=cimd.example.com' \
  -addext 'subjectAltName=DNS:cimd.example.com' > "$fixture_directory/openssl.log" 2>&1
REZICS_CIMD_FIXTURE_DIRECTORY="$(realpath "$fixture_directory")" bun scripts/check-cimd-transport.ts
