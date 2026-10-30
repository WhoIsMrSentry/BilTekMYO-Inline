from __future__ import annotations

import argparse
import os

from .agent import AiBoxAgent
from .client import ApiClient
from .inference import UnconfiguredInferenceEngine
from .types import AiBoxConfig, CameraConfig


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the BilTekMYO AI Box agent.")
    parser.add_argument("--api-url", default="http://localhost:3000")
    parser.add_argument("--api-key", default=os.environ.get("AI_BOX_API_KEY", ""))
    parser.add_argument("--camera-1", default="0")
    parser.add_argument("--camera-2", default="1")
    parser.add_argument("--model-version", default="unconfigured")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if not args.api_key:
        raise SystemExit("AI_BOX_API_KEY is required.")
    config = AiBoxConfig(
        id="ai-box-01",
        name="Main AI Box",
        cameras=(
            CameraConfig("camera-01", "Camera 1", "usb", args.camera_1),
            CameraConfig("camera-02", "Camera 2", "usb", args.camera_2),
        ),
        model_version=args.model_version,
    )
    client = ApiClient(args.api_url, api_key=args.api_key)
    agent = AiBoxAgent(
        config=config,
        api_client=client,
        inference_factory=lambda current: UnconfiguredInferenceEngine(current.model_version),
    )
    try:
        client.register_ai_box({"id": config.id, "name": config.name, "cameraIds": [camera.id for camera in config.cameras]})
        agent.heartbeat({"camera-01": "online", "camera-02": "online"})
        agent.process_once()
    finally:
        agent.close()


if __name__ == "__main__":
    main()
