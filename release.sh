#!/bin/bash

# Esci immediatamente se un comando fallisce
set -e

echo "🚀 Inizio del processo di release..."

# Creazione delle cartelle per gli artefatti di release
echo "📁 Creazione delle cartelle per gli artefatti di release..."
mkdir -p release_assets/relay
mkdir -p release_assets/extension
echo "  Cartelle create: release_assets/relay, release_assets/extension"

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

echo "🚚 Spostamento del pacchetto del relay in release_assets/relay..."
mv "$TGZ_FILE" ../../release_assets/relay/
echo "  File $TGZ_FILE spostato."

echo "🌍 Installazione globale del pacchetto del relay..."
npm install -g "../../release_assets/relay/$TGZ_FILE"

echo "🚀 Pubblicazione del relay su NPM dall'artefatto..."
npm publish "../../release_assets/relay/$TGZ_FILE"

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

# Il nome del pacchetto è definito in package.json
EXT_NAME=$(node -p "require('./package.json').name")
VSIX_FILE="${EXT_NAME}-${NEW_EXT_VERSION}.vsix"

echo "🚚 Spostamento del pacchetto dell'estensione in release_assets/extension..."
if [ -f "$VSIX_FILE" ]; then
  mv "$VSIX_FILE" ../../release_assets/extension/
  echo "  File $VSIX_FILE spostato."
else
  echo "⚠️  Attenzione: File $VSIX_FILE non trovato nella directory corrente."
fi


# Ritorna alla root del progetto
cd ../..

echo ""
echo "✅ Processo di release completato!"
echo "  - Relay versione $NEW_VERSION pubblicato e installato globalmente."
echo "  - Estensione versione $NEW_EXT_VERSION pacchettizzata."
echo "  - Gli artefatti sono disponibili in 'release_assets/'."

