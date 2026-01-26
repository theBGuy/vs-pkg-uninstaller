import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
type Dependencies = { [key: string]: string };
type DependencyType = "dependency" | "devDependency" | "optionalDependency" | "peerDependency";

interface PackageInfo {
  name: string;
  type: DependencyType;
}

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

function fmtDeps(deps: Dependencies | undefined, type: DependencyType): PackageInfo[] {
  if (!deps) {
    return [];
  }
  return Object.keys(deps)
    .filter((pkg) => !deps[pkg]?.includes("workspace:"))
    .map((name) => ({ name, type }));
}

function parsePackageJson(fileContent: string): PackageInfo[] {
  const packageJson: PackageJson = JSON.parse(fileContent);
  return [
    ...fmtDeps(packageJson.dependencies, "dependency"),
    ...fmtDeps(packageJson.devDependencies, "devDependency"),
    ...fmtDeps(packageJson.optionalDependencies, "optionalDependency"),
    ...fmtDeps(packageJson.peerDependencies, "peerDependency"),
  ];
}

function getAllDependencyNames(fileContent: string): Set<string> {
  const packageJson: PackageJson = JSON.parse(fileContent);
  const allDeps = new Set<string>();
  for (const deps of [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.optionalDependencies,
    packageJson.peerDependencies,
  ]) {
    if (deps) {
      for (const name of Object.keys(deps)) {
        allDeps.add(name);
      }
    }
  }
  return allDeps;
}

interface UninstallCommand {
  cmd: string;
  args: string[];
}

function getUninstallCommand(packageManager: PackageManager): UninstallCommand {
  switch (packageManager) {
    case "yarn":
      return { cmd: "yarn", args: ["remove"] };
    case "pnpm":
      return { cmd: "pnpm", args: ["remove"] };
    case "bun":
      return { cmd: "bun", args: ["remove"] };
    default:
      return { cmd: "npm", args: ["uninstall"] };
  }
}

function getInstallCommand(packageManager: PackageManager): string {
  return `${packageManager} install`;
}

async function uninstallPackages(
  packageNames: string[],
  packageManager: PackageManager,
  cwd: string,
  token: vscode.CancellationToken,
): Promise<boolean> {
  const { cmd, args } = getUninstallCommand(packageManager);

  if (!fs.existsSync(path.join(cwd, "package.json"))) {
    vscode.window.showErrorMessage(`No package.json found in ${cwd}. Cannot uninstall packages.`);
    return false;
  }

  let wasCancelled = false;

  return new Promise((resolve) => {
    const childProcess = execFile(cmd, [...args, ...packageNames], { cwd, shell: true }, (err, _stdout, stderr) => {
      if (wasCancelled) {
        // Don't show error if user cancelled - they already got the warning
        resolve(false);
        return;
      }
      if (err) {
        vscode.window.showErrorMessage(`Error uninstalling packages: ${stderr || err.message}`);
        resolve(false);
      } else {
        vscode.window.showInformationMessage(`Successfully uninstalled: ${packageNames.join(", ")}`);
        resolve(true);
      }
    });

    token.onCancellationRequested(() => {
      wasCancelled = true;
      childProcess.kill();
      const installCmd = getInstallCommand(packageManager);
      vscode.window
        .showWarningMessage("Uninstall cancelled. Your project may be in an inconsistent state.", `Run ${installCmd}`)
        .then((selection) => {
          if (selection) {
            const terminal = vscode.window.createTerminal("Package Recovery");
            terminal.show();
            terminal.sendText(`cd "${cwd}" && ${installCmd}`);
          }
        });
      resolve(false);
    });
  });
}

function getPackageJsonDirectory(filePath: string): string {
  return path.dirname(filePath);
}

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function determinePackageManager(packageJsonDir: string, workspaceRoot?: string): PackageManager | undefined {
  let packageManager = detectPackageManager(packageJsonDir);

  // If not found and we have a workspace root different from package.json dir, try workspace root
  if (!packageManager && workspaceRoot && workspaceRoot !== packageJsonDir) {
    packageManager = detectPackageManager(workspaceRoot);
  }

  return packageManager;
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("extension.uninstallPackages", async () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !editor.document.fileName.endsWith("package.json")) {
      vscode.window.showErrorMessage("Please open a package.json file.");
      return;
    }

    const filePath = editor.document.fileName;
    const fileContent = editor.document.getText();

    try {
      const allPackages = parsePackageJson(fileContent);

      if (allPackages.length === 0) {
        vscode.window.showInformationMessage("No packages to uninstall.");
        return;
      }

      const packageJsonDir = getPackageJsonDirectory(filePath);
      const workspaceRoot = getWorkspaceRoot();

      if (!workspaceRoot) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
      }

      const packageManager = determinePackageManager(packageJsonDir, workspaceRoot);

      if (!packageManager) {
        vscode.window.showErrorMessage(
          "No package manager lock file found. Please ensure you have a package-lock.json, yarn.lock, pnpm-lock.yaml, or bun.lock file.",
        );
        return;
      }

      const quickPickItems = allPackages.map((pkg) => ({
        label: pkg.name,
        description: pkg.type,
        pkg,
      }));

      const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
        canPickMany: true,
        placeHolder: `Detected ${packageManager}. Select packages to uninstall`,
      });

      if (!selectedItems || selectedItems.length === 0) {
        return;
      }

      const packageNames = selectedItems.map((item) => item.pkg.name);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Uninstalling ${packageNames.length} package(s)...`,
          cancellable: true,
        },
        async (_progress, token) => {
          await uninstallPackages(packageNames, packageManager, packageJsonDir, token);
        },
      );
    } catch (error) {
      console.error(error);
      vscode.window.showErrorMessage("Error parsing package.json.");
    }
  });

  const contextDisposable = vscode.commands.registerCommand("extension.uninstallPackageFromContext", async () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !editor.document.fileName.endsWith("package.json")) {
      vscode.window.showErrorMessage("Please open a package.json file.");
      return;
    }

    const filePath = editor.document.fileName;
    const fileContent = editor.document.getText();
    const packageJsonDir = getPackageJsonDirectory(filePath);
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder found.");
      return;
    }

    const packageManager = determinePackageManager(packageJsonDir, workspaceRoot);

    if (!packageManager) {
      vscode.window.showErrorMessage(
        "No package manager lock file found. Please ensure you have a package-lock.json, yarn.lock, pnpm-lock.yaml, or bun.lock file.",
      );
      return;
    }

    const position = editor.selection.active;
    const wordRange = editor.document.getWordRangeAtPosition(position, /"[^"]+"/);

    if (!wordRange) {
      vscode.window.showErrorMessage("Please right-click on a package name.");
      return;
    }

    const packageName = editor.document.getText(wordRange).replace(/"/g, "");

    // Validate that the selected text is actually a dependency
    const validDependencies = getAllDependencyNames(fileContent);
    if (!validDependencies.has(packageName)) {
      vscode.window.showErrorMessage(`"${packageName}" is not a dependency in this package.json.`);
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Uninstalling ${packageName}...`,
        cancellable: true,
      },
      async (_progress, token) => {
        await uninstallPackages([packageName], packageManager, packageJsonDir, token);
      },
    );
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(contextDisposable);
}

export function deactivate() {}
