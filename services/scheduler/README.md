# Scheduler Service

İçerik, playlist, zaman aralığı, öncelik ve acil yayın çözümleme servisi.

`PlaylistScheduler`, belirli bir ekran ve zaman için aktif içeriklerden snapshot
üretir. Emergency içerik varsa normal içerikleri bastırır. Tarih aralığı,
ekran eşleşmesi ve isteğe bağlı UTC haftanın günü filtresi uygulanır.
