(function () {
    const vscode = acquireVsCodeApi();
    let currentConfig = {};

    // DOM Elements
    const autoApprovalHeader = document.querySelector('.auto-approval-header');
    const autoApprovalBody = document.querySelector('.auto-approval-body');
    const chevron = document.querySelector('.auto-approval-header .chevron');
    const openSettingsLink = document.getElementById('open-settings-link');
    const autoApproveCheckbox = document.getElementById('auto-approve-checkbox');
    const gridButtons = document.querySelectorAll('.buttons-grid button');

    let isAutoApprovalOpen = false;

    // Functions
    function updatePanelUI(config) {
        currentConfig = config;
        if (!currentConfig.permissions) {
            currentConfig.permissions = {}; // Ensure permissions object exists
        }
        autoApproveCheckbox.checked = config.enabled;

        gridButtons.forEach(button => {
            const permissionKey = button.dataset.permissionKey;
            if (permissionKey && config.permissions[permissionKey]) {
                if (config.permissions[permissionKey].enabled) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });
    }

    function updateConfig() {
        vscode.postMessage({ command: 'updateAutoApprovalConfig', config: currentConfig });
    }

    // Event Listeners
    autoApproveCheckbox.addEventListener('change', () => {
        currentConfig.enabled = autoApproveCheckbox.checked;
        updateConfig();
    });

    autoApprovalHeader.addEventListener('click', (event) => {
        // Prevent toggling when clicking on the checkbox itself
        if (event.target === autoApproveCheckbox) {
            return;
        }

        isAutoApprovalOpen = !isAutoApprovalOpen;
        if (isAutoApprovalOpen) {
            autoApprovalBody.style.display = 'block';
            chevron.style.transform = 'rotate(-135deg)';
        } else {
            autoApprovalBody.style.display = 'none';
            chevron.style.transform = 'rotate(45deg)';
        }
    });

    openSettingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        vscode.postMessage({ command: 'openAutoApprovalSettings' });
    });

    gridButtons.forEach(button => {
        button.addEventListener('click', () => {
            const permissionKey = button.dataset.permissionKey;
            if (permissionKey) {
                if (!currentConfig.permissions[permissionKey]) {
                    currentConfig.permissions[permissionKey] = { enabled: false };
                }
                currentConfig.permissions[permissionKey].enabled = !currentConfig.permissions[permissionKey].enabled;
                button.classList.toggle('active');
                updateConfig();
            }
        });
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateAutoApprovalConfig':
                updatePanelUI(message.config);
                break;
        }
    });

    // Initial request for config
    vscode.postMessage({ command: 'getAutoApprovalConfig' });

}());