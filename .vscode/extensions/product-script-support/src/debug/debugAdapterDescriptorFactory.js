const vscode = require('vscode');
const { getConfiguration, expandVariables } = require('../config');

class DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(session) {
        const folder = session.workspaceFolder;
        const rootUri = session.configuration.program ? vscode.Uri.file(session.configuration.program) : undefined;
        const config = getConfiguration(folder);
        const rawCommand = config.get('debugAdapter.command', '');
        if (!rawCommand) {
            vscode.window.showErrorMessage('productScript.debugAdapter.command が設定されていません。');
            return undefined;
        }

        const command = expandVariables(rawCommand, folder, rootUri);
        const args = config.get('debugAdapter.arguments', []).map(x => expandVariables(x, folder, rootUri));
        const cwd = expandVariables(config.get('debugAdapter.cwd', '${workspaceFolder}'), folder, rootUri);
        return new vscode.DebugAdapterExecutable(command, args, { cwd });
    }
}

module.exports = { DebugAdapterDescriptorFactory };
