#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
# If SITE_DIST is set (e.g. by the ONCE entrypoint), write output there.
# Otherwise fall back to the default output dir configured in eleventy.config.js (dist/).
if [ -n "$SITE_DIST" ]; then
    npx @11ty/eleventy --output "$SITE_DIST"
else
    npm run build
fi
