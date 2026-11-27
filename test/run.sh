#!/bin/sh
# The one entry point for this repo's automated checks, as in every kick-*
# script: syntax-checks the userscript with macOS's built-in JavaScriptCore
# shell (no Node needed), then checks that `@version`, the `VERSION` constant and
# the top CHANGELOG entry agree — the version is in three places and they have
# drifted before (0.21.2), then runs the logic tests (test/logic.test.js).
# Exits non-zero on any failure.
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

# Logic tests. One file is built from test/env.js (a fake page), every
# top-level `const` / `let` declaration of the script, and test/logic.test.js,
# then run with jsc, so the tests call the very code that ships. A declaration
# starts at a line indented exactly two spaces with `const ` or `let `, and runs
# until the next two-space line that isn't a closing `}`, `)`, `]` or backtick.
# The IIFE's other top-level statements (listeners, boot) are left out, so
# nothing starts. A top-level `function` in test/env.js replaces the script's
# declaration of the same name.
echo "== test/logic.test.js"
stubs=" $(sed -n 's/^function \([A-Za-z_$][A-Za-z0-9_$]*\).*/\1/p' test/env.js | tr '\n' ' ') "
bundle=$(mktemp "${TMPDIR:-/tmp}/kfc-tests.XXXXXX")
trap 'rm -f "$bundle"' EXIT
{
  cat test/env.js
  awk -v stubs="$stubs" '
    /^  [^ ]/ && !/^  [})\]`]/ {
      cap = 0
      if (match($0, /^  (const|let) [A-Za-z_$][A-Za-z0-9_$]*/)) {
        split(substr($0, 3, RLENGTH - 2), w, " ")
        cap = index(stubs, " " w[2] " ") == 0
      }
    }
    cap { print }' "$SCRIPT"
  cat test/logic.test.js
} > "$bundle"
"$JSC" "$bundle" || status=1

# Family style: colours from the shared palette (test/family-style.js).
echo "== test/family-style.js"
"$JSC" test/family-style.js || status=1

[ "$status" -eq 0 ] && echo "== all checks passed" || echo "== FAILURES"
exit "$status"
