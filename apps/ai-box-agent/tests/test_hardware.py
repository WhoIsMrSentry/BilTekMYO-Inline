from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from ai_box_agent.hardware import DGX_SPARK_PROFILE, HardwareProfile


def test_dgx_spark_defaults_to_tensorrt_and_two_cameras() -> None:
    assert DGX_SPARK_PROFILE.kind == "nvidia-dgx-spark"
    assert DGX_SPARK_PROFILE.inference_backend == "tensorrt"
    assert DGX_SPARK_PROFILE.camera_count == 2


def test_dgx_spark_rejects_cpu_backend() -> None:
    try:
        HardwareProfile("nvidia-dgx-spark", "cpu")
    except ValueError as error:
        assert "GPU" in str(error)
    else:
        raise AssertionError("DGX Spark must reject CPU-only inference")
