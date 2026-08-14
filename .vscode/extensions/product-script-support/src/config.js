const vscode = require('vscode');
const path = require('path');

function getWorkspaceFolder(uri) {
    if (uri) {
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (folder) return folder;
    }
    return vscode.workspace.workspaceFolders?.[0];
}

function getConfiguration(folder) {
    return vscode.workspace.getConfiguration('productScript', folder?.uri);
}

function expandVariables(value, folder, rootScriptUri) {
    if (typeof value !== 'string') return value;
    const workspaceFolder = folder?.uri.fsPath ?? '';
    const rootScript = rootScriptUri?.fsPath ?? '';
    const rootScriptRelative = rootScriptUri && folder
        ? path.relative(folder.uri.fsPath, rootScriptUri.fsPath)
        : '';

    return value
        .replaceAll('${workspaceFolder}', workspaceFolder)
        .replaceAll('${rootScript}', rootScript)
        .replaceAll('${rootScriptRelative}', rootScriptRelative);
}

function resolveWorkspacePath(folder, value) {
    if (!folder || !value) return undefined;
    const expanded = expandVariables(value, folder);
    return path.isAbsolute(expanded)
        ? vscode.Uri.file(expanded)
        : vscode.Uri.joinPath(folder.uri, expanded.replaceAll('\\', '/'));
}

module.exports = {
    getWorkspaceFolder,
    getConfiguration,
    expandVariables,
    resolveWorkspacePath
};
