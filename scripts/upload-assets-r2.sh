#!/usr/bin/env bash
set -euo pipefail

BUCKET="cpma-assets"

for f in website/public/baseq3/*.pk3; do
  echo "Uploading $f ..."
  npx wrangler r2 object put --remote "$BUCKET/baseq3/$(basename "$f")" --file="$f"
done

for f in website/public/cpma/*.pk3; do
  echo "Uploading $f ..."
  npx wrangler r2 object put --remote "$BUCKET/cpma/$(basename "$f")" --file="$f"
done

echo "Done."
