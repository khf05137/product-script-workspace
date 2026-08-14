# Product Script Workspace

このフォルダ自体を VS Code で開いて使用する、独自スクリプト開発用ワークスペースです。
VSIX や Extension Development Host は使用しません。

## 構成

```text
.
├─ .vscode/
│  ├─ settings.json
│  ├─ extensions/
│  │  └─ product-script-support/    # Local workspace extension 本体
│  └─ product-script/
│     ├─ language.json              # 言語構文・snippet等の定義
│     └─ functions.json             # 独自関数定義
│
└─ Scripts/
   ├─ main_01.txt                   # ルートスクリプト候補
   ├─ main_02.txt                   # ルートスクリプト候補
   └─ Common/
      └─ common.txt                 # IMPORTされるスクリプト例
```

## 初回セットアップ

1. このフォルダを VS Code の **[ファイル] → [フォルダーを開く]** で開きます。
2. Workspace Trust を求められた場合は、内容を確認したうえでこのワークスペースを信頼します。
3. `Ctrl+Shift+X` で Extensions ビューを開きます。
4. **Workspace Recommendations** に表示される `Product Script Support` をインストールします。
5. `Scripts/main_01.txt` などを開き、そのままスクリプト開発を開始します。

Local workspace extension は `.vscode/extensions/product-script-support/` に展開済みです。
VSIX の作成・インストールは不要です。

## 普段の利用

2回目以降は、このフォルダを VS Code で開くだけです。

Explorer に **PRODUCT SCRIPT** View が表示されます。

```text
PRODUCT SCRIPT
├─ Target: main_01.txt
├─ Compile
└─ Debug
```

### Target

`.vscode/settings.json` の `productScript.rootScripts` から Compile / Debug のルートを選択します。
現在エディタで開いている `.txt` とは独立しています。

### Compile

`productScript.compiler.command` に設定した外部 C# アプリを直接起動します。
統合ターミナルは使用しません。

`productScript.compiler.arguments` では次の変数を使用できます。

- `${workspaceFolder}`: ワークスペースの絶対パス
- `${rootScript}`: 選択中ルートスクリプトの絶対パス
- `${rootScriptRelative}`: 選択中ルートスクリプトのワークスペース相対パス

### Debug

`productScript.debugAdapter.command` に設定した既存 C# Debug Adapter を起動します。
選択中 Target の絶対パスを DAP の `launch.program` として渡します。

## 言語定義

仕向けごとの変更は主に次を編集します。

```text
.vscode/product-script/language.json
.vscode/product-script/functions.json
```

Extension本体と仕様定義を分離しているため、可能な範囲で JavaScript を変更せず定義ファイル側でメンテナンスできます。

## Scripts の言語識別

`Scripts/**/*.txt` を `Product Script` 言語として扱います。
ワークスペース内の他の `.txt` ファイルには適用しません。

## Git運用

`.vscode/extensions/product-script-support/` も含め、このワークスペース一式をGit管理する想定です。
仕向けごとにリポジトリが独立している場合、その仕向けのスクリプト、言語定義、Extensionを同じリポジトリの履歴として管理できます。
