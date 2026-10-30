from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

HardwareKind = Literal["nvidia-dgx-spark"]
InferenceBackend = Literal["tensorrt", "onnxruntime-cuda", "cpu"]


@dataclass(frozen=True)
class HardwareProfile:
    kind: HardwareKind
    inference_backend: InferenceBackend
    camera_count: int = 2

    def __post_init__(self) -> None:
        if self.camera_count != 2:
            raise ValueError("The AI Box must be configured for exactly two cameras.")
        if self.kind == "nvidia-dgx-spark" and self.inference_backend == "cpu":
            raise ValueError("DGX Spark must use a GPU inference backend.")


DGX_SPARK_PROFILE = HardwareProfile(
    kind="nvidia-dgx-spark",
    inference_backend="tensorrt",
)
