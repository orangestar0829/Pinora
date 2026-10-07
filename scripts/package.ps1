$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectDirectory 'dist'
$manifestPath = Join-Path $outputDirectory 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Build the extension first.' }
$package = Get-Content -LiteralPath (Join-Path $projectDirectory 'package.json') -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.version -ne $package.version) { throw 'Package and built manifest versions differ. Rebuild the extension.' }
$version = $manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') { throw 'Invalid extension version.' }
$artifactDirectory = Join-Path $projectDirectory 'artifacts'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
$archivePath = Join-Path $artifactDirectory "Pinora-$version.zip"
Compress-Archive -Path (Join-Path $outputDirectory '*') -DestinationPath $archivePath -Force
Write-Output $archivePath
