#!/data/data/com.termux/files/usr/bin/bash
#
# install.sh - Production-ready installer for RTKCode
#
set -euo pipefail

# --- Configuration ---
INSTALL_DIR="$HOME/.termux-code-editor"
VENV_DIR="$INSTALL_DIR/venv"
BIN_DIR="$PREFIX/bin"
MONACO_VERSION="0.47.0"
REQUIRED_PKGS=(python git curl tar unzip)

# --- Helpers ---
log() { echo -e "\033[1;32m[INFO]\033[0m $1"; }
err() { echo -e "\033[1;31m[ERROR]\033[0m $1" >&2; exit 1; }

check_termux() {
    [ -d "/data/data/com.termux" ] || err "This installer is designed for Termux only."
}

# --- 1. Environment Verification ---
check_termux
log "Verifying architecture and dependencies..."

pkg update -y >/dev/null
for pkg in "${REQUIRED_PKGS[@]}"; do
    if ! command -v "$pkg" >/dev/null; then
        log "Installing $pkg..."
        pkg install -y "$pkg"
    fi
done

# --- 2. VENV Setup (Idempotent) ---
if [ ! -d "$VENV_DIR" ]; then
    log "Creating virtual environment..."
    python -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

# --- 3. Dependency Installation ---
log "Installing/Updating Python dependencies..."
pip install --quiet -r requirements.txt

# --- 4. Install Application Files ---
log "Installing RTKCode application files..."

mkdir -p "$INSTALL_DIR"

rm -rf "$INSTALL_DIR/backend"
rm -rf "$INSTALL_DIR/frontend"

cp -r backend "$INSTALL_DIR/"
cp -r frontend "$INSTALL_DIR/"

[ -d "$INSTALL_DIR/backend" ] || err "Backend installation failed."
[ -f "$INSTALL_DIR/backend/main.py" ] || err "Backend files missing."
[ -d "$INSTALL_DIR/frontend" ] || err "Frontend installation failed."

# --- 4. Monaco Bundle (Auto-retry logic) ---
VENDOR_DIR="$INSTALL_DIR/frontend/vendor/monaco-editor"
if [ ! -f "$VENDOR_DIR/min/vs/loader.js" ]; then
    log "Downloading Monaco Editor v$MONACO_VERSION..."
    mkdir -p "$VENDOR_DIR"
    
    max_retries=3
    count=0
    success=false
    
    while [ $count -lt $max_retries ]; do
        if curl -fSL "https://registry.npmjs.org/monaco-editor/-/monaco-editor-${MONACO_VERSION}.tgz" | tar -xz -C "$VENDOR_DIR" --strip-components=1 package/min; then
            success=true
            break
        fi
        count=$((count+1))
        log "Download failed. Retrying ($count/$max_retries)..."
        sleep 2
    done

    [ "$success" = true ] || err "Failed to download Monaco Editor after $max_retries attempts."
fi

# --- 5. Install Global Binary ---
log "Installing 'code' command..."
cp bin/code "$BIN_DIR/code"
chmod +x "$BIN_DIR/code"
sed -i "s|VENV_PATH=.*|VENV_PATH=\"$VENV_DIR\"|g" "$BIN_DIR/code"

# --- 6. Health Checks ---
log "Performing health checks..."
[ -f "$VENV_DIR/bin/python" ] || err "Venv setup failed."
[ -d "$VENDOR_DIR/min/vs" ] || err "Monaco bundle integrity check failed."
[ -x "$BIN_DIR/code" ] || err "Binary installation failed."

log "Installation successful."
