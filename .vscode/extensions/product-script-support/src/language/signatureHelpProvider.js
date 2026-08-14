const vscode = require('vscode');
const { getWorkspaceFolder } = require('../config');
const { buildSignature } = require('./completionProvider');

class SignatureHelpProvider {
    constructor(definitionLoader) {
        this.definitionLoader = definitionLoader;
    }

    async provideSignatureHelp(document, position) {
        const line = document.lineAt(position.line).text.slice(0, position.character);
        const match = /([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)$/.exec(line);
        if (!match) return undefined;

        const folder = getWorkspaceFolder(document.uri);
        const def = await this.definitionLoader.load(folder);
        const fn = def.functions.find(f => f.name.toUpperCase() === match[1].toUpperCase());
        if (!fn) return undefined;

        const result = new vscode.SignatureHelp();
        const sig = new vscode.SignatureInformation(fn.signature ?? buildSignature(fn), fn.description ?? '');
        sig.parameters = (fn.parameters ?? []).map(p => new vscode.ParameterInformation(p.name, p.description ?? ''));
        result.signatures = [sig];
        result.activeSignature = 0;
        result.activeParameter = Math.min((match[2].match(/,/g) ?? []).length, Math.max(sig.parameters.length - 1, 0));
        return result;
    }
}

module.exports = { SignatureHelpProvider };
