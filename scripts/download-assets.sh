#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TMP_DIR="${ROOT_DIR}/.assets-tmp"

CLIENT_BASEQ3="${ROOT_DIR}/website/game-assets/baseq3"
CLIENT_CPMA="${ROOT_DIR}/website/game-assets/cpma"
SERVER_BASEQ3="${ROOT_DIR}/server/baseq3"
SERVER_CPMA="${ROOT_DIR}/server/cpma"

mkdir -p "$TMP_DIR" "$CLIENT_BASEQ3" "$CLIENT_CPMA" "$SERVER_BASEQ3" "$SERVER_CPMA"

# ============================================================================
# baseq3 demo paks
# ============================================================================
echo "=== Downloading Quake 3 demo pak files ==="

DEMO_URL="https://ftp.gwdg.de/pub/misc/ftp.idsoftware.com/idstuff/quake3/linux/linuxq3ademo-1.11-6.x86.gz.sh"
PATCH_URL="https://files.ioquake3.org/quake3-latest-pk3s.zip"

if [ ! -f "$CLIENT_BASEQ3/pak0.pk3" ]; then
    echo "Downloading Quake 3 demo installer..."
    curl -L -o "${TMP_DIR}/q3demo.sh.gz" "$DEMO_URL"

    echo "Extracting demo pak0.pk3..."
    gunzip -c "${TMP_DIR}/q3demo.sh.gz" > "${TMP_DIR}/q3demo.sh" 2>/dev/null || cp "${TMP_DIR}/q3demo.sh.gz" "${TMP_DIR}/q3demo.sh"
    chmod +x "${TMP_DIR}/q3demo.sh"
    cd "$TMP_DIR" && ./q3demo.sh --tar xf --wildcards '*/pak0.pk3' 2>/dev/null || true
    find "$TMP_DIR" -name "pak0.pk3" -exec cp {} "$CLIENT_BASEQ3/" \; 2>/dev/null || echo "Warning: pak0.pk3 extraction failed"
    cp "$CLIENT_BASEQ3/pak0.pk3" "$SERVER_BASEQ3/" 2>/dev/null || true
else
    echo "pak0.pk3 already exists, skipping..."
fi

