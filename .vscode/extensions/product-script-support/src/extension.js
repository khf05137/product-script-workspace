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

async function activate(context) {
    const definitionLoader = new DefinitionLoader();
    const targetManager = new TargetManager(context);
    const workspaceIndex = new WorkspaceIndex(definitionLoader);
    const compilerClient = new CompilerClient();
    const getFolder = () => getWorkspaceFolder(vscode.window.activeTextEditor?.document.uri);
    const treeProvider = new ProductScriptTreeProvider(targetManager, getFolder);

    context.subscriptions.push(
        definitionLoader,
        targetManager,
        workspaceIndex,
        compilerClient,
        treeProvider,
        vscode.window.registerTreeDataProvider('productScript.view', treeProvider),
        vscode.languages.registerCompletionItemProvider({ language: 'productScript', scheme: 'file' }, new CompletionProvider(definitionLoader, workspaceIndex), '(', ','),
        vscode.languages.registerHoverProvider({ language: 'productScript', scheme: 'file' }, new HoverProvider(definitionLoader, workspaceIndex)),
        vscode.languages.registerSignatureHelpProvider({ language: 'productScript', scheme: 'file' }, new SignatureHelpProvider(definitionLoader), '(', ','),
        vscode.languages.registerDefinitionProvider({ language: 'productScript', scheme: 'file' }, new DefinitionProvider(definitionLoader, workspaceIndex)),
        vscode.languages.registerDocumentSemanticTokensProvider({ language: 'productScript', scheme: 'file' }, new SemanticTokensProvider(definitionLoader), semanticLegend),
        vscode.debug.registerDebugConfigurationProvider('productScript', new DebugConfigurationProvider(targetManager, getFolder)),
        vscode.debug.registerDebugAdapterDescriptorFactory('productScript', new DebugAdapterDescriptorFactory())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('productScript.selectTarget', async () => {
            const folder = getFolder();
            if (!folder) return vscode.window.showWarningMessage('ワークスペースフォルダを開いてください。');
            await targetManager.select(folder);
            treeProvider.refresh();
        }),
        vscode.commands.registerCommand('productScript.compile', async () => {
            const folder = getFolder();
            if (!folder) return vscode.window.showWarningMessage('ワークスペースフォルダを開いてください。');
            const target = await targetManager.requireTarget(folder);
            if (target) await compilerClient.compile(folder, target);
        }),
        vscode.commands.registerCommand('productScript.debug', async () => {
            const folder = getFolder();
            if (!folder) return vscode.window.showWarningMessage('ワークスペースフォルダを開いてください。');
            const target = await targetManager.requireTarget(folder);
            if (!target) return;
            await vscode.debug.startDebugging(folder, {
                type: 'productScript',
                request: 'launch',
                name: `Debug ${require('path').basename(target.fsPath)}`,
                program: target.fsPath
            });
        }),
        vscode.commands.registerCommand('productScript.refresh', async () => {
            definitionLoader.invalidate();
            await workspaceIndex.rebuild(getFolder());
            treeProvider.refresh();
        })
    );

    context.subscriptions.push(
        targetManager.onDidChange(() => treeProvider.refresh()),
        definitionLoader.onDidChange(() => workspaceIndex.scheduleRebuild(getFolder()))
    );

    const scriptWatcher = vscode.workspace.createFileSystemWatcher('**/Scripts/**/*.txt');
    const definitionWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/product-script/*.json');
    context.subscriptions.push(scriptWatcher, definitionWatcher);
    context.subscriptions.push(
        scriptWatcher.onDidCreate(uri => workspaceIndex.scheduleRebuild(getWorkspaceFolder(uri))),
        scriptWatcher.onDidChange(uri => workspaceIndex.scheduleRebuild(getWorkspaceFolder(uri))),
        scriptWatcher.onDidDelete(uri => workspaceIndex.scheduleRebuild(getWorkspaceFolder(uri))),
        definitionWatcher.onDidCreate(() => definitionLoader.invalidate()),
        definitionWatcher.onDidChange(() => definitionLoader.invalidate()),
        definitionWatcher.onDidDelete(() => definitionLoader.invalidate())
    );
    vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.languageId === 'productScript') workspaceIndex.scheduleRebuild(getWorkspaceFolder(e.document.uri));
    }, null, context.subscriptions);
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('productScript')) {
            definitionLoader.invalidate();
            treeProvider.refresh();
        }
    }, null, context.subscriptions);

    await workspaceIndex.rebuild(getFolder());
}

function deactivate() {}

module.exports = { activate, deactivate };
