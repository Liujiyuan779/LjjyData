$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "== Running core tests =="
& node (Join-Path $PSScriptRoot "core.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Core tests failed"
}

Write-Host "== Running auth tests =="
& node (Join-Path $PSScriptRoot "auth.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Auth tests failed"
}

Write-Host "== Running cloud tests =="
& node (Join-Path $PSScriptRoot "cloud.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Cloud tests failed"
}

Write-Host "== Running storage tests =="
& node (Join-Path $PSScriptRoot "storage.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Storage tests failed"
}

Write-Host "== Running electron file service tests =="
& node (Join-Path $PSScriptRoot "electron-file-service.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Electron file service tests failed"
}

Write-Host "== Running electron storage tests =="
& node (Join-Path $PSScriptRoot "storage-electron.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Electron storage tests failed"
}

Write-Host "== Running electron runtime test =="
& node (Join-Path $PSScriptRoot "electron-runtime.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Electron runtime test failed"
}

Write-Host "== Checking app.js syntax =="
& node --check (Join-Path $root "app.js")
if ($LASTEXITCODE -ne 0) {
  throw "app.js syntax check failed"
}

Write-Host "== Checking electron syntax =="
& node --check (Join-Path $root "electron/main.js")
if ($LASTEXITCODE -ne 0) {
  throw "electron main syntax check failed"
}
& node --check (Join-Path $root "electron/preload.js")
if ($LASTEXITCODE -ne 0) {
  throw "electron preload syntax check failed"
}
& node --check (Join-Path $root "electron/fileService.js")
if ($LASTEXITCODE -ne 0) {
  throw "electron file service syntax check failed"
}

Write-Host "== Checking questionBank.js syntax =="
& node --check (Join-Path $root "questionBank.js")
if ($LASTEXITCODE -ne 0) {
  throw "questionBank.js syntax check failed"
}

Write-Host "== Checking auth.js syntax =="
& node --check (Join-Path $root "auth.js")
if ($LASTEXITCODE -ne 0) {
  throw "auth.js syntax check failed"
}

Write-Host "== Checking cloud.js syntax =="
& node --check (Join-Path $root "cloud.js")
if ($LASTEXITCODE -ne 0) {
  throw "cloud.js syntax check failed"
}

Write-Host "== Running shell tests =="
& node (Join-Path $PSScriptRoot "shell.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Shell tests failed"
}

Write-Host "== Running server smoke test =="
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "server.test.ps1")
if ($LASTEXITCODE -ne 0) {
  throw "Server test failed"
}

Write-Host "== Running browser smoke test =="
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "browser.test.ps1")
if ($LASTEXITCODE -ne 0) {
  throw "Browser test failed"
}

Write-Host "== Running browser interaction test =="
& node (Join-Path $PSScriptRoot "browser-interaction.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Browser interaction test failed"
}

Write-Host "ALL TESTS PASSED"
