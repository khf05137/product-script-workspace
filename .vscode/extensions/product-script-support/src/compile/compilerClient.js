const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const { getConfiguration, expandVariables } = require('../config');

class CompilerClient {
    constructor() {
        this.output = vscode.window.createOutputChannel('Product Script');
        this.diagnostics = vscode.languages.createDiagnosticCollection('productScript.compile');
    }

    dispose() {
        this.output.dispose();
        this.diagnostics.dispose();
    }

    async compile(folder, rootScriptUri) {
        const config = getConfiguration(folder);
        const rawCommand = config.get('compiler.command', '');
        if (!rawCommand) {
            vscode.window.showErrorMessage('productScript.compiler.command が設定されていません。');
            return;
        }

        const command = expandVariables(rawCommand, folder, rootScriptUri);
        const args = config.get('compiler.arguments', []).map(x => expandVariables(x, folder, rootScriptUri));
        const cwd = expandVariables(config.get('compiler.cwd', '${workspaceFolder}'), folder, rootScriptUri);

        this.output.clear();
        this.output.show(true);
        this.output.appendLine(`> ${command} ${args.map(quote).join(' ')}`);
        this.output.appendLine(`cwd: ${cwd}`);
        this.diagnostics.clear();

        return new Promise(resolve => {
            let stdout = '';
            const child = spawn(command, args, { cwd, windowsHide: true, shell: false });

            child.stdout.on('data', data => {
                const text = data.toString();
                stdout += text;
                this.output.append(text);
            });
            child.stderr.on('data', data => this.output.append(data.toString()));
            child.on('error', err => {
                this.output.appendLine(`\n[ERROR] ${err.message}`);
                vscode.window.showErrorMessage(`Compile起動に失敗しました: ${err.message}`);
                resolve(false);
            });
            child.on('close', code => {
                this.output.appendLine(`\n[exit code: ${code}]`);
                if (config.get('compiler.diagnosticsMode', 'none') === 'json') {
                    this._applyJsonDiagnostics(folder, stdout);
                }
                if (code === 0) vscode.window.showInformationMessage(`Compile OK: ${path.basename(rootScriptUri.fsPath)}`);
                else vscode.window.showErrorMessage(`Compile NG: ${path.basename(rootScriptUri.fsPath)} (exit ${code})`);
                resolve(code === 0);
            });
        });
    }

    _applyJsonDiagnostics(folder, stdout) {
        let result;
        try { result = JSON.parse(stdout); }
        catch {
            this.output.appendLine('[diagnostics] stdout をJSONとして解析できませんでした。');
            return;
        }

        const grouped = new Map();
        for (const d of result.diagnostics ?? []) {
            if (!d.file || !d.message) continue;
            const uri = path.isAbsolute(d.file)
                ? vscode.Uri.file(d.file)
                : vscode.Uri.joinPath(folder.uri, d.file.replaceAll('\\', '/'));
            const line = Math.max((d.line ?? 1) - 1, 0);
            const column = Math.max((d.column ?? 1) - 1, 0);
            const endLine = Math.max((d.endLine ?? d.line ?? 1) - 1, line);
            const endColumn = Math.max((d.endColumn ?? (d.column ?? 1) + 1) - 1, column + 1);
            const range = new vscode.Range(line, column, endLine, endColumn);
            const severity = severityFromString(d.severity);
            const diag = new vscode.Diagnostic(range, d.message, severity);
            diag.code = d.code;
            diag.source = 'Product Script Compiler';
            const key = uri.toString();
            if (!grouped.has(key)) grouped.set(key, { uri, list: [] });
            grouped.get(key).list.push(diag);
        }

        for (const { uri, list } of grouped.values()) this.diagnostics.set(uri, list);
    }
}

function severityFromString(value) {
    switch ((value ?? '').toLowerCase()) {
        case 'warning': return vscode.DiagnosticSeverity.Warning;
        case 'information':
        case 'info': return vscode.DiagnosticSeverity.Information;
        case 'hint': return vscode.DiagnosticSeverity.Hint;
        default: return vscode.DiagnosticSeverity.Error;
    }
}

function quote(value) { return /\s/.test(value) ? `"${value}"` : value; }

module.exports = { CompilerClient };
