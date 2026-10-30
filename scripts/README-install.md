# Development dependencies and model setup

From the repository root, run the installer for your operating system:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
./scripts/install.ps1
```

```bash
bash scripts/install.sh
```

Both installers install the pinned pnpm workspace dependencies, create a local
Python virtual environment, install the AI Box camera dependencies, and fetch
the Nano/Tiny YOLOX `.pth` and ONNX models. Every model download is checked
against the SHA-256 recorded in `models/README.md`. Existing valid models are
left in place.

Use `-Runtime cuda` / `--runtime cuda` on a CUDA-capable Linux host, including
DGX Spark. On Windows, `-Runtime directml` installs ONNX Runtime DirectML;
`cpu` is the portable default. Camera tests can then be run with:

```powershell
./.venv/Scripts/python.exe ./apps/ai-box-agent/scripts/camera_test.py --model ./models/pretrained/yolox_nano.onnx
```

```bash
./.venv/bin/python ./apps/ai-box-agent/scripts/camera_test.py --model ./models/pretrained/yolox_nano.onnx
```

Pass `-SkipModels` / `--skip-models` or `-SkipWebPackages` /
`--skip-web-packages` to omit those installer steps. Node.js 20+, Python 3.11+,
and an internet connection are required. Linux users need `curl` and `sha256sum`.
