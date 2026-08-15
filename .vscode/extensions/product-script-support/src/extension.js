const vscode = require('vscode');
const { getWorkspaceFolder } = require('./config');
const { DefinitionLoader } = require('./definitionLoader');
const { TargetManager } = require('./targetManager');
const { WorkspaceIndex } = require('./workspaceIndex');
const { CompletionProvider } = require('./language/completionProvider');
const { HoverProvider } = require('./language/hoverProvider');
const { SignatureHelpProvider } = require('./language/signatureHelpProvider');
const { DefinitionProvider } = require('./language/definitionProvider');
const { SemanticTokensProvider, semanticLegend } = require('./language/semanticTokensProvider');
const { ProductScriptTreeProvider } = require('./ui/productScriptTreeProvider');
const { CompilerClient } = require('./compile/compilerClient');
const { DebugConfigurationProvider } = require('./debug/debugConfigurationProvider');
const { DebugAdapterDescriptorFactory } = require('./debug/debugAdapterDescriptorFactory');

// 拡張機能を初期化し、各機能をVS Codeへ登録する。
async function activate(context) {
    // 拡張機能全体で使用する各コンポーネントを生成する。
    const definitionLoader = new DefinitionLoader();
    const targetManager = new TargetManager(context);
    const workspaceIndex = new WorkspaceIndex(definitionLoader);
    const compilerClient = new CompilerClient();

    // 現在のエディタを基準に対象ワークスペースを取得する。
    const getFolder = () =>
        getWorkspaceFolder(vscode.window.activeTextEditor?.document.uri);

    // Explorer内のPRODUCT SCRIPT Viewを生成する。
    const treeProvider = new ProductScriptTreeProvider(
        targetManager,
        getFolder
    );

    // Tree View、言語支援、デバッグ機能をVS Codeへ登録する。
    context.subscriptions.push(
        definitionLoader,
        targetManager,
        workspaceIndex,
        compilerClient,
        treeProvider,

        vscode.window.registerTreeDataProvider(
            'productScript.view',
            treeProvider
        ),

        vscode.languages.registerCompletionItemProvider(
            { language: 'productScript', scheme: 'file' },
            new CompletionProvider(
                definitionLoader,
                workspaceIndex
            ),
            '(',
            ','
        ),

        vscode.languages.registerHoverProvider(
            { language: 'productScript', scheme: 'file' },
            new HoverProvider(
                definitionLoader,
                workspaceIndex
            )
        ),

        vscode.languages.registerSignatureHelpProvider(
            { language: 'productScript', scheme: 'file' },
            new SignatureHelpProvider(definitionLoader),
            '(',
            ','
        ),

        vscode.languages.registerDefinitionProvider(
            { language: 'productScript', scheme: 'file' },
            new DefinitionProvider(
                definitionLoader,
                workspaceIndex
            )
        ),

        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'productScript', scheme: 'file' },
            new SemanticTokensProvider(definitionLoader),
            semanticLegend
        ),

        vscode.debug.registerDebugConfigurationProvider(
            'productScript',
            new DebugConfigurationProvider(
                targetManager,
                getFolder
            )
        ),

        vscode.debug.registerDebugAdapterDescriptorFactory(
            'productScript',
            new DebugAdapterDescriptorFactory()
        )
    );

    // PRODUCT SCRIPT用の各コマンドを登録する。
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'productScript.selectTarget',
            async () => {
                // 現在のワークスペースからRoot Scriptを選択する。
                const folder = getFolder();

                if (!folder) {
                    return vscode.window.showWarningMessage(
                        'ワークスペースフォルダを開いてください。'
                    );
                }

                await targetManager.select(folder);
                treeProvider.refresh();
            }
        ),

        vscode.commands.registerCommand(
            'productScript.compile',
            async () => {
                // 現在のTargetを取得して外部コンパイラを実行する。
                const folder = getFolder();

                if (!folder) {
                    return vscode.window.showWarningMessage(
                        'ワークスペースフォルダを開いてください。'
                    );
                }

                const target = await targetManager.requireTarget(folder);

                if (target) {
                    await compilerClient.compile(
                        folder,
                        target
                    );
                }
            }
        ),

        vscode.commands.registerCommand(
            'productScript.debug',
            async () => {
                // 現在のTargetを取得してデバッグセッションを開始する。
                const folder = getFolder();

                if (!folder) {
                    return vscode.window.showWarningMessage(
                        'ワークスペースフォルダを開いてください。'
                    );
                }

                const target = await targetManager.requireTarget(folder);

                if (!target) {
                    return;
                }

                await vscode.debug.startDebugging(
                    folder,
                    {
                        type: 'productScript',
                        request: 'launch',
                        name: `Debug ${require('path').basename(target.fsPath)}`,
                        program: target.fsPath
                    }
                );
            }
        ),

        vscode.commands.registerCommand(
            'productScript.refresh',
            async () => {
                // 言語定義とWorkspace Indexを再読み込みする。
                definitionLoader.invalidate();
                await workspaceIndex.rebuild(getFolder());
                treeProvider.refresh();
            }
        )
    );

    // Targetや言語定義の変更に応じて関連機能を更新する。
    context.subscriptions.push(
        targetManager.onDidChange(
            () => treeProvider.refresh()
        ),

        definitionLoader.onDidChange(
            () => workspaceIndex.scheduleRebuild(
                getFolder()
            )
        )
    );

    // スクリプトファイルと言語定義ファイルの変更を監視する。
    const scriptWatcher =
        vscode.workspace.createFileSystemWatcher(
            '**/Scripts/**/*.txt'
        );

    const definitionWatcher =
        vscode.workspace.createFileSystemWatcher(
            '**/.vscode/product-script/*.json'
        );

    context.subscriptions.push(
        scriptWatcher,
        definitionWatcher
    );

    // スクリプトファイル変更時にWorkspace Indexを更新する。
    context.subscriptions.push(
        scriptWatcher.onDidCreate(
            uri => workspaceIndex.scheduleRebuild(
                getWorkspaceFolder(uri)
            )
        ),

        scriptWatcher.onDidChange(
            uri => workspaceIndex.scheduleRebuild(
                getWorkspaceFolder(uri)
            )
        ),

        scriptWatcher.onDidDelete(
            uri => workspaceIndex.scheduleRebuild(
                getWorkspaceFolder(uri)
            )
        ),

        // 言語定義ファイル変更時に定義キャッシュを破棄する。
        definitionWatcher.onDidCreate(
            () => definitionLoader.invalidate()
        ),

        definitionWatcher.onDidChange(
            () => definitionLoader.invalidate()
        ),

        definitionWatcher.onDidDelete(
            () => definitionLoader.invalidate()
        )
    );

    // エディタ上のProduct Script変更時にWorkspace Indexを更新する。
    vscode.workspace.onDidChangeTextDocument(
        e => {
            if (e.document.languageId === 'productScript') {
                workspaceIndex.scheduleRebuild(
                    getWorkspaceFolder(e.document.uri)
                );
            }
        },
        null,
        context.subscriptions
    );

    // Product Script設定変更時に定義情報とTree Viewを更新する。
    vscode.workspace.onDidChangeConfiguration(
        e => {
            if (e.affectsConfiguration('productScript')) {
                definitionLoader.invalidate();
                treeProvider.refresh();
            }
        },
        null,
        context.subscriptions
    );

    // 起動時にWorkspace Indexを初期構築する。
    await workspaceIndex.rebuild(getFolder());
}

// 拡張機能終了時の追加処理は現在なし。
function deactivate() {}

module.exports = { activate, deactivate };