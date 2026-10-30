from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

CameraSourceKind = Literal["usb", "rtsp"]
CameraStatus = Literal["online", "offline", "degraded"]


@dataclass(frozen=True)
class CameraConfig:
    id: str
    name: str
    source: CameraSourceKind
    uri: str | None = None
    enabled: bool = True


@dataclass(frozen=True)
class AiBoxConfig:
    id: str
    name: str
    cameras: tuple[CameraConfig, CameraConfig]
    model_version: str
    retain_frames: bool = False
    retention_seconds: int = 0

    def __post_init__(self) -> None:
        if len(self.cameras) != 2:
            raise ValueError("An AI Box must be configured with exactly two cameras.")
        if self.retain_frames and self.retention_seconds <= 0:
            raise ValueError("Frame retention requires a positive retention period.")


class AnonymousMetrics(TypedDict):
    peopleCount: int
    entries: int
    exits: int
    estimatedOccupancy: int
    genderDistribution: dict[str, int]
    moodDistribution: dict[str, int]


class MetricsEvent(TypedDict):
    schemaVersion: Literal[1]
    aiBoxId: str
    cameraId: str
    capturedAt: str
    metrics: AnonymousMetrics


class DeviceHeartbeat(TypedDict):
    aiBoxId: str
    sentAt: str
    agentVersion: str
    modelVersion: str
    cameraStatuses: dict[str, CameraStatus]
