#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZOIA_LIB_DIR="$ROOT/.vendor/zoia_lib"
ZOIA_LIB_REVISION="9a959c4ef2ecbaa82f6525761472058bbead7d66"

if [[ ! -d "$ZOIA_LIB_DIR/.git" ]]; then
  mkdir -p "$ROOT/.vendor"
  git clone --quiet https://github.com/meanmedianmoge/zoia_lib.git "$ZOIA_LIB_DIR"
fi

git -C "$ZOIA_LIB_DIR" fetch --quiet origin "$ZOIA_LIB_REVISION"
git -C "$ZOIA_LIB_DIR" checkout --quiet "$ZOIA_LIB_REVISION"

PYTHON=""
for candidate in python3 python /opt/homebrew/bin/python3 /usr/local/bin/python3 /Library/Frameworks/Python.framework/Versions/3.12/bin/python3; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import ssl, venv' >/dev/null 2>&1; then
    PYTHON="$(command -v "$candidate")"
    break
  fi
done

if [[ -z "$PYTHON" ]]; then
  echo "Python 3 with SSL and venv support is required." >&2
  exit 1
fi

if [[ -x "$ROOT/.venv/bin/python" ]] && ! "$ROOT/.venv/bin/python" -c 'import ssl' >/dev/null 2>&1; then
  rm -rf "$ROOT/.venv"
fi
if [[ ! -x "$ROOT/.venv/bin/python" ]]; then
  "$PYTHON" -m venv "$ROOT/.venv"
fi

"$ROOT/.venv/bin/python" -m pip install --quiet --disable-pip-version-check -r "$ROOT/service/requirements.txt"
printf 'Parser ready: zoia_lib %s\n' "$ZOIA_LIB_REVISION"
