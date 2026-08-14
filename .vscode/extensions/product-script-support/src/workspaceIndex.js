const vscode = require('vscode');
const { getWorkspaceFolder } = require('./config');

class WorkspaceIndex {
    constructor(definitionLoader) {
        this.definitionLoader = definitionLoader;
        this.byFolder = new Map();
        this._timer = undefined;
    }

    dispose() {
        if (this._timer) clearTimeout(this._timer);
    }

    scheduleRebuild(folder) {
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => this.rebuild(folder), 250);
    }

    async rebuild(folder) {
        folder ??= getWorkspaceFolder();
        if (!folder) return;
        const def = await this.definitionLoader.load(folder);
        let regex;
        try {
            regex = new RegExp(def.language.patterns.functionDefinition, 'gmi');
        } catch {
            return;
        }

        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, 'Scripts/**/*.txt'));
        const symbols = new Map();

        for (const uri of files) {
            let text;
            const opened = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
            if (opened) text = opened.getText();
            else {
                try {
                    const bytes = await vscode.workspace.fs.readFile(uri);
                    text = Buffer.from(bytes).toString('utf8');
                } catch {
                    continue;
                }
            }

            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const name = match[1];
                if (!name) continue;
                const prefix = text.slice(0, match.index);
                const line = prefix.split(/\r?\n/).length - 1;
                const lastNl = Math.max(prefix.lastIndexOf('\n'), prefix.lastIndexOf('\r'));
                const column = match.index - (lastNl + 1) + match[0].indexOf(name);
                const location = new vscode.Location(uri, new vscode.Position(line, Math.max(column, 0)));
                if (!symbols.has(name.toUpperCase())) symbols.set(name.toUpperCase(), []);
                symbols.get(name.toUpperCase()).push({ name, location });
            }
        }

        this.byFolder.set(folder.uri.toString(), symbols);
    }

    getFunctionDefinitions(folder, name) {
        if (!folder || !name) return [];
        return this.byFolder.get(folder.uri.toString())?.get(name.toUpperCase()) ?? [];
    }

    getAllFunctionNames(folder) {
        if (!folder) return [];
        const symbols = this.byFolder.get(folder.uri.toString());
        if (!symbols) return [];
        return [...symbols.values()].map(items => items[0]?.name).filter(Boolean).sort();
    }
}

module.exports = { WorkspaceIndex };
