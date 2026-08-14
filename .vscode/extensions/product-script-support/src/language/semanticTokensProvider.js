const vscode = require('vscode');
const { getWorkspaceFolder } = require('../config');

const tokenTypes = ['keyword', 'function', 'variable'];
const legend = new vscode.SemanticTokensLegend(tokenTypes);

class SemanticTokensProvider {
    constructor(definitionLoader) {
        this.definitionLoader = definitionLoader;
    }

    async provideDocumentSemanticTokens(document) {
        const folder = getWorkspaceFolder(document.uri);
        const def = await this.definitionLoader.load(folder);
        const builder = new vscode.SemanticTokensBuilder(legend);
        const keywords = new Set(def.language.keywords.map(k => k.toUpperCase()));
        const functions = new Set(def.functions.map(f => f.name.toUpperCase()));

        let variableRegex;
        try { variableRegex = new RegExp(def.language.patterns.variable, 'g'); }
        catch { variableRegex = /[$!][A-Za-z_][A-Za-z0-9_]*/g; }

        for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
            const text = document.lineAt(lineNo).text;
            const ignored = collectIgnoredRanges(text, def.language.patterns);
            const occupied = [];

            variableRegex.lastIndex = 0;
            let vm;
            while ((vm = variableRegex.exec(text)) !== null) {
                if (!isIgnored(vm.index, vm[0].length, ignored)) {
                    builder.push(lineNo, vm.index, vm[0].length, 2, 0);
                    occupied.push([vm.index, vm.index + vm[0].length]);
                }
                if (vm[0].length === 0) variableRegex.lastIndex++;
            }

            const wordRegex = /[A-Za-z_][A-Za-z0-9_]*/g;
            let match;
            while ((match = wordRegex.exec(text)) !== null) {
                if (isIgnored(match.index, match[0].length, ignored) || overlaps(match.index, match[0].length, occupied)) continue;
                const upper = match[0].toUpperCase();
                if (keywords.has(upper)) builder.push(lineNo, match.index, match[0].length, 0, 0);
                else if (functions.has(upper) || /^\s*\(/.test(text.slice(match.index + match[0].length))) {
                    builder.push(lineNo, match.index, match[0].length, 1, 0);
                }
            }
        }

        return builder.build();
    }
}

function collectIgnoredRanges(text, patterns) {
    const ranges = [];
    for (const source of [patterns.string, patterns.comment]) {
        if (!source) continue;
        try {
            const re = new RegExp(source, 'g');
            let m;
            while ((m = re.exec(text)) !== null) {
                ranges.push([m.index, m.index + m[0].length]);
                if (m[0].length === 0) re.lastIndex++;
            }
        } catch {}
    }
    return ranges;
}

function isIgnored(start, length, ranges) { return overlaps(start, length, ranges); }
function overlaps(start, length, ranges) {
    const end = start + length;
    return ranges.some(([a, b]) => start < b && end > a);
}

module.exports = { SemanticTokensProvider, semanticLegend: legend };
