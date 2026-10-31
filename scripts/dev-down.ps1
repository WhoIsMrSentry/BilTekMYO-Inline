$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifestPath = Join-Path $root 'var\dev-processes.json'
if (-not (Test-Path -LiteralPath $manifestPath)) {
  Write-Host 'No managed development services are recorded.'
  exit 0
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
foreach ($service in $manifest.services) {
  $process = Get-Process -Id ([int]$service.pid) -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  if ($process.ProcessName -ne 'node' -or $process.StartTime.ToUniversalTime().Ticks -ne [long]$service.startTimeUtcTicks) {
    Write-Warning "Skipping PID $($service.pid): it no longer matches the recorded Node process."
    continue
  }
  & taskkill.exe /PID ([int]$service.pid) /T /F *> $null
  if ($LASTEXITCODE -eq 0) { Write-Host "Stopped $($service.name) (port $($service.port))." }
}

Remove-Item -LiteralPath $manifestPath -Force
Write-Host 'Development app services stopped. PostgreSQL and the document converter remain available.'
