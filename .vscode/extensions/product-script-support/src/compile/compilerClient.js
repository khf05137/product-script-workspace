const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const { getConfiguration, expandVariables } = require('../config');

// 外部コンパイラの起動と結果表示を管理する。
class CompilerClient {
    constructor() {
        // コンパイル結果の出力先を作成する。
        this.output = vscode.window.createOutputChannel('Product Script');

        // コンパイルエラーをVS Code上へ表示するための診断情報を作成する。
        this.diagnostics = vscode.languages.createDiagnosticCollection('productScript.compile');
    }

    // 使用しているVS Codeリソースを解放する。
    dispose() {
        this.output.dispose();
        this.diagnostics.dispose();
    }

    // 指定したルートスクリプトを外部コンパイラでコンパイルする。
    async compile(folder, rootScriptUri) {
        // ワークスペース設定からコンパイラ情報を取得する。
        const config = getConfiguration(folder);
        const rawCommand = config.get('compiler.command', '');
        if (!rawCommand) {
            vscode.window.showErrorMessage('productScript.compiler.command が設定されていません。');
            return;
        }

        // 設定値内の変数を実際のパスへ展開する。
        const command = expandVariables(rawCommand, folder, rootScriptUri);
        const args = config.get('compiler.arguments', []).map(x => expandVariables(x, folder, rootScriptUri));
        const cwd = expandVariables(config.get('compiler.cwd', '${workspaceFolder}'), folder, rootScriptUri);

        // コンパイル開始前に出力と診断情報を初期化する。
        this.output.clear();
        this.output.show(true);
        this.output.appendLine(`> ${command} ${args.map(quote).join(' ')}`);
        this.output.appendLine(`cwd: ${cwd}`);
        this.diagnostics.clear();

        // 外部コンパイラを起動して終了まで待機する。
        return new Promise(resolve => {
            let stdout = '';
            const child = spawn(command, args, { cwd, windowsHide: true, shell: false });

            // 標準出力をOutputへ転送し、診断解析用にも保持する。
            child.stdout.on('data', data => {
                const text = data.toString();
                stdout += text;
                this.output.append(text);
            });

            // 標準エラー出力をOutputへ転送する。
            child.stderr.on('data', data => this.output.append(data.toString()));

            // コンパイラの起動失敗を処理する。
            child.on('error', err => {
                this.output.appendLine(`\n[ERROR] ${err.message}`);
                vscode.window.showErrorMessage(`Compile起動に失敗しました: ${err.message}`);
                resolve(false);
            });

            // コンパイラ終了後に結果と診断情報を反映する。
            child.on('close', code => {
                this.output.appendLine(`\n[exit code: ${code}]`);

                if (config.get('compiler.diagnosticsMode', 'none') === 'json') {
                    this._applyJsonDiagnostics(folder, stdout);
                }

                if (code === 0) {
                    vscode.window.showInformationMessage(`Compile OK: ${path.basename(rootScriptUri.fsPath)}`);
                } else {
                    vscode.window.showErrorMessage(`Compile NG: ${path.basename(rootScriptUri.fsPath)} (exit ${code})`);
                }

                resolve(code === 0);
            });
        });
    }

    // コンパイラのJSON出力をVS Codeの診断情報へ変換する。
    _applyJsonDiagnostics(folder, stdout) {
        // 標準出力をJSONとして解析する。
        let result;
        try {
            result = JSON.parse(stdout);
        } catch {
            this.output.appendLine('[diagnostics] stdout をJSONとして解析できませんでした。');
            return;
        }

        // 診断情報をファイル単位でまとめる。
        const grouped = new Map();

        for (const d of result.diagnostics ?? []) {
            if (!d.file || !d.message) continue;

            // 診断対象ファイルのURIを生成する。
            const uri = path.isAbsolute(d.file)
                ? vscode.Uri.file(d.file)
                : vscode.Uri.joinPath(folder.uri, d.file.replaceAll('\\', '/'));

            // 1始まりの行・列番号をVS Codeの0始まりへ変換する。
            const line = Math.max((d.line ?? 1) - 1, 0);
            const column = Math.max((d.column ?? 1) - 1, 0);
            const endLine = Math.max((d.endLine ?? d.line ?? 1) - 1, line);
            const endColumn = Math.max((d.endColumn ?? (d.column ?? 1) + 1) - 1, column + 1);

            // VS Code用の診断情報を生成する。
            const range = new vscode.Range(line, column, endLine, endColumn);
            const severity = severityFromString(d.severity);
            const diag = new vscode.Diagnostic(range, d.message, severity);
            diag.code = d.code;
            diag.source = 'Product Script Compiler';

            // 同一ファイルの診断情報をまとめる。
            const key = uri.toString();
            if (!grouped.has(key)) {
                grouped.set(key, { uri, list: [] });
            }

            grouped.get(key).list.push(diag);
        }

        // ファイルごとの診断情報をVS Codeへ登録する。
        for (const { uri, list } of grouped.values()) {
            this.diagnostics.set(uri, list);
        }
    }
}

// 文字列のseverityをVS CodeのDiagnosticSeverityへ変換する。
function severityFromString(value) {
    switch ((value ?? '').toLowerCase()) {
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;

        case 'information':
        case 'info':
            return vscode.DiagnosticSeverity.Information;

        case 'hint':
            return vscode.DiagnosticSeverity.Hint;

        default:
            return vscode.DiagnosticSeverity.Error;
    }
}

// 空白を含むコマンドライン引数を引用符で囲む。
function quote(value) {
    return /\s/.test(value) ? `"${value}"` : value;
}

module.exports = { CompilerClient };