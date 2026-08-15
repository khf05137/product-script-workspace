const vscode = require('vscode');
const { getConfiguration, expandVariables } = require('../config');

// 外部Debug Adapterの起動情報を生成する。
class DebugAdapterDescriptorFactory {
    // デバッグセッションに対応するDebug Adapter実行設定を作成する。
    createDebugAdapterDescriptor(session) {
        // デバッグ対象のワークスペースとルートスクリプトを取得する。
        const folder = session.workspaceFolder;
        const rootUri = session.configuration.program
            ? vscode.Uri.file(session.configuration.program)
            : undefined;

        // ワークスペース設定からDebug Adapter情報を取得する。
        const config = getConfiguration(folder);
        const rawCommand = config.get('debugAdapter.command', '');

        if (!rawCommand) {
            vscode.window.showErrorMessage(
                'productScript.debugAdapter.command が設定されていません。'
            );
            return undefined;
        }

        // 設定値内の変数を実際のパスへ展開する。
        const command = expandVariables(rawCommand, folder, rootUri);
        const args = config
            .get('debugAdapter.arguments', [])
            .map(x => expandVariables(x, folder, rootUri));
        const cwd = expandVariables(
            config.get('debugAdapter.cwd', '${workspaceFolder}'),
            folder,
            rootUri
        );

        // 外部Debug Adapterの実行情報をVS Codeへ返す。
        return new vscode.DebugAdapterExecutable(command, args, { cwd });
    }
}

module.exports = { DebugAdapterDescriptorFactory };