# BilTekMYO İnline

Okul içi ekranlarda zamanlanmış duyuru ve medya yayınlamak için yönetim paneli, API ve web player. Kamera metrikleri AI Box üzerinde anonim olarak işlenmek üzere tasarlanmıştır.

## Yerel geliştirmeyi başlatma

Gerekli olanlar: Windows PowerShell, Node.js ve pnpm. Docker Desktop isteğe bağlıdır. Docker yoksa betik API’yi bellek kipinde başlatır; içerikler API kapanınca sıfırlanır ve DOCX/PPTX dönüştürme kullanılamaz. Docker varsa PostgreSQL ve LibreOffice tabanlı dönüştürücü de başlatılır ve içerikler kalıcı saklanır.

Oynatıcı, içerik değişikliklerini açık SSE bağlantısıyla anında alır. Planlı yayınların başlangıç/bitiş saatlerini yakalamak için 30 saniyede bir yedek kontrol de yapılır.

```powershell
pnpm install
pnpm dev:up
```

Başlatma betiği `.env` dosyası yoksa `.env.example` üzerinden oluşturur. Docker kipinde şemayı uygular ve örnek ekranları ekler. Her iki kipte API’yi derler, ardından ayrı PowerShell pencerelerinde API, admin paneli ve player’ı açar. Docker’ı sonradan kurarsanız kalıcı veritabanı ve Office dönüşümü için aynı `pnpm dev:up` komutunu yeniden kullanın.

Komut varsayılan olarak admin paneli için 3001, player için 3002 ve API için 3000 portlarını kullanır. Bu portlar doluysa boş port seçer; gerçek adresleri ve log klasörünü terminal çıktısında gösterir.

- Admin panel: başlatma çıktısındaki adres
- Player: başlatma çıktısındaki adres + `/?display=display-01` (sunum/kiosk görünümü)
- API: başlatma çıktısındaki adres
- Servis logları: `var/logs/`

Docker’sız kipte ekranlar ve içerikler bellek verisidir; API’yi kapatmak bunları sıfırlar. PDF, görsel ve MP4 ekleri yerel dosyada çalışır. DOCX/PPTX ekleri için Docker converter gerekir.

İlk yerel giriş: `admin` / `change-this-local-password`. Gerçek ortamda `.env` içindeki kullanıcı adı, parola, oturum sırrı ve AI Box anahtarını mutlaka değiştirin. Durdurmak için açılan servis pencerelerini kapatın; PostgreSQL’i durdurmak için `docker compose -f infrastructure/docker/docker-compose.yml stop` çalıştırın.

## İçerik ekleri

PDF, PNG/JPEG/WebP, MP4 ve DOCX/PPTX yüklenebilir. Office belgeleri yerel converter container’ında PDF’e dönüştürülür; dönüştürücü internetten belge almaz ve yalnızca loopback üzerinde yayınlanır. Yükleme sınırı 40 MB’dir. Dosyalar uygulamanın `var/uploads` klasöründe saklanır. Admin erişimi oturumla korunur; player bağlantıları imzalıdır ve yalnızca ilgili ekranda o sırada yayınlanan içeriğe izin verir.

İçerik formundaki **Canlı yayın URL’si** alanı HTTPS HLS (`.m3u8`) ve MP4 adreslerini kabul eder. HLS tarayıcıda hls.js ile oynatılır; yayın kaynağı istemciden doğrudan alınır, sunucuda görüntü işleme yapılmaz. Harici HLS kaynaklarının CORS üzerinden oynatmaya izin vermesi gerekir. Deneme için [BBC R&D 24/7 HLS test akışını](https://rdmedia.bbc.co.uk/testcard/simulcast/manifests/avc-full.m3u8) kullanabilirsiniz.

## AI Box

`pnpm dev:up` geliştirme API’sini, veritabanını, admin panelini, player’ı ve belge dönüştürücüyü açar. Player çerçevesiz sunum görünümünde çalışır; köşedeki düğme veya `F11` tarayıcıyı tam ekrana alır. Gerçek kamera agent’ı otomatik başlatılmaz.

## Kamera ve model testi

İşletim sisteminize uygun kurulum betiği web paketlerini, AI Box Python bağımlılıklarını ve YOLOX Nano/Tiny ONNX ile `.pth` dosyalarını indirir. Ağırlıklar Git’e eklenmez; her dosya SHA-256 ile doğrulanır.

```powershell
./scripts/install.ps1 -Runtime directml
./.venv/Scripts/python.exe ./apps/ai-box-agent/scripts/camera_test.py --model ./models/pretrained/yolox_tiny.onnx --camera 0 --provider directml
```

```bash
bash scripts/install.sh --runtime cuda
./.venv/bin/python ./apps/ai-box-agent/scripts/camera_test.py --model ./models/pretrained/yolox_tiny.onnx --camera 0 --provider cuda
```

CPU denemesi için `-Runtime cpu` / `--runtime cpu` ve `--provider cpu` kullanın. Kamera testi görüntüyü yerel bilgisayarda işler; kareleri kaydetmez. DGX Spark üzerindeki TensorRT engine üretimi ve ana agent servisine üretim bağlantısı ayrıca yapılandırılmalıdır. Kurulum seçenekleri için `scripts/README-install.md` dosyasına bakın.

## Güvenlik notları

Admin API’si oturum çereziyle korunur; mutasyonlar izinli admin origin’lerinden kabul edilir. AI Box kayıt, heartbeat ve metrik yolları `AI_BOX_API_KEY` ister. Upload izinli uzantı/MIME, dosya boyutu ve temel dosya imzasıyla doğrulanır. Yerel geliştirme parolaları dağıtım için kullanılmamalıdır; HTTPS ve güçlü sırlar gerekir.