if [ ! -f "$CLIENT_BASEQ3/pak1.pk3" ]; then
    echo "Downloading patch pk3s (pak1-pak8)..."
    curl -L -o "${TMP_DIR}/patches.zip" "$PATCH_URL"
    unzip -o "${TMP_DIR}/patches.zip" -d "$TMP_DIR"
    cp "${TMP_DIR}"/quake3-latest-pk3s/baseq3/*.pk3 "$CLIENT_BASEQ3/"
    cp "${TMP_DIR}"/quake3-latest-pk3s/baseq3/*.pk3 "$SERVER_BASEQ3/"
else
    echo "Patch paks already exist, skipping..."
fi

# ============================================================================
# Hi-res textures
# ============================================================================
echo "=== Downloading hi-res textures ==="

HIRES_URL="https://files.ioquake3.org/xcsv_hires.zip"

if [ ! -f "$CLIENT_BASEQ3/xcsv_bq3hi-res.pk3" ]; then
    echo "Downloading xcsv hi-res texture pack..."
    curl -L -o "${TMP_DIR}/xcsv_hires.zip" "$HIRES_URL"
    unzip -o "${TMP_DIR}/xcsv_hires.zip" -d "$TMP_DIR"
    cp "${TMP_DIR}/xcsv_bq3hi-res.pk3" "$CLIENT_BASEQ3/"
    cp "${TMP_DIR}/xcsv_bq3hi-res.pk3" "$SERVER_BASEQ3/"
else
    echo "Hi-res textures already exist, skipping..."
fi

# ============================================================================
# Quake Live sounds
# ============================================================================
echo "=== Downloading Quake Live sounds ==="

SOUNDS_URL="https://github.com/diegoulloao/ioquake3-mac-install/raw/master/extras/quake3-live-sounds.pk3"

if [ ! -f "$CLIENT_BASEQ3/quake3-live-sounds.pk3" ]; then
    echo "Downloading Quake Live sounds..."
    curl -L -o "$CLIENT_BASEQ3/quake3-live-sounds.pk3" "$SOUNDS_URL"
    cp "$CLIENT_BASEQ3/quake3-live-sounds.pk3" "$SERVER_BASEQ3/"
else
    echo "Quake Live sounds already exist, skipping..."
fi

# ============================================================================
# zpack weapons
# ============================================================================
echo "=== Downloading zpack weapons ==="

WEAPONS_URL="https://github.com/diegoulloao/ioquake3-mac-install/raw/master/extras/zpack-weapons.pk3"

if [ ! -f "$CLIENT_BASEQ3/zpack-weapons.pk3" ]; then
    echo "Downloading zpack weapons..."
    curl -L -o "$CLIENT_BASEQ3/zpack-weapons.pk3" "$WEAPONS_URL"
    cp "$CLIENT_BASEQ3/zpack-weapons.pk3" "$SERVER_BASEQ3/"
else
    echo "zpack weapons already exist, skipping..."
fi

# ============================================================================
# CPMA 1.53
# ============================================================================
echo "=== Downloading CPMA 1.53 ==="

CPMA_URL="https://cdn.playmorepromode.com/files/cpma/cpma-1.53-nomaps.zip"

if [ ! -f "$CLIENT_CPMA/z-cpma-pak153.pk3" ]; then
    echo "Downloading CPMA 1.53..."
    curl -L -o "${TMP_DIR}/cpma.zip" "$CPMA_URL"
    unzip -o "${TMP_DIR}/cpma.zip" -d "$TMP_DIR"

    # Copy pk3 to both client and server
    cp "${TMP_DIR}/cpma/z-cpma-pak153.pk3" "$CLIENT_CPMA/"
    cp "${TMP_DIR}/cpma/z-cpma-pak153.pk3" "$SERVER_CPMA/"

    # Copy cfg-maps to server (needed for map lists)
    cp -r "${TMP_DIR}/cpma/cfg-maps" "$SERVER_CPMA/"

    # Copy default modes to server (won't overwrite existing custom modes)
    mkdir -p "$SERVER_CPMA/modes"
    cp -n "${TMP_DIR}/cpma/modes/"*.cfg "$SERVER_CPMA/modes/" 2>/dev/null || true
else
    echo "CPMA 1.53 already exists, skipping..."
fi

# ============================================================================
# CPMA Map Pack
# ============================================================================
echo "=== Downloading CPMA map pack ==="

MAPS_URL="https://cdn.playmorepromode.com/files/cpma-mappack-full.zip"

if [ ! -f "$CLIENT_CPMA/map_cpm1a.pk3" ]; then
    echo "Downloading CPMA map pack..."
    curl -L -o "${TMP_DIR}/cpma-maps.zip" "$MAPS_URL"
    unzip -o "${TMP_DIR}/cpma-maps.zip" -d "$TMP_DIR"

    # Find and copy all map pk3s
    find "$TMP_DIR" -name "map_*.pk3" -exec cp {} "$CLIENT_CPMA/" \;
    find "$TMP_DIR" -name "map_*.pk3" -exec cp {} "$SERVER_CPMA/" \;
else
    echo "CPMA maps already exist, skipping..."
fi

# ============================================================================
# Cleanup
# ============================================================================
echo "=== Cleaning up ==="
rm -rf "$TMP_DIR"

echo ""
echo "=== Done! Assets installed ==="
echo "Client baseq3: $(ls -1 "$CLIENT_BASEQ3"/*.pk3 2>/dev/null | wc -l | tr -d ' ') pk3 files"
echo "Client cpma: $(ls -1 "$CLIENT_CPMA"/*.pk3 2>/dev/null | wc -l | tr -d ' ') pk3 files"
echo "Server baseq3: $(ls -1 "$SERVER_BASEQ3"/*.pk3 2>/dev/null | wc -l | tr -d ' ') pk3 files"
echo "Server cpma: $(ls -1 "$SERVER_CPMA"/*.pk3 2>/dev/null | wc -l | tr -d ' ') pk3 files"
echo ""
echo "Note: Server configs (server.cfg, modes/OKIDOKI.cfg) are in the repo, not downloaded."
