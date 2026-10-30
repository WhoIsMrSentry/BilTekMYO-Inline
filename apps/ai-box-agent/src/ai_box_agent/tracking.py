from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Direction = Literal["entry", "exit"]


@dataclass(frozen=True)
class TrackedPerson:
    track_id: int
    center_x: float
    center_y: float


class LineCrossingTracker:
    """Counts each track once when it crosses a configured horizontal line."""

    def __init__(self, line_y: float, max_distance: float = 120.0) -> None:
        if line_y < 0:
            raise ValueError("The crossing line must have a non-negative y coordinate.")
        if max_distance <= 0:
            raise ValueError("The tracker max distance must be positive.")
        self.line_y = line_y
        self.max_distance = max_distance
        self._last_positions: dict[int, float] = {}
        self._crossed: set[int] = set()

    def update(self, people: list[TrackedPerson]) -> dict[Direction, int]:
        counts: dict[Direction, int] = {"entry": 0, "exit": 0}
        current_ids = set()
        for person in people:
            current_ids.add(person.track_id)
            previous_y = self._last_positions.get(person.track_id)
            self._last_positions[person.track_id] = person.center_y
            if previous_y is None or person.track_id in self._crossed:
                continue
            if abs(person.center_y - previous_y) > self.max_distance:
                continue
            direction = self._crossing_direction(previous_y, person.center_y)
            if direction:
                counts[direction] += 1
                self._crossed.add(person.track_id)

        missing_ids = set(self._last_positions) - current_ids
        for track_id in missing_ids:
            self._last_positions.pop(track_id)
            self._crossed.discard(track_id)
        return counts

    def _crossing_direction(self, previous_y: float, current_y: float) -> Direction | None:
        was_above = previous_y < self.line_y
        is_above = current_y < self.line_y
        if was_above == is_above:
            return None
        return "entry" if was_above and not is_above else "exit"
