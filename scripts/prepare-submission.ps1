param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Push-Location $projectDirectory
try {
    $package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
    $version = $package.version
    if ($version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') { throw 'Invalid extension version.' }
    if (-not $SkipBuild) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
    }
    & (Join-Path $PSScriptRoot 'package.ps1')
    & (Join-Path $PSScriptRoot 'package.ps1') -Firefox

    $bundle = Join-Path $projectDirectory "artifacts/submission/Pinora-$version"
    foreach ($folder in @('edge', 'firefox', 'copy', 'assets')) {
        New-Item -ItemType Directory -Path (Join-Path $bundle $folder) -Force | Out-Null
    }
    Copy-Item -LiteralPath "artifacts/Pinora-$version.zip" -Destination (Join-Path $bundle "edge/Pinora-$version.zip") -Force
    Copy-Item -LiteralPath "artifacts/Pinora-$version-firefox.xpi" -Destination (Join-Path $bundle "firefox/Pinora-$version-firefox.xpi") -Force
    Copy-Item -Path 'docs/store/*' -Destination (Join-Path $bundle 'copy') -Force
    Copy-Item -LiteralPath 'docs/store/README.md' -Destination (Join-Path $bundle 'README.md') -Force
    Copy-Item -LiteralPath 'public/privacy.md' -Destination (Join-Path $bundle 'copy/privacy.md') -Force

    $nodeVersion = (& node --version).Trim()
    $npmVersion = (& npm.cmd --version).Trim()
    $windowsVersion = [Environment]::OSVersion.VersionString
    $powerShellVersion = $PSVersionTable.PSVersion.ToString()
    $buildInstructions = @"
# Rebuild Pinora $version for Firefox

This source archive corresponds to the unsigned Pinora-$version-firefox.xpi supplied with this submission.

## Build environment used for this submission

- OS: $windowsVersion (Windows, x64)
- Node.js: $nodeVersion
- npm: $npmVersion
- Windows PowerShell: $powerShellVersion
- Dependencies: exact versions in package-lock.json

Use Windows x64 and the listed Node.js/npm versions. The archive script uses Windows PowerShell 5.1; it is not a Linux shell command.

## Commands

Extract the source ZIP into an empty directory. In that directory run:

    npm.cmd ci
    npm.cmd run build
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package.ps1 -Firefox

Output: artifacts/Pinora-$version-firefox.xpi

The command first builds the bundled JS/CSS into dist/. The final command only changes the packaged manifest: it removes minimum_chrome_version and the favicon permission, then adds the Firefox add-on ID, minimum Firefox version and data collection declaration. No runtime code is downloaded. npm ci needs internet access to install the locked build dependencies.

For Edge, use the same build and run:

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package.ps1

Output: artifacts/Pinora-$version.zip

Archive timestamps may differ; the unpacked runtime files should match. Please compare file content, not ZIP metadata. The XPI is unsigned; Mozilla supplies the signature.

## Runtime dependencies and license notices

React, React DOM, Scheduler and Lucide are bundled from the locked npm dependencies. Notices are in public/THIRD_PARTY_NOTICES.md and public/licenses/ and are copied into the install package. The original Pinora code remains all rights reserved unless the owner selects a different license.
"@
    [IO.File]::WriteAllText((Join-Path $bundle 'BUILDING.md'), $buildInstructions, [Text.UTF8Encoding]::new($false))

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $sourcePath = Join-Path $bundle "firefox/Pinora-$version-source.zip"
    if (Test-Path -LiteralPath $sourcePath) { Remove-Item -LiteralPath $sourcePath -Force }
    $zip = [IO.Compression.ZipFile]::Open($sourcePath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $sourceFiles = @()
        foreach ($directory in @('src', 'public', 'scripts', 'tests', 'docs/store')) {
            $sourceFiles += Get-ChildItem -LiteralPath (Join-Path $projectDirectory $directory) -File -Recurse
        }
        foreach ($name in @('package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'eslint.config.js', 'playwright.config.ts', 'index.html', 'README.md')) {
            $sourceFiles += Get-Item -LiteralPath (Join-Path $projectDirectory $name)
        }
        foreach ($file in $sourceFiles) {
            $relativePath = $file.FullName.Substring($projectDirectory.Length + 1).Replace('\', '/')
            [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relativePath, [IO.Compression.CompressionLevel]::Optimal)
        }
        [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $bundle 'BUILDING.md'), 'BUILDING.md', [IO.Compression.CompressionLevel]::Optimal)
    } finally {
        $zip.Dispose()
    }
    Write-Output "Submission materials: $bundle"
    Write-Output 'Next: node scripts/capture-store-assets.mjs'
} finally {
    Pop-Location
}
