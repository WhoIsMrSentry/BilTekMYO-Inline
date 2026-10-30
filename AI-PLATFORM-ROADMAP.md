# Çok platformlu AI Box ve ekran yol haritası

## Hedef mimari

Kamera kaynağı AI Box agent tarafından okunur. Agent modeli çalıştırır ve yalnızca kamera bazlı anonim sayaçları API'ye yollar. Ekran PC'si duyuruları ve bu sayaçları gösterir; model çalıştırmaz ve görüntü kaydetmez.

```text
USB / RTSP / test kamerası → AI Box kamera adaptörü → ortak inference sözleşmesi
  → platform runtime'ı → kişi algılama + takip → anonim metrik API'si
  → SSE → tam ekran duyuru ve metrik istemcisi
```

## Platform matrisi

| Platform | Mimari | Varsayılan runtime | Hızlandırma |
|---|---|---|---|
| Windows PC | x64 | ONNX Runtime CPU | Windows ML veya uyumlu NVIDIA CUDA sağlayıcısı |
| Linux PC/server | x64 | ONNX Runtime CPU | Uyumlu NVIDIA GPU varsa CUDA |
| NVIDIA DGX Spark | Linux ARM64 / GB10 | TensorRT | Cihaza ve kurulu TensorRT sürümüne göre DGX üzerinde üretilen engine |

ONNX, platformlar arasında taşınan ortak model biçimi olacak. TensorRT engine dosyaları Windows/Linux veya farklı donanımlar arasında ortak paket gibi kullanılmayacak; hedef DGX üzerinde yerel üretilecek. Her platform seçtiği runtime'ı aynı inference giriş/çıkış sözleşmesinin arkasında kullanacak. Gereken hızlandırıcı kurulu değilse uygulama sessizce sahte sonuç vermeyecek; CPU fallback yalnızca açıkça seçildiğinde kullanılacak.

## Ekran sözleşmesi

- Sunum istemcisi tam ekran, çerçevesiz bir tuvalde duyuruları ve kamera bazlı kişi/giriş/çıkış/doluluk tablosunu gösterir.
- İstemci son metrik snapshot'ını API'den alır; yeni sonuçlar SSE ile ekrana düşer.
- Yalnızca anonim sayılar yayınlanır; kareler, yüzler veya kimlik bilgileri ekrana/API'ye gönderilmez.
- Birden fazla kameranın sayıları tabloda ayrı satırda tutulur; kamera örtüşmesi doğrulanmadan “benzersiz kişi toplamı” iddiası üretilmez.

## Aşamalar

1. **Metrikleri ekrana bağla — tamamlandı.** API son kamera ölçümlerini anonim snapshot olarak sunuyor ve SSE ile değişiklikleri yayımlıyor. Tam ekran istemci kişi, giriş, çıkış ve tahmini doluluk tablosunu gösteriyor.
2. **Platform/runtime seçimini yap — yerel testte başladı.** ONNX kamera aracı `auto`, CPU, CUDA, DirectML ve ONNX Runtime TensorRT sağlayıcısı seçebiliyor. Bu seçim henüz uzun çalışan AI Box agent'ın komut satırına bağlanmadı.
3. **Gerçek YOLOX inference'ını bağla — kamera smoke test hazır.** Resmî Nano/Tiny ONNX dosyaları aynı decode/NMS yolundan geçiyor; Windows PC kamerasında CPU inference çalışıyor. Aynı inference sınıfını AI Box agent'a bağla ve DGX üzerinde TensorRT engine üretimini tamamla.
4. **Kamera kaynaklarını işlet.** USB/RTSP kaynaklarını çoklu kamera döngüsüne bağla. PC kamerası testinde kareler istemcide tutulmadan güvenli kamera akışıyla AI Box'a iletilsin.
5. **Platform başlatma ve saha doğrulaması.** PowerShell ve Linux shell başlatıcıları, health-check/loglar ve gerçek Windows, Linux ve DGX cihazlarında performans/sonuç doğrulaması ekle.

## Mevcut sınır

Metrik paneli ve yerel kamera smoke test hazırdır. Kamera test aracı sayaçları görüntüler, ancak API'ye göndermediği için admin/player metrik tablosuna henüz akış yoktur. AI Box agent varsayılanı hâlâ `UnconfiguredInferenceEngine`; agent'a bağlama, DGX Spark TensorRT üretimi ve Linux üzerinde saha denemesi sonraki işlerdir.

## Teknik referanslar

- [ONNX Runtime execution providers](https://onnxruntime.ai/docs/execution-providers/)
- [Windows ML ve ONNX Runtime](https://onnxruntime.ai/docs/get-started/with-windows.html)
- [TensorRT engine portability](https://docs.nvidia.com/deeplearning/tensorrt/latest/getting-started/support-matrix.html)
- [DGX Spark User Guide](https://docs.nvidia.com/dgx/dgx-spark/)
