$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectDirectory 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $outputDirectory 'manifest.json'))) { throw 'Build the extension first.' }
$artifactDirectory = Join-Path $projectDirectory 'artifacts'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
$archivePath = Join-Path $artifactDirectory 'Pinora-0.1.0-alpha.zip'
Compress-Archive -Path (Join-Path $outputDirectory '*') -DestinationPath $archivePath -Force
Write-Output $archivePath
