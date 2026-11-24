#!/bin/bash
# Dubbelklicka på den här filen i Finder för att starta Plugga.
# Stäng fönstret (eller tryck Ctrl+C) för att stoppa.
cd "$(dirname "$0")" || exit 1
PORT=8000
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo ""
echo "  Plugga är igång!"
echo "  På den här datorn:  http://localhost:$PORT"
[ -n "$IP" ] && echo "  På iPad/annan dator i samma nätverk:  http://$IP:$PORT"
echo ""
echo "  Låt fönstret vara öppet. Stäng det för att stoppa."
echo ""
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server $PORT
else
  exec python -m SimpleHTTPServer $PORT
fi
