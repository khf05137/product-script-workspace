const vscode = require('vscode');
const path = require('path');
const { getConfiguration } = require('./config');

class TargetManager {
    constructor(context) {
        this.context = context;
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
    }

    dispose() {
        this._onDidChange.dispose();
    }

    _key(folder) {
        return `productScript.selectedTarget:${folder.uri.toString()}`;
    }

    getRootScripts(folder) {
        if (!folder) return [];
        return getConfiguration(folder).get('rootScripts', []);
    }

    getSelectedRelative(folder) {
        if (!folder) return undefined;
        const roots = this.getRootScripts(folder);
        const saved = this.context.workspaceState.get(this._key(folder));
        if (saved && roots.includes(saved)) return saved;
        if (roots.length === 1) return roots[0];
        return undefined;
    }

    getSelectedUri(folder) {
        const relative = this.getSelectedRelative(folder);
        return relative ? vscode.Uri.joinPath(folder.uri, relative.replaceAll('\\', '/')) : undefined;
    }

    async select(folder) {
        const roots = this.getRootScripts(folder);
        if (roots.length === 0) {
            vscode.window.showWarningMessage('productScript.rootScripts が設定されていません。');
            return undefined;
        }

        const current = this.getSelectedRelative(folder);
        const selected = await vscode.window.showQuickPick(
            roots.map(root => ({
                label: path.basename(root),
                description: root,
                root,
                picked: root === current
            })),
            { placeHolder: '実行対象のルートスクリプトを選択' }
        );

        if (!selected) return undefined;
        await this.context.workspaceState.update(this._key(folder), selected.root);
        this._onDidChange.fire(folder);
        return vscode.Uri.joinPath(folder.uri, selected.root.replaceAll('\\', '/'));
    }

    async requireTarget(folder) {
        const current = this.getSelectedUri(folder);
        if (current) return current;
        return this.select(folder);
    }
}

module.exports = { TargetManager };
