#!/bin/sh
# Instala el plugin headless-connector en el WordPress de wordpress-original
# (Docker) sin modificar ese repositorio: copia el plugin al volumen del
# contenedor y lo activa con WP-CLI.
#
# Uso:
#   ./scripts/install-connector.sh                       # usa ../wordpress-original
#   ORIGINAL=/ruta/a/wordpress-original ./scripts/install-connector.sh
#   FRONTEND_ORIGIN=http://localhost:4321 ./scripts/install-connector.sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORIGINAL="${ORIGINAL:-$ROOT/../wordpress-original}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:4321}"

if [ ! -f "$ORIGINAL/docker-compose.yml" ]; then
  echo "No encuentro $ORIGINAL/docker-compose.yml. Indica la ruta con ORIGINAL=..." >&2
  exit 1
fi

cd "$ORIGINAL"
CONTAINER="$(docker compose ps -q wordpress)"
if [ -z "$CONTAINER" ]; then
  echo "El contenedor de WordPress no está arrancado. Ejecuta 'docker compose up -d' en $ORIGINAL" >&2
  exit 1
fi

echo "==> Copiando el plugin al contenedor..."
docker cp "$ROOT/wp-connector/headless-connector" "$CONTAINER:/var/www/html/wp-content/plugins/"
docker exec "$CONTAINER" chown -R www-data:www-data /var/www/html/wp-content/plugins/headless-connector

echo "==> Activando y configurando..."
docker compose run --rm wpcli wp plugin activate headless-connector
docker compose run --rm wpcli wp option update headless_frontend_origin "$FRONTEND_ORIGIN"

echo ""
echo "Listo. Comprueba: curl http://localhost:8080/wp-json/headless/v1/site"
