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
python apps/ai-box-agent/scripts/camera_test.py --model models/pretrained/yolox_nano.onnx --camera 0 --provider auto
```

Linux/macOS shell'de pip extra komutu:

```sh
python -m pip install -e 'apps/ai-box-agent[camera-cpu]'
python apps/ai-box-agent/scripts/camera_test.py --model models/pretrained/yolox_nano.onnx --camera 0 --provider auto
```

Önizleme penceresi algılanan kişileri ve FPS'i gösterir; kareler diske
yazılmaz. Kamera görüntüsü varsayılan olarak 1280×720 alınır. `Q` veya `Esc`
ile kapatılır. NVIDIA ekran kartlı Windows bilgisayarda `directml`, CUDA
kurulumu olan sistemlerde `cuda` sağlayıcısını seçin. `auto`, kurulu en hızlı
sağlayıcıyı seçer; seçilen sağlayıcı kullanılabilir değilse açık hata verir.
DGX Spark için ONNX'ten cihaz üzerinde TensorRT engine üretimi ve AI Box agent'a
üretim bağlantısı sonraki adımdır.

### İşlenmiş kareyi yayın ekranında gösterme

Yerel kamerayı YOLOX ile işleyip kişi kutuları çizilmiş 720p'e kadar kareleri
(varsayılan en fazla 20 FPS) ve anonim ölçümü API'ye gönderebilirsiniz.
API aktarımı kamera görüntüsünü durdurmaması için ayrı bir iş parçacığında yapılır;
bekleyen eski kareler atılır ve en güncel kare tutulur. Kareler dosyaya yazılmaz;
API yalnızca son kareyi 15 saniyeye kadar bellekte tutar. JPEG kareleri en fazla
64 KB'tır. Yayın adresi ekran
başına imzalanır ve 90 saniyede yenilenir. Kameradan gelen görüntü kampüs
ekranında görüleceği için `--publish-preview` seçeneğini yalnızca bu yayına
izin verilen ekranda kullanın.

PowerShell:

```powershell
python -m pip install -e 'apps/ai-box-agent[camera-directml]'
$env:AI_BOX_API_KEY = (Get-Content .env | Where-Object { $_ -match '^AI_BOX_API_KEY=' } | Select-Object -First 1).Split('=', 2)[1]
python apps/ai-box-agent/scripts/camera_test.py --model models/pretrained/yolox_nano.onnx --camera 0 --provider directml --gpu-index 1 --capture-width 1280 --capture-height 720 --preview-fps 10 --publish-preview
```

Bu çift GPU'lu Windows bilgisayarında DirectML `--gpu-index 1` ile RTX 5060'ı
seçiyor; başka cihazlarda adaptör numarası farklı olabilir.

Önce `pnpm dev:up` ile servisleri başlatın. `camera_test.py`, doğru API adresini
`var/dev-ports.json` dosyasından otomatik alır; `--api-url` yalnızca servisleri
elle farklı bir portta çalıştırdıysanız verin. Ardından `dev:up` çıktısındaki
yayın ekranı adresini açın. Tetiklenince
OpenCV işlenmiş kareleri MJPEG canlı akışı olarak yalnızca ana duyuru alanında
gösterir; üst bilgi, sıradaki yayınlar ve analiz paneli görünür kalır.
Kamerayı durdurmak için önizleme penceresinde `Q` veya `Esc` tuşuna basın.

`--publish-preview` kapalıyken kamera kareleri API'ye gönderilmez. Kurulu
YOLOX COCO modelleri kişi algılar; cinsiyet sınıflandırması üretmez. Böyle bir
çıktı mevcut olmadığı için kadın/erkek sayıları tahmin edilmez ve kişiler
“belirsiz” altında gösterilir. Metrik aktarım sözleşmesi yalnızca aynı izleme
kimliğiyle eşleşen, gerçekten üretilmiş sınıflandırmaları sayar.
