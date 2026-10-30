from __future__ import annotations

import argparse
import os
from pathlib import Path

from .agent import AiBoxAgent
from .client import ApiClient
from .inference import YoloXOnnxRuntimeEngine
from .types import AiBoxConfig, CameraConfig


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the BilTekMYO AI Box agent.")
    parser.add_argument("--api-url", default="http://localhost:3000")
    parser.add_argument("--api-key", default=os.environ.get("AI_BOX_API_KEY", ""))
    project_root = Path(__file__).resolve().parents[4]
    parser.add_argument("--model", default=str(project_root / "models" / "pretrained" / "yolox_tiny.onnx"))
    parser.add_argument("--provider", choices=("auto", "cpu", "cuda", "directml", "tensorrt"), default="auto")
    parser.add_argument("--camera-1", default="0")
    parser.add_argument("--camera-2", default="1")
    parser.add_argument("--interval-seconds", type=float, default=1.0)
    parser.add_argument("--publish-preview", action="store_true", help="Send a low-resolution annotated preview to display screens; frames are held in memory only.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if not args.api_key:
        raise SystemExit("AI_BOX_API_KEY is required.")
    model_path = Path(args.model).resolve()
    model_version = model_path.stem
    config = AiBoxConfig(
        id="ai-box-01",
        name="Main AI Box",
        cameras=(
            CameraConfig("camera-01", "Camera 1", "usb", args.camera_1),
            CameraConfig("camera-02", "Camera 2", "usb", args.camera_2),
        ),
        model_version=model_version,
        publish_preview=args.publish_preview,
    )
    client = ApiClient(args.api_url, api_key=args.api_key)
    agent = AiBoxAgent(
        config=config,
        api_client=client,
        inference_factory=lambda current: YoloXOnnxRuntimeEngine(
            str(model_path), current.model_version, provider=args.provider,
        ),
    )
    try:
        client.register_ai_box({"id": config.id, "name": config.name, "cameraIds": [camera.id for camera in config.cameras]})
        print(f"Model: {model_path.name} | API: {args.api_url} | Preview: {'on' if args.publish_preview else 'off'}")
        agent.run_forever(args.interval_seconds)
    except KeyboardInterrupt:
        print("Stopping camera processing…")
    finally:
        agent.close()


if __name__ == "__main__":
    main()
