from __future__ import annotations

from datetime import datetime, timezone
from threading import Event
from time import monotonic
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
            motion_detected = inference.motion_detected(frame)
            metrics, preview = inference.analyze_with_preview(frame)
            captured_at = utc_now()
            event: MetricsEvent = {
                "schemaVersion": 1,
                "aiBoxId": self.config.id,
                "cameraId": camera.config.id,
                "capturedAt": captured_at,
                "motionDetected": motion_detected,
                "metrics": metrics,
            }
            self.api_client.send_metrics(event)
            if self.config.publish_preview and preview:
                self.api_client.send_camera_frame(self.config.id, camera.config.id, captured_at, preview)

    def run_forever(
        self,
        interval_seconds: float,
        stop_event: Event | None = None,
    ) -> None:
        if interval_seconds <= 0:
            raise ValueError("Processing interval must be greater than zero.")
        stop_event = stop_event or Event()
        next_heartbeat = 0.0
        while not stop_event.is_set():
            started = monotonic()
            if started >= next_heartbeat:
                self.heartbeat({camera.config.id: "online" for camera in self.cameras})
                next_heartbeat = started + 30
            self.process_once()
            stop_event.wait(max(0, interval_seconds - (monotonic() - started)))

    def close(self) -> None:
        for camera in self.cameras:
            camera.close()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
