from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .metrics import Detection
from .tracking import TrackedPerson


@dataclass(frozen=True)
class RawDetection:
    class_id: int
    confidence: float
    box: tuple[float, float, float, float]
    track_id: int | None = None


@dataclass(frozen=True)
class DecodedDetections:
    detections: list[Detection]
    tracked_people: list[TrackedPerson]


class ModelOutputDecoder:
    """Converts model output into validated, model-independent detections."""

    def __init__(self, class_names: Mapping[int, str]) -> None:
        if not class_names:
            raise ValueError("At least one model class is required.")
        self.class_names = dict(class_names)

    def decode(self, raw: list[RawDetection]) -> DecodedDetections:
        detections: list[Detection] = []
        tracked_people: list[TrackedPerson] = []
        for item in raw:
            class_name = self.class_names.get(item.class_id)
            if class_name is None:
                continue
            self._validate(item)
            detections.append(Detection(self._normalise_class(class_name), item.confidence))
            if class_name == "person" and item.track_id is not None:
                x1, y1, x2, y2 = item.box
                tracked_people.append(
                    TrackedPerson(
                        track_id=item.track_id,
                        center_x=(x1 + x2) / 2,
                        center_y=(y1 + y2) / 2,
                    )
                )
        return DecodedDetections(detections, tracked_people)

    @staticmethod
    def _validate(item: RawDetection) -> None:
        if not 0 <= item.confidence <= 1:
            raise ValueError("Detection confidence must be between 0 and 1.")
        x1, y1, x2, y2 = item.box
        if x1 < 0 or y1 < 0 or x2 <= x1 or y2 <= y1:
            raise ValueError("Detection bounding box must have positive dimensions.")

    @staticmethod
    def _normalise_class(class_name: str) -> Any:
        allowed = {"person", "female", "male", "happy", "neutral", "sad", "angry", "unknown"}
        if class_name not in allowed:
            return "unknown"
        return class_name
