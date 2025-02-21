import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { exec } from "node:child_process";

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

function detectPackageManager(workspaceFolder: string): "npm" | "yarn" | "pnpm" | undefined {
  if (fs.existsSync(path.join(workspaceFolder, "yarn.lock"))) {
    return "yarn";
  }
  if (fs.existsSync(path.join(workspaceFolder, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(workspaceFolder, "package-lock.json"))) {
    return "npm";
  }
  return undefined;
}

function fmtDeps(deps?: Dependencies) {
  if (!deps) {
    return [];
  }
  return Object.keys(deps).filter((pkg) => !deps[pkg].includes("workspace:"));
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
        const packageJson: PackageJson = JSON.parse(fileContent);
        const dependencies = fmtDeps(packageJson.dependencies);
        const devDependencies = fmtDeps(packageJson.devDependencies);
        const optionalDependencies = fmtDeps(packageJson.optionalDependencies);
        const peerDependencies = fmtDeps(packageJson.peerDependencies);
        const allPackages = [
          ...dependencies.map(pkg => `dependency: ${pkg}`),
          ...devDependencies.map(pkg => `devDependency: ${pkg}`),
          ...optionalDependencies.map(pkg => `optionalDependency: ${pkg}`),
          ...peerDependencies.map(pkg => `peerDependency: ${pkg}`),
        ];

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

        const packageNames = selectedPackages.map(pkg => pkg.split(": ")[1]);
        const managerRemoveCmd = packageManager === "yarn"
              ? "yarn remove"
              : packageManager === "pnpm"
              ? "pnpm remove"
              : "npm uninstall";

        for (const packageName of packageNames) {
          const uninstallCommand = `${managerRemoveCmd} ${packageName}`;

          await new Promise<void>((resolve, reject) => {
            // 2/21/2025 - hacky workaround for monorepos
            exec(uninstallCommand, { cwd: monorepo ? cwd : workspaceFolder }, (err, stdout, stderr) => {
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
        console.error(error);
        vscode.window.showErrorMessage("Error parsing package.json.");
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
