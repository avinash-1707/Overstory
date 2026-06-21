#!/usr/bin/env bash
# Rasterize the brand SVGs (public/favicon.svg, public/og-default.svg) into the committed
# PNG/ICO head assets. Requires ImageMagick.
#
# Why the OG step is not a plain `convert og-default.svg`: ImageMagick v6's built-in SVG text
# renderer mangles the serif wordmark's glyph advances (the letters collapse). So the card base
# is rendered from the SVG with its <text>Overstory</text> stripped, then the wordmark is drawn
# with IM-native text (correct metrics) composited on top. The SVGs themselves are correct and
# render fine in real browsers / librsvg; this is purely an IM-v6 rasterizer workaround.
set -euo pipefail
cd "$(dirname "$0")/../public"

# Favicons (pure shapes — render fine straight from SVG).
convert -density 384 -background none favicon.svg -resize 64x64 \
  -define icon:auto-resize=48,32,16 favicon.ico
convert -density 384 -background '#0c0c0b' favicon.svg -resize 180x180 -flatten apple-touch-icon.png

# OG card: base without the wordmark, then composite an IM-native serif wordmark.
tmp="$(mktemp --suffix=.svg)"
base="$(mktemp --suffix=.png)"
perl -0777 -pe 's{<!-- Wordmark.*?</text>}{}s' og-default.svg > "$tmp"
convert -density 96 -background '#0c0c0b' "$tmp" -resize 1200x630 -flatten "$base"
convert "$base" -font DejaVu-Serif -pointsize 96 -fill '#ece8de' \
  -annotate +90+422 'Overstory' og-default.png
rm -f "$tmp" "$base"

echo "wrote: favicon.ico apple-touch-icon.png og-default.png"
