#!/usr/bin/env bash
set -euo pipefail

TAG="${1:?usage: deploy/deploy.sh <image-tag>}"
COMPOSE=(docker compose -f docker-compose.production.yml)
previous_tag=""
current_image="$(docker inspect --format '{{.Config.Image}}' zoia-editor-web 2>/dev/null || true)"
if [[ "$current_image" == zoia-editor-web:* ]]; then previous_tag="${current_image#*:}"; fi

if ! docker network inspect proxy >/dev/null 2>&1; then
  echo "The shared external Docker network 'proxy' does not exist." >&2
  exit 1
fi

export ZOIA_IMAGE_TAG="$TAG"
"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d --remove-orphans

healthy() {
  local service="$1"
  local id
  id="$("${COMPOSE[@]}" ps -q "$service")"
  [[ -n "$id" ]] && [[ "$(docker inspect --format '{{.State.Health.Status}}' "$id")" == healthy ]]
}

for _ in {1..30}; do
  if healthy web && healthy codec; then
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

"${COMPOSE[@]}" ps
if [[ -n "$previous_tag" && "$previous_tag" != "$TAG" ]]; then
  echo "Health checks failed; restoring $previous_tag" >&2
  export ZOIA_IMAGE_TAG="$previous_tag"
  "${COMPOSE[@]}" up -d --no-build --remove-orphans
fi
exit 1
