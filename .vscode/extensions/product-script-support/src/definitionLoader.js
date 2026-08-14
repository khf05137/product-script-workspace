const vscode = require('vscode');
const { getConfiguration } = require('./config');

class DefinitionLoader {
    constructor() {
        this._cache = new Map();
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
    }

    dispose() {
        this._onDidChange.dispose();
    }

    invalidate() {
        this._cache.clear();
        this._onDidChange.fire();
    }

    async load(folder) {
        if (!folder) return emptyDefinition();
        const key = folder.uri.toString();
        if (this._cache.has(key)) return this._cache.get(key);

        const config = getConfiguration(folder);
        const dir = config.get('definitionDirectory', '.vscode/product-script');
        const base = vscode.Uri.joinPath(folder.uri, dir.replaceAll('\\', '/'));
        const language = await readJson(vscode.Uri.joinPath(base, 'language.json'), {});
        const functionsFile = await readJson(vscode.Uri.joinPath(base, 'functions.json'), []);
        const functions = Array.isArray(functionsFile) ? functionsFile : (functionsFile.functions ?? []);

        const result = {
            language: {
                keywords: language.keywords ?? [],
                snippets: language.snippets ?? [],
                patterns: {
                    functionDefinition: language.patterns?.functionDefinition ?? '\\bFUNCTION\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\(([^)]*)\\)',
                    import: language.patterns?.import ?? '\\bIMPORT\\s*\\(\\s*"([^"]+)"\\s*\\)',
                    variable: language.patterns?.variable ?? '[$!][A-Za-z_][A-Za-z0-9_]*',
                    comment: language.patterns?.comment ?? "(?:'|//).*$",
                    string: language.patterns?.string ?? '"(?:\\\\.|[^"\\\\])*"'
                },
                importBase: language.importBase ?? 'currentFileDirectory'
            },
            functions
        };

        this._cache.set(key, result);
        return result;
    }
}

async function readJson(uri, fallback) {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(Buffer.from(bytes).toString('utf8'));
    } catch {
        return fallback;
    }
}

function emptyDefinition() {
    return { language: { keywords: [], snippets: [], patterns: {}, importBase: 'currentFileDirectory' }, functions: [] };
}

module.exports = { DefinitionLoader };
