# MCP Bridge Auto-Approval System

Il sistema di auto-approvazione del MCP Bridge consente agli utenti di configurare l'approvazione automatica per diversi tipi di operazioni, riducendo la necessità di intervento manuale continuo mantenendo al contempo controlli granulari per la sicurezza.

## Caratteristiche Principali

### 🛡️ Controlli di Sicurezza Granulari

- **Operazioni di Lettura**: Controllo automatico per visualizzazione file e listing directory
- **Operazioni di Scrittura**: Gestione sicura di creazione, modifica e cancellazione file
- **Esecuzione Comandi**: Lista personalizzabile di comandi autorizzati con supporto wildcards
- **Operazioni Debug**: Auto-approvazione per sessioni di debug
- **Operazioni Terminal**: Controllo accesso terminal integrato
- **Anteprima Browser**: Auto-approvazione per apertura URL nel browser integrato

### 📊 Rate Limiting Avanzato

- Limite massimo richieste per finestra temporale
- Configurazione ritardi e timeout personalizzabili
- Reset manuale contatori rate limit
- Monitoraggio in tempo reale dello stato

### 🎯 Interfaccia Utente Intuitiva

- Pannello di configurazione WebView integrato nell'Explorer
- Indicatori di stato nella barra di stato VSCode
- Comandi della palette per gestione rapida
- Notifiche non invasive per operazioni auto-approvate

## Come Configurare

### 1. Accesso alle Impostazioni

Esistono diverse modalità per accedere alle impostazioni di auto-approvazione:

**Tramite Command Palette:**

1. Premi `Ctrl+Shift+P` (o `Cmd+Shift+P` su Mac)
2. Cerca "MCP Bridge: Open Auto-Approval Settings"
3. Premi Enter

**Tramite Explorer Panel:**

1. Apri il pannello Explorer (`Ctrl+Shift+E`)
2. Scorri fino a trovare la sezione "MCP Auto-Approval"
3. Clicca per aprire il pannello di configurazione

**Tramite Settings JSON:**

1. Apri le impostazioni utente/workspace (`Ctrl+,`)
2. Cerca "mcpBridgeC2V.autoApproval"
3. Modifica direttamente il JSON

### 2. Configurazione Base

#### Abilitazione Sistema

```json
{
  "mcpBridgeC2V.autoApproval.enabled": true
}
```

#### Configurazione Operazioni di Lettura

```json
{
  "mcpBridgeC2V.autoApproval.permissions.read": {
    "enabled": true,
    "includeOutsideWorkspace": false
  }
}
```

#### Configurazione Operazioni di Scrittura

```json
{
  "mcpBridgeC2V.autoApproval.permissions.write": {
    "enabled": true,
    "includeOutsideWorkspace": false,
    "includeProtectedFiles": false
  }
}
```

#### Configurazione Esecuzione Comandi

```json
{
  "mcpBridgeC2V.autoApproval.permissions.execute": {
    "enabled": true,
    "allowedCommands": [
      "npm install",
      "npm run *",
      "git status",
      "git add *",
      "ls *",
      "pwd",
      "cd *"
    ]
  }
}
```

### 3. Configurazioni Avanzate

#### Rate Limiting

```json
{
  "mcpBridgeC2V.autoApproval.limits": {
    "maxRequests": 100,
    "timeWindowMinutes": 60,
    "retryDelaySeconds": 10,
    "requestTimeoutSeconds": 60
  }
}
```

## Esempi di Configurazione

### Configurazione Conservativa (Raccomandata per Iniziare)

```json
{
  "mcpBridgeC2V.autoApproval": {
    "enabled": true,
    "permissions": {
      "read": {
        "enabled": true,
        "includeOutsideWorkspace": false
      },
      "write": {
        "enabled": false,
        "includeOutsideWorkspace": false,
        "includeProtectedFiles": false
      },
      "execute": {
        "enabled": true,
        "allowedCommands": ["ls *", "pwd", "git status"]
      },
      "debug": { "enabled": false },
      "terminal": { "enabled": false },
      "browser": { "enabled": true }
    },
    "limits": {
      "maxRequests": 50,
      "timeWindowMinutes": 30,
      "retryDelaySeconds": 5,
      "requestTimeoutSeconds": 30
    }
  }
}
```

### Configurazione Sviluppatore Esperto

