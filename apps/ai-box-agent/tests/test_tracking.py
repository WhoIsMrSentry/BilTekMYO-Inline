from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from ai_box_agent.tracking import LineCrossingTracker, TrackedPerson


def test_tracker_counts_crossing_direction_once() -> None:
    tracker = LineCrossingTracker(line_y=100)
    assert tracker.update([TrackedPerson(1, 10, 80)]) == {"entry": 0, "exit": 0}
    assert tracker.update([TrackedPerson(1, 10, 110)]) == {"entry": 1, "exit": 0}
    assert tracker.update([TrackedPerson(1, 10, 120)]) == {"entry": 0, "exit": 0}

    assert tracker.update([]) == {"entry": 0, "exit": 0}
    assert tracker.update([TrackedPerson(1, 10, 120)]) == {"entry": 0, "exit": 0}
    assert tracker.update([TrackedPerson(1, 10, 80)]) == {"entry": 0, "exit": 1}


def test_tracker_rejects_jumps_and_invalid_configuration() -> None:
    for line_y, max_distance in ((-1, 10), (1, 0)):
        try:
            LineCrossingTracker(line_y, max_distance)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid tracker configuration was accepted")

    tracker = LineCrossingTracker(line_y=100, max_distance=10)
    tracker.update([TrackedPerson(1, 0, 80)])
    assert tracker.update([TrackedPerson(1, 0, 130)]) == {"entry": 0, "exit": 0}
