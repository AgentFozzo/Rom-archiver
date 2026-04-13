#!/bin/sh
set -eu

uvicorn main:app --host 127.0.0.1 --port 8097 --workers "${UVICORN_WORKERS:-1}" &
app_pid="$!"

nginx -g "daemon off;" &
nginx_pid="$!"

cleanup() {
    kill -TERM "$app_pid" "$nginx_pid" 2>/dev/null || true
    wait "$app_pid" "$nginx_pid" 2>/dev/null || true
}

trap cleanup INT TERM

while true; do
    if ! kill -0 "$app_pid" 2>/dev/null; then
        cleanup
        exit 1
    fi
    if ! kill -0 "$nginx_pid" 2>/dev/null; then
        cleanup
        exit 1
    fi
    sleep 2
done