```json
{
  "mcpBridgeC2V.autoApproval": {
    "enabled": true,
    "permissions": {
      "read": {
        "enabled": true,
        "includeOutsideWorkspace": true
      },
      "write": {
        "enabled": true,
        "includeOutsideWorkspace": false,
        "includeProtectedFiles": false
      },
      "execute": {
        "enabled": true,
        "allowedCommands": [
          "npm *",
          "yarn *",
          "pnpm *",
          "git *",
          "ls *",
          "pwd",
          "cd *",
          "mkdir *",
          "touch *",
          "cat *",
          "grep *",
          "find *"
        ]
      },
      "debug": { "enabled": true },
      "terminal": { "enabled": true },
      "browser": { "enabled": true }
    },
    "limits": {
      "maxRequests": 200,
      "timeWindowMinutes": 60,
      "retryDelaySeconds": 10,
      "requestTimeoutSeconds": 60
    }
  }
}
```

## File Protetti

Il sistema considera "protetti" i seguenti pattern di file e directory:

- `.git/**` - Repository Git
- `.vscode/**` - Configurazioni VSCode
- `node_modules/**` - Dipendenze Node.js
- `**/.env*` - File di ambiente
- `**/package-lock.json` - Lock file NPM
- `**/yarn.lock` - Lock file Yarn
- `**/pnpm-lock.yaml` - Lock file PNPM
- `**/*.key` - Chiavi private
- `**/*.pem` - Certificati
- `**/*.p12` - Keystore

## Comandi Disponibili

### Command Palette

- `MCP Bridge: Open Auto-Approval Settings` - Apre pannello configurazione
- `MCP Bridge: Toggle Auto-Approval` - Abilita/disabilita sistema
- `MCP Bridge: Reset Rate Limits` - Reset contatori rate limiting

### Programmatici

- `mcpBridgeC2V.openAutoApprovalSettings`
- `mcpBridgeC2V.toggleAutoApproval`
- `mcpBridgeC2V.resetRateLimits`

## Indicatori di Stato

### Barra di Stato

- `$(server) MCP Bridge $(shield)` - Server attivo, auto-approvazione abilitata
- `$(server) MCP Bridge $(shield-x)` - Server attivo, auto-approvazione disabilitata
- `$(circle-slash) MCP Bridge $(shield-x)` - Server non attivo

### Notifiche

- `$(check) Auto-approved: [operazione]` - Operazione auto-approvata
- Messaggio temporaneo nella barra di stato per 3 secondi

## Sicurezza e Best Practices

### ⚠️ Raccomandazioni di Sicurezza

1. **Inizia Conservativo**: Abilita solo operazioni di lettura e comandi sicuri
2. **Revisa Regolarmente**: Controlla periodicamente i comandi autorizzati
3. **Monitoraggio**: Tieni traccia delle operazioni auto-approvate
4. **Workspace Isolation**: Evita di abilitare operazioni fuori workspace per progetti sensibili
5. **Rate Limiting**: Mantieni limiti ragionevoli per prevenire abusi

### 🔒 File Sensibili

- Sempre rivedere modifiche a file di configurazione critici
- Prestare attenzione ai file di ambiente e credenziali
- Verificare modifiche a script di build e deployment

### 📝 Logging e Auditing

- Tutte le operazioni auto-approvate sono registrate nell'Output Channel
- I rate limit sono tracciati e resetabili
- Le configurazioni sono salvate nelle settings VSCode

## Risoluzione Problemi

### Auto-Approvazione Non Funziona

1. Verifica che `enabled: true` sia impostato
2. Controlla che l'operazione specifica sia abilitata
3. Verifica i rate limits
4. Controlla l'Output Channel per messaggi di debug

### Rate Limit Raggiunto

1. Usa il comando "Reset Rate Limits"
2. Aumenta `maxRequests` o `timeWindowMinutes`
3. Verifica non ci siano loop infiniti

### Comandi Non Riconosciuti

1. Controlla la sintassi wildcards (`*` non `**`)
2. Verifica che il comando sia nella lista `allowedCommands`
3. Testa con comandi più specifici prima di usare wildcards

## Contribuire

Per segnalazioni bug, richieste feature o contributi:

1. Apri issue nel repository GitHub
2. Fornisci dettagli sulla configurazione
3. Includi log dall'Output Channel se applicabile

## Changelog

### v0.0.1

- Implementazione sistema base auto-approvazione
- Supporto per operazioni Read/Write/Execute/Debug/Terminal/Browser
- Rate limiting configurabile
- Interfaccia WebView per configurazione
- Integrazione barra di stato VSCode
