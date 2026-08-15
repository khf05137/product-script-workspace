const vscode = require('vscode');
const path = require('path');

// URIに対応するワークスペースフォルダを取得する。
function getWorkspaceFolder(uri) {
    // URIが指定されている場合は、そのURIを含むワークスペースを優先する。
    if (uri) {
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (folder) return folder;
    }

    // 見つからない場合は先頭のワークスペースフォルダを返す。
    return vscode.workspace.workspaceFolders?.[0];
}

// Product Script用のワークスペース設定を取得する。
function getConfiguration(folder) {
    return vscode.workspace.getConfiguration(
        'productScript',
        folder?.uri
    );
}

// 設定値内のワークスペース・Root Script関連変数を展開する。
function expandVariables(value, folder, rootScriptUri) {
    if (typeof value !== 'string') {
        return value;
    }

    // 変数展開に使用するパス情報を取得する。
    const workspaceFolder = folder?.uri.fsPath ?? '';
    const rootScript = rootScriptUri?.fsPath ?? '';
    const rootScriptRelative = rootScriptUri && folder
        ? path.relative(
            folder.uri.fsPath,
            rootScriptUri.fsPath
        )
        : '';

    // 独自変数を実際のパスへ置換する。
    return value
        .replaceAll('${workspaceFolder}', workspaceFolder)
        .replaceAll('${rootScript}', rootScript)
        .replaceAll('${rootScriptRelative}', rootScriptRelative);
}

// ワークスペース基準のパスをVS CodeのURIへ解決する。
function resolveWorkspacePath(folder, value) {
    if (!folder || !value) {
        return undefined;
    }

    // 設定値内の変数を展開する。
    const expanded = expandVariables(
        value,
        folder
    );

    // 絶対パスと相対パスでURI生成方法を切り替える。
    return path.isAbsolute(expanded)
        ? vscode.Uri.file(expanded)
        : vscode.Uri.joinPath(
            folder.uri,
            expanded.replaceAll('\\', '/')
        );
}

module.exports = {
    getWorkspaceFolder,
    getConfiguration,
    expandVariables,
    resolveWorkspacePath
};