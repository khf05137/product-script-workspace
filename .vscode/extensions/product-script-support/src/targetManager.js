const vscode = require('vscode');
const path = require('path');
const { getConfiguration } = require('./config');

// Compile / Debug対象となるRoot Scriptの選択状態を管理する。
class TargetManager {
    constructor(context) {
        this.context = context;

        // Target変更通知用のイベントを作成する。
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
    }

    // 使用しているイベントリソースを解放する。
    dispose() {
        this._onDidChange.dispose();
    }

    // ワークスペースごとのTarget保存キーを生成する。
    _key(folder) {
        return `productScript.selectedTarget:${folder.uri.toString()}`;
    }

    // settings.jsonからRoot Script一覧を取得する。
    getRootScripts(folder) {
        if (!folder) {
            return [];
        }

        return getConfiguration(folder).get(
            'rootScripts',
            []
        );
    }

    // 現在選択されているRoot Scriptの相対パスを取得する。
    getSelectedRelative(folder) {
        if (!folder) {
            return undefined;
        }

        // 設定済みのRoot Script一覧を取得する。
        const roots = this.getRootScripts(folder);

        // Workspace Stateに保存されたTargetを取得する。
        const saved = this.context.workspaceState.get(
            this._key(folder)
        );

        // 保存済みTargetが現在も有効ならそのまま使用する。
        if (saved && roots.includes(saved)) {
            return saved;
        }

        // Root Scriptが1件だけなら自動的に選択する。
        if (roots.length === 1) {
            return roots[0];
        }

        return undefined;
    }

    // 現在選択されているRoot ScriptをURIで取得する。
    getSelectedUri(folder) {
        const relative = this.getSelectedRelative(folder);

        return relative
            ? vscode.Uri.joinPath(
                folder.uri,
                relative.replaceAll('\\', '/')
            )
            : undefined;
    }

    // Root Script一覧から実行対象をユーザーに選択させる。
    async select(folder) {
        const roots = this.getRootScripts(folder);

        // Root Scriptが未設定の場合は警告を表示する。
        if (roots.length === 0) {
            vscode.window.showWarningMessage(
                'productScript.rootScripts が設定されていません。'
            );
            return undefined;
        }

        // 現在選択中のTargetを取得する。
        const current = this.getSelectedRelative(folder);

        // Quick PickでRoot Scriptの選択肢を表示する。
        const selected = await vscode.window.showQuickPick(
            roots.map(root => ({
                label: path.basename(root),
                description: root,
                root,
                picked: root === current
            })),
            {
                placeHolder: '実行対象のルートスクリプトを選択'
            }
        );

        if (!selected) {
            return undefined;
        }

        // 選択したTargetをワークスペース単位で保存する。
        await this.context.workspaceState.update(
            this._key(folder),
            selected.root
        );

        // Target変更を他コンポーネントへ通知する。
        this._onDidChange.fire(folder);

        // 選択したRoot ScriptをURIで返す。
        return vscode.Uri.joinPath(
            folder.uri,
            selected.root.replaceAll('\\', '/')
        );
    }

    // Targetが未選択の場合は選択UIを表示して必ず取得を試みる。
    async requireTarget(folder) {
        const current = this.getSelectedUri(folder);

        if (current) {
            return current;
        }

        return this.select(folder);
    }
}

module.exports = { TargetManager };