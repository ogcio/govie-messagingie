#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ENV_FILE=${UPLOAD_API_K6_ENV_FILE:-"$SCRIPT_DIR/.env"}

export UPLOAD_API_K6_ENV_FILE="$ENV_FILE"

node "$SCRIPT_DIR/run-load-tests.mjs" "$@"