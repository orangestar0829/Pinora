param([switch]$Firefox)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectDirectory 'dist'
$manifestPath = Join-Path $outputDirectory 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Build the extension first.' }
$package = Get-Content -LiteralPath (Join-Path $projectDirectory 'package.json') -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.version -ne $package.version) { throw 'Package and built manifest versions differ. Rebuild the extension.' }
$version = $manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') { throw 'Invalid extension version.' }
$artifactDirectory = Join-Path $projectDirectory 'artifacts'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
if (-not $Firefox) {
    $archivePath = Join-Path $artifactDirectory "Pinora-$version.zip"
    Compress-Archive -Path (Join-Path $outputDirectory '*') -DestinationPath $archivePath -Force
    Write-Output $archivePath
    return
}

$manifest.PSObject.Properties.Remove('minimum_chrome_version')
$manifest.permissions = @($manifest.permissions | Where-Object { $_ -ne 'favicon' })
$manifest | Add-Member -NotePropertyName 'browser_specific_settings' -NotePropertyValue @{
    gecko = @{
        id = 'pinora@pinora.local'
        strict_min_version = '140.0'
        data_collection_permissions = @{ required = @('none') }
    }
}

$stage = Join-Path ([IO.Path]::GetTempPath()) "pinora-firefox-$([guid]::NewGuid())"
$archivePath = Join-Path $artifactDirectory "Pinora-$version-firefox.xpi"
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    $extension = Join-Path $stage 'extension'
    Copy-Item -LiteralPath $outputDirectory -Destination $extension -Recurse
    $firefoxManifest = $manifest | ConvertTo-Json -Depth 10
    [IO.File]::WriteAllText((Join-Path $extension 'manifest.json'), $firefoxManifest)
    $archive = Join-Path $stage 'extension.xpi'
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::Open($archive, [IO.Compression.ZipArchiveMode]::Create)
    try {
        # Firefox must be able to resolve nested JS, CSS and icons in the XPI.
        foreach ($item in Get-ChildItem -LiteralPath $extension -Recurse) {
            $entry = $item.FullName.Substring($extension.Length + 1).Replace('\', '/')
            if ($item.PSIsContainer) {
                [void]$zip.CreateEntry("$entry/")
            } else {
                [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                    $zip, $item.FullName, $entry, [IO.Compression.CompressionLevel]::Optimal
                )
            }
        }
    } finally {
        $zip.Dispose()
    }
    Move-Item -LiteralPath $archive -Destination $archivePath -Force
} finally {
    Remove-Item -LiteralPath $stage -Recurse -Force
}
Write-Output $archivePath
