param(
  [switch]$Memory,
  [switch]$NoDatabase,
  [switch]$NoBuild,
  [switch]$Lan,
  [string]$LanHost
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Required command not found: $Name" }
}
Require-Command 'node'

function Repair-WorkspaceJunction([string]$RelativePath, [string]$TargetRelativePath) {
  $linkPath = Join-Path $root $RelativePath
  $targetPath = Join-Path $root $TargetRelativePath
  $current = Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
  if ($current) {
    if ($current.LinkType -ne 'Junction') { throw "Refusing to replace non-junction dependency path: $linkPath" }
    $currentTarget = [IO.Path]::GetFullPath([string]$current.Target).TrimEnd([char]92)
    $expectedTarget = [IO.Path]::GetFullPath($targetPath).TrimEnd([char]92)
    if ($currentTarget -ieq $expectedTarget) { return }
    Remove-Item -LiteralPath $linkPath
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $linkPath) | Out-Null
  }
  New-Item -ItemType Junction -Path $linkPath -Target $targetPath | Out-Null
}

$workspaceLinks = @(
  @{ Path = 'services\scheduler\node_modules\@biltekmyo\shared-types'; Target = 'packages\shared-types' },
  @{ Path = 'apps\api\node_modules\@biltekmyo\shared-types'; Target = 'packages\shared-types' },
  @{ Path = 'apps\api\node_modules\@biltekmyo\scheduler'; Target = 'services\scheduler' },
  @{ Path = 'apps\admin-panel\node_modules\@biltekmyo\shared-types'; Target = 'packages\shared-types' },
  @{ Path = 'apps\display-player\node_modules\@biltekmyo\shared-types'; Target = 'packages\shared-types' },
  @{ Path = 'apps\admin-panel\node_modules\@biltekmyo\theme'; Target = 'packages\theme' },
  @{ Path = 'apps\display-player\node_modules\@biltekmyo\theme'; Target = 'packages\theme' }
)
foreach ($link in $workspaceLinks) { Repair-WorkspaceJunction $link.Path $link.Target }

$envFile = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $envFile
  Write-Warning 'Created .env from local development defaults. Replace secrets before deployment.'
}
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*?)\s*$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim('"', "'"), 'Process')
  }
}
foreach ($required in @('ADMIN_USERNAME', 'ADMIN_PASSWORD', 'SESSION_SECRET', 'AI_BOX_API_KEY')) {
  if (-not [Environment]::GetEnvironmentVariable($required, 'Process')) { throw ".env must define $required" }
}

$memoryMode = $Memory -or $NoDatabase -or $env:EDGE_REPOSITORY -eq 'memory'
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCommand) {
  $dockerCandidates = @(
    (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Docker\Docker\resources\bin\docker.exe')
  )
  $dockerPath = $dockerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($dockerPath) {
    $env:PATH = (Split-Path -Parent $dockerPath) + ';' + $env:PATH
    $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
  }
}
$docker = if ($dockerCommand) { $dockerCommand.Source } else { $null }
if (-not $memoryMode) {
  if (-not $docker) {
    $memoryMode = $true
    Write-Warning 'Docker was not found. Starting API with in-memory data; content changes reset when API restarts. Office conversion is unavailable.'
  } else {
    & $docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
      $memoryMode = $true
      Write-Warning 'Docker Desktop is not running. Starting API with in-memory data; content changes reset when API restarts. Office conversion is unavailable.'
    }
  }
}

