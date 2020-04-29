// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const gogoast = require('gogoast');
const glob = require('glob');
const fs = require('fs');
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('transform.addExport', function () {
		// The code you place here will be executed every time your command is executed
		const config = vscode.workspace.getConfiguration();
		const fileType = config.get('fileType');
		const outputDir = config.get('outputDir');
		const inputDir = config.get('inputDir');

		const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		glob(`${rootPath}/${inputDir}/**/*${fileType}`,{}, (err, fileList) => {
			fileList.forEach(file => {
				addExport(file, inputDir, outputDir);
			})
		})

		console.log(vscode.workspace.workspaceFolders);
		// Display a message box to the user
		const watcher = vscode.workspace.createFileSystemWatcher(`**/*${fileType}`, false, false, false);
		console.log(`**/*${fileType}`)
		watcher.onDidChange(e => { // 文件发生更新
			if (e.fsPath.match(`${inputDir}/`)) {
				console.log('file changed', e.fsPath);
				addExport(e.fsPath, inputDir, outputDir)
			}
		});
		watcher.onDidCreate(e => { // 新建了js文件
			console.log('file created');
			addExport(e.fsPath, inputDir, outputDir)
		});
		// watcher.onDidDelete(e => { // 删除了js文件
		// 	console.log('js deleted,');
		// 	// addExport(fileType, inputDir, outputDir)
		// });
	});

	context.subscriptions.push(disposable);
}
exports.activate = activate;

// function addExport(fileType, inputDir, outputDir) {
// 	glob(`${inputDir}/**/*${fileType}`, {}, (err, fileList) => {
// 		console.log(fileType,inputDir,outputDir)
// 	})
// }
function addExport(file, inputDir, outputDir) {

	const code = fs.readFileSync(file).toString();
	const AST = gogoast.createAstObj(code);     // code是源代码字符串

	const { nodePathList } = AST.getAstsBySelector([
	`const $_$ = $_$`,
	`function $_$() {}`,
	`type $_$ = $_$`,
	`type $_$ = $_$ | $_$`,
	`interface $_$ {}`
	], true, 'n');   // 匹配到最外层的变量定义
	nodePathList.forEach(n => {
	if (n.parent.node.type == 'ExportNamedDeclaration') {    // declarator类型的节点肯定至少存在两级parent，不会报错
		return;     // 已经export的不处理
	}
	gogoast.replaceAstByAst(n, { type: 'ExportNamedDeclaration', declaration: n.value })
	})
	fs.writeFileSync(file.replace(`${inputDir}/`, `${outputDir}/`), AST.generate())
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
