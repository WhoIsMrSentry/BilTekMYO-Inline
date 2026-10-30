from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from .types import CameraConfig


class CameraSource(ABC):
    def __init__(self, config: CameraConfig) -> None:
        self.config = config

    @abstractmethod
    def read(self) -> Any:
        """Return one frame without retaining it beyond the inference cycle."""

    @abstractmethod
    def close(self) -> None:
        """Release camera resources."""


class OpenCvCameraSource(CameraSource):
    def __init__(self, config: CameraConfig) -> None:
        super().__init__(config)
        try:
            import cv2
        except ImportError as error:
            raise RuntimeError(
                "OpenCV is required for camera capture. Install the 'opencv' extra."
            ) from error

        self._cv2 = cv2
        source: int | str = (
            int(config.uri) if config.source == "usb" and config.uri else config.uri or 0
        )
        self._capture = cv2.VideoCapture(source)
        if not self._capture.isOpened():
            self._capture.release()
            raise RuntimeError(f"Unable to open camera source: {config.id}")

    def read(self) -> Any:
        success, frame = self._capture.read()
        if not success:
            raise RuntimeError(f"Unable to read frame from camera: {self.config.id}")
        return frame

    def close(self) -> None:
        self._capture.release()


def create_camera_source(config: CameraConfig) -> CameraSource:
    if not config.enabled:
        raise ValueError(f"Camera is disabled: {config.id}")
    if config.source == "rtsp" and not config.uri:
        raise ValueError(f"RTSP camera requires a URI: {config.id}")
    return OpenCvCameraSource(config)
