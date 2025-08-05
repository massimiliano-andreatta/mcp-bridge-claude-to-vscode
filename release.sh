#!/bin/bash

# Esci immediatamente se un comando fallisce
set -e

echo "🚀 Inizio del processo di release..."

# --- Gestione del Relay ---
echo ""
echo "📦 Gestione del relay..."
cd packages/relay

echo "⬆️  Incremento della versione patch del relay..."
# Incrementa la versione ma non creare un tag git, lasciando la gestione al flusso di lavoro principale
npm version patch --no-git-tag-version

# Leggi la nuova versione da package.json
NEW_VERSION=$(node -p "require('./package.json').version")
echo "  Nuova versione del relay: $NEW_VERSION"

echo "🛠️  Build del relay..."
npm run build

echo "🎁 Creazione del pacchetto del relay..."
npm pack

TGZ_FILE="mcp-bridge-claude-to-vscode-${NEW_VERSION}.tgz"

echo "🌍 Installazione globale del pacchetto del relay ($TGZ_FILE)..."
npm install -g "./$TGZ_FILE"

echo "🚀 Pubblicazione del relay su NPM..."
npm publish

# Ritorna alla root del progetto
cd ../..

# --- Gestione dell'Estensione ---
echo ""
echo "🔌 Gestione dell'estensione..."
cd packages/extension

echo "⬆️  Incremento della versione patch dell'estensione..."
npm version patch --no-git-tag-version
NEW_EXT_VERSION=$(node -p "require('./package.json').version")
echo "  Nuova versione dell'estensione: $NEW_EXT_VERSION"

echo "📦 Pacchettizzazione dell'estensione..."
npx pnpm package-extension

# Ritorna alla root del progetto
cd ../..

echo ""
echo "✅ Processo di release completato!"
echo "  - Relay versione $NEW_VERSION pubblicato e installato globalmente."
echo "  - Estensione versione $NEW_EXT_VERSION pacchettizzata."
