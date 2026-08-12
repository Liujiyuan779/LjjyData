$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "== Running core tests =="
& node (Join-Path $PSScriptRoot "core.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Core tests failed"
}

Write-Host "== Running storage tests =="
& node (Join-Path $PSScriptRoot "storage.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Storage tests failed"
}

Write-Host "== Checking app.js syntax =="
& node --check (Join-Path $root "app.js")
if ($LASTEXITCODE -ne 0) {
  throw "app.js syntax check failed"
}

Write-Host "== Checking questionBank.js syntax =="
& node --check (Join-Path $root "questionBank.js")
if ($LASTEXITCODE -ne 0) {
  throw "questionBank.js syntax check failed"
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
