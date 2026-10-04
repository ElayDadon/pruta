#!/bin/bash
# Pruta on macOS - starts the local server (run.py) and opens the browser.
#   Double-click this file. The first time, macOS may ask: right-click it, then Open.
# The window stays open while Pruta runs; closing it stops the server.
cd "$(dirname "$0")" || exit 1
if [ ! -f run.py ]; then
  echo ""
  echo "  run.py was not found next to this file."
  echo "  Extract the whole zip first, then run this file from the extracted folder."
  echo ""
  read -r -p "  Press Enter to close "
  exit 1
fi
if command -v python3 >/dev/null 2>&1; then
  python3 run.py
elif command -v python >/dev/null 2>&1; then
  python run.py
else
  echo ""
  echo "  Python 3 was not found on this computer."
  echo ""
  echo "  Either install it (from https://www.python.org/downloads/) and run this file again,"
  echo "  or simply open index.html in your browser - everything works there too,"
  echo "  only the data is kept in the browser instead of in this folder."
  echo ""
  read -r -p "  Press Enter to close "
  exit 1
fi
status=$?
if [ "$status" -ne 0 ] && [ "$status" -ne 130 ]; then
  echo ""
  echo "  Pruta stopped with an error. The message above says why."
  echo "  You can still use it by opening index.html in your browser."
  echo ""
  read -r -p "  Press Enter to close "
fi
