#!/bin/bash
# Script Universal de Versionamento Antigravity
NEW_VERSION=$1

if [[ ! $NEW_VERSION =~ ^V[0-9]+\.[0-9]{2}\.[0-9]{2}$ ]]; then
  echo "❌ Formato INVÁLIDO! Use o padrão V1.XX.XX (Ex: V1.01.04)"
  exit 1
fi

# 1. Atualizar VERSION.md do projeto
if [ -f "VERSION.md" ]; then
  sed -i "s/Versão Atual: \*\*.*\*\*/Versão Atual: \*\*$NEW_VERSION\*\*/" VERSION.md
fi

# 2. Atualizar package.json (removendo o 'V' para compatibilidade npm se necessário)
PLAIN_VERSION=${NEW_VERSION#V}
if [ -f "apps/web/package.json" ]; then
  sed -i "s/\"version\": \"[0-9.]\+\"/\"version\": \"$PLAIN_VERSION\"/" apps/web/package.json
fi

# 3. Atualizar version.ts da UI
if [ -f "apps/web/src/lib/version.ts" ]; then
  echo "export const APP_VERSION = '$NEW_VERSION'" > apps/web/src/lib/version.ts
fi

echo "✅ Versão elevada para $NEW_VERSION"
