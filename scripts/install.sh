#!/usr/bin/env bash
set -euo pipefail

runtime="cpu"
skip_models=0
skip_web=0
while (($#)); do
  case "$1" in
    --runtime)
      [[ $# -ge 2 ]] || { echo "--runtime requires cpu or cuda" >&2; exit 2; }
      runtime="$2"; shift 2 ;;
    --skip-models) skip_models=1; shift ;;
    --skip-web-packages) skip_web=1; shift ;;
    -h|--help)
      echo "Usage: bash scripts/install.sh [--runtime cpu|cuda] [--skip-models] [--skip-web-packages]"
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
case "$runtime" in cpu|cuda) ;; *) echo "Unsupported runtime: $runtime (choose cpu or cuda)" >&2; exit 2 ;; esac

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
command -v python3 >/dev/null || { echo 'Python 3.11+ is required.' >&2; exit 1; }
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' || { echo 'Python 3.11+ is required.' >&2; exit 1; }

if ((skip_web == 0)); then
  command -v node >/dev/null || { echo 'Node.js 20+ is required.' >&2; exit 1; }
  command -v corepack >/dev/null || { echo 'Corepack is required; install Node.js 20+.' >&2; exit 1; }
  corepack prepare pnpm@9.15.0 --activate
  pnpm install --frozen-lockfile
fi

download() {
  local name="$1" url="$2" expected="$3" target="models/pretrained/$1" temp
  mkdir -p models/pretrained
  if [[ -f "$target" ]] && printf '%s  %s\n' "$expected" "$target" | sha256sum --check --status; then
    echo "Model already verified: $name"; return
  fi
  temp="$target.partial"
  rm -f "$temp"
  echo "Downloading $name..."
  curl --fail --location --retry 3 --output "$temp" "$url"
  printf '%s  %s\n' "$expected" "$temp" | sha256sum --check --status || { rm -f "$temp"; echo "SHA-256 verification failed: $name" >&2; exit 1; }
  mv -f "$temp" "$target"
}

if ((skip_models == 0)); then
  command -v curl >/dev/null || { echo 'curl is required to download models.' >&2; exit 1; }
  command -v sha256sum >/dev/null || { echo 'sha256sum is required to verify models.' >&2; exit 1; }
  base='https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0'
  download yolox_nano.pth "$base/yolox_nano.pth" cd28f55fbbc1829f99d9ac9b38a16d259a22889739c8728ea877610201feff7b
  download yolox_tiny.pth "$base/yolox_tiny.pth" 9de513de589ac98bb92d3bca53b5af7b9acfa9b0bacb831f7999d0f7afaee8f0
  download yolox_nano.onnx "$base/yolox_nano.onnx" c789161ed43c8269fcd4e67c67eeeb4e80c622da2eb296a20bc6007bd18a0b7d
  download yolox_tiny.onnx "$base/yolox_tiny.onnx" 427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7
fi

python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e "./apps/ai-box-agent[camera-$runtime]"

echo
echo 'Setup complete.'
echo "Python runtime: $runtime"
echo 'Web workspace: pnpm install --frozen-lockfile (unless --skip-web-packages was used)'
echo 'Models: models/pretrained (unless --skip-models was used)'
