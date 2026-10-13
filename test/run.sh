#!/bin/sh
# The one entry point for this repo's automated checks, as in every kick-*
# script: syntax-checks the userscript with macOS's built-in JavaScriptCore
# shell (no Node needed), then checks that `@version`, the `VERSION` constant and
# the top CHANGELOG entry agree — the version is in three places and they have
# drifted before (0.21.2). Exits non-zero on any failure.
cd "$(dirname "$0")/.." || exit 1
SCRIPT=kick-fullscreen-chat.user.js
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
if [ ! -x "$JSC" ]; then
  echo "jsc not found at $JSC — the checks need macOS's JavaScriptCore shell" >&2
  exit 1
fi
status=0
syntax=$("$JSC" -e 'try { new Function(readFile("'"$SCRIPT"'")); print("syntax OK"); } catch (e) { print("SYNTAX ERROR: " + e); }')
echo "== $syntax"
[ "$syntax" = "syntax OK" ] || status=1
meta=$(sed -n 's|^// @version  *\(.*\)$|\1|p' "$SCRIPT" | head -1)
const=$(sed -n "s|^  const VERSION = '\(.*\)';$|\1|p" "$SCRIPT" | head -1)
changelog=$(sed -n 's|^## \[\([0-9][^]]*\)\].*|\1|p' CHANGELOG.md | head -1)
echo "== @version=$meta VERSION=$const CHANGELOG=$changelog"
if [ -z "$meta" ] || [ "$meta" != "$const" ] || [ "$meta" != "$changelog" ]; then
  echo "== VERSION MISMATCH — @version, the VERSION constant and the CHANGELOG's top entry must agree"
  status=1
fi
[ "$status" -eq 0 ] && echo "== all checks passed" || echo "== FAILURES"
exit "$status"
