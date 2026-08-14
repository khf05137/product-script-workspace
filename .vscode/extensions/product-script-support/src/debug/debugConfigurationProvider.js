const path = require('path');

class DebugConfigurationProvider {
    constructor(targetManager, getFolder) {
        this.targetManager = targetManager;
        this.getFolder = getFolder;
    }

    provideDebugConfigurations(folder) {
        const target = this.targetManager.getSelectedUri(folder ?? this.getFolder());
        return [{
            type: 'productScript',
            request: 'launch',
            name: target ? `Debug ${path.basename(target.fsPath)}` : 'Product Script: Debug Current Target',
            ...(target ? { program: target.fsPath } : {})
        }];
    }

    async resolveDebugConfiguration(folder, config) {
        folder ??= this.getFolder();
        if (!folder) return undefined;
        if (!config.type) config.type = 'productScript';
        if (!config.request) config.request = 'launch';
        if (!config.name) config.name = 'Product Script: Debug Current Target';

        if (!config.program) {
            const target = await this.targetManager.requireTarget(folder);
            if (!target) return undefined;
            config.program = target.fsPath;
            config.name = `Debug ${path.basename(target.fsPath)}`;
        }
        return config;
    }
}

module.exports = { DebugConfigurationProvider };
