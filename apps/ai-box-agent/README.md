# AI Box Agent

Tek AI Box üzerinde iki kamerayı çalıştıracak yerel agent.

İlk sınırlar:

- USB ve RTSP kamera kaynakları
- Değiştirilebilir inference backend
- Ham görüntü yerine anonim `MetricsEvent`
- Heartbeat ve model sürümü bildirimi
- İki kamera şartının başlangıçta doğrulanması

Donanım profili **NVIDIA DGX Spark** olarak sabitlenmiştir. Varsayılan
inference backend TensorRT'tir; ONNX Runtime CUDA ve CPU yalnızca açık bir
profil seçimiyle kullanılabilir. TensorRT engine/model sürümü kesinleşmeden
runtime paketi veya model dosyası kaynak depoya eklenmeyecektir.

Örnek başlatma hedefi:

```text
DGX Spark + TensorRT engine + USB/RTSP iki kamera
```

TensorRT adapter'ı runtime ve model uyumsuzluklarını başlangıçta açık hata
olarak raporlar; henüz onaylanmamış modelle sahte metrik üretmez.

Model çıktısı için ilk ortak sözleşme:

- `person` detection: kişi sayısını artırır.
- `female`/`male` ve mood sınıfları: güven eşiğini geçerse toplu metriğe girer.
- Eşiği geçmeyen sınıflar `unknown` sayılır.
- Ham frame agent dışına çıkmaz ve saklanmaz.
- Giriş/çıkış sayısı tracker sözleşmesi eklenene kadar `0` üretilir; kişi
  sayısından giriş/çıkış uydurulmaz.

Tracker bağlandığında her kişi `track_id` ve bounding-box merkez noktasıyla
izlenir. Sanal çizgiyi bir kez geçen track için yön (`entry`/`exit`) sayılır;
ani ve güvenilmez büyük koordinat sıçramaları sayılmaz. Track state yalnızca
agent belleğinde tutulur.

`ModelOutputDecoder`, TensorRT/ONNX çıktısını modelden bağımsız `Detection` ve
`TrackedPerson` nesnelerine çevirir. Bilinmeyen sınıflar `unknown` olarak
işaretlenir; geçersiz confidence veya bounding-box çıktıları açık hata verir.

Agent her kamera için ayrı bir inference instance'ı oluşturur; böylece tracker
durumu iki kamera arasında paylaşılmaz. `run_forever(interval_seconds, stop_event)`
metodu her döngüde iki kameradan birer frame alır, her frame'i kendi inference
instance'ına verir ve iki anonim `MetricsEvent` gönderir. Model bağlı değilse
işlem açık hata ile durur; sahte metrik üretilmez.

## Windows/Linux yerel kamera testi

Resmî YOLOX Nano/Tiny ONNX ağırlıkları `models/pretrained` altında bulunur.
CPU tabanlı kamera denemesi Windows ve Linux'ta aynı komutla çalışır:

```powershell
python -m pip install -e "apps/ai-box-agent[camera-cpu]"
python apps/ai-box-agent/scripts/camera_test.py --model models/pretrained/yolox_tiny.onnx --camera 0 --provider auto
```

Linux/macOS shell'de pip extra komutu:

```sh
python -m pip install -e 'apps/ai-box-agent[camera-cpu]'
python apps/ai-box-agent/scripts/camera_test.py --model models/pretrained/yolox_tiny.onnx --camera 0 --provider auto
```

Önizleme penceresi algılanan kişileri ve FPS'i gösterir; kareler diske
yazılmaz. `Q` veya `Esc` ile kapatılır. `--provider` seçeneği `cpu`, `cuda`,
`directml`, `tensorrt` veya `auto` kabul eder; seçilen sağlayıcı kurulu değilse
açık hata verir. DGX Spark için ONNX'ten cihaz üzerinde TensorRT engine üretimi
ve AI Box agent'a üretim bağlantısı sonraki adımdır.
