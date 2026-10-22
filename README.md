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

## Klasör yapısı

```
src/
  core/        React'ten bağımsız, test edilebilir mantık (kamera, ölçüm, analiz)
  hooks/       React ile core arasındaki köprü (kamera, model, kare döngüsü)
  render/      Canvas / Three.js çizimleri
  components/  Arayüz bileşenleri
  styles/      CSS
tests/         Vitest birim testleri
scripts/       Yardımcı scriptler (model indirme)
```

## Aşamalar

- [x] **Aşama 0:** Kurulum, kamera, performans ölçüm altyapısı
- [x] **Aşama 1:** Yüz noktası tespiti (478 nokta, canvas çizimi, yüz yok uyarısı)
- [ ] Aşama 2: Temel 2D gözlük yerleştirme
- [ ] Aşama 3: 3D gözlük (Three.js)
- [ ] Aşama 4: Stabilizasyon (One Euro filtresi)
- [ ] Aşama 5: Yüz şekli tahmini ve öneriler
- [ ] Aşama 6: Arayüz geliştirmeleri
- [ ] Aşama 7: Algoritma gösterim modu
- [ ] Aşama 8: Test ve rapor
