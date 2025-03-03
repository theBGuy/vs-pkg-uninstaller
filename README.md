# Pkg-Uninstaller
![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/theBGuy.pkguninstaller)


**Pkg-Uninstaller** is a lightweight and efficient VS Code extension that allows you to easily uninstall packages directly from your `package.json` file using the context menu. Simply select the package you want to remove, and uninstall it with a single click. Perfect for developers who want to quickly manage their dependencies without leaving the editor.

## Features

- **Uninstall Multiple Packages**: Select and uninstall multiple packages at once from your `package.json`.
- **Quick and Easy**: No need to run terminal commands. Just right-click on the package name in your `package.json` and uninstall it directly.
- **Support for Multiple Package Managers**: Currently supports npm, yarn, and pnpm, making it versatile for any project setup.
- **Context Menu Integration**: Seamlessly integrates into the editor's context menu for easy access while working in your `package.json`.

## Installation

1. Open VS Code.
2. Go to the Extensions view (`Ctrl+Shift+X`).
3. Search for `Pkg-Uninstaller` and click **Install**.

Alternatively, you can install it via the [Marketplace](https://marketplace.visualstudio.com/) by searching for `Pkg-Uninstaller`.

## Usage

### Uninstall a Single Package

1. Open your `package.json` file in VS Code.
2. Right-click on the package name you want to uninstall in the editor.
3. Select **Uninstall Package** from the context menu.

### Uninstall Multiple Packages

1. Open your `package.json` file in VS Code.
2. Right-click anywhere in the editor.
3. Select **Uninstall Packages** from the context menu.
4. Choose the packages you want to uninstall from the quick pick list.
5. The selected packages will be uninstalled at once.

## Supported Package Managers

- **npm**
- **yarn**
- **pnpm**
- **bun**

The extension automatically detects which package manager you're using based on your project's `package.json`.

## Commands

- **Uninstall Package**: Right-click any installed package in the `package.json` and choose this option to uninstall it.
- **Uninstall Packages**: Right-click anywhere in the `package.json` and choose this option to uninstall multiple packages.

## Development

To contribute to **Pkg-Uninstaller**, clone this repository and follow these steps:

1. Clone the repo:
   ```bash
   git clone https://github.com/your-username/pkg-uninstaller.git
   ```

2. Install dependencies:
    ```bash
    npm install
    ```
3. Compile the TypeScript code:
    ```bash
    npm run compile
    ```
4. Test your changes:
    ```bash
    npm test
    ```

## License
This extension is licensed under the MIT License. See the LICENSE file for more details.