if (-not $memoryMode) {
  foreach ($required in @('DATABASE_URL', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD')) {
    if (-not [Environment]::GetEnvironmentVariable($required, 'Process')) { throw ".env must define $required" }
  }
  Write-Host 'Starting PostgreSQL and the document converter...'
  & $docker compose --env-file .env -f infrastructure/docker/docker-compose.yml up -d postgres document-converter
  if ($LASTEXITCODE -ne 0) {
    $memoryMode = $true
    Write-Warning 'Docker services could not start. Falling back to in-memory API mode; Office conversion is unavailable.'
  }
}

if (-not $memoryMode) {
  $databaseReady = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & $docker compose --env-file .env -f infrastructure/docker/docker-compose.yml exec -T postgres pg_isready -U $env:POSTGRES_USER -d $env:POSTGRES_DB *> $null
    if ($LASTEXITCODE -eq 0) { $databaseReady = $true; break }
    Start-Sleep -Seconds 2
  }
  $converterReady = $false
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    try {
      $health = Invoke-WebRequest -Uri 'http://127.0.0.1:3030/health' -TimeoutSec 2 -UseBasicParsing
      if ($health.StatusCode -eq 200) { $converterReady = $true; break }
    } catch { Start-Sleep -Seconds 2 }
  }
  if (-not $databaseReady -or -not $converterReady) {
    $memoryMode = $true
    Write-Warning 'Database or document converter did not become ready. Falling back to in-memory API mode.'
  } else {
    Write-Host 'Preparing database schema and sample displays...'
    node scripts/init-db.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
  }
}

if ($memoryMode) {
  $env:EDGE_REPOSITORY = 'memory'
  Write-Host 'Using in-memory mode with two sample displays.'
}

if (-not $NoBuild) {
  $typescriptPackage = Get-ChildItem (Join-Path $root 'node_modules\.pnpm') -Directory -Filter 'typescript@*' | Select-Object -First 1
  if (-not $typescriptPackage) { throw 'TypeScript not found. Run pnpm install first.' }
  $tsc = Join-Path $typescriptPackage.FullName 'node_modules\typescript\bin\tsc'
  foreach ($project in @('packages/shared-types/tsconfig.json', 'services/scheduler/tsconfig.json', 'apps/api/tsconfig.json')) {
    Write-Host "Building $project"
    node $tsc -p $project
    if ($LASTEXITCODE -ne 0) { throw "Build failed: $project" }
  }
}

function Test-PortInUse([int]$Port) {
  foreach ($address in @([System.Net.IPAddress]::Loopback, [System.Net.IPAddress]::IPv6Loopback)) {
    $client = [System.Net.Sockets.TcpClient]::new($address.AddressFamily)
    try {
      $client.Connect($address, $Port)
      return $true
    } catch {
      # A refused loopback connection means nothing is listening on that address.
    } finally {
      $client.Dispose()
    }
  }
  return $false
}

