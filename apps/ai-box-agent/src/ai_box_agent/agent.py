from __future__ import annotations

from datetime import datetime, timezone
from threading import Event
from time import sleep
from typing import Callable

from .camera import CameraSource, create_camera_source
from .client import ApiClient
from .inference import InferenceEngine
from .types import AiBoxConfig, CameraStatus, DeviceHeartbeat, MetricsEvent


class AiBoxAgent:
    def __init__(
        self,
        config: AiBoxConfig,
        api_client: ApiClient,
        inference_factory: Callable[[AiBoxConfig], InferenceEngine],
        camera_factory: Callable[[object], CameraSource] = create_camera_source,
    ) -> None:
        self.config = config
        self.api_client = api_client
        self.inferences = [inference_factory(config) for _ in config.cameras]
        self.inference = self.inferences[0]
        self.cameras = [camera_factory(camera) for camera in config.cameras]

    def heartbeat(self, statuses: dict[str, CameraStatus]) -> None:
        payload: DeviceHeartbeat = {
            "aiBoxId": self.config.id,
            "sentAt": utc_now(),
            "agentVersion": "0.1.0",
            "modelVersion": self.inference.model_version,
            "cameraStatuses": statuses,
        }
        self.api_client.send_heartbeat(payload)

    def process_once(self) -> None:
        for camera, inference in zip(self.cameras, self.inferences, strict=True):
            frame = camera.read()
            metrics = inference.analyze(frame)
            event: MetricsEvent = {
                "schemaVersion": 1,
                "aiBoxId": self.config.id,
                "cameraId": camera.config.id,
                "capturedAt": utc_now(),
                "metrics": metrics,
            }
            self.api_client.send_metrics(event)

    def run_forever(
        self,
        interval_seconds: float,
        stop_event: Event | None = None,
    ) -> None:
        if interval_seconds <= 0:
            raise ValueError("Processing interval must be greater than zero.")
        stop_event = stop_event or Event()
        while not stop_event.is_set():
            self.process_once()
            stop_event.wait(interval_seconds)

    def close(self) -> None:
        for camera in self.cameras:
            camera.close()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
