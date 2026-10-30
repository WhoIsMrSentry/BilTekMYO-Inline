# Model Registry

Model metadata, sürüm, checksum, giriş çözünürlüğü, sınıf listesi ve hedef
runtime bilgileri burada tutulacaktır. Büyük model dosyaları kaynak depoya
eklenmeyecektir.

Hedef edge donanımı: NVIDIA DGX Spark.

İlk model registry kaydı şu alanları zorunlu tutacaktır:

- model sürümü ve checksum
- TensorRT engine veya ONNX kaynak formatı
- CUDA/TensorRT uyumluluk bilgisi
- giriş çözünürlüğü ve sınıf listesi
- iki kamera ile beklenen throughput ve gecikme ölçümü

İlk model adapter sözleşmesi ham görüntü yerine doğrulanmış detection listesi
alır. Confidence threshold altında kalan hassas sınıflar `unknown` olur.
Tracker doğrulanmadan `entries` ve `exits` metrikleri tahmin edilmez.

## İndirilen açık kaynak test modelleri

İlk webcam/kişi algılama denemeleri için resmi Megvii YOLOX COCO ağırlıkları indirildi. Kaynak kod deposu Apache-2.0 lisanslıdır: https://github.com/Megvii-BaseDetection/YOLOX

| Model | Dosya | Girdi | İndirme boyutu | SHA-256 |
|---|---|---:|---:|---|
| YOLOX-Nano | `pretrained/yolox_nano.pth` | 416 | 7,694,953 bytes | `cd28f55fbbc1829f99d9ac9b38a16d259a22889739c8728ea877610201feff7b` |
| YOLOX-Tiny | `pretrained/yolox_tiny.pth` | 416 | 40,755,013 bytes | `9de513de589ac98bb92d3bca53b5af7b9acfa9b0bacb831f7999d0f7afaee8f0` |

Resmî ONNXRuntime yayın dosyaları da indirildi; CPU/CUDA/DirectML sağlayıcılarıyla ortak test ve sonraki TensorRT dönüşümü için kullanılacak:

| Model | Dosya | Boyut | SHA-256 |
|---|---|---:|---|
| YOLOX-Nano | `pretrained/yolox_nano.onnx` | 3,659,407 bytes | `c789161ed43c8269fcd4e67c67eeeb4e80c622da2eb296a20bc6007bd18a0b7d` |
| YOLOX-Tiny | `pretrained/yolox_tiny.onnx` | 20,219,662 bytes | `427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7` |

Ağırlıklar resmi `0.1.1rc0` sürümünden alındı. Her iki COCO modeli de `person` sınıfını algılar; Tiny daha doğru, Nano daha küçüktür. Bu `.pth` dosyaları kaynak depoya eklenmez. DGX Spark'ta seçilen TensorRT sürümüyle engine üretimi ve kamera üzerinde ölçüm ayrıca yapılmalıdır.

İndirme URL'leri:
- https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.pth
- https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.pth
