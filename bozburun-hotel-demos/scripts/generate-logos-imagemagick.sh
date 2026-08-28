#!/bin/bash
# generate-logos-imagemagick.sh
# ImageMagick ile Defne Lorina ve Mete Otel için görsel logolar üretir

OUTDIR="/Users/macbookairm1/Desktop/ERP/bozburun-hotel-demos/template-system/visual-assets"

# ─── DEFNE LORINA ────────────────────────────────────────────────────────────
echo "🌿 Defne Lorina logosu üretiliyor..."

magick -size 800x800 \
  xc:'#2e4a2c' \
  \( -size 800x800 xc:'#2e4a2c' \) \
  -composite \
  \
  \( -size 600x2 xc:'#b8a98a' \) -gravity Center -geometry +0-120 -composite \
  \( -size 600x2 xc:'#b8a98a' \) -gravity Center -geometry +0+90 -composite \
  \
  -font "Times-Bold" -pointsize 62 \
  -fill '#e8dcc8' \
  -gravity Center \
  -annotate +0-30 'DEFNE LORINA' \
  \
  -font "Helvetica" -pointsize 18 \
  -fill '#9aab88' \
  -gravity Center \
  -annotate +0+115 'B O Z B U R U N  ·  M A R M A R I S' \
  \
  -font "Times-Italic" -pointsize 22 \
  -fill '#b8a98a' \
  -gravity Center \
  -annotate +0+80 '— Botanik Koy Otel —' \
  \
  "$OUTDIR/defne-lorina/logo-brand.png"

echo "  ✓ defne-lorina logo-brand.png"

# Also save to generated site media dirs
cp "$OUTDIR/defne-lorina/logo-brand.png" \
   "/Users/macbookairm1/Desktop/ERP/bozburun-hotel-demos/template-system/generated-sites/defne-lorina-v1/media/logo-brand.png" 2>/dev/null || true
cp "$OUTDIR/defne-lorina/logo-brand.png" \
   "/Users/macbookairm1/Desktop/ERP/bozburun-hotel-demos/template-system/generated-sites/defne-lorina-v2/media/logo-brand.png" 2>/dev/null || true

# ─── METE OTEL ───────────────────────────────────────────────────────────────
echo "⚓ Mete Otel logosu üretiliyor..."

METE_OUTDIR=""
# Find mete otel visual assets dir
if [ -d "$OUTDIR/mete-otel-bozburun" ]; then
  METE_OUTDIR="$OUTDIR/mete-otel-bozburun"
elif [ -d "$OUTDIR/mete-otel-selimiye" ]; then
  METE_OUTDIR="$OUTDIR/mete-otel-selimiye"
fi

magick -size 800x800 \
  xc:'#1a2d40' \
  \
  \( -size 600x2 xc:'#c5a96a' \) -gravity Center -geometry +0-100 -composite \
  \( -size 600x2 xc:'#c5a96a' \) -gravity Center -geometry +0+110 -composite \
  \
  -font "Times-Bold" -pointsize 68 \
  -fill '#e8d8b0' \
  -gravity Center \
  -annotate +0-20 'METE OTEL' \
  \
  -font "Helvetica" -pointsize 18 \
  -fill '#8aa8c4' \
  -gravity Center \
  -annotate +0+120 'S E L İ M İ Y E  ·  M A R M A R İ S' \
  \
  -font "Times-Italic" -pointsize 20 \
  -fill '#c5a96a' \
  -gravity Center \
  -annotate +0+75 '— Kıyı Butik Konaklama —' \
  \
  "/tmp/mete-otel-logo-brand.png"

echo "  ✓ mete-otel logo created at /tmp/mete-otel-logo-brand.png"

# Copy to all mete otel dirs
for d in $(find /Users/macbookairm1/Desktop/ERP/bozburun-hotel-demos -type d -name "*mete*" 2>/dev/null); do
  if [ -d "$d/media" ]; then
    cp /tmp/mete-otel-logo-brand.png "$d/media/logo-brand.png"
    echo "  → $d/media/"
  fi
  cp /tmp/mete-otel-logo-brand.png "$d/logo-brand.png" 2>/dev/null || true
done

if [ -n "$METE_OUTDIR" ]; then
  cp /tmp/mete-otel-logo-brand.png "$METE_OUTDIR/logo-brand.png"
  echo "  → $METE_OUTDIR/"
fi

echo ""
echo "✅ İki logo da üretildi."
echo "   Defne Lorina: $OUTDIR/defne-lorina/logo-brand.png"
echo "   Mete Otel: /tmp/mete-otel-logo-brand.png (kopyalar yukarıda)"
