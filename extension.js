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

const Config = {
	fileType: '.{ts,js}',
	outputDir: 'transform',
	inputDir: 'src'
}

function activate(context) {
	const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	let configJSON = {};
	try {
		configJSON = JSON.parse(fs.readFileSync(`${rootPath}/.vscode/.transform.json`).toString());
	} catch(e) {

	}
	Object.assign(Config, configJSON);

	addAllExport({ rootPath});

	console.log(vscode.workspace.workspaceFolders);

	watchSrcFile();
	
	watchConfigFile(rootPath);
}
exports.activate = activate;

function watchConfigFile(rootPath) {
	const configWatcher = vscode.workspace.createFileSystemWatcher(`**/.transform.json`, false, false, false);
	configWatcher.onDidChange(e => { // 文件发生更新
		const configJSON = JSON.parse(fs.readFileSync(`${rootPath}/.vscode/.transform.json`).toString());
		Object.assign(Config, configJSON);
		addAllExport({ rootPath });
	});
	configWatcher.onDidCreate(e => {
		const configJSON = JSON.parse(fs.readFileSync(`${rootPath}/.vscode/.transform.json`).toString());
		Object.assign(Config, configJSON);
		addAllExport({ rootPath });
	});
	configWatcher.onDidDelete(e => {

	});
}

function watchSrcFile() {
	const { inputDir, fileType } = Config;
	const watcher = vscode.workspace.createFileSystemWatcher(`**/*${fileType}`, false, false, false);
	console.log(`**/*${fileType}`)
	watcher.onDidChange(e => { // 文件发生更新
		if (e.fsPath.match(`${inputDir}/`)) {
			console.log('file changed', e.fsPath);
			addExport(e.fsPath)
		}
	});
	watcher.onDidCreate(e => { // 新建了js文件
		if (e.fsPath.match(`${inputDir}/`)) {
			console.log('file created');
			addExport(e.fsPath)
		}
	});
}

function addAllExport({rootPath}) {
	const { inputDir, outputDir, fileType } = Config;
	glob(`${rootPath}/${inputDir}/**/*${fileType}`,{}, (err, fileList) => {
		fileList.forEach(file => {
			addExport(file, inputDir, outputDir);
		})
	})
}

function addExport(file) {
	const { inputDir, outputDir } = Config;
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
	const outputFile = file.replace(`${inputDir}/`, `${outputDir}/`);
	fs.mkdir(outputFile.replace(/\/[^\/]+$/, ''),{ recursive: true }, function(err){
		if (err) {
			return console.error(err);
		}
		fs.writeFileSync(outputFile, AST.generate())
	});
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
