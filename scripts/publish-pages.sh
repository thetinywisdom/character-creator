#!/usr/bin/env bash
# Publish the built game to GitHub Pages: https://thetinywisdom.github.io/character-creator/
# Builds, then adds a normal commit on the gh-pages branch with the contents of
# dist/ (no history rewriting), and pushes it. GitHub serves it a minute later.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
W=$(mktemp -d)
git fetch -q origin gh-pages
git worktree add -q "$W" origin/gh-pages
( cd "$W" && git checkout -q -B gh-pages origin/gh-pages && git rm -rq . && cp -r "$OLDPWD/dist/." . && touch .nojekyll \
  && git add -A && git commit -q -m "Publish $(git -C "$OLDPWD" rev-parse --short HEAD) to GitHub Pages" && git push -q origin gh-pages )
git worktree remove --force "$W"
echo "Published: https://thetinywisdom.github.io/character-creator/"
