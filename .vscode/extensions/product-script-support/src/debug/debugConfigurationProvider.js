const path = require('path');

// Product Script用のデバッグ構成を生成・補完する。
class DebugConfigurationProvider {
    constructor(targetManager, getFolder) {
        this.targetManager = targetManager;
        this.getFolder = getFolder;
    }

    // 現在選択されているRoot Scriptからデバッグ構成候補を生成する。
    provideDebugConfigurations(folder) {
        // 対象ワークスペースの現在Targetを取得する。
        const target = this.targetManager.getSelectedUri(
            folder ?? this.getFolder()
        );

        // VS Codeへ提示するデバッグ構成を返す。
        return [{
            type: 'productScript',
            request: 'launch',
            name: target
                ? `Debug ${path.basename(target.fsPath)}`
                : 'Product Script: Debug Current Target',
            ...(target ? { program: target.fsPath } : {})
        }];
    }

    // 実行直前に不足しているデバッグ設定を補完する。
    async resolveDebugConfiguration(folder, config) {
        // ワークスペースフォルダを確定する。
        folder ??= this.getFolder();
        if (!folder) return undefined;

        // 必須のデバッグ設定にデフォルト値を設定する。
        if (!config.type) config.type = 'productScript';
        if (!config.request) config.request = 'launch';
        if (!config.name) {
            config.name = 'Product Script: Debug Current Target';
        }

        // program未指定の場合は現在Targetを取得して設定する。
        if (!config.program) {
            const target = await this.targetManager.requireTarget(folder);
            if (!target) return undefined;

            config.program = target.fsPath;
            config.name = `Debug ${path.basename(target.fsPath)}`;
        }

        // 補完したデバッグ構成をVS Codeへ返す。
        return config;
    }
}

module.exports = { DebugConfigurationProvider };