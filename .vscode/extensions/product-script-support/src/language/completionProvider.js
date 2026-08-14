const vscode = require('vscode');
const { getWorkspaceFolder } = require('../config');

class CompletionProvider {
    constructor(definitionLoader, workspaceIndex) {
        this.definitionLoader = definitionLoader;
        this.workspaceIndex = workspaceIndex;
    }

    async provideCompletionItems(document) {
        const folder = getWorkspaceFolder(document.uri);
        const def = await this.definitionLoader.load(folder);
        const items = [];

        for (const keyword of def.language.keywords) {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            item.detail = 'Product Script keyword';
            items.push(item);
        }

        for (const snippet of def.language.snippets) {
            const item = new vscode.CompletionItem(snippet.label ?? snippet.prefix, vscode.CompletionItemKind.Snippet);
            item.filterText = snippet.prefix;
            item.insertText = new vscode.SnippetString(snippet.insertText ?? snippet.prefix);
            item.documentation = snippet.description;
            item.detail = snippet.detail ?? 'Product Script snippet';
            items.push(item);
        }

        for (const fn of def.functions) {
            const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
            item.insertText = new vscode.SnippetString(fn.insertText ?? `${fn.name}()`);
            item.detail = fn.signature ?? buildSignature(fn);
            item.documentation = new vscode.MarkdownString(fn.description ?? '');
            items.push(item);
        }

        for (const name of this.workspaceIndex.getAllFunctionNames(folder)) {
            if (def.functions.some(f => f.name.toUpperCase() === name.toUpperCase())) continue;
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
            item.insertText = new vscode.SnippetString(`${name}()`);
            item.detail = 'Workspace function';
            items.push(item);
        }

        return items;
    }
}

function buildSignature(fn) {
    const params = (fn.parameters ?? []).map(p => p.name).join(', ');
    return `${fn.name}(${params})${fn.returnType ? ` : ${fn.returnType}` : ''}`;
}

module.exports = { CompletionProvider, buildSignature };
