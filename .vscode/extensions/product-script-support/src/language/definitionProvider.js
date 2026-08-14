const vscode = require('vscode');
const path = require('path');
const { getWorkspaceFolder } = require('../config');

class DefinitionProvider {
    constructor(definitionLoader, workspaceIndex) {
        this.definitionLoader = definitionLoader;
        this.workspaceIndex = workspaceIndex;
    }

    async provideDefinition(document, position) {
        const folder = getWorkspaceFolder(document.uri);
        if (!folder) return undefined;
        const def = await this.definitionLoader.load(folder);

        const importLocation = this._tryImport(document, position, folder, def);
        if (importLocation) return importLocation;

        const range = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
        if (!range) return undefined;
        const name = document.getText(range);
        const found = this.workspaceIndex.getFunctionDefinitions(folder, name);
        return found.map(x => x.location);
    }

    _tryImport(document, position, folder, def) {
        let regex;
        try { regex = new RegExp(def.language.patterns.import, 'i'); }
        catch { return undefined; }

        const line = document.lineAt(position.line).text;
        const match = regex.exec(line);
        if (!match || !match[1]) return undefined;
        const pathStart = line.indexOf(match[1], match.index);
        if (pathStart < 0 || position.character < pathStart || position.character > pathStart + match[1].length) return undefined;

        let target;
        if (def.language.importBase === 'scriptsRoot') {
            target = vscode.Uri.joinPath(folder.uri, 'Scripts', match[1].replaceAll('\\', '/'));
        } else {
            target = vscode.Uri.file(path.resolve(path.dirname(document.uri.fsPath), match[1]));
        }
        return new vscode.Location(target, new vscode.Position(0, 0));
    }
}

module.exports = { DefinitionProvider };
