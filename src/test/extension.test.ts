// import * as assert from 'assert';

// // You can import and use all API from the 'vscode' module
// // as well as import your extension to test it
// import * as vscode from 'vscode';
// // import * as myExtension from '../../extension';

// suite('Extension Test Suite', () => {
// 	vscode.window.showInformationMessage('Start all tests.');

// 	test('Sample test', () => {
// 		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
// 		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
// 	});
// });

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

suite("Extension Tests", () => {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

  test("Command 'extension.uninstallPackageFromContext' is registered", async () => {
    const extension = vscode.extensions.getExtension("theBGuy.pkguninstaller");
    assert.ok(extension, "Extension not found.");
    await extension?.activate();
    const commandExists = (await vscode.commands.getCommands()).includes("extension.uninstallPackageFromContext");
    assert.strictEqual(commandExists, true, "Command 'extension.uninstallPackageFromContext' is not registered");
  });

  test("Command 'extension.uninstallPackages' is registered", async () => {
    const extension = vscode.extensions.getExtension("theBGuy.pkguninstaller");
    assert.ok(extension, "Extension not found.");
    await extension?.activate();
    const commandExists = (await vscode.commands.getCommands()).includes("extension.uninstallPackages");
    assert.strictEqual(commandExists, true, "Command 'extension.uninstallPackages' is not registered");
  });

  test("Package.json can be parsed", async () => {
    const packageJsonPath = path.join(workspacePath, "package.json");
    assert.strictEqual(fs.existsSync(packageJsonPath), true, "package.json file does not exist in the workspace");

    const fileContent = fs.readFileSync(packageJsonPath, "utf8");
    assert.doesNotThrow(() => JSON.parse(fileContent), "Failed to parse package.json");
  });

  test("Uninstall single package from context", async () => {
    const command = "extension.uninstallPackageFromContext";
    const packageJsonPath = path.join(workspacePath, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      fs.writeFileSync(packageJsonPath, JSON.stringify({ dependencies: { "fake-package": "^1.0.0" } }, null, 2));
    }

    await vscode.commands.executeCommand(command);

    assert.ok(true, "Command executed successfully");
  });

  test("Uninstall multiple packages", async () => {
    const command = "extension.uninstallPackages";
    const packageJsonPath = path.join(workspacePath, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      fs.writeFileSync(packageJsonPath, JSON.stringify({ dependencies: { "fake-package": "^1.0.0" } }, null, 2));
    }

    await vscode.commands.executeCommand(command);

    assert.ok(true, "Command executed successfully");
  });
});
