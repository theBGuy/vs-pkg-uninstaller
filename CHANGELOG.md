# Change Log

All notable changes to the "pkguninstaller" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.0.8] - 2026-01-26

### Fixed
- Security: Fixed command injection vulnerability by using `execFile` instead of `exec`
- Fixed progress increment calculation
- Context menu now validates selection is actually a dependency

### Changed
- Batch uninstalls into single command for better performance
- Use `editor.document.getText()` instead of `fs.readFileSync()` for reading open files
- Improved cancellation support with recovery option to run install command