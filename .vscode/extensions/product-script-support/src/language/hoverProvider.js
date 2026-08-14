const vscode = require('vscode');
const { getWorkspaceFolder } = require('../config');
const { buildSignature } = require('./completionProvider');

class HoverProvider {
    constructor(definitionLoader, workspaceIndex) {
        this.definitionLoader = definitionLoader;
        this.workspaceIndex = workspaceIndex;
    }

    async provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
        if (!range) return undefined;
        const word = document.getText(range);
        const folder = getWorkspaceFolder(document.uri);
        const def = await this.definitionLoader.load(folder);
        const fn = def.functions.find(f => f.name.toUpperCase() === word.toUpperCase());

        if (fn) {
            const md = new vscode.MarkdownString();
            md.appendCodeblock(fn.signature ?? buildSignature(fn), 'text');
            if (fn.description) md.appendMarkdown(`\n${fn.description}`);
            if (fn.parameters?.length) {
                md.appendMarkdown('\n\n**Parameters**');
                for (const p of fn.parameters) {
                    md.appendMarkdown(`\n\n- \`${p.name}\`${p.type ? `: ${p.type}` : ''}${p.description ? ` — ${p.description}` : ''}`);
                }
            }
            return new vscode.Hover(md, range);
        }

        const defs = this.workspaceIndex.getFunctionDefinitions(folder, word);
        if (defs.length) {
            return new vscode.Hover(new vscode.MarkdownString(`**${word}**\n\nWorkspace function`), range);
        }

        if (def.language.keywords.some(k => k.toUpperCase() === word.toUpperCase())) {
            return new vscode.Hover(new vscode.MarkdownString(`**${word}** — Product Script keyword`), range);
        }

        return undefined;
    }
}

module.exports = { HoverProvider };
