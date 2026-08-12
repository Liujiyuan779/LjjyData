$ErrorActionPreference = "Stop"
$port = 8792
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root "server.ps1"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path -LiteralPath $edge)) {
  $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path -LiteralPath $edge)) {
  throw "Edge browser not found"
}

$process = $null
$profile = Join-Path $env:TEMP ("kaoyan-edge-" + [guid]::NewGuid().ToString("N"))

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

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $null = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/" -TimeoutSec 1
      $ready = $true
      break
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }
  if (-not $ready) {
    throw "Server did not become ready on port $port"
  }

  $oldErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  $dom = (& $edge "--headless=new" "--disable-gpu" "--no-sandbox" "--user-data-dir=$profile" "--virtual-time-budget=3000" "--dump-dom" "http://127.0.0.1:$port/" 2>&1 | Out-String)
  $ErrorActionPreference = $oldErrorAction

  if ($dom -notmatch 'id="memo-input"') {
    throw "Home view was not rendered"
  }
  if ($dom -notmatch 'id="plan-title"') {
    throw "Plan view was not rendered"
  }
  if ($dom -notmatch 'generate-test-card') {
    throw "Generate test card style was not rendered"
  }
  if ($dom -notmatch 'id="gen-subject"') {
    throw "Generated test form was not rendered"
  }
  if ($dom -notmatch 'id="import-questions"') {
    throw "Question import form was not rendered"
  }
  if ($dom -notmatch 'id="search-subject"') {
    throw "Online search form was not rendered"
  }
  if ($dom -notmatch 'id="search-keyword"') {
    throw "Online search keyword input was not rendered"
  }
  if ($dom -notmatch 'id="theme-toggle"') {
    throw "Theme toggle button was not rendered"
  }
  if ($dom -notmatch 'id="resource-name"') {
    throw "Resources view was not rendered"
  }
  if ($dom -notmatch 'id="resource-url"') {
    throw "Resource URL form was not rendered"
  }
  if ($dom -notmatch 'id="wrong-question"') {
    throw "Wrong question view was not rendered"
  }

  Write-Host "PASS browser smoke test"
} finally {
  if ($null -ne $process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
  if (Test-Path -LiteralPath $profile) {
    Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
  }
}
