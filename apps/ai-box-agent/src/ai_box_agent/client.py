from __future__ import annotations

import json
import base64
from urllib.parse import urlsplit, urlunsplit
from urllib import request

from .types import DeviceHeartbeat, MetricsEvent


class ApiClient:
    def __init__(self, base_url: str, api_key: str = "", timeout_seconds: float = 10.0) -> None:
        parsed_url = urlsplit(base_url)
        if parsed_url.hostname and parsed_url.hostname.lower() == "localhost":
            port = f":{parsed_url.port}" if parsed_url.port else ""
            host = f"{parsed_url.username}:{parsed_url.password}@" if parsed_url.username else ""
            parsed_url = parsed_url._replace(netloc=f"{host}127.0.0.1{port}")
        self.base_url = urlunsplit(parsed_url).rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def register_ai_box(self, ai_box: dict[str, object]) -> None:
        self._post("/edge/ai-boxes", ai_box)

    def send_heartbeat(self, heartbeat: DeviceHeartbeat) -> None:
        self._post("/edge/heartbeat", heartbeat)

    def send_metrics(self, event: MetricsEvent) -> None:
        self._post("/edge/metrics", event)

    def send_camera_frame(self, ai_box_id: str, camera_id: str, captured_at: str, jpeg: bytes) -> None:
        if len(jpeg) > 64 * 1024:
            raise ValueError("Camera preview frame must not exceed 64 KB.")
        self._post("/edge/camera-frames", {
            "aiBoxId": ai_box_id,
            "cameraId": camera_id,
            "capturedAt": captured_at,
            "jpegBase64": base64.b64encode(jpeg).decode("ascii"),
        })

    def _post(self, path: str, payload: dict[str, object]) -> None:
        if not self.api_key:
            raise RuntimeError("AI_BOX_API_KEY is required to authenticate with the API.")
        body = json.dumps(payload).encode("utf-8")
        http_request = request.Request(
            f"{self.base_url}{path}",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with request.urlopen(http_request, timeout=self.timeout_seconds) as response:
                if response.status < 200 or response.status >= 300:
                    raise RuntimeError(f"API rejected {path}: HTTP {response.status}")
        except OSError as error:
            raise RuntimeError(f"Unable to reach API at {self.base_url}") from error
