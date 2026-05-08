#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-/api}"
BUYER_IMAGE="marketplace-buyer:latest"
SELLER_IMAGE="marketplace-seller:latest"
BUYER_CONTAINER="marketplace-buyer"
SELLER_CONTAINER="marketplace-seller"

cd "$(dirname "$0")"

stop_and_remove() {
  local name="$1"
  if docker ps -a --format '{{.Names}}' | grep -qx "$name"; then
    docker stop "$name" >/dev/null 2>&1 || true
    docker rm "$name" >/dev/null 2>&1 || true
  fi
}

build_image() {
  local app_dir="$1"
  local image_name="$2"
  docker build \
    --no-cache \
    --pull \
    --build-arg VITE_API_URL="$BACKEND_URL" \
    -t "$image_name" \
    "$app_dir"
}

run_container() {
  local image_name="$1"
  local container_name="$2"
  local host_port="$3"

  stop_and_remove "$container_name"
  docker run -d \
    --name "$container_name" \
    --restart unless-stopped \
    -p "$host_port:80" \
    "$image_name"
}

echo "Building buyer frontend..."
build_image "buyer-app" "$BUYER_IMAGE"

echo "Building seller frontend..."
build_image "seller-app" "$SELLER_IMAGE"

echo "Starting containers..."
run_container "$BUYER_IMAGE" "$BUYER_CONTAINER" 8080
run_container "$SELLER_IMAGE" "$SELLER_CONTAINER" 8081

echo "Done."
docker ps --filter "name=marketplace-" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
