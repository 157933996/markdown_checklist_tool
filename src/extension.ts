// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "table" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('table.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from table!');
	});
	const ikunCommand = vscode.commands.registerCommand('table.ikun', () => {
		vscode.window.showInformationMessage('唱、跳、rap、篮球');
	});
	const Mark = vscode.commands.registerCommand('table.convertToTable', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请打开一个文本文件并选中文本');
            return;
        }
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        if (!text.trim()) {
            vscode.window.showErrorMessage('请选择要转换的内容');
            return;
        }
        const headers = ["cat", "编号", "检查项目", "检查方法与参考值", "检查结果", "RP&时间"];
        const tableMarkdown = convertToMarkdownTable(headers, text);
        editor.edit(editBuilder => {
            editBuilder.insert(selection.end, "\n\n" + tableMarkdown);
        });
    });
    const Unmark = vscode.commands.registerCommand('table.convertFromTable', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('请打开一个文本文件并选中文本');
			return;
		}
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text.trim()) {
			vscode.window.showErrorMessage('请选择要转换的内容');
			return;
		}
		try {
			const originalText = convertHtmlTableToText(text);
			editor.edit(editBuilder => {
				editBuilder.insert(selection.end, "\n\n" + originalText);
			});
		} catch (error) {
			vscode.window.showErrorMessage('转换失败，请确保选中的内容是有效的HTML表格');
		}
	});
    context.subscriptions.push(Mark);
    context.subscriptions.push(Unmark);
	context.subscriptions.push(disposable);
	context.subscriptions.push(ikunCommand);

}

function convertToMarkdownTable(headers: string[], tableContent: string): string {
    interface RowData {
        num: string;
        checkItem: string;
        checkMethod: string;
    }

    let dataRows: { cat: string; rows: RowData[] }[] = [];
    let currentCat: string | null = null;
    let currentRows: RowData[] = [];
    let itemIndex = 1; // 编号，按类别重置

    function cleanField(text: string, prefixes: string[]): string {
        for (const prefix of prefixes) {
            const pattern = new RegExp(`^\\s*${prefix}[:：]\\s*`);
            if (pattern.test(text)) {
                return text.replace(pattern, "").trim();
            }
        }
        return text.trim();
    }

    // 定义所有可能的字段前缀
    const numPrefixes = ["编号"];
    const checkItemPrefixes = ["检查项目", "检查项⽬"];
    const checkMethodPrefixes = ["检查方法与参考值", "检查⽅法与参考值"];
    const catPrefixes = ["cat"];

    // 处理输入行
    const lines = tableContent.split("\n").map(line => line.trim()).filter(line => line.length > 0);

    for (const line of lines) {
        // 移除行首的 '-' 和空格
        const content = line.replace(/^\s*\-+\s*/, "");

        if (catPrefixes.some(prefix => content.startsWith(`${prefix}:`))) {
            // 保存之前的分类数据
            if (currentCat !== null) {
                dataRows.push({ cat: currentCat, rows: currentRows });
            }
            currentCat = cleanField(content, catPrefixes);
            currentRows = [];
            itemIndex = 1; // 重置编号
        } else {
            if (!currentCat) continue;
            const rowText = content.replace(/#+$/, ""); // 去除尾部的 '#'
            const fields = rowText.split("#").map(field => field.trim()).filter(f => f.length > 0);

            let num = "";
            let checkItem = "";
            let checkMethod = "";

            for (const field of fields) {
                if (numPrefixes.some(prefix => field.startsWith(`${prefix}:`) || field.startsWith(`${prefix}：`))) {
                    num = cleanField(field, numPrefixes);
                } else if (checkItemPrefixes.some(prefix => field.startsWith(`${prefix}:`) || field.startsWith(`${prefix}：`))) {
                    checkItem = cleanField(field, checkItemPrefixes);
                } else if (checkMethodPrefixes.some(prefix => field.startsWith(`${prefix}:`) || field.startsWith(`${prefix}：`))) {
                    checkMethod = cleanField(field, checkMethodPrefixes);
                } else {
                    // 如果没有匹配特定前缀，根据顺序填充
                    if (!checkItem) {
                        checkItem = field;
                    } else if (!checkMethod) {
                        checkMethod = field;
                    }
                }
            }

            if (!num) {
                num = String(itemIndex++);
            }

            currentRows.push({ num, checkItem, checkMethod });
        }
    }

    // 添加最后一个分类的数据
    if (currentCat !== null) {
        dataRows.push({ cat: currentCat, rows: currentRows });
    }

    // 构建 HTML 表格
    let output = ["<table>", "  <thead>", "    <tr>"];
    headers.forEach(header => output.push(`      <th>${header}</th>`));
    output.push("    </tr>", "  </thead>", "  <tbody>");

    for (const { cat, rows } of dataRows) {
        let firstRow = true;
        for (const row of rows) {
            output.push("    <tr>");
            if (firstRow) {
                output.push(`      <td rowspan="${rows.length}">${cat}</td>`);
                firstRow = false;
            }
            output.push(`      <td>${row.num}</td>`); // 编号
            output.push(`      <td>${row.checkItem}</td>`); // 检查项目
            output.push(`      <td>${row.checkMethod}</td>`); // 检查方法与参考值
            output.push(`      <td></td>`); // 检查结果
            output.push(`      <td></td>`); // RP&时间
            output.push("    </tr>");
        }
    }

    output.push("  </tbody>", "</table>");
    return output.join("\n");
}

function convertHtmlTableToText(htmlContent: string): string {
    const $ = cheerio.load(htmlContent);
    const table = $('table');

    if (table.length === 0) {
        throw new Error('未找到表格');
    }

    const headers = table.find('thead th').map((i, el) => $(el).text().trim()).get();

    // 获取各列的索引
    const catIndex = headers.indexOf('cat');
    const numIndex = headers.indexOf('编号');
    const checkItemIndex = headers.indexOf('检查项目');
    const methodIndex = headers.indexOf('检查方法与参考值');

    const rows = table.find('tbody tr');
    let resultLines: string[] = [];
    let currentCat: string | null = null;
    let catRowspan = 0;

    rows.each((index, row) => {
        const cells = $(row).find('td');

        // 偏移量，用于处理 rowspan 导致的列缺失
        let offset = 0;

        // 处理分类 (cat)
        if (cells.length === headers.length) {
            // 当前行有 cat 列
            const catCell = cells.eq(catIndex);
            const rowspanAttr = catCell.attr('rowspan');
            catRowspan = rowspanAttr ? parseInt(rowspanAttr) - 1 : 0;
            currentCat = catCell.text().trim();
            resultLines.push(`- cat:${currentCat}`);
        } else {
            // 当前行没有 cat 列，维持之前的分类
            catRowspan--;
            offset = -1;
        }

        // 获取各列数据
        const num = cells.eq(numIndex + offset).text().trim(); // 编号
        const checkItem = cells.eq(checkItemIndex + offset).text().trim(); // 检查项目
        const checkMethod = cells.eq(methodIndex + offset).html()?.trim() || ''; // 检查方法与参考值

        // 构造输出行
        let line = ` - 编号：${num}#检查项⽬:${checkItem}`;
        if (checkMethod) {
            line += `#检查⽅法与参考值：${checkMethod}##`;
        } else {
            line += `##`;
        }
        resultLines.push(line);
    });

    return resultLines.join('\n');
}

// This method is called when your extension is deactivated
export function deactivate() {}
