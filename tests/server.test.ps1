$ErrorActionPreference = "Stop"
$port = 8791
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root "server.ps1"
$process = $null

try {
  $process = Start-Process -FilePath powershell.exe -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    ('"' + $script + '"'),
    "-NoBrowser",
    "-Port",
    "$port"
  ) -PassThru -WindowStyle Hidden

  $response = $null
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/" -TimeoutSec 1
      break
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }

  if ($null -eq $response) {
    throw "Server did not become ready on port $port"
  }
  if ($response.StatusCode -ne 200) {
    throw "Expected status 200, got $($response.StatusCode)"
  }
  if ($response.Content -notmatch "KaoYan") {
    throw "Index page title not found"
  }

  $core = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/core.js" -TimeoutSec 2
  if ($core.StatusCode -ne 200 -or $core.Content -notmatch "KaoYanCore") {
    throw "core.js was not served correctly"
  }

  Write-Host "PASS server smoke test"
} finally {
  if ($null -ne $process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
