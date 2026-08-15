const vscode = require('vscode');
const { getWorkspaceFolder } = require('../config');

// Product Scriptの入力補完候補を生成する。
class CompletionProvider {
    constructor(definitionLoader, workspaceIndex) {
        this.definitionLoader = definitionLoader;
        this.workspaceIndex = workspaceIndex;
    }

    // 現在のドキュメントに対する補完候補を取得する。
    async provideCompletionItems(document) {
        // 対象ワークスペースと言語定義を取得する。
        const folder = getWorkspaceFolder(document.uri);
        const def = await this.definitionLoader.load(folder);
        const items = [];

        // 言語キーワードを補完候補へ追加する。
        for (const keyword of def.language.keywords) {
            const item = new vscode.CompletionItem(
                keyword,
                vscode.CompletionItemKind.Keyword
            );

            item.detail = 'Product Script keyword';
            items.push(item);
        }

        // 定義済みスニペットを補完候補へ追加する。
        for (const snippet of def.language.snippets) {
            const item = new vscode.CompletionItem(
                snippet.label ?? snippet.prefix,
                vscode.CompletionItemKind.Snippet
            );

            item.filterText = snippet.prefix;
            item.insertText = new vscode.SnippetString(
                snippet.insertText ?? snippet.prefix
            );
            item.documentation = snippet.description;
            item.detail = snippet.detail ?? 'Product Script snippet';

            items.push(item);
        }

        // 組み込み関数を補完候補へ追加する。
        for (const fn of def.functions) {
            const item = new vscode.CompletionItem(
                fn.name,
                vscode.CompletionItemKind.Function
            );

            item.insertText = new vscode.SnippetString(
                fn.insertText ?? `${fn.name}()`
            );
            item.detail = fn.signature ?? buildSignature(fn);
            item.documentation = new vscode.MarkdownString(
                fn.description ?? ''
            );

            items.push(item);
        }

        // ワークスペース内で定義された関数を補完候補へ追加する。
        for (const name of this.workspaceIndex.getAllFunctionNames(folder)) {
            // 組み込み関数と同名の場合は重複登録しない。
            if (
                def.functions.some(
                    f => f.name.toUpperCase() === name.toUpperCase()
                )
            ) {
                continue;
            }

            const item = new vscode.CompletionItem(
                name,
                vscode.CompletionItemKind.Function
            );

            item.insertText = new vscode.SnippetString(`${name}()`);
            item.detail = 'Workspace function';

            items.push(item);
        }

        // 生成した補完候補一覧をVS Codeへ返す。
        return items;
    }
}

// 関数定義から表示用のシグネチャ文字列を生成する。
function buildSignature(fn) {
    const params = (fn.parameters ?? [])
        .map(p => p.name)
        .join(', ');

    return `${fn.name}(${params})${
        fn.returnType ? ` : ${fn.returnType}` : ''
    }`;
}

module.exports = { CompletionProvider, buildSignature };