#!/bin/sh
set -e

# On first launch /storage/site-dist is empty (fresh volume).
# Start the backend temporarily so Eleventy can fetch articles from the API,
# then build the initial static site before handing control back as PID 1.
if [ -z "$(ls -A /storage/site-dist 2>/dev/null)" ]; then
    echo "[startup] First run — building initial static site..."

    /app/server &
    SERVER_PID=$!

    echo "[startup] Waiting for backend to be ready..."
    ATTEMPTS=0
    until wget -qO /dev/null "http://localhost:${PORT:-8080}/up" 2>/dev/null; do
        ATTEMPTS=$((ATTEMPTS + 1))
        if [ "$ATTEMPTS" -ge 30 ]; then
            echo "[startup] Backend did not become ready in time — skipping initial build."
            kill "$SERVER_PID" 2>/dev/null || true
            wait "$SERVER_PID" 2>/dev/null || true
            SERVER_PID=""
            break
        fi
        sleep 1
    done

    if [ -n "$SERVER_PID" ]; then
        echo "[startup] Running Eleventy build..."
        BACKEND_URL="http://localhost:${PORT:-8080}" \
        SITE_DIST="/storage/site-dist" \
        bash /app/site/build.sh \
            && echo "[startup] Site build complete." \
            || echo "[startup] Site build failed — continuing anyway."

        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
fi

echo "[startup] Starting server..."
exec /app/server
