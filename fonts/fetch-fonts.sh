#!/bin/sh
# Re-download Familjen Grotesk woff2 files from Google Fonts.
# Requires: curl. Produces the same file set referenced by css/fonts.css.
set -e
cd "$(dirname "$0")"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
for W in 400 500 600 700; do
  CSS=$(curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@$W&display=swap")
  i=0
  echo "$CSS" | grep -o 'https://[^)]*\.woff2' | while read -r url; do
    curl -s -A "$UA" -o "familjen-$W-$i.woff2" "$url"
    i=$((i+1))
  done
done
echo "done — verify file count matches css/fonts.css @font-face blocks"
