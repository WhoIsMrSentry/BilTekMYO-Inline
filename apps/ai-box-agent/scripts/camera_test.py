from __future__ import annotations

import argparse
import json
import os
import sys
import time
from queue import Empty, Queue
from threading import Event, Lock, Thread
from datetime import datetime, timezone
from pathlib import Path

import cv2

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_box_agent.inference import YoloXOnnxRuntimeEngine
from ai_box_agent.client import ApiClient


def default_api_url() -> str:
    configured_url = os.environ.get("BILTEKMYO_API_URL")
    if configured_url:
        return configured_url
    manifest_path = PROJECT_ROOT / "var" / "dev-ports.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        api_url = manifest.get("apiUrl")
        if isinstance(api_url, str) and api_url.startswith(("http://", "https://")):
            return api_url
    except (OSError, json.JSONDecodeError):
        pass
    return "http://localhost:3000"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Yerel PC kamerasıyla YOLOX ONNX kişi algılamasını deneyin."
    )
    parser.add_argument(
        "--model",
        default=str(PROJECT_ROOT / "models" / "pretrained" / "yolox_nano.onnx"),
        help="ONNX model yolu (varsayılan: CPU için daha hafif YOLOX-Nano).",
    )
    parser.add_argument("--camera", type=int, default=0, help="Kamera aygıt numarası.")
    parser.add_argument(
        "--provider",
        choices=("auto", "cpu", "cuda", "directml", "tensorrt"),
        default="auto",
        help="ONNX Runtime sağlayıcısı.",
    )
    parser.add_argument("--confidence", type=float, default=0.35)
    parser.add_argument("--input-size", type=int, choices=(416,), default=416,
                        help="Bu model dosyası 416x416 sabit giriş kullanır.")
    parser.add_argument("--capture-width", type=int, default=1280,
                        help="Kameradan alınacak kare genişliği (varsayılan: 1280).")
    parser.add_argument("--capture-height", type=int, default=720,
                        help="Kameradan alınacak kare yüksekliği (varsayılan: 720).")
    parser.add_argument("--cpu-threads", type=int, default=2,
                        help="ONNX Runtime CPU iş parçacığı sayısı.")
    parser.add_argument("--gpu-index", type=int, default=0,
                        help="DirectML ekran kartı indeksi (varsayılan: 0).")
    parser.add_argument("--preview-fps", type=float, default=20.0,
                        help="Yayın ekranına gönderilecek en yüksek kare hızı (varsayılan: 20).")
    parser.add_argument("--publish-preview", action="store_true", help="Publish the annotated preview and anonymous metrics to the assigned display.")
    parser.add_argument("--api-url", default=default_api_url(),
                        help="API adresi; varsayılan dev:up tarafından kaydedilen adrestir.")
    parser.add_argument("--camera-id", default="camera-01")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    engine = YoloXOnnxRuntimeEngine(
        model_path=args.model,
        model_version=Path(args.model).stem,
        provider=args.provider,
        confidence_threshold=args.confidence,
        input_size=args.input_size,
        cpu_threads=args.cpu_threads,
        directml_device_id=args.gpu_index,
    )
    backend = cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_ANY
    camera = cv2.VideoCapture(args.camera, backend)
    if not camera.isOpened():
        raise SystemExit(
            f"Kamera {args.camera} açılamadı. Windows kamera iznini ve aygıt numarasını kontrol edin."
        )
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, args.capture_width)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, args.capture_height)
    camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    api_client = None
    paired_camera_id = "camera-02" if args.camera_id != "camera-02" else "camera-01"
    if args.publish_preview:
        api_key = os.environ.get("AI_BOX_API_KEY", "")
        if not api_key:
            camera.release()
            raise SystemExit("AI_BOX_API_KEY ortam değişkeni --publish-preview için gerekli.")
        api_client = ApiClient(args.api_url, api_key=api_key)
        print(f"API hedefi: {args.api_url}", flush=True)
        try:
            api_client.register_ai_box({"id": "ai-box-camera-test", "name": "Yerel kamera testi", "cameraIds": [args.camera_id, paired_camera_id]})
            api_client.send_heartbeat({
                "aiBoxId": "ai-box-camera-test", "sentAt": datetime.now(timezone.utc).isoformat(),
                "agentVersion": "camera-test", "modelVersion": Path(args.model).stem,
                "cameraStatuses": {args.camera_id: "online", paired_camera_id: "offline"},
            })
        except RuntimeError as error:
            camera.release()
            raise SystemExit(
                f"{error}\nAPI sunucusu kapalı ya da port yanlış. Önce pnpm dev:up çalıştırın; "
                f"API adresini var/dev-ports.json veya dev:up çıktısından alın."
            ) from None

    state_lock = Lock()
    capture_stop = Event()
    inference_stop = Event()
    publish_stop = Event()
    metric_queue: Queue = Queue(maxsize=2)
    preview_queue: Queue = Queue(maxsize=1)
    latest = {"frame": None, "version": 0, "detections": [], "people_count": 0, "captured_at": "", "inference_fps": 0.0}

    def capture_latest() -> None:
        while not capture_stop.is_set():
            ok, captured = camera.read()
            if not ok:
                time.sleep(0.02)
                continue
            with state_lock:
                latest["frame"] = captured
                latest["version"] += 1

    def infer_latest() -> None:
        last_version = 0
        motion_seen = False
        while not inference_stop.is_set():
            with state_lock:
                frame = latest["frame"].copy() if latest["frame"] is not None else None
                version = latest["version"]
            if frame is None or version == last_version:
                time.sleep(0.005)
                continue
            last_version = version
            try:
                inference_started = time.perf_counter()
                motion_seen = engine.motion_detected(frame) or motion_seen
                detections = engine.detect(frame)
                decoded = engine.decoder.decode(detections)
                metrics = engine.metrics.aggregate(decoded.detections)
                captured_at = datetime.now(timezone.utc).isoformat()
                inference_fps = 1.0 / max(time.perf_counter() - inference_started, 1e-6)
                with state_lock:
                    latest["detections"] = detections
                    latest["people_count"] = len(detections)
                    latest["captured_at"] = captured_at
                    latest["inference_fps"] = inference_fps
                if api_client:
                    event = {
                        "schemaVersion": 1, "aiBoxId": "ai-box-camera-test", "cameraId": args.camera_id,
                        "capturedAt": captured_at, "motionDetected": motion_seen, "metrics": metrics,
                    }
                    if metric_queue.full():
                        try:
                            metric_queue.get_nowait()
                            metric_queue.task_done()
                        except Empty:
                            pass
                    metric_queue.put_nowait(event)
                motion_seen = False
            except Exception as error:
                print(f"Model işlemi başarısız: {error}", flush=True)

    capture_thread = Thread(target=capture_latest, name="camera-capture", daemon=True)
    inference_thread = Thread(target=infer_latest, name="camera-inference", daemon=True)
    capture_thread.start()
    inference_thread.start()

    publisher_threads = []
    if api_client:
        def publish_metrics() -> None:
            report_started = time.perf_counter()
            published = 0
            while not publish_stop.is_set() or not metric_queue.empty():
                try:
                    event = metric_queue.get(timeout=0.1)
                except Empty:
                    continue
                try:
                    request_started = time.perf_counter()
                    api_client.send_metrics(event)
                    last_request_ms = (time.perf_counter() - request_started) * 1000
                    published += 1
                    elapsed = time.perf_counter() - report_started
                    if elapsed >= 5:
                        print(f"API metrik aktarımı: {published / elapsed:.2f}/sn; son istek {last_request_ms:.0f} ms", flush=True)
                        report_started = time.perf_counter()
                        published = 0
                except Exception as error:
                    print(f"Metrik gönderimi başarısız: {error}", flush=True)
                finally:
                    metric_queue.task_done()

        def publish_previews() -> None:
            interval = 1.0 / max(0.25, args.preview_fps)
            while not publish_stop.is_set():
                started_at = time.perf_counter()
                with state_lock:
                    frame = latest["frame"].copy() if latest["frame"] is not None else None
                    detections = list(latest["detections"])
                    people_count = int(latest["people_count"])
                    captured_at = datetime.now(timezone.utc).isoformat()
                if frame is not None:
                    try:
                        jpeg = engine._annotated_preview(frame, detections, people_count)
                        if preview_queue.full():
                            try:
                                preview_queue.get_nowait()
                                preview_queue.task_done()
                            except Empty:
                                pass
                        preview_queue.put_nowait((captured_at, jpeg))
                    except Exception as error:
                        print(f"Önizleme hazırlanamadı: {error}", flush=True)
                time.sleep(max(0, interval - (time.perf_counter() - started_at)))

        def send_previews() -> None:
            report_started = time.perf_counter()
            published = 0
            while not publish_stop.is_set() or not preview_queue.empty():
                try:
                    captured_at, jpeg = preview_queue.get(timeout=0.1)
                except Empty:
                    continue
                try:
                    request_started = time.perf_counter()
                    api_client.send_camera_frame("ai-box-camera-test", args.camera_id, captured_at, jpeg)
                    last_request_ms = (time.perf_counter() - request_started) * 1000
                    published += 1
                    elapsed = time.perf_counter() - report_started
                    if elapsed >= 5:
                        print(f"API önizleme aktarımı: {published / elapsed:.2f} FPS; son istek {last_request_ms:.0f} ms", flush=True)
                        report_started = time.perf_counter()
                        published = 0
                except Exception as error:
                    print(f"Önizleme gönderimi başarısız: {error}", flush=True)
                finally:
                    preview_queue.task_done()

        publisher_threads = [
            Thread(target=publish_metrics, name="camera-metrics-publisher", daemon=True),
            Thread(target=publish_previews, name="camera-preview-encoder", daemon=True),
            Thread(target=send_previews, name="camera-preview-publisher", daemon=True),
        ]
        for thread in publisher_threads:
            thread.start()

    print(f"Model: {Path(args.model).name} | Provider: {engine.provider_name} | Giriş: {args.input_size}px | CPU threads: {args.cpu_threads}")
    print("Kareler diske yazılmaz. Önizleme gönderimi: " + ("açık" if api_client else "kapalı") + ". Q veya Esc ile kapatın.")
    previous = time.perf_counter()
    fps = 0.0
    try:
        while True:
            with state_lock:
                frame = latest["frame"].copy() if latest["frame"] is not None else None
                detections = list(latest["detections"])
                inference_fps = float(latest["inference_fps"])
            if frame is None:
                time.sleep(0.01)
                continue
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
            cv2.rectangle(frame, (12, 12), (590, 82), (20, 32, 37), -1)
            cv2.putText(frame, f"Gorulen kisi: {len(detections)}", (24, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (240, 248, 244), 2, cv2.LINE_AA)
            cv2.putText(frame, f"AI {inference_fps:.2f} FPS  |  Onizleme {fps:.1f} FPS", (24, 68), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (145, 205, 190), 1, cv2.LINE_AA)
            cv2.imshow("BilTekMYO - YOLOX kamera testi", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
    finally:
        inference_stop.set()
        capture_stop.set()
        publish_stop.set()
        camera.release()
        capture_thread.join(timeout=2)
        inference_thread.join(timeout=2)
        for thread in publisher_threads:
            thread.join(timeout=2)
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
