param(
  [int]$Port = 8765,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = New-Object System.Net.HttpListener
$actualPort = $Port
for ($p = $Port; $p -lt ($Port + 30); $p++) {
  $prefix = "http://127.0.0.1:$p/"
  $listener.Prefixes.Clear()
  $listener.Prefixes.Add($prefix)
  try {
    $listener.Start()
    $actualPort = $p
    break
  } catch {
    if ($p -ge ($Port + 29)) {
      throw
    }
  }
}
$prefix = "http://127.0.0.1:$actualPort/"
Write-Host "KaoYan app running at $prefix"

if (-not $NoBrowser) {
  $edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  if (-not (Test-Path -LiteralPath $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  }
  if (Test-Path -LiteralPath $edge) {
    Start-Process -FilePath $edge -ArgumentList $prefix -WindowStyle Hidden
  } else {
    Start-Process $prefix
  }
}

$mimeMap = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif" = "image/gif"
  ".ico" = "image/x-icon"
  ".md" = "text/plain; charset=utf-8"
  ".txt" = "text/plain; charset=utf-8"
  ".pdf" = "application/pdf"
  ".mp4" = "video/mp4"
  ".webm" = "video/webm"
  ".doc" = "application/msword"
  ".docx" = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ".xls" = "application/vnd.ms-excel"
  ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ".ppt" = "application/vnd.ms-powerpoint"
  ".pptx" = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ".zip" = "application/zip"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $path = $request.Url.AbsolutePath
    if ($path -eq "/" -or $path -eq "") {
      $path = "/index.html"
    }
    $relative = $path.TrimStart("/").Replace("/", "\")
    $fullPath = [IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $fullPath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
      $response.StatusCode = 403
      $response.Close()
      continue
    }
    if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($fullPath).ToLower()
      $mime = $mimeMap[$ext]
      if (-not $mime) {
        $mime = "application/octet-stream"
      }
      $bytes = [IO.File]::ReadAllBytes($fullPath)
      $response.ContentType = $mime
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $response.StatusCode = 404
      $body = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $response.ContentType = "text/plain; charset=utf-8"
      $response.ContentLength64 = $body.Length
      $response.OutputStream.Write($body, 0, $body.Length)
    }
    $response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
