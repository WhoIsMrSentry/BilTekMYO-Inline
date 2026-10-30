param(
  [ValidateSet('cpu', 'cuda', 'directml')]
  [string]$Runtime = 'cpu',
  [switch]$SkipModels,
  [switch]$SkipWebPackages
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Invoke-Checked([string]$Command, [string[]]$CommandArgs) {
  & $Command @CommandArgs
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Command $($CommandArgs -join ' ')" }
}

$models = @(
  @{ Name = 'yolox_nano.pth'; Url = 'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.pth'; Sha256 = 'cd28f55fbbc1829f99d9ac9b38a16d259a22889739c8728ea877610201feff7b' },
  @{ Name = 'yolox_tiny.pth'; Url = 'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.pth'; Sha256 = '9de513de589ac98bb92d3bca53b5af7b9acfa9b0bacb831f7999d0f7afaee8f0' },
  @{ Name = 'yolox_nano.onnx'; Url = 'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx'; Sha256 = 'c789161ed43c8269fcd4e67c67eeeb4e80c622da2eb296a20bc6007bd18a0b7d' },
  @{ Name = 'yolox_tiny.onnx'; Url = 'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx'; Sha256 = '427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7' }
)

if (-not $SkipWebPackages) {
  Require-Command 'node'
  if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) { throw 'Install Node.js 20+ with Corepack enabled, then retry.' }
  Invoke-Checked 'corepack' @('prepare', 'pnpm@9.15.0', '--activate')
  Invoke-Checked 'pnpm' @('install', '--frozen-lockfile')
}

if (-not $SkipModels) {
  Require-Command 'python'
  $modelDir = Join-Path $root 'models\pretrained'
  New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
  foreach ($model in $models) {
    $target = Join-Path $modelDir $model.Name
    $partial = "$target.partial"
    $valid = (Test-Path -LiteralPath $target) -and ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -eq $model.Sha256)
    if ($valid) { Write-Host "Model already verified: $($model.Name)"; continue }
    Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
    Write-Host "Downloading $($model.Name)..."
    Invoke-WebRequest -Uri $model.Url -OutFile $partial
    $actual = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $model.Sha256) {
      Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
      throw "SHA-256 verification failed for $($model.Name)."
    }
    Move-Item -LiteralPath $partial -Destination $target -Force
  }
}

Require-Command 'python'
$pythonVersion = & python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ($LASTEXITCODE -ne 0 -or [version]$pythonVersion -lt [version]'3.11') { throw 'Python 3.11 or newer is required.' }
$venvPython = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) { Invoke-Checked 'python' @('-m', 'venv', '.venv') }
Invoke-Checked $venvPython @('-m', 'pip', 'install', '--upgrade', 'pip')
Invoke-Checked $venvPython @('-m', 'pip', 'install', '-e', ".\apps\ai-box-agent[camera-$Runtime]")

Write-Host ''
Write-Host 'Setup complete.'
Write-Host "Python runtime: $Runtime"
Write-Host 'Web workspace: pnpm install --frozen-lockfile (unless -SkipWebPackages was used)'
Write-Host 'Models: models/pretrained (unless -SkipModels was used)'
