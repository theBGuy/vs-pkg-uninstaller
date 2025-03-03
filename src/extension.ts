import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
type Dependencies = { [key: string]: string };

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  scripts?: { [key: string]: string };
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  peerDependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  [key: string]: unknown;
}

function detectPackageManager(workspaceFolder: string): PackageManager | undefined {
  if (fs.existsSync(path.join(workspaceFolder, "yarn.lock"))) {
    return "yarn";
  }
  if (fs.existsSync(path.join(workspaceFolder, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(workspaceFolder, "package-lock.json"))) {
    return "npm";
  }
  if (fs.existsSync(path.join(workspaceFolder, "bun.lock"))) {
    return "bun";
  }
  if (fs.existsSync(path.join(workspaceFolder, "bun.lockb"))) {
    return "bun";
  }
  return undefined;
}

function fmtDeps(deps?: Dependencies) {
  if (!deps) {
    return [];
  }
  return Object.keys(deps).filter((pkg) => !deps[pkg].includes("workspace:"));
}

function parsePackageJson(fileContent: string) {
  const packageJson: PackageJson = JSON.parse(fileContent);
  const dependencies = fmtDeps(packageJson.dependencies);
  const devDependencies = fmtDeps(packageJson.devDependencies);
  const optionalDependencies = fmtDeps(packageJson.optionalDependencies);
  const peerDependencies = fmtDeps(packageJson.peerDependencies);
  const allPackages = [
    ...dependencies.map((pkg) => `dependency: ${pkg}`),
    ...devDependencies.map((pkg) => `devDependency: ${pkg}`),
    ...optionalDependencies.map((pkg) => `optionalDependency: ${pkg}`),
    ...peerDependencies.map((pkg) => `peerDependency: ${pkg}`),
  ];
  return allPackages;
}

function getUninstallCommand(packageManager: PackageManager) {
  return packageManager === "yarn"
    ? "yarn remove"
    : packageManager === "pnpm"
      ? "pnpm remove"
      : packageManager === "bun"
        ? "bun remove"
        : "npm uninstall";
}

async function uninstallPackages(packageNames: string[], packageManager: PackageManager, cwd: string) {
  const managerRemoveCmd = getUninstallCommand(packageManager);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Uninstalling packages",
      cancellable: false,
    },
    async (progress) => {
      for (const [index, packageName] of packageNames.entries()) {
        const uninstallCommand = `${managerRemoveCmd} ${packageName}`;

        await new Promise<void>((resolve, reject) => {
          exec(uninstallCommand, { cwd }, (err, stdout, stderr) => {
            if (err) {
              vscode.window.showErrorMessage(`Error uninstalling ${packageName}: ${stderr}`);
              reject(err);
            } else {
              progress.report({
                increment: (index + 1) * (100 / packageNames.length),
                message: `Uninstalled ${packageName}`,
              });
              resolve();
            }
          });
        });
      }
    },
  );

  vscode.window.showInformationMessage(`Selected packages uninstalled successfully. ${packageNames.join(", ")}`);
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("extension.uninstallPackages", async () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !editor.document.fileName.endsWith("package.json")) {
      vscode.window.showErrorMessage("Please open a package.json file.");
      return;
    }

    const filePath = editor.document.fileName;
    const fileContent = fs.readFileSync(filePath, "utf8");

    try {
      const allPackages = parsePackageJson(fileContent);

      if (allPackages.length === 0) {
        vscode.window.showInformationMessage("No packages to uninstall.");
        return;
      }

      let monorepo = false;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      const cwd = path.dirname(filePath);

      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
      }

      const packageManager = (() => {
        const _pkgManager = detectPackageManager(cwd);
        if (!_pkgManager) {
          monorepo = true;
          return detectPackageManager(workspaceFolder);
        }
        return _pkgManager;
      })();

      if (!packageManager) {
        vscode.window.showErrorMessage("No package manager lock file found in the workspace.");
        return;
      }

      const selectedPackages = await vscode.window.showQuickPick(allPackages, {
        canPickMany: true,
        placeHolder: `Detected ${packageManager}. Select a package to uninstall`,
      });

      if (!selectedPackages || selectedPackages.length === 0) {
        return;
      }

      const packageNames = selectedPackages.map((pkg) => pkg.split(": ")[1]);
      const useDirectory = monorepo ? cwd : workspaceFolder;

      await uninstallPackages(packageNames, packageManager, useDirectory);
    } catch (error) {
      console.error(error);
      vscode.window.showErrorMessage("Error parsing package.json.");
    }
  });

  const contextDisposable = vscode.commands.registerCommand(
    "extension.uninstallPackageFromContext",
    async (uri: vscode.Uri) => {
      const editor = vscode.window.activeTextEditor;

      if (!editor || !editor.document.fileName.endsWith("package.json")) {
        vscode.window.showErrorMessage("Please open a package.json file.");
        return;
      }

      const filePath = editor.document.fileName;
      const fileContent = fs.readFileSync(filePath, "utf8");

      try {
        const allPackages = parsePackageJson(fileContent);

        if (allPackages.length === 0) {
          vscode.window.showInformationMessage("No packages to uninstall.");
          return;
        }

        const position = editor.selection.active;
        const wordRange = editor.document.getWordRangeAtPosition(position, /"[^"]+"/);
        if (!wordRange) {
          vscode.window.showErrorMessage("Please right-click on a package name.");
          return;
        }

        let monorepo = false;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        const cwd = path.dirname(filePath);
        const packageName = editor.document.getText(wordRange).replace(/"/g, "");

        if (!workspaceFolder) {
          vscode.window.showErrorMessage("No workspace folder found.");
          return;
        }

        const packageManager = (() => {
          const _pkgManager = detectPackageManager(cwd);
          if (!_pkgManager) {
            monorepo = true;
            return detectPackageManager(workspaceFolder);
          }
          return _pkgManager;
        })();

        if (!packageManager) {
          vscode.window.showErrorMessage("No package manager lock file found in the workspace.");
          return;
        }

        const useDirectory = monorepo ? cwd : workspaceFolder;
        await uninstallPackages([packageName], packageManager, useDirectory);
      } catch (error) {
        console.error(error);
        vscode.window.showErrorMessage("Error parsing package.json.");
      }
    },
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(contextDisposable);
}

export function deactivate() {}
