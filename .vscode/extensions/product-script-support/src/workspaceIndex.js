const vscode = require('vscode');
const { getWorkspaceFolder } = require('./config');

// ワークスペース内の関数定義位置を収集・管理する。
class WorkspaceIndex {
    constructor(definitionLoader) {
        this.definitionLoader = definitionLoader;

        // ワークスペースごとの関数定義情報を保持する。
        this.byFolder = new Map();

        // 連続更新をまとめるためのタイマーを保持する。
        this._timer = undefined;
    }

    // 保留中の再構築タイマーを破棄する。
    dispose() {
        if (this._timer) {
            clearTimeout(this._timer);
        }
    }

    // 短時間に連続する変更をまとめてIndexを再構築する。
    scheduleRebuild(folder) {
        if (this._timer) {
            clearTimeout(this._timer);
        }

        this._timer = setTimeout(
            () => this.rebuild(folder),
            250
        );
    }

    // Scripts以下を走査して関数定義Indexを再構築する。
    async rebuild(folder) {
        // 対象ワークスペースと言語定義を取得する。
        folder ??= getWorkspaceFolder();

        if (!folder) {
            return;
        }

        const def = await this.definitionLoader.load(folder);

        // 言語定義から関数定義検出用の正規表現を生成する。
        let regex;

        try {
            regex = new RegExp(
                def.language.patterns.functionDefinition,
                'gmi'
            );
        } catch {
            return;
        }

        // Scripts以下の全スクリプトファイルを取得する。
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(
                folder,
                'Scripts/**/*.txt'
            )
        );

        const symbols = new Map();

        // 各スクリプトから関数定義を収集する。
        for (const uri of files) {
            let text;

            // エディタで開かれている場合は未保存の内容を優先する。
            const opened = vscode.workspace.textDocuments.find(
                d => d.uri.toString() === uri.toString()
            );

            if (opened) {
                text = opened.getText();
            } else {
                // 未オープンの場合はファイルから内容を読み込む。
                try {
                    const bytes = await vscode.workspace.fs.readFile(uri);
                    text = Buffer.from(bytes).toString('utf8');
                } catch {
                    continue;
                }
            }

            // ファイル内の関数定義を検索する。
            regex.lastIndex = 0;
            let match;

            while ((match = regex.exec(text)) !== null) {
                const name = match[1];

                if (!name) {
                    continue;
                }

                // マッチ位置から関数名の行・列番号を算出する。
                const prefix = text.slice(0, match.index);
                const line = prefix.split(/\r?\n/).length - 1;
                const lastNl = Math.max(
                    prefix.lastIndexOf('\n'),
                    prefix.lastIndexOf('\r')
                );
                const column =
                    match.index -
                    (lastNl + 1) +
                    match[0].indexOf(name);

                // VS Code用の定義位置情報を生成する。
                const location = new vscode.Location(
                    uri,
                    new vscode.Position(
                        line,
                        Math.max(column, 0)
                    )
                );

                // 関数名ごとに定義位置をまとめる。
                const key = name.toUpperCase();

                if (!symbols.has(key)) {
                    symbols.set(key, []);
                }

                symbols.get(key).push({
                    name,
                    location
                });
            }
        }

        // 再構築したIndexをワークスペース単位で保存する。
        this.byFolder.set(
            folder.uri.toString(),
            symbols
        );
    }

    // 指定した関数名の定義位置一覧を取得する。
    getFunctionDefinitions(folder, name) {
        if (!folder || !name) {
            return [];
        }

        return this.byFolder
            .get(folder.uri.toString())
            ?.get(name.toUpperCase()) ?? [];
    }

    // ワークスペース内で定義されている全関数名を取得する。
    getAllFunctionNames(folder) {
        if (!folder) {
            return [];
        }

        const symbols = this.byFolder.get(
            folder.uri.toString()
        );

        if (!symbols) {
            return [];
        }

        // 各関数の代表名を取得して名前順に並べる。
        return [...symbols.values()]
            .map(items => items[0]?.name)
            .filter(Boolean)
            .sort();
    }
}

module.exports = { WorkspaceIndex };