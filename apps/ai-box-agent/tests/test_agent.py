from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from threading import Event

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from ai_box_agent.agent import AiBoxAgent
from ai_box_agent.inference import InferenceEngine
from ai_box_agent.types import AiBoxConfig, AnonymousMetrics, CameraConfig


class FakeCamera:
    def __init__(self, config: CameraConfig) -> None:
        self.config = config

    def read(self) -> Any:
        return object()

    def close(self) -> None:
        pass


class FakeInference(InferenceEngine):
    model_version = "test-model"

    def analyze(self, frame: Any) -> AnonymousMetrics:
        del frame
        return {
            "peopleCount": 1,
            "entries": 1,
            "exits": 0,
            "estimatedOccupancy": 1,
            "genderDistribution": {"female": 0, "male": 0, "unknown": 1},
            "moodDistribution": {
                "happy": 0,
                "neutral": 0,
                "sad": 0,
                "angry": 0,
                "unknown": 1,
            },
        }


class FakeApi:
    def __init__(self) -> None:
        self.heartbeats = []
        self.metrics = []

    def send_heartbeat(self, payload: object) -> None:
        self.heartbeats.append(payload)

    def send_metrics(self, payload: object) -> None:
        self.metrics.append(payload)


def test_agent_requires_two_cameras() -> None:
    try:
        AiBoxConfig(
            id="box",
            name="Box",
            cameras=(CameraConfig("one", "One", "usb"),),  # type: ignore[arg-type]
            model_version="test",
        )
    except ValueError as error:
        assert "exactly two" in str(error)
    else:
        raise AssertionError("Expected the two-camera invariant to be enforced")


def test_agent_processes_both_cameras() -> None:
    config = AiBoxConfig(
        id="box",
        name="Box",
        cameras=(
            CameraConfig("one", "One", "usb"),
            CameraConfig("two", "Two", "usb"),
        ),
        model_version="test",
    )
    api = FakeApi()
    agent = AiBoxAgent(
        config,
        api,  # type: ignore[arg-type]
        lambda _: FakeInference(),
        camera_factory=FakeCamera,
    )
    agent.heartbeat({"one": "online", "two": "online"})
    agent.process_once()
    agent.close()

    assert len(api.heartbeats) == 1
    assert len(api.metrics) == 2


def test_agent_creates_independent_inference_for_each_camera() -> None:
    config = AiBoxConfig(
        id="box",
        name="Box",
        cameras=(
            CameraConfig("one", "One", "usb"),
            CameraConfig("two", "Two", "usb"),
        ),
        model_version="test",
    )
    created = []
    api = FakeApi()
    agent = AiBoxAgent(
        config,
        api,  # type: ignore[arg-type]
        lambda _: created.append(object()) or FakeInference(),
        camera_factory=FakeCamera,
    )

    assert len(created) == 2
    assert agent.inferences[0] is not agent.inferences[1]


def test_agent_run_forever_can_be_stopped_after_one_cycle() -> None:
    config = AiBoxConfig(
        id="box",
        name="Box",
        cameras=(
            CameraConfig("one", "One", "usb"),
            CameraConfig("two", "Two", "usb"),
        ),
        model_version="test",
    )
    api = FakeApi()
    agent = AiBoxAgent(
        config,
        api,  # type: ignore[arg-type]
        lambda _: FakeInference(),
        camera_factory=FakeCamera,
    )
    stop_event = Event()
    original_process_once = agent.process_once

    def process_and_stop() -> None:
        original_process_once()
        stop_event.set()

    agent.process_once = process_and_stop  # type: ignore[method-assign]
    agent.run_forever(0.01, stop_event)

    assert len(api.metrics) == 2
