const vscode = require('vscode');
const path = require('path');
const { getWorkspaceFolder } = require('../config');

// 関数やIMPORT先への定義ジャンプを提供する。
class DefinitionProvider {
    constructor(definitionLoader, workspaceIndex) {
        this.definitionLoader = definitionLoader;
        this.workspaceIndex = workspaceIndex;
    }

    // カーソル位置に対応する定義位置を取得する。
    async provideDefinition(document, position) {
        // 対象ワークスペースと言語定義を取得する。
        const folder = getWorkspaceFolder(document.uri);
        if (!folder) return undefined;

        const def = await this.definitionLoader.load(folder);

        // IMPORTのファイルパス上なら参照先ファイルを返す。
        const importLocation = this._tryImport(
            document,
            position,
            folder,
            def
        );

        if (importLocation) {
            return importLocation;
        }

        // カーソル位置の関数名を取得する。
        const range = document.getWordRangeAtPosition(
            position,
            /[A-Za-z_][A-Za-z0-9_]*/
        );

        if (!range) return undefined;

        const name = document.getText(range);

        // ワークスペース内から同名関数の定義位置を検索する。
        const found = this.workspaceIndex.getFunctionDefinitions(
            folder,
            name
        );

        return found.map(x => x.location);
    }

    // カーソル位置がIMPORT先パスなら、そのファイル位置を取得する。
    _tryImport(document, position, folder, def) {
        // 言語定義からIMPORT構文の正規表現を生成する。
        let regex;

        try {
            regex = new RegExp(
                def.language.patterns.import,
                'i'
            );
        } catch {
            return undefined;
        }

        // 現在行からIMPORT対象のファイルパスを取得する。
        const line = document.lineAt(position.line).text;
        const match = regex.exec(line);

        if (!match || !match[1]) {
            return undefined;
        }

        // カーソルがIMPORTのファイルパス上にあるか確認する。
        const pathStart = line.indexOf(
            match[1],
            match.index
        );

        if (
            pathStart < 0 ||
            position.character < pathStart ||
            position.character > pathStart + match[1].length
        ) {
            return undefined;
        }

        // 言語設定に従ってIMPORT先ファイルのパスを解決する。
        let target;

        if (def.language.importBase === 'scriptsRoot') {
            target = vscode.Uri.joinPath(
                folder.uri,
                'Scripts',
                match[1].replaceAll('\\', '/')
            );
        } else {
            target = vscode.Uri.file(
                path.resolve(
                    path.dirname(document.uri.fsPath),
                    match[1]
                )
            );
        }

        // IMPORT先ファイルの先頭位置を定義位置として返す。
        return new vscode.Location(
            target,
            new vscode.Position(0, 0)
        );
    }
}

module.exports = { DefinitionProvider };