#!/usr/bin/env bash
# Corre el lint tras cada edición. Si todo está bien no imprime nada (no gasta tokens).
# Si falla, muestra máximo 30 líneas por stderr y sale con 2 para que Claude las corrija.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f package.json ] || exit 0
out=$(npm run lint --if-present --silent 2>&1)
if [ $? -ne 0 ]; then
  echo "$out" | head -n 30 >&2
  exit 2
fi
exit 0