$ports = [ordered]@{ api = 3000; admin = 3001; player = 3002 }
foreach ($service in $ports.GetEnumerator()) {
  if (Test-PortInUse $service.Value) {
    throw "Port $($service.Value) ($($service.Key)) is already in use. Stop it with pnpm dev:down or free the port; the launcher will not silently choose extra ports."
  }
}
if ($Lan -and [string]::IsNullOrWhiteSpace($LanHost)) {
  throw "LAN mode needs -LanHost with this server's LAN IP or DNS name, for example: pnpm dev:up -- -Lan -LanHost 192.168.1.20"
}
$bindAddress = if ($Lan) { '0.0.0.0' } else { '127.0.0.1' }
$publicHost = if ($Lan) { $LanHost } else { 'localhost' }
$apiUrl = 'http://' + $publicHost + ':' + $ports.api
$adminUrl = 'http://' + $publicHost + ':' + $ports.admin
$playerUrl = 'http://' + $publicHost + ':' + $ports.player
$adminOrigin = "$adminUrl,$playerUrl"
$logDirectory = Join-Path $root 'var\logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$portManifestPath = Join-Path $root 'var\dev-ports.json'
$processManifestPath = Join-Path $root 'var\dev-processes.json'
$apiEntry = Join-Path $root 'apps\api\dist\main.js'
$adminNext = Join-Path $root 'apps\admin-panel\node_modules\next\dist\bin\next'
$playerNext = Join-Path $root 'apps\display-player\node_modules\next\dist\bin\next'
$portManifest = [ordered]@{
  apiUrl = $apiUrl
  adminUrl = $adminUrl
  playerUrl = $playerUrl
  apiPort = $ports.api
  adminPort = $ports.admin
  playerPort = $ports.player
}
$portManifestJson = $portManifest | ConvertTo-Json
[System.IO.File]::WriteAllText($portManifestPath, $portManifestJson, [System.Text.UTF8Encoding]::new($false))
$services = @(
  @{ Name = 'api'; Port = $ports.api; WorkingDirectory = $root; Entry = $apiEntry; Arguments = ('"' + $apiEntry + '"'); Environment = @{ HOST = $bindAddress; PORT = [string]$ports.api; ADMIN_PANEL_ORIGIN = $adminOrigin } },
  @{ Name = 'admin'; Port = $ports.admin; WorkingDirectory = (Join-Path $root 'apps\admin-panel'); Entry = $adminNext; Arguments = ('"' + $adminNext + '" dev --hostname ' + $bindAddress + ' --port ' + $ports.admin); Environment = @{ NEXT_PUBLIC_API_URL = $apiUrl; NEXT_PUBLIC_PLAYER_URL = "$playerUrl/?display=display-01"; NEXT_DIST_DIR = ".next-dev-$($ports.admin)" } },
  @{ Name = 'player'; Port = $ports.player; WorkingDirectory = (Join-Path $root 'apps\display-player'); Entry = $playerNext; Arguments = ('"' + $playerNext + '" dev --hostname ' + $bindAddress + ' --port ' + $ports.player); Environment = @{ NEXT_PUBLIC_API_URL = $apiUrl; NEXT_DIST_DIR = ".next-dev-$($ports.player)" } }
)
$started = [System.Collections.Generic.List[object]]::new()
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
try {
  foreach ($service in $services) {
    $oldValues = @{}
    foreach ($key in $service.Environment.Keys) {
      $oldValues[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
      [Environment]::SetEnvironmentVariable($key, $service.Environment[$key], 'Process')
    }
    try {
      $stdout = Join-Path $logDirectory "$($service.Name)-$runStamp.log"
      $stderr = Join-Path $logDirectory "$($service.Name)-$runStamp.error.log"
      $process = Start-Process -FilePath 'node' -ArgumentList $service.Arguments -WorkingDirectory $service.WorkingDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
      $started.Add([pscustomobject]@{ name = $service.Name; port = $service.Port; pid = $process.Id; startTimeUtcTicks = $process.StartTime.ToUniversalTime().Ticks; entry = $service.Entry })
    } finally {
      foreach ($key in $service.Environment.Keys) { [Environment]::SetEnvironmentVariable($key, $oldValues[$key], 'Process') }
    }
  }
} catch {
  foreach ($service in $started) { try { & taskkill.exe /PID $service.pid /T /F *> $null } catch {} }
  throw
}
$processManifest = [ordered]@{ root = $root; services = @($started) } | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($processManifestPath, $processManifest, [System.Text.UTF8Encoding]::new($false))
Write-Host ''
Write-Host 'Services started in the background; no terminal windows were opened.'
Write-Host "Admin:  $adminUrl"
Write-Host "Player: $playerUrl/?display=display-01"
Write-Host "API:    $apiUrl"
Write-Host "Service logs: $logDirectory"
Write-Host 'Stop app services with: pnpm dev:down'
if ($Lan) { Write-Warning 'LAN mode binds ports 3000-3002 to all interfaces. Limit Windows Firewall access to trusted school subnets and authorized devices.' }
else { Write-Host 'Local-only mode binds services to 127.0.0.1. Use -Lan -LanHost <server-IP-or-DNS> only when LAN clients need access.' }
if ($memoryMode) { Write-Host 'In-memory content resets when the API window closes.' } else { Write-Host 'Database content persists in the Docker PostgreSQL volume.' }







