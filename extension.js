// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const gogoast = require('gogoast');
const glob = require('glob');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */

let Config = {
	fileType: '.{ts,js}',
	outputDir: 'transform',
	inputDir: 'src'
}

let srcFileWatcher = null;
let configWatcher = null;

function activate(context) {
	const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

	watchConfigFile(rootPath);

	const { hasTransformFile } = getConfig(rootPath);
	console.log(hasTransformFile ? 'hasConfig' : 'noConfig');
	if (!hasTransformFile) {
		return;
	}

	addAllExport(rootPath);

	watchSrcFile(rootPath);
}

function getConfig(rootPath) {
	let configFileContent = '';
	let hasTransformFile = false;
	try {
		configFileContent = fs.readFileSync(`${rootPath}/.vscode/.transform.json`).toString();
		hasTransformFile = true;
	} catch(e) {
		console.error(e.message);
		return { hasTransformFile };
	}
	
	try {
		configJSON = JSON.parse(configFileContent);
		for( let c in configJSON) {
			if (!configJSON[c]){
				delete configJSON[c];
			}
		}
		Object.assign(Config, {
			fileType: '.{ts,js}',
			outputDir: 'transform',
			inputDir: 'src'
		}, configJSON);
	} catch(e) {
		Object.assign(Config, {
			fileType: '.{ts,js}',
			outputDir: 'transform',
			inputDir: 'src'
		})
		console.error(e.message);
	}
	return { hasTransformFile };
}

function watchConfigFile(rootPath) {
	console.log('watch config')
	if (configWatcher) {
		configWatcher.dispose();
		configWatcher = null;
	}
	configWatcher = vscode.workspace.createFileSystemWatcher(`**/.transform.json`, false, false, false);
	configWatcher.onDidChange(e => { // 文件发生更新
		const { hasTransformFile } = getConfig(rootPath);
		if (!hasTransformFile) {
			return;
		}
		console.log('config change')
		addAllExport(rootPath);
	});
	configWatcher.onDidCreate(e => {
		const { hasTransformFile } = getConfig(rootPath);
		if (!hasTransformFile) {
			return;
		}
		console.log('config create')
		addAllExport(rootPath);
		watchSrcFile(rootPath)
	});
	configWatcher.onDidDelete(e => {
		console.log('config delete')
		srcFileWatcher && srcFileWatcher.dispose();
		srcFileWatcher = null;
		Object.assign(Config, {
			fileType: '.{ts,js}',
			outputDir: 'transform',
			inputDir: 'src'
		})
	});
}

function watchSrcFile(rootPath) {
	const { inputDir, fileType } = Config;
	if (srcFileWatcher) {
		srcFileWatcher.dispose();
		srcFileWatcher = null;
	}
	console.log('watch file');
	const watcher = vscode.workspace.createFileSystemWatcher(`**/*${fileType}`, false, false, false);
	watcher.onDidChange(e => { // 文件发生更新
		if (e.fsPath.match(`${rootPath}/${inputDir}/`)) {
			console.log('file changed', e.fsPath);
			addExport(e.fsPath, rootPath)
		}
	});
	watcher.onDidCreate(e => { // 新建了js文件
		if (e.fsPath.match(`${rootPath}/${inputDir}/`)) {
			console.log('file created');
			addExport(e.fsPath, rootPath)
		}
	});
	srcFileWatcher = watcher;
}

function addAllExport(rootPath) {
	const { inputDir, outputDir, fileType } = Config;

	glob(`${rootPath}/${inputDir}/**/*${fileType}`,{}, (err, fileList) => {
		fileList.forEach(file => {
			try {
				hasFile = fs.readFileSync(file.replace(`${rootPath}/${inputDir}`, `${rootPath}/${outputDir}`));
			} catch(e) {
				try {
					addExport(file, rootPath);
				} catch(e) {
					console.error(e.message);
				}	
			}
		})
	})
}

function addExport(file, rootPath) {
	const { inputDir, outputDir } = Config;
	fs.readFile(file, (err, data) => {
		if (err) {
			console.error(err.message);
			return;
		}
		const code = data.toString();
		const AST = gogoast.createAstObj(code);     // code是源代码字符串
	
		const { nodePathList } = AST.getAstsBySelector([
			`const $_$ = $_$`,
			`var $_$ = $_$`,
			`let $_$ = $_$`,
			`function $_$() {}`,
			`type $_$ = $_$`,
			`type $_$ = $_$ | $_$`,
			`interface $_$ {}`
		], true, 'n');   // 匹配到最外层的变量定义
		nodePathList.forEach(n => {
			if (n.parent.node.type == 'ExportNamedDeclaration') {    // declaration类型的节点肯定存在parent
				return;     // 已经export的不处理
			}
			gogoast.replaceAstByAst(n, { type: 'ExportNamedDeclaration', declaration: n.value })
		})
		const outputFile = file.replace(`${rootPath}/${inputDir}/`, `${rootPath}/${outputDir}/`);
		if (outputFile.match(`${rootPath}/${outputDir}/`)) {
			fs.mkdir(path.resolve(outputFile, '../'),{ recursive: true }, function(err){
				if (err) {
					return console.error(err);
				}
				fs.writeFileSync(outputFile, AST.generate())
			});
		}
	})
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
