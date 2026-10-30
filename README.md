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

## Aşamalar

- [x] **Aşama 0:** Kurulum, kamera, performans ölçüm altyapısı
- [x] **Aşama 1:** Yüz noktası tespiti (478 nokta, canvas çizimi, yüz yok uyarısı)
- [x] **Aşama 2:** 2D gözlük yerleştirme (göz merkezleri, mesafe, eğim açısı, afin dönüşüm)
- [x] **Aşama 3:** 3D gözlük (Three.js): kafa pozu matrisi, 3D model, occlusion, 2D/3D geçişi
- [ ] Aşama 4: Stabilizasyon (One Euro filtresi)
- [ ] Aşama 5: Yüz şekli tahmini ve öneriler
- [ ] Aşama 6: Arayüz geliştirmeleri
- [ ] Aşama 7: Algoritma gösterim modu
- [ ] Aşama 8: Test ve rapor
