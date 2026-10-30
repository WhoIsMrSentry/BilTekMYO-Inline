from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .types import AnonymousMetrics


@dataclass(frozen=True)
class Detection:
    class_name: Literal["person", "female", "male", "happy", "neutral", "sad", "angry", "unknown"]
    confidence: float


class MetricsAggregator:
    def __init__(self, confidence_threshold: float = 0.6) -> None:
        if not 0 < confidence_threshold <= 1:
            raise ValueError("Confidence threshold must be greater than 0 and at most 1.")
        self.confidence_threshold = confidence_threshold

    def aggregate(
        self,
        detections: list[Detection],
        entries: int = 0,
        exits: int = 0,
    ) -> AnonymousMetrics:
        if entries < 0 or exits < 0:
            raise ValueError("Entry and exit counts cannot be negative.")
        valid = [item for item in detections if 0 <= item.confidence <= 1]
        people = [
            item for item in valid
            if item.class_name == "person" and item.confidence >= self.confidence_threshold
        ]
        gender = {"female": 0, "male": 0, "unknown": 0}
        mood = {"happy": 0, "neutral": 0, "sad": 0, "angry": 0, "unknown": 0}

        for item in people:
            gender_match = self._best_attribute(valid, item, ("female", "male"))
            gender[gender_match or "unknown"] += 1
            mood_match = self._best_attribute(valid, item, ("happy", "neutral", "sad", "angry"))
            mood[mood_match or "unknown"] += 1

        return {
            "peopleCount": len(people),
            "entries": entries,
            "exits": exits,
            "estimatedOccupancy": len(people),
            "genderDistribution": gender,
            "moodDistribution": mood,
        }

    def _best_attribute(
        self,
        detections: list[Detection],
        person: Detection,
        classes: tuple[str, ...],
    ) -> str | None:
        del person
        candidates = [
            item for item in detections
            if item.class_name in classes and item.confidence >= self.confidence_threshold
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda item: item.confidence).class_name
