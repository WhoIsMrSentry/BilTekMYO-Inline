from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from .types import AnonymousMetrics
from .metrics import Detection, MetricsAggregator
from .tracking import Direction, LineCrossingTracker, TrackedPerson
from .decoder import ModelOutputDecoder, RawDetection


class InferenceEngine(ABC):
    model_version: str

    @abstractmethod
    def analyze(self, frame: Any) -> AnonymousMetrics:
        """Analyze a frame and return only aggregate anonymous metrics."""


class UnconfiguredInferenceEngine(InferenceEngine):
    def __init__(self, model_version: str) -> None:
        self.model_version = model_version

    def analyze(self, frame: Any) -> AnonymousMetrics:
        del frame
        raise RuntimeError(
            "No inference model is configured. Install and configure a model "
            "backend before starting camera processing."
        )


class TensorRtInferenceEngine(InferenceEngine):
    """DGX Spark inference boundary; model/runtime compatibility is validated at startup."""

    def __init__(self, model_path: str, model_version: str) -> None:
        if not model_path.strip():
            raise ValueError("TensorRT requires a serialized engine path.")
        self.model_path = model_path
        self.model_version = model_version
        try:
            import tensorrt  # noqa: F401
        except ImportError as error:
            raise RuntimeError(
                "TensorRT is not installed for the selected DGX Spark runtime."
            ) from error

    def analyze(self, frame: Any) -> AnonymousMetrics:
        del frame
        raise NotImplementedError(
            "TensorRT model execution is pending the approved model contract."
        )


