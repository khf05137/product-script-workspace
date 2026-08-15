const vscode = require('vscode');
const { getConfiguration } = require('./config');

// 言語定義ファイルを読み込み、拡張機能内部で利用する形式へ変換する。
class DefinitionLoader {
    constructor() {
        // ワークスペース単位の定義情報キャッシュを保持する。
        this._cache = new Map();

        // 定義変更通知用のイベントを作成する。
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
    }

    // 使用しているイベントリソースを解放する。
    dispose() {
        this._onDidChange.dispose();
    }

    // キャッシュを破棄して定義情報の再読み込みを通知する。
    invalidate() {
        this._cache.clear();
        this._onDidChange.fire();
    }

    // 指定ワークスペースの言語定義と関数定義を読み込む。
    async load(folder) {
        if (!folder) {
            return emptyDefinition();
        }

        // キャッシュ済みの場合は既存の定義情報を返す。
        const key = folder.uri.toString();

        if (this._cache.has(key)) {
            return this._cache.get(key);
        }

        // 設定から定義ファイルの配置ディレクトリを取得する。
        const config = getConfiguration(folder);
        const dir = config.get(
            'definitionDirectory',
            '.vscode/product-script'
        );
        const base = vscode.Uri.joinPath(
            folder.uri,
            dir.replaceAll('\\', '/')
        );

        // 言語定義と関数定義のJSONファイルを読み込む。
        const language = await readJson(
            vscode.Uri.joinPath(base, 'language.json'),
            {}
        );
        const functionsFile = await readJson(
            vscode.Uri.joinPath(base, 'functions.json'),
            []
        );

        // 関数定義を配列形式へ統一する。
        const functions = Array.isArray(functionsFile)
            ? functionsFile
            : (functionsFile.functions ?? []);

        // 未定義項目には既定値を設定して内部形式へ変換する。
        const result = {
            language: {
                keywords: language.keywords ?? [],
                snippets: language.snippets ?? [],
                patterns: {
                    functionDefinition:
                        language.patterns?.functionDefinition ??
                        '\\bFUNCTION\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\(([^)]*)\\)',
                    import:
                        language.patterns?.import ??
                        '\\bIMPORT\\s*\\(\\s*"([^"]+)"\\s*\\)',
                    variable:
                        language.patterns?.variable ??
                        '[$!][A-Za-z_][A-Za-z0-9_]*',
                    comment:
                        language.patterns?.comment ??
                        "(?:'|//).*$",
                    string:
                        language.patterns?.string ??
                        '"(?:\\\\.|[^"\\\\])*"'
                },
                importBase:
                    language.importBase ??
                    'currentFileDirectory'
            },
            functions
        };

        // 読み込んだ定義情報をキャッシュして返す。
        this._cache.set(key, result);
        return result;
    }
}

// JSONファイルを読み込み、失敗時は指定された既定値を返す。
async function readJson(uri, fallback) {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(
            Buffer.from(bytes).toString('utf8')
        );
    } catch {
        return fallback;
    }
}

// ワークスペースが無い場合に使用する空の定義情報を生成する。
function emptyDefinition() {
    return {
        language: {
            keywords: [],
            snippets: [],
            patterns: {},
            importBase: 'currentFileDirectory'
        },
        functions: []
    };
}

module.exports = { DefinitionLoader };