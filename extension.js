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
