#!/data/data/com.termux/files/usr/bin/bash
#
# uninstall.sh - removes the Termux Code Editor and the global `code` command.
#
set -euo pipefail

INSTALL_DIR="$HOME/.termux-code-editor"
BIN_DIR="${PREFIX:-/usr}/bin"

echo "Removing $INSTALL_DIR ..."
rm -rf "$INSTALL_DIR"

if [ -f "$BIN_DIR/code" ]; then
  echo "Removing $BIN_DIR/code ..."
  rm -f "$BIN_DIR/code"
fi

echo "Termux Code Editor has been uninstalled."
