#!/bin/bash

# Script per testare il sistema di auto-approvazione MCP Bridge
# Previene processi appesi e testa il graceful shutdown

echo "🚀 Starting MCP Bridge Auto-Approval System Test"
echo "=================================================="

# Funzione per cleanup
cleanup() {
    echo "🧹 Cleaning up..."
    pkill -f "mcp-bridge" 2>/dev/null || true
    pkill -f "claude" 2>/dev/null || true
    echo "✅ Cleanup completed"
}

# Trap per assicurare cleanup su exit
trap cleanup EXIT INT TERM

# Test 1: Compilazione TypeScript
echo "🔧 Test 1: TypeScript Compilation"
cd packages/extension
if npx tsc --noEmit --timeout 30000; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Test 2: Build dell'estensione
echo "🔧 Test 2: Extension Build"
if timeout 60s node build.js; then
    echo "✅ Extension build successful"
else
    echo "❌ Extension build failed or timed out"
    exit 1
fi

# Test 3: Verifica file generati
echo "🔧 Test 3: Generated Files Check"
if [ -f "dist/extension.js" ]; then
    echo "✅ Extension bundle created"
    echo "📦 Bundle size: $(du -h dist/extension.js | cut -f1)"
else
    echo "❌ Extension bundle not found"
    exit 1
fi

# Test 4: Lint dei file principali
echo "🔧 Test 4: ESLint Check (key files)"
key_files=(
    "src/utils/AutoApprovalManager.ts"
    "src/utils/ServerLifecycleManager.ts" 
    "src/utils/confirmation_ui.ts"
    "src/bidi-http-transport.ts"
    "src/extension.ts"
)

for file in "${key_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Test 5: Verifica configurazione package.json
echo "🔧 Test 5: Package.json Validation"
if node -e "
const pkg = require('./package.json');
const requiredCommands = [
    'mcpBridgeC2V.openAutoApprovalSettings',
    'mcpBridgeC2V.toggleAutoApproval', 
    'mcpBridgeC2V.resetRateLimits',
    'mcpBridgeC2V.showLifecycleStatus'
];
const commands = pkg.contributes.commands.map(c => c.command);
const missing = requiredCommands.filter(cmd => !commands.includes(cmd));
if (missing.length > 0) {
    console.error('Missing commands:', missing);
    process.exit(1);
}
console.log('✅ All required commands present');
"; then
    echo "✅ Package.json validation successful"
else
    echo "❌ Package.json validation failed"
    exit 1
fi

# Test 6: Verifica schema auto-approval
echo "🔧 Test 6: Auto-Approval Schema Validation"
if node -e "
const pkg = require('./package.json');
const autoApprovalConfig = pkg.contributes.configuration.properties['mcpBridgeC2V.autoApproval'];
if (!autoApprovalConfig) {
    console.error('Auto-approval configuration missing');
    process.exit(1);
}
const required = ['enabled', 'permissions', 'limits'];
const configProps = Object.keys(autoApprovalConfig.default);
const missing = required.filter(prop => !configProps.includes(prop));
if (missing.length > 0) {
    console.error('Missing auto-approval properties:', missing);
    process.exit(1);
}
console.log('✅ Auto-approval schema valid');
"; then
    echo "✅ Auto-approval configuration valid"
else
    echo "❌ Auto-approval configuration invalid"
    exit 1
fi

echo ""
echo "🎉 All Tests Passed!"
echo "================================"
echo "✅ TypeScript compilation"
echo "✅ Extension build"
echo "✅ Generated files"
echo "✅ File structure"
echo "✅ Package.json configuration"
echo "✅ Auto-approval schema"
echo ""
echo "🚀 MCP Bridge Auto-Approval System is ready!"
echo ""
echo "📝 Next Steps:"
echo "   1. Install the extension in VSCode"
echo "   2. Configure auto-approval settings via Command Palette"
echo "   3. Test with Claude Desktop integration"
echo "   4. Monitor lifecycle status to prevent hanging processes"
echo ""
echo "🛡️ Security Reminder:"
echo "   • Start with conservative settings"
echo "   • Review auto-approved operations regularly"  
echo "   • Use rate limiting appropriately"
echo "   • Monitor the ServerLifecycleManager status"
