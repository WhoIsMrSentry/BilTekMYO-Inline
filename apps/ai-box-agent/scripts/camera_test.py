from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_box_agent.inference import YoloXOnnxRuntimeEngine


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Yerel PC kamerasıyla YOLOX ONNX kişi algılamasını deneyin."
    )
    parser.add_argument(
        "--model",
        default=str(PROJECT_ROOT / "models" / "pretrained" / "yolox_tiny.onnx"),
        help="ONNX model yolu (varsayılan: YOLOX-Tiny).",
    )
    parser.add_argument("--camera", type=int, default=0, help="Kamera aygıt numarası.")
    parser.add_argument(
        "--provider",
        choices=("auto", "cpu", "cuda", "directml", "tensorrt"),
        default="auto",
        help="ONNX Runtime sağlayıcısı.",
    )
    parser.add_argument("--confidence", type=float, default=0.35)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    engine = YoloXOnnxRuntimeEngine(
        model_path=args.model,
        model_version=Path(args.model).stem,
        provider=args.provider,
        confidence_threshold=args.confidence,
    )
    backend = cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_ANY
    camera = cv2.VideoCapture(args.camera, backend)
    if not camera.isOpened():
        raise SystemExit(
            f"Kamera {args.camera} açılamadı. Windows kamera iznini ve aygıt numarasını kontrol edin."
        )

    print(f"Model: {Path(args.model).name} | Provider: {engine.provider_name}")
    print("Kamera görüntüsü yalnızca bu bilgisayarda işlenir ve kaydedilmez. Çıkmak için Q veya Esc.")
    previous = time.perf_counter()
    fps = 0.0
    failed_reads = 0
    try:
        while True:
            ok, frame = camera.read()
            if not ok:
                failed_reads += 1
                if failed_reads < 12:
                    time.sleep(0.1)
                    continue
                raise RuntimeError("Kameradan görüntü okunamadı.")
            failed_reads = 0
            detections = engine.detect(frame)
            for detection in detections:
                x1, y1, x2, y2 = (int(value) for value in detection.box)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (70, 220, 170), 2)
                cv2.putText(
                    frame,
                    f"Kisi {detection.confidence:.0%}",
                    (x1, max(22, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (70, 220, 170),
                    2,
                    cv2.LINE_AA,
                )
            now = time.perf_counter()
            instant_fps = 1 / max(now - previous, 1e-6)
            fps = instant_fps if fps == 0 else fps * 0.85 + instant_fps * 0.15
            previous = now
            cv2.rectangle(frame, (12, 12), (310, 82), (20, 32, 37), -1)
            cv2.putText(frame, f"Gorulen kisi: {len(detections)}", (24, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (240, 248, 244), 2, cv2.LINE_AA)
            cv2.putText(frame, f"{engine.provider_name}  |  {fps:.1f} FPS", (24, 68), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (145, 205, 190), 1, cv2.LINE_AA)
            cv2.imshow("BilTekMYO - YOLOX kamera testi", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
    finally:
        camera.release()
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
