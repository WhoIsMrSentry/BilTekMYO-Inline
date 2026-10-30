from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from ai_box_agent.metrics import Detection, MetricsAggregator


def test_low_confidence_attributes_become_unknown() -> None:
    metrics = MetricsAggregator(0.7).aggregate([
        Detection("person", 0.99),
        Detection("female", 0.65),
        Detection("happy", 0.99),
    ])
    assert metrics["peopleCount"] == 1
    assert metrics["genderDistribution"] == {"female": 0, "male": 0, "unknown": 1}
    assert metrics["moodDistribution"]["happy"] == 1


def test_invalid_confidence_is_ignored_and_no_entries_are_invented() -> None:
    metrics = MetricsAggregator().aggregate([
        Detection("person", 1.2),
        Detection("person", 0.8),
        Detection("male", 0.8),
    ])
    assert metrics["peopleCount"] == 1
    assert metrics["entries"] == 0
    assert metrics["exits"] == 0
    assert metrics["genderDistribution"]["male"] == 1


def test_threshold_must_be_valid() -> None:
    for threshold in (0, 1.1):
        try:
            MetricsAggregator(threshold)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid threshold was accepted")