class YoloXOnnxRuntimeEngine(InferenceEngine):
    """Runs the shared YOLOX ONNX artifact on the active ONNX Runtime provider."""

    _PROVIDER_NAMES = {
        "cpu": "CPUExecutionProvider",
        "cuda": "CUDAExecutionProvider",
        "directml": "DmlExecutionProvider",
        "tensorrt": "TensorrtExecutionProvider",
    }

    def __init__(
        self,
        model_path: str,
        model_version: str,
        provider: str = "auto",
        confidence_threshold: float = 0.35,
        nms_threshold: float = 0.45,
        input_size: int = 416,
    ) -> None:
        if not Path(model_path).is_file():
            raise FileNotFoundError(f"ONNX model was not found: {model_path}")
        if not 0 < confidence_threshold <= 1 or not 0 < nms_threshold <= 1:
            raise ValueError("Confidence and NMS thresholds must be between 0 and 1.")
        if input_size <= 0:
            raise ValueError("Model input size must be positive.")
        try:
            import cv2
            import numpy as np
            import onnxruntime as ort
        except ImportError as error:
            raise RuntimeError(
                "Install the camera-test extra (OpenCV, NumPy, ONNX Runtime) first."
            ) from error

        self._cv2 = cv2
        self._np = np
        self.model_version = model_version
        self.confidence_threshold = confidence_threshold
        self.nms_threshold = nms_threshold
        self.input_size = input_size
        available = ort.get_available_providers()
        if provider == "auto":
            priority = ("tensorrt", "cuda", "directml", "cpu")
            selected = next(
                (name for name in priority if self._PROVIDER_NAMES[name] in available),
                None,
            )
        else:
            selected = provider
        if selected not in self._PROVIDER_NAMES:
            raise ValueError(f"Unsupported ONNX Runtime provider: {provider}")
        provider_name = self._PROVIDER_NAMES[selected]
        if provider_name not in available:
            raise RuntimeError(
                f"ONNX Runtime provider {provider_name} is unavailable. "
                f"Installed providers: {', '.join(available)}"
            )

        providers: list[Any] = [provider_name]
        if selected == "tensorrt":
            cache_dir = str(Path(model_path).resolve().parent / ".tensorrt-cache")
            Path(cache_dir).mkdir(parents=True, exist_ok=True)
            providers = [
                (provider_name, {
                    "trt_engine_cache_enable": True,
                    "trt_engine_cache_path": cache_dir,
                }),
                "CUDAExecutionProvider",
                "CPUExecutionProvider",
            ]
        elif selected != "cpu":
            providers.append("CPUExecutionProvider")
        self.provider_name = provider_name
        self.session = ort.InferenceSession(model_path, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.metrics = MetricsAggregator(confidence_threshold)
        self.decoder = ModelOutputDecoder({0: "person"})

    def detect(self, frame: Any) -> list[RawDetection]:
        np = self._np
        height, width = frame.shape[:2]
        ratio = min(self.input_size / height, self.input_size / width)
        resized = self._cv2.resize(
            frame,
            (int(width * ratio), int(height * ratio)),
            interpolation=self._cv2.INTER_LINEAR,
        ).astype(np.uint8)
        canvas = np.full((self.input_size, self.input_size, 3), 114, dtype=np.uint8)
        canvas[: resized.shape[0], : resized.shape[1]] = resized
        tensor = np.ascontiguousarray(canvas.transpose(2, 0, 1), dtype=np.float32)
        output = self.session.run(
            [self.output_name], {self.input_name: tensor[None, :, :, :]}
        )[0]
        predictions = self._decode_outputs(output)[0]
        object_scores = predictions[:, 4]
        person_scores = object_scores * predictions[:, 5]
        keep = person_scores >= self.confidence_threshold
        if not np.any(keep):
            return []

        candidates = predictions[keep]
        scores = person_scores[keep]
        boxes = np.empty_like(candidates[:, :4])
        boxes[:, 0] = candidates[:, 0] - candidates[:, 2] / 2
        boxes[:, 1] = candidates[:, 1] - candidates[:, 3] / 2
        boxes[:, 2] = candidates[:, 0] + candidates[:, 2] / 2
        boxes[:, 3] = candidates[:, 1] + candidates[:, 3] / 2
        boxes /= ratio
        boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, width - 1)
        boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, height - 1)
        xywh = [
            [int(box[0]), int(box[1]), max(1, int(box[2] - box[0])), max(1, int(box[3] - box[1]))]
            for box in boxes
        ]
        indices = self._cv2.dnn.NMSBoxes(
            xywh, scores.tolist(), self.confidence_threshold, self.nms_threshold
        )
        if len(indices) == 0:
            return []
        selected = np.asarray(indices).reshape(-1)
        detections: list[RawDetection] = []
        for index in selected:
            x1, y1, x2, y2 = boxes[int(index)].tolist()
            if x2 <= x1 or y2 <= y1:
                continue
            detections.append(RawDetection(
                class_id=0,
                confidence=float(scores[int(index)]),
                box=(float(x1), float(y1), float(x2), float(y2)),
            ))
        return detections

    def analyze(self, frame: Any) -> AnonymousMetrics:
        decoded = self.decoder.decode(self.detect(frame))
        return self.metrics.aggregate(decoded.detections)

    def _decode_outputs(self, output: Any) -> Any:
        np = self._np
        predictions = output[0] if output.ndim == 3 else output
        grids = []
        expanded_strides = []
        for stride in (8, 16, 32):
            grid_size = self.input_size // stride
            yv, xv = np.meshgrid(np.arange(grid_size), np.arange(grid_size), indexing="ij")
            grid = np.stack((xv, yv), axis=2).reshape(1, -1, 2)
            grids.append(grid)
            expanded_strides.append(
                np.full((1, grid.shape[1], 1), stride, dtype=np.float32)
            )
        grid = np.concatenate(grids, axis=1)
        stride_values = np.concatenate(expanded_strides, axis=1)
        if predictions.shape[0] != grid.shape[1]:
            raise RuntimeError(
                f"Unexpected YOLOX output shape {predictions.shape}; "
                f"expected {grid.shape[1]} candidates for {self.input_size}px input."
            )
        decoded = predictions.astype(np.float32, copy=True)
        decoded[:, :2] = (decoded[:, :2] + grid[0]) * stride_values[0]
        decoded[:, 2:4] = np.exp(np.clip(decoded[:, 2:4], -16, 16)) * stride_values[0]
        return decoded[None, :, :]


class DetectionInferenceAdapter(InferenceEngine):
    """Converts model detections to anonymous metrics without retaining frames."""

    def __init__(
        self,
        model_version: str,
        line_y: float,
        confidence_threshold: float = 0.6,
    ) -> None:
        self.model_version = model_version
        self.aggregator = MetricsAggregator(confidence_threshold)
        self.tracker = LineCrossingTracker(line_y=line_y)

    def analyze_detections(
        self,
        detections: list[Detection],
        tracked_people: list[TrackedPerson] | None = None,
    ) -> AnonymousMetrics:
        crossings: dict[Direction, int] = {"entry": 0, "exit": 0}
        if tracked_people is not None:
            crossings = self.tracker.update(tracked_people)
        return self.aggregator.aggregate(
            detections,
            entries=crossings["entry"],
            exits=crossings["exit"],
        )

    def analyze_model_output(
        self,
        raw_detections: list[RawDetection],
        decoder: ModelOutputDecoder,
    ) -> AnonymousMetrics:
        decoded = decoder.decode(raw_detections)
        return self.analyze_detections(decoded.detections, decoded.tracked_people)

    def analyze(self, frame: Any) -> AnonymousMetrics:
        del frame
        raise RuntimeError(
            "Raw-frame inference is not configured. Connect a TensorRT output "
            "decoder and call analyze_detections with validated detections."
        )
