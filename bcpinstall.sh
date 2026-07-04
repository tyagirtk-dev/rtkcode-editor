#!/data/data/com.termux/files/usr/bin/bash
#
# install.sh - installs the Termux Code Editor and the global `code` command.
#
# Usage:
#   bash install.sh
#
set -euo pipefail

echo "== Termux Code Editor - Installer =="
echo ""

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/.termux-code-editor"
BIN_DIR="${PREFIX:-/usr}/bin"
MONACO_VERSION="0.47.0"

# ---------------------------------------------------------------------------
echo "[1/6] Checking dependencies..."
# ---------------------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

if ! have python3; then
  echo "  Installing python..."
  pkg install -y python
fi

if ! have pip && ! python3 -m pip --version >/dev/null 2>&1; then
  echo "  Installing python-pip..."
  pkg install -y python-pip
fi

if ! have curl; then
  echo "  Installing curl..."
  pkg install -y curl
fi

if ! have tar; then
  echo "  Installing tar..."
  pkg install -y tar
fi

# ---------------------------------------------------------------------------
echo "[2/6] Installing Python packages (fastapi, uvicorn)..."
# ---------------------------------------------------------------------------
python3 -m pip install --quiet --upgrade pip
python3 -m pip install --quiet -r "$SRC_DIR/requirements.txt"

# ---------------------------------------------------------------------------
echo "[3/6] Copying application files to $INSTALL_DIR..."
# ---------------------------------------------------------------------------
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -r "$SRC_DIR/backend" "$INSTALL_DIR/backend"
cp -r "$SRC_DIR/frontend" "$INSTALL_DIR/frontend"

# ---------------------------------------------------------------------------
echo "[4/6] Downloading Monaco Editor (bundled locally for fully offline use)..."
# ---------------------------------------------------------------------------
VENDOR_DIR="$INSTALL_DIR/frontend/vendor/monaco-editor"
mkdir -p "$VENDOR_DIR"
TMP_TGZ="$(mktemp -t monaco-XXXXXX.tgz)"
TMP_EXTRACT="$(mktemp -d -t monaco-extract-XXXXXX)"

if curl -fsSL "https://registry.npmjs.org/monaco-editor/-/monaco-editor-${MONACO_VERSION}.tgz" -o "$TMP_TGZ"; then
  tar -xzf "$TMP_TGZ" -C "$TMP_EXTRACT"
  cp -r "$TMP_EXTRACT/package/min" "$VENDOR_DIR/min"
  [ -d "$TMP_EXTRACT/package/min-maps" ] && cp -r "$TMP_EXTRACT/package/min-maps" "$VENDOR_DIR/min-maps"
  echo "  Monaco Editor bundled successfully."
else
  echo ""
  echo "  WARNING: could not download Monaco Editor automatically (no network?)."
  echo "  The editor UI will not load until Monaco's 'min' folder is placed at:"
  echo "    $VENDOR_DIR/min"
  echo "  You can retry later with:"
  echo "    curl -fsSL https://registry.npmjs.org/monaco-editor/-/monaco-editor-${MONACO_VERSION}.tgz | tar -xz -C /tmp"
  echo "    cp -r /tmp/package/min $VENDOR_DIR/min"
  echo ""
fi
rm -rf "$TMP_TGZ" "$TMP_EXTRACT"

# ---------------------------------------------------------------------------
echo "[5/6] Installing the 'code' command to $BIN_DIR..."
# ---------------------------------------------------------------------------
mkdir -p "$BIN_DIR"
cp "$SRC_DIR/bin/code" "$BIN_DIR/code"
chmod +x "$BIN_DIR/code"

# ---------------------------------------------------------------------------
echo "[6/6] Done."
# ---------------------------------------------------------------------------
echo ""
echo "Installation complete! Usage:"
echo "  code .              # open the current directory"
echo "  code ~/myproject    # open a specific folder"
echo "  code app.py         # open a specific file"
echo ""
echo "To uninstall: bash uninstall.sh"
