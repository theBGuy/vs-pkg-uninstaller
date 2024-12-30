// // The module 'vscode' contains the VS Code extensibility API
// // Import the module and reference it with the alias vscode in your code below
// import * as vscode from 'vscode';

// // This method is called when your extension is activated
// // Your extension is activated the very first time the command is executed
// export function activate(context: vscode.ExtensionContext) {

// 	// Use the console to output diagnostic information (console.log) and errors (console.error)
// 	// This line of code will only be executed once when your extension is activated
// 	console.log('Congratulations, your extension "quickuninstall" is now active!');

// 	// The command has been defined in the package.json file
// 	// Now provide the implementation of the command with registerCommand
// 	// The commandId parameter must match the command field in package.json
// 	const disposable = vscode.commands.registerCommand('quickuninstall.helloWorld', () => {
// 		// The code you place here will be executed every time your command is executed
// 		// Display a message box to the user
// 		vscode.window.showInformationMessage('Hello World from QuickUninstall!');
// 	});

// 	context.subscriptions.push(disposable);
// }

// // This method is called when your extension is deactivated
// export function deactivate() {}

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { exec } from "node:child_process";

function detectPackageManager(workspaceFolder: string): "npm" | "yarn" | "pnpm" {
  if (fs.existsSync(path.join(workspaceFolder, "yarn.lock"))) {
    return "yarn";
  }
  if (fs.existsSync(path.join(workspaceFolder, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  return "npm";
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.uninstallPackage",
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor || !editor.document.fileName.endsWith("package.json")) {
        vscode.window.showErrorMessage("Please open a package.json file.");
        return;
      }

      const filePath = editor.document.fileName;
      const fileContent = fs.readFileSync(filePath, "utf8");

      try {
        const packageJson = JSON.parse(fileContent);
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        const allPackages = [
          ...dependencies.map(pkg => `dependency: ${pkg}`),
          ...devDependencies.map(pkg => `devDependency: ${pkg}`),
        ];

        if (allPackages.length === 0) {
          vscode.window.showInformationMessage("No packages to uninstall.");
          return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        if (!workspaceFolder) {
          vscode.window.showErrorMessage("No workspace folder found.");
          return;
        }

        const packageManager = detectPackageManager(workspaceFolder);

        const selectedPackages = await vscode.window.showQuickPick(allPackages, {
          canPickMany: true,
          placeHolder: `Detected ${packageManager}. Select a package to uninstall`,
        });

        if (!selectedPackages || selectedPackages.length === 0) {
          return;
        }

        const packageNames = selectedPackages.map(pkg => pkg.split(": ")[1]);
        const managerRemoveCmd = packageManager === "yarn"
              ? "yarn remove"
              : packageManager === "pnpm"
              ? "pnpm remove"
              : "npm uninstall";

        for (const packageName of packageNames) {
          const uninstallCommand = `${managerRemoveCmd} ${packageName}`;

          await new Promise<void>((resolve, reject) => {
            exec(uninstallCommand, { cwd: workspaceFolder }, (err, stdout, stderr) => {
              if (err) {
                vscode.window.showErrorMessage(`Error uninstalling ${packageName}: ${stderr}`);
                reject(err);
              } else {
                vscode.window.showInformationMessage(`${packageName} uninstalled successfully.`);
                resolve();
              }
            });
          });
        }
      } catch (error) {
        vscode.window.showErrorMessage("Error parsing package.json.");
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
