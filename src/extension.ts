

import * as vscode from 'vscode';
import fs from 'fs';
import pdf from 'pdfkit';
import path from 'path';

function generatePDF(apis: any[],progress: { report: (arg0: { increment: number; }) => void; },filename: any) {
    return new Promise((resolve, reject) => {
        const doc = new pdf();
        const pdfFilePath = vscode.Uri.file(`${vscode.workspace.rootPath}/${filename}.pdf`);
        const stream = fs.createWriteStream(pdfFilePath.fsPath);

        doc.pipe(stream);

        doc.fontSize(16).text('Extracted APIs and Methods', { align: 'center' });

        const totalAPIs = apis.length;

        apis.forEach((api: { route: any; method: any; handler: any; lineNumber: number; link: any; }, index: number) => {

            if(!api.route){
                console.log(api);
                return;
            }
            doc
                .fontSize(12)
                .text(`API ${index + 1}: ${api.route}`)
                .text(`Method: ${api.method}`)
                .text(`Handler: ${api.handler}`)
                .text(`Line Number: ${api.lineNumber + 1}`);

            // Create a clickable link using the text block
            doc.link(doc.x, doc.y, doc.widthOfString('Go to Code'), 12, api.link)
                .text('Go to Code');

            doc.moveDown();

            // Report progress
            progress.report({ increment: (100 / totalAPIs) });
        });

        doc.end();

        stream.on('finish', () => {
            resolve(pdfFilePath.fsPath);
        });

        stream.on('error', (err: any) => {
            reject(err);
        });
    });

}

function generateTXT(apis: any[],fileName: any) {
    
    const txtFilePath = vscode.Uri.file(`${vscode.workspace.rootPath}/${fileName}.txt`);
    const txtContent = apis.map((api: { route: any; lineNumber: number; link: any; method: any; handler: any; }) => {
        if(!api.route){
            console.log(api);
            return;
        }
        const goToCodeLink = `[Go to Line ${api.lineNumber + 1}](${api.link})`;
        return `API: ${api.route}\nMethod: ${api.method}\nHandler: ${api.handler}\nLine Number: ${api.lineNumber + 1}\n${goToCodeLink}\n\n`;
    }).join('\n');

    fs.writeFileSync(txtFilePath.fsPath, txtContent);

    return txtFilePath.fsPath;
}

async function exportAPIRoutesToFile(selectedFormat: string) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }
    const fileName = await vscode.window.showInputBox({
        placeHolder: 'Enter the file name (without extension)',
        prompt: 'Provide a name for the output file',
        validateInput: (input: string) => {
            return input.trim() === '' ? 'File name cannot be empty' : null;
        },
    });

    if (fileName === undefined) {
        vscode.window.showErrorMessage('Please enter the file name');
        // User canceled the input
        return;
    }

    if (!fileName) {
        // User did not provide a file name
        vscode.window.showErrorMessage('File name cannot be empty');
        return;
    }


    const sourceCode = activeEditor.document.getText();
    const apiRoutes = extractExpressAPIRoutes(sourceCode);

    if (!apiRoutes) {
        vscode.window.showInformationMessage('No Express.js routes found');
        return;
    }

    if (apiRoutes.length === 0) {
        vscode.window.showInformationMessage('No Express.js routes found');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Generating ${selectedFormat.toUpperCase()}...`,
        cancellable: false
    }, async (progress: any) => {
        try {
            let filePath;
            if (selectedFormat.toLowerCase() === 'pdf') {
                filePath = await generatePDF(apiRoutes, progress,fileName);
            } else if (selectedFormat.toLowerCase() === 'txt') {
                filePath = generateTXT(apiRoutes,fileName);
            } else {
                vscode.window.showErrorMessage('Unsupported file format. Please choose either "pdf" or "txt".');
                return;
            }

            vscode.window.showInformationMessage(`${selectedFormat.toUpperCase()} file created at ${filePath}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error generating ${selectedFormat.toUpperCase()}: ${error.message}`);
        }
    });
}

function extractExpressAPIRoutes(sourceCode: any) {
    const editor = vscode.window.activeTextEditor;
    if(!editor){
        vscode.window.showErrorMessage('No active editor found!!');
        return;
    }
    const document = editor.document;


    const filePath = document.uri.fsPath;
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Regular expression to match API routes and associated methods
    const apiPattern = /router\.route\("(.+)"\)\.(post|get|put|delete)\((.+)\);/g;
    const apis = [{}];

    let match;
    while ((match = apiPattern.exec(fileContent))) {
        console.log(match);
        const [, route, method, handler] = match;
        const lineNumber = document.positionAt(match.index).line;
        const lineText = document.lineAt(lineNumber).text;
        const link = `[Go to Line ${lineNumber + 1}](${document.uri.toString()}#${lineNumber + 1})`;
        if(route){
            apis.push({ route, method, handler, lineNumber, link, lineText });
        }
    }
    return apis;
}

export function activate(context: { subscriptions: any[]; }) {
    let disposable = vscode.commands.registerCommand('extension.nodejs-api-documentation', async () => {
        const selectedFormat = await vscode.window.showQuickPick(['PDF', 'TXT'], {
            placeHolder: 'Select file format',
            ignoreFocusOut: true,
        });

        if (selectedFormat) {
            await exportAPIRoutesToFile(selectedFormat);
        }
    });

    context.subscriptions.push(disposable);

}

export function deactivate() { }
