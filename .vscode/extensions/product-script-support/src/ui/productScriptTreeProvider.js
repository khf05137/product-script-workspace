const vscode = require('vscode');
const path = require('path');

// Explorer内のPRODUCT SCRIPT Viewを生成する。
class ProductScriptTreeProvider {
    constructor(targetManager, getFolder) {
        this.targetManager = targetManager;
        this.getFolder = getFolder;

        // Tree Viewの更新通知用イベントを作成する。
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    // 使用しているイベントリソースを解放する。
    dispose() {
        this._onDidChangeTreeData.dispose();
    }

    // Tree View全体を再描画する。
    refresh() {
        this._onDidChangeTreeData.fire();
    }

    // 指定されたTreeItemをそのまま返す。
    getTreeItem(element) {
        return element;
    }

    // PRODUCT SCRIPT Viewに表示する項目を生成する。
    getChildren() {
        // 現在のワークスペースとTarget情報を取得する。
        const folder = this.getFolder();
        const selected = this.targetManager.getSelectedRelative(folder);
        const rootCount = this.targetManager.getRootScripts(folder).length;

        // 現在のRoot Scriptを選択するTarget項目を生成する。
        const target = new vscode.TreeItem(
            selected
                ? `Target: ${path.basename(selected)}`
                : 'Target: Select...',
            vscode.TreeItemCollapsibleState.None
        );

        target.description =
            selected ??
            (rootCount
                ? `${rootCount} candidates`
                : 'rootScripts is empty');

        target.iconPath = new vscode.ThemeIcon('target');
        target.command = {
            command: 'productScript.selectTarget',
            title: 'Select Target'
        };
        target.tooltip = 'Compile / Debug のルートスクリプトを選択';

        // 現在のTargetをコンパイルする項目を生成する。
        const compile = new vscode.TreeItem(
            'Compile',
            vscode.TreeItemCollapsibleState.None
        );

        compile.iconPath = new vscode.ThemeIcon('check');
        compile.command = {
            command: 'productScript.compile',
            title: 'Compile'
        };
        compile.tooltip = '現在のTargetを外部C#コンパイラで確認';

        // 現在のTargetをデバッグする項目を生成する。
        const debug = new vscode.TreeItem(
            'Debug',
            vscode.TreeItemCollapsibleState.None
        );

        debug.iconPath = new vscode.ThemeIcon('debug-alt');
        debug.command = {
            command: 'productScript.debug',
            title: 'Debug'
        };
        debug.tooltip = '現在のTargetを外部C# Debug Adapterでデバッグ';

        // PRODUCT SCRIPT Viewへ表示する項目一覧を返す。
        return [target, compile, debug];
    }
}

module.exports = { ProductScriptTreeProvider };