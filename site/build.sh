#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -n "$SITE_DIST" ]; then
    # Build into a temp directory first; only replace the live dir on success.
    SITE_DIST_TMP="${SITE_DIST}.tmp.$$"
    OLD_DIST="${SITE_DIST}.old.$$"

    # Clean any leftover temp dirs from previous failed builds
    rm -rf "${SITE_DIST}.tmp."* "${SITE_DIST}.old."* 2>/dev/null || true

    # Ensure temp dir is removed if the build fails
    cleanup() { rm -rf "$SITE_DIST_TMP"; }
    trap cleanup EXIT

    echo "[folio] Building site into ${SITE_DIST_TMP} …"
    npx @11ty/eleventy --output "$SITE_DIST_TMP"

    echo "[folio] Build succeeded. Swapping into ${SITE_DIST} …"
    # Atomic-ish swap: move live aside, move new into place, remove old
    if [ -d "$SITE_DIST" ]; then
        mv "$SITE_DIST" "$OLD_DIST"
    fi
    mv "$SITE_DIST_TMP" "$SITE_DIST"
    rm -rf "$OLD_DIST"

    # Disable cleanup trap — swap succeeded
    trap - EXIT
    echo "[folio] Site updated."
else
    npm run build
fi
