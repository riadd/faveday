# Builds a distributable .zip of the FaveDay Electron app.
# Output: out/make/zip/<platform>/<arch>/*.zip
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

if (-not (Test-Path 'node_modules')) {
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
}

npx electron-forge make --targets @electron-forge/maker-zip
if ($LASTEXITCODE -ne 0) { throw "electron-forge make failed with exit code $LASTEXITCODE" }
