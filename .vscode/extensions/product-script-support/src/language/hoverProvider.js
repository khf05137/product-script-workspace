const vscode = require('vscode');
const { getWorkspaceFolder } = require('../config');
const { buildSignature } = require('./completionProvider');

// キーワードや関数に対するHover情報を提供する。
class HoverProvider {
    constructor(definitionLoader, workspaceIndex) {
        this.definitionLoader = definitionLoader;
        this.workspaceIndex = workspaceIndex;
    }

    // カーソル位置の単語に対応するHover情報を生成する。
    async provideHover(document, position) {
        // カーソル位置の単語を取得する。
        const range = document.getWordRangeAtPosition(
            position,
            /[A-Za-z_][A-Za-z0-9_]*/
        );

        if (!range) return undefined;

        const word = document.getText(range);

        // 対象ワークスペースと言語定義を取得する。
        const folder = getWorkspaceFolder(document.uri);
        const def = await this.definitionLoader.load(folder);

        // 組み込み関数の定義を検索する。
        const fn = def.functions.find(
            f => f.name.toUpperCase() === word.toUpperCase()
        );

        if (fn) {
            // 関数のシグネチャと説明をMarkdownで生成する。
            const md = new vscode.MarkdownString();

            md.appendCodeblock(
                fn.signature ?? buildSignature(fn),
                'text'
            );

            if (fn.description) {
                md.appendMarkdown(`\n${fn.description}`);
            }

            // 関数の引数情報を追加する。
            if (fn.parameters?.length) {
                md.appendMarkdown('\n\n**Parameters**');

                for (const p of fn.parameters) {
                    md.appendMarkdown(
                        `\n\n- \`${p.name}\`` +
                        `${p.type ? `: ${p.type}` : ''}` +
                        `${p.description ? ` — ${p.description}` : ''}`
                    );
                }
            }

            return new vscode.Hover(md, range);
        }

        // ワークスペース内で定義された関数を検索する。
        const defs = this.workspaceIndex.getFunctionDefinitions(
            folder,
            word
        );

        if (defs.length) {
            return new vscode.Hover(
                new vscode.MarkdownString(
                    `**${word}**\n\nWorkspace function`
                ),
                range
            );
        }

        // 言語キーワードの場合はキーワード情報を表示する。
        if (
            def.language.keywords.some(
                k => k.toUpperCase() === word.toUpperCase()
            )
        ) {
            return new vscode.Hover(
                new vscode.MarkdownString(
                    `**${word}** — Product Script keyword`
                ),
                range
            );
        }

        return undefined;
    }
}

module.exports = { HoverProvider };