from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from ai_box_agent.decoder import ModelOutputDecoder, RawDetection


def test_decoder_maps_classes_and_person_centers() -> None:
    decoded = ModelOutputDecoder({0: "person", 1: "happy", 2: "vendor"}).decode([
        RawDetection(0, 0.95, (10, 20, 30, 60), track_id=7),
        RawDetection(1, 0.8, (0, 0, 4, 4)),
        RawDetection(2, 0.9, (1, 1, 2, 2)),
    ])
    assert [item.class_name for item in decoded.detections] == ["person", "happy", "unknown"]
    assert decoded.tracked_people[0].track_id == 7
    assert decoded.tracked_people[0].center_x == 20
    assert decoded.tracked_people[0].center_y == 40


def test_decoder_rejects_invalid_box_and_confidence() -> None:
    decoder = ModelOutputDecoder({0: "person"})
    for item in (
        RawDetection(0, 1.1, (0, 0, 1, 1)),
        RawDetection(0, 0.8, (5, 0, 1, 1)),
    ):
        try:
            decoder.decode([item])
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid model output was accepted")


def test_unknown_model_class_is_ignored() -> None:
    decoded = ModelOutputDecoder({0: "person"}).decode([
        RawDetection(99, 0.99, (0, 0, 1, 1), track_id=1),
    ])
    assert decoded.detections == []
    assert decoded.tracked_people == []
