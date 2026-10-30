# 👓 Gerçek Zamanlı Sanal Gözlük Deneme Sistemi

> **Real-time Virtual Glasses Try-On** — MediaPipe Face Landmarker · Three.js · React

Web kamerasından yüz ve yüz referans noktalarını gerçek zamanlı tespit ederek gözlük
modellerini yüze uygun konum, boyut ve açıda yerleştiren; yüz şekline göre tahmini
gözlük önerileri sunan web uygulaması.

**Teknolojiler:** React + Vite · MediaPipe Face Landmarker · Three.js · Vitest

## Kurulum

Gereksinim: Node.js 20 veya üzeri.

```bash
npm install
npm run model     # MediaPipe yüz modeli (~3.6 MB) → public/models/
npm run dev       # http://localhost:5173
```

Tarayıcı kamera izni istediğinde **İzin ver**'i seçin. Chrome önerilir.
macOS ilk seferde tarayıcı için kamera izni isteyebilir
(Sistem Ayarları → Gizlilik ve Güvenlik → Kamera).

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm test` | Birim testleri (Vitest) |
| `npm run build` | Üretim derlemesi (`dist/`) |
| `npm run bench:filter` | One Euro filtresi ölçüm tablosu (titreme azalması, gecikme; 15/30/60 FPS) |
| `npm run glasses` | `assets/glasses/*.svg` → `public/glasses/*.png` gözlük görsellerini üretir |

## Klasör yapısı

```
src/
  core/        React'ten bağımsız, test edilebilir mantık (kamera, ölçüm, analiz)
  hooks/       React ile core arasındaki köprü (kamera, model, kare döngüsü)
  render/      Canvas / Three.js çizimleri
  components/  Arayüz bileşenleri
  styles/      CSS
tests/         Vitest birim testleri
scripts/       Yardımcı scriptler (model indirme, WASM kopyalama, gözlük PNG üretimi)
assets/        Gözlük görsellerinin SVG kaynakları
```

## Görünüm modları

Sağ paneldeki **2D (PNG) / 3D (Three.js)** seçimiyle iki yöntem arasında geçiş yapılır.
3D başlatılamazsa (WebGL yok vb.) panelde uyarı çıkar, 2D mod çalışmaya devam eder.

**2D:** Göz köşelerinden göz merkezleri, gözler arası mesafe ve eğim açısı hesaplanır;
şeffaf PNG gözlük afin dönüşümle (`ctx.setTransform`) yerleştirilir.

**3D:** Kodla üretilen gözlük modeli (çerçeve, camlar, köprü, menteşeler, saplar) Three.js ile çizilir.

| Bilgi | Kaynak |
|---|---|
| Dönme (yaw, pitch, roll) | MediaPipe yüz dönüşüm matrisi (4×4, sütun öncelikli) |
| Konum | İki göz merkezinin orta noktası (landmark) |
| Ölçek | Gözler arası 3D piksel mesafesi / 6.3 cm |

Koordinat sistemleri:

- **Video pikseli:** x sağa, y aşağı, z uzağa. z normalize ve görelidir, milimetre değildir; x ile aynı ölçekte olduğu için `z · genişlik` ile piksele çevrilir.
- **Three.js dünyası:** x sağa, y yukarı, z kameraya doğru. Dönüşüm: `(x, y, z) → (x, −y, −z)`.
- **MediaPipe metrik uzayı:** eksen yönleri Three.js dünyasıyla aynı, birim cm. Bu yüzden matrisin dönme kısmı doğrudan kullanılır. Öteleme kısmı ise MediaPipe'ın varsaydığı 63°'lik sanal kameraya göredir; gerçek kameranın açısı bilinmediği için kullanılmaz.
- **Kamera:** Piksel ölçeğinde ortografik kamera (zayıf perspektif yaklaşımı). Böylece 3D gözlük, 2D'deki gibi doğrudan landmark pikselleriyle hizalanır.
- **Aynalama:** Hesaplar ham video koordinatlarında yapılır. Video, 2D ve 3D canvas'lar aynı CSS `scaleX(−1)` kapsayıcısında olduğu için birlikte aynalanır.

Occlusion (saplar kafanın arkasına geçince gizlenir):

1. Yüz ağı maskesi (MediaPipe ağından 852 üçgen, her karede güncellenir) ve kafa elipsoidi yalnızca derinlik tamponuna yazılır, ekranda görünmez.
2. Saplar derinlik testiyle çizilir, maskelerin arkasında kalan kısımları gizlenir.
3. Derinlik tamponu temizlenir, ön çerçeve en üste çizilir.

Panelden **Occlusion maskelerini göster** seçilince maskeler tel kafes olarak görünür.

## Stabilizasyon (One Euro filtresi)

MediaPipe noktaları sabit bir yüzde bile kareden kareye 1–2 piksel oynar, bu da gözlüğün titremesine yol açar. Gözlüğü yerleştiren parametreler One Euro filtresinden geçirilir (`src/core/oneEuroFilter.js`, `src/core/stabilizer.js`):

```
α  = r / (r + 1),   r = 2π · fc · Δt        (Δt = gerçek kare süresi)
dx = alçak geçiren( (x − x̂_önceki) / Δt , dCutoff )
fc = minCutoff + beta · |dx|
x̂  = x̂_önceki + α · (x − x̂_önceki)
```

Yavaş harekette kesim frekansı düşük kalır ve titreme bastırılır. Hızlı harekette `beta` sayesinde kesim frekansı yükselir, gecikme azalır.

| Kanal | Filtrelenen büyüklük | Not |
|---|---|---|
| Konum | göz orta noktası x, y, z (px) | hız, gözler arası mesafeye bölünür (yakın/uzak yüzde aynı davranış) |
| Ölçek | log(gözler arası 2D ve 3D mesafe) | oransal değişim |
| Eğim (2D) | göz çizgisi açısı θ | ±180° sınırında açı açılır, sıçrama olmaz |
| Dönme (3D) | kafa pozu kuaterniyonu | slerp ve yarıküre kontrolü (q ≡ −q), Euler sıçraması yok |

2D afin matris ve 3D poz aynı filtrelenmiş ölçümden hesaplanır, bu yüzden mod değiştirmek filtreyi sıfırlamaz. Yüz kaybolunca veya kareler arasında 0,5 sn'den uzun boşluk olunca filtre sıfırlanır. Yüz yeniden görünürse ilk kare ham değerle başlar, eski konumdan kayma olmaz.

Varsayılan parametreler: `minCutoff = 1.0 Hz`, `beta = 2.0`, `dCutoff = 1.0 Hz`. Panelden değiştirilebilir, filtre kapatılabilir. Panelde ham ve filtrelenmiş değerler, canlı titreme ölçümü ve son 5 saniyenin grafiği gösterilir.

Simülasyon sonuçları (`npm run bench:filter`, σ = 1 px gürültü, 1 IPD = 120 px):

| FPS | Konum sapması azalması | Kareden kareye titreme azalması | Ani sıçrama %90 süresi | 360 px/s harekette gecikme |
|---|---|---|---|---|
| 15 | %52,0 | %76,0 | 133 ms (2 kare) | 18,4 ms |
| 30 | %67,8 | %86,4 | 67 ms (2 kare) | 16,1 ms |
| 60 | %79,1 | %92,2 | 33 ms (2 kare) | 13,4 ms |

Karşılaştırma: düz alçak geçiren filtre (`beta = 0`) aynı harekette 159 ms geride kalır ve sıçramaya 383–467 ms'de ulaşır. Hiçbir senaryoda aşma (overshoot) olmaz.

## Aşamalar

- [x] **Aşama 0:** Kurulum, kamera, performans ölçüm altyapısı
- [x] **Aşama 1:** Yüz noktası tespiti (478 nokta, canvas çizimi, yüz yok uyarısı)
- [x] **Aşama 2:** 2D gözlük yerleştirme (göz merkezleri, mesafe, eğim açısı, afin dönüşüm)
- [x] **Aşama 3:** 3D gözlük (Three.js): kafa pozu matrisi, 3D model, occlusion, 2D/3D geçişi
- [ ] **Aşama 4:** Stabilizasyon (One Euro filtresi): kod ve testler hazır, kamera testi bekleniyor
- [ ] Aşama 5: Yüz şekli tahmini ve öneriler
- [ ] Aşama 6: Arayüz geliştirmeleri
- [ ] Aşama 7: Algoritma gösterim modu
- [ ] Aşama 8: Test ve rapor
