#!/usr/bin/env bash
# Show the open team notes for whoever is running this. See notes/README.md.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

who="${BIY_ME:-}"
if [ -z "$who" ]; then
  id="$(git config user.name 2>/dev/null) $(git config user.email 2>/dev/null)"
  id="$(printf '%s' "$id" | tr '[:upper:]' '[:lower:]')"
  case "$id" in
    *luis*|*henrich*) who=luis ;;
    *rapha*|*dery*)   who=raphael ;;
    *jad*|*merzouki*|*mzk*) who=jad ;;
    *) echo "notes: can't tell who you are from git ($id). Set BIY_ME=luis|jad|raphael." >&2; exit 0 ;;
  esac
fi

dir="notes/to-$who"
shopt -s nullglob
files=("$dir"/*.md)
if [ ${#files[@]} -eq 0 ]; then
  echo "notes: no open notes for $who."
  exit 0
fi

echo "notes: ${#files[@]} open note(s) for $who in $dir/. Act on them, then delete each file and commit 'notes: done <topic>'."
for f in "${files[@]}"; do
  echo
  echo "===== $f ====="
  cat "$f"
done
