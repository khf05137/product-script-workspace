const vscode = require('vscode');
const { getWorkspaceFolder } = require('../config');

// Semantic Highlightで使用するトークン種別を定義する。
const tokenTypes = ['keyword', 'function', 'variable'];
const legend = new vscode.SemanticTokensLegend(tokenTypes);

// ドキュメント内のキーワード・関数・変数を意味的に色分けする。
class SemanticTokensProvider {
    constructor(definitionLoader) {
        this.definitionLoader = definitionLoader;
    }

    // ドキュメント全体を解析してSemantic Tokenを生成する。
    async provideDocumentSemanticTokens(document) {
        // 対象ワークスペースと言語定義を取得する。
        const folder = getWorkspaceFolder(document.uri);
        const def = await this.definitionLoader.load(folder);

        // Semantic Token生成用の情報を準備する。
        const builder = new vscode.SemanticTokensBuilder(legend);
        const keywords = new Set(
            def.language.keywords.map(k => k.toUpperCase())
        );
        const functions = new Set(
            def.functions.map(f => f.name.toUpperCase())
        );

        // 言語定義から変数検出用の正規表現を生成する。
        let variableRegex;

        try {
            variableRegex = new RegExp(
                def.language.patterns.variable,
                'g'
            );
        } catch {
            variableRegex = /[$!][A-Za-z_][A-Za-z0-9_]*/g;
        }

        // ドキュメントを1行ずつ解析する。
        for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
            const text = document.lineAt(lineNo).text;

            // 文字列やコメントなど解析対象外の範囲を取得する。
            const ignored = collectIgnoredRanges(
                text,
                def.language.patterns
            );

            // 既にToken化した範囲を保持する。
            const occupied = [];

            // 変数を検出してSemantic Tokenへ追加する。
            variableRegex.lastIndex = 0;
            let vm;

            while ((vm = variableRegex.exec(text)) !== null) {
                if (!isIgnored(vm.index, vm[0].length, ignored)) {
                    builder.push(
                        lineNo,
                        vm.index,
                        vm[0].length,
                        2,
                        0
                    );

                    occupied.push([
                        vm.index,
                        vm.index + vm[0].length
                    ]);
                }

                // 空文字列に一致する正規表現による無限ループを防止する。
                if (vm[0].length === 0) {
                    variableRegex.lastIndex++;
                }
            }

            // 通常の識別子をキーワードまたは関数として判定する。
            const wordRegex = /[A-Za-z_][A-Za-z0-9_]*/g;
            let match;

            while ((match = wordRegex.exec(text)) !== null) {
                // 文字列・コメント・変数として処理済みの範囲は除外する。
                if (
                    isIgnored(
                        match.index,
                        match[0].length,
                        ignored
                    ) ||
                    overlaps(
                        match.index,
                        match[0].length,
                        occupied
                    )
                ) {
                    continue;
                }

                const upper = match[0].toUpperCase();

                // 言語キーワードを登録する。
                if (keywords.has(upper)) {
                    builder.push(
                        lineNo,
                        match.index,
                        match[0].length,
                        0,
                        0
                    );
                }
                // 組み込み関数または関数呼び出し形式を登録する。
                else if (
                    functions.has(upper) ||
                    /^\s*\(/.test(
                        text.slice(
                            match.index + match[0].length
                        )
                    )
                ) {
                    builder.push(
                        lineNo,
                        match.index,
                        match[0].length,
                        1,
                        0
                    );
                }
            }
        }

        // 生成したSemantic Token一覧をVS Codeへ返す。
        return builder.build();
    }
}

// 文字列やコメントなどSemantic Highlight対象外の範囲を収集する。
function collectIgnoredRanges(text, patterns) {
    const ranges = [];

    for (const source of [patterns.string, patterns.comment]) {
        if (!source) continue;

        try {
            const re = new RegExp(source, 'g');
            let m;

            while ((m = re.exec(text)) !== null) {
                ranges.push([
                    m.index,
                    m.index + m[0].length
                ]);

                // 空文字列に一致する正規表現による無限ループを防止する。
                if (m[0].length === 0) {
                    re.lastIndex++;
                }
            }
        } catch {
            // 不正な正規表現は無視する。
        }
    }

    return ranges;
}

// 指定範囲が解析対象外の範囲と重なっているか確認する。
function isIgnored(start, length, ranges) {
    return overlaps(start, length, ranges);
}

// 指定範囲が既存の範囲と重なっているか確認する。
function overlaps(start, length, ranges) {
    const end = start + length;

    return ranges.some(
        ([a, b]) => start < b && end > a
    );
}

module.exports = {
    SemanticTokensProvider,
    semanticLegend: legend
};