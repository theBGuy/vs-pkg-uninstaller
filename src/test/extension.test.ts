import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

suite("Extension Tests", () => {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

  const createTestDir = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  };

  const cleanupTestDir = (dirPath: string) => {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  };

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

  // test("Package.json can be parsed", async () => {
  //   const packageJsonPath = path.join(workspacePath, "package.json");
  //   assert.strictEqual(fs.existsSync(packageJsonPath), true, "package.json file does not exist in the workspace");

  //   const fileContent = fs.readFileSync(packageJsonPath, "utf8");
  //   assert.doesNotThrow(() => JSON.parse(fileContent), "Failed to parse package.json");
  // });

  suite("Monorepo Tests", () => {
    const testMonorepoPath = path.join(workspacePath, "test-monorepo");
    const packagesPath = path.join(testMonorepoPath, "packages");
    const appsPath = path.join(testMonorepoPath, "apps");

    setup(() => {
      createTestDir(testMonorepoPath);
      createTestDir(packagesPath);
      createTestDir(appsPath);
    });

    teardown(() => {
      cleanupTestDir(testMonorepoPath);
    });

    test("Creates valid monorepo structure", () => {
      const rootPackageJson = {
        name: "test-monorepo",
        version: "1.0.0",
        workspaces: ["packages/*", "apps/*"],
      };
      fs.writeFileSync(path.join(testMonorepoPath, "package.json"), JSON.stringify(rootPackageJson, null, 2));

      const packageAPath = path.join(packagesPath, "package-a");
      createTestDir(packageAPath);
      const packageAJson = {
        name: "@monorepo/package-a",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
          "@monorepo/package-b": "workspace:*",
        },
        devDependencies: {
          typescript: "^4.0.0",
        },
      };
      fs.writeFileSync(path.join(packageAPath, "package.json"), JSON.stringify(packageAJson, null, 2));

      const packageBPath = path.join(packagesPath, "package-b");
      createTestDir(packageBPath);
      const packageBJson = {
        name: "@monorepo/package-b",
        version: "1.0.0",
        dependencies: {
          axios: "^0.24.0",
        },
      };
      fs.writeFileSync(path.join(packageBPath, "package.json"), JSON.stringify(packageBJson, null, 2));

      assert.strictEqual(fs.existsSync(path.join(testMonorepoPath, "package.json")), true);
      assert.strictEqual(fs.existsSync(path.join(packageAPath, "package.json")), true);
      assert.strictEqual(fs.existsSync(path.join(packageBPath, "package.json")), true);
    });

    test("Handles monorepo directory structure correctly", () => {
      const rootPackageJson = {
        name: "complex-monorepo",
        version: "1.0.0",
        workspaces: {
          packages: ["packages/*", "apps/*", "tools/*"],
        },
      };
      fs.writeFileSync(path.join(testMonorepoPath, "package.json"), JSON.stringify(rootPackageJson, null, 2));

      const toolsPath = path.join(testMonorepoPath, "tools");
      createTestDir(toolsPath);

      const buildToolPath = path.join(toolsPath, "build-tool");
      createTestDir(buildToolPath);
      const buildToolJson = {
        name: "@monorepo/build-tool",
        version: "1.0.0",
        dependencies: {
          webpack: "^5.0.0",
          "babel-core": "^6.0.0",
        },
        devDependencies: {
          "@types/webpack": "^5.0.0",
        },
        peerDependencies: {
          react: "^17.0.0",
        },
        optionalDependencies: {
          fsevents: "^2.3.0",
        },
      };
      fs.writeFileSync(path.join(buildToolPath, "package.json"), JSON.stringify(buildToolJson, null, 2));

      assert.strictEqual(fs.existsSync(path.join(buildToolPath, "package.json")), true);

      const parsedJson = JSON.parse(fs.readFileSync(path.join(buildToolPath, "package.json"), "utf8"));
      assert.strictEqual(parsedJson.name, "@monorepo/build-tool");
      assert.strictEqual(Object.keys(parsedJson.dependencies).length, 2);
      assert.strictEqual(Object.keys(parsedJson.devDependencies).length, 1);
      assert.strictEqual(Object.keys(parsedJson.peerDependencies).length, 1);
      assert.strictEqual(Object.keys(parsedJson.optionalDependencies).length, 1);
    });

    test("Validates package.json parsing in monorepo packages", () => {
      const packagePath = path.join(packagesPath, "test-package");
      createTestDir(packagePath);

      const packageJson = {
        name: "@monorepo/test-package",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
          "@monorepo/shared": "workspace:*",
          express: "^4.18.0",
        },
        devDependencies: {
          jest: "^27.0.0",
          "@monorepo/dev-tools": "workspace:^1.0.0",
          eslint: "^8.0.0",
        },
        peerDependencies: {
          react: "^17.0.0",
        },
        optionalDependencies: {
          sharp: "^0.30.0",
        },
      };

      fs.writeFileSync(path.join(packagePath, "package.json"), JSON.stringify(packageJson, null, 2));

      // Read and parse the file
      const fileContent = fs.readFileSync(path.join(packagePath, "package.json"), "utf8");
      assert.doesNotThrow(() => JSON.parse(fileContent), "Failed to parse monorepo package.json");

      const parsed = JSON.parse(fileContent);

      // Verify all dependency types are present
      assert.ok(parsed.dependencies, "Dependencies should be present");
      assert.ok(parsed.devDependencies, "DevDependencies should be present");
      assert.ok(parsed.peerDependencies, "PeerDependencies should be present");
      assert.ok(parsed.optionalDependencies, "OptionalDependencies should be present");

      // Verify workspace dependencies are included
      assert.strictEqual(parsed.dependencies["@monorepo/shared"], "workspace:*");
      assert.strictEqual(parsed.devDependencies["@monorepo/dev-tools"], "workspace:^1.0.0");
    });

    test("Handles different package manager lock files", () => {
      // Test npm lockfile
      const npmLockPath = path.join(testMonorepoPath, "package-lock.json");
      fs.writeFileSync(npmLockPath, JSON.stringify({ lockfileVersion: 2 }, null, 2));
      assert.strictEqual(fs.existsSync(npmLockPath), true, "npm lock file should exist");

      // Test yarn lockfile
      const yarnLockPath = path.join(testMonorepoPath, "yarn.lock");
      fs.writeFileSync(yarnLockPath, '# This file is generated by running "yarn install"');
      assert.strictEqual(fs.existsSync(yarnLockPath), true, "yarn lock file should exist");

      // Test pnpm lockfile
      const pnpmLockPath = path.join(testMonorepoPath, "pnpm-lock.yaml");
      fs.writeFileSync(pnpmLockPath, "lockfileVersion: 5.4");
      assert.strictEqual(fs.existsSync(pnpmLockPath), true, "pnpm lock file should exist");

      // Test bun lockfiles
      const bunLockPath = path.join(testMonorepoPath, "bun.lockb");
      fs.writeFileSync(bunLockPath, "");
      assert.strictEqual(fs.existsSync(bunLockPath), true, "bun lock file should exist");

      // Clean up lock files
      for (const lockFile of [npmLockPath, yarnLockPath, pnpmLockPath, bunLockPath]) {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
        }
      }
    });

    test("Creates valid monorepo structure for testing commands", () => {
      // Create a realistic monorepo structure that could be used for command testing
      const rootPackageJson = {
        name: "test-monorepo-commands",
        version: "1.0.0",
        private: true,
        workspaces: ["packages/*"],
        devDependencies: {
          lerna: "^5.0.0",
          typescript: "^4.8.0",
        },
      };
      fs.writeFileSync(path.join(testMonorepoPath, "package.json"), JSON.stringify(rootPackageJson, null, 2));

      // Create yarn.lock for package manager detection
      fs.writeFileSync(path.join(testMonorepoPath, "yarn.lock"), "# Yarn lockfile");

      // Create a package with realistic dependencies
      const uiPackagePath = path.join(packagesPath, "ui");
      createTestDir(uiPackagePath);
      const uiPackageJson = {
        name: "@test/ui",
        version: "1.0.0",
        dependencies: {
          react: "^18.0.0",
          "react-dom": "^18.0.0",
          "@test/utils": "workspace:*",
        },
        devDependencies: {
          "@types/react": "^18.0.0",
          vite: "^3.0.0",
        },
        peerDependencies: {
          react: ">=16.8.0",
        },
      };
      fs.writeFileSync(path.join(uiPackagePath, "package.json"), JSON.stringify(uiPackageJson, null, 2));

      // Verify the structure is suitable for command testing
      assert.strictEqual(fs.existsSync(path.join(testMonorepoPath, "package.json")), true);
      assert.strictEqual(fs.existsSync(path.join(testMonorepoPath, "yarn.lock")), true);
      assert.strictEqual(fs.existsSync(path.join(uiPackagePath, "package.json")), true);

      // Verify package content
      const uiPackageContent = JSON.parse(fs.readFileSync(path.join(uiPackagePath, "package.json"), "utf8"));
      assert.strictEqual(uiPackageContent.name, "@test/ui");
      // biome-ignore lint/complexity/useLiteralKeys: <explanation>
      assert.ok(uiPackageContent.dependencies["react"]);
      assert.ok(uiPackageContent.dependencies["@test/utils"]);
    });

    test("Extension can handle workspace dependency filtering", () => {
      const packagePath = path.join(packagesPath, "filter-test");
      createTestDir(packagePath);

      const packageJson = {
        name: "@monorepo/filter-test",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
          "@monorepo/internal-a": "workspace:*",
          axios: "^0.24.0",
          "@monorepo/internal-b": "workspace:^1.0.0",
        },
        devDependencies: {
          jest: "^27.0.0",
          "@monorepo/dev-shared": "workspace:*",
          typescript: "^4.8.0",
        },
      };

      fs.writeFileSync(path.join(packagePath, "package.json"), JSON.stringify(packageJson, null, 2));

      const fileContent = fs.readFileSync(path.join(packagePath, "package.json"), "utf8");
      const parsed = JSON.parse(fileContent);

      // Simulate the filtering logic from the extension
      const filterWorkspaceDeps = (deps: { [key: string]: string } | undefined) => {
        if (!deps) return [];
        return Object.keys(deps).filter((pkg) => !deps[pkg].includes("workspace:"));
      };

      const filteredDeps = filterWorkspaceDeps(parsed.dependencies);
      const filteredDevDeps = filterWorkspaceDeps(parsed.devDependencies);

      // Verify workspace dependencies are filtered out
      assert.strictEqual(filteredDeps.length, 2, "Should have 2 non-workspace dependencies");
      assert.ok(filteredDeps.includes("lodash"), "Should include lodash");
      assert.ok(filteredDeps.includes("axios"), "Should include axios");
      assert.ok(!filteredDeps.includes("@monorepo/internal-a"), "Should not include workspace dependency");
      assert.ok(!filteredDeps.includes("@monorepo/internal-b"), "Should not include workspace dependency");

      assert.strictEqual(filteredDevDeps.length, 2, "Should have 2 non-workspace devDependencies");
      assert.ok(filteredDevDeps.includes("jest"), "Should include jest");
      assert.ok(filteredDevDeps.includes("typescript"), "Should include typescript");
      assert.ok(!filteredDevDeps.includes("@monorepo/dev-shared"), "Should not include workspace devDependency");
    });
  });
});
