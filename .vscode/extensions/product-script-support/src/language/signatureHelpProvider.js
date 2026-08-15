const vscode = require('vscode');
const { getWorkspaceFolder } = require('../config');
const { buildSignature } = require('./completionProvider');

// 関数呼び出し時のシグネチャと引数情報を提供する。
class SignatureHelpProvider {
    constructor(definitionLoader) {
        this.definitionLoader = definitionLoader;
    }

    // カーソル位置の関数呼び出しに対応するSignature Helpを生成する。
    async provideSignatureHelp(document, position) {
        // 現在行のカーソル位置までを取得し、関数呼び出し形式を解析する。
        const line = document
            .lineAt(position.line)
            .text
            .slice(0, position.character);

        const match = /([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)$/.exec(line);

        if (!match) {
            return undefined;
        }

        // 対象ワークスペースと言語定義を取得する。
        const folder = getWorkspaceFolder(document.uri);
        const def = await this.definitionLoader.load(folder);

        // 呼び出し中の組み込み関数を検索する。
        const fn = def.functions.find(
            f => f.name.toUpperCase() === match[1].toUpperCase()
        );

        if (!fn) {
            return undefined;
        }

        // 関数のシグネチャ情報を生成する。
        const result = new vscode.SignatureHelp();

        const sig = new vscode.SignatureInformation(
            fn.signature ?? buildSignature(fn),
            fn.description ?? ''
        );

        // 各引数の名前と説明を設定する。
        sig.parameters = (fn.parameters ?? []).map(
            p => new vscode.ParameterInformation(
                p.name,
                p.description ?? ''
            )
        );

        result.signatures = [sig];
        result.activeSignature = 0;

        // カンマ数から現在入力中の引数位置を判定する。
        result.activeParameter = Math.min(
            (match[2].match(/,/g) ?? []).length,
            Math.max(sig.parameters.length - 1, 0)
        );

        // 生成したSignature HelpをVS Codeへ返す。
        return result;
    }
}

module.exports = { SignatureHelpProvider };