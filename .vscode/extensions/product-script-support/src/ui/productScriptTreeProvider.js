const vscode = require('vscode');
const path = require('path');

class ProductScriptTreeProvider {
    constructor(targetManager, getFolder) {
        this.targetManager = targetManager;
        this.getFolder = getFolder;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    dispose() {
        this._onDidChangeTreeData.dispose();
    }

    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(element) { return element; }

    getChildren() {
        const folder = this.getFolder();
        const selected = this.targetManager.getSelectedRelative(folder);
        const rootCount = this.targetManager.getRootScripts(folder).length;

        const target = new vscode.TreeItem(
            selected ? `Target: ${path.basename(selected)}` : 'Target: Select...',
            vscode.TreeItemCollapsibleState.None
        );
        target.description = selected ?? (rootCount ? `${rootCount} candidates` : 'rootScripts is empty');
        target.iconPath = new vscode.ThemeIcon('target');
        target.command = { command: 'productScript.selectTarget', title: 'Select Target' };
        target.tooltip = 'Compile / Debug のルートスクリプトを選択';

        const compile = new vscode.TreeItem('Compile', vscode.TreeItemCollapsibleState.None);
        compile.iconPath = new vscode.ThemeIcon('check');
        compile.command = { command: 'productScript.compile', title: 'Compile' };
        compile.tooltip = '現在のTargetを外部C#コンパイラで確認';

        const debug = new vscode.TreeItem('Debug', vscode.TreeItemCollapsibleState.None);
        debug.iconPath = new vscode.ThemeIcon('debug-alt');
        debug.command = { command: 'productScript.debug', title: 'Debug' };
        debug.tooltip = '現在のTargetを外部C# Debug Adapterでデバッグ';

        return [target, compile, debug];
    }
}

module.exports = { ProductScriptTreeProvider };
