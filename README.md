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

**Model dosyaları:** Yüz modeli (`face_landmarker.task`) boyutu nedeniyle depoda yoktur. `npm run model`
komutu dosyayı Google'ın resmî MediaPipe deposundan
(`storage.googleapis.com/mediapipe-models/face_landmarker/...`) indirir ve `public/models/` klasörüne koyar.
MediaPipe'ın WASM dosyaları `npm install` ile gelen paketten `npm run dev` / `npm run build` öncesinde otomatik
kopyalanır. Kurulumdan sonra uygulama internet bağlantısı olmadan da çalışır.

**Kamera izni:** Tarayıcı izin istediğinde **İzin ver**'i seçin (Chrome önerilir). Kamera yalnızca
`localhost` ya da `https` üzerinde açılabilir.
- İzni yanlışlıkla reddettiyseniz adres çubuğundaki kamera / kilit simgesinden izin verip **Tekrar dene**'ye basın.
- macOS'ta tarayıcıya ayrıca sistem izni gerekebilir: Sistem Ayarları → Gizlilik ve Güvenlik → Kamera.
- Kamera başka bir uygulamada (Zoom, FaceTime) açıksa önce oradan kapatın.

## Kullanım

1. Sayfa açılınca kamera kendiliğinden başlar. Sağ üstteki **Kamerayı durdur / başlat** düğmesiyle kapatıp
   yeniden açabilirsiniz.
2. Kameradan 50–70 cm uzakta, düz bakarak durun. **Yüz analizi** paneli birkaç saniye içinde yaklaşık yüz
   şeklini ve size en uygun üç çerçeveyi gösterir. Ölçüm sırasında ilerleme çubuğu ve gerekirse uyarılar
   (baş dönük, ağız açık, alın kapalı vb.) görünür.
3. Kameranın altındaki **Gözlük kataloğu**ndan bir model seçin. Önerilen modeller ★ ile işaretlidir.
   Seçim anında uygulanır, kamera kesilmez.
4. Kamera üzerindeki araç çubuğundan **2D / 3D** arasında geçin, gözlüğü gizleyip gösterin.
5. **📷 Ekran görüntüsü** ile seçili gözlükle bir kare alın. Önizlemede **İndir** dosyayı bilgisayarınıza kaydeder.
6. **Teknik ayrıntılar** bölümündeki açılır paneller algoritmayı göstermek içindir: yüz noktaları ve
   yerleştirme geometrisi katmanları, One Euro filtresi ayarları ve titreme ölçümü, yerleştirme hesapları,
   model bilgisi. Alttaki çubuk FPS ile tespit, yerleştirme ve çizim sürelerini sürekli gösterir.
7. **Algoritma Modu** (araç çubuğundaki **Algoritma** kutusu ya da sağdaki **Algoritma Modu** anahtarı) işlem
   adımlarını kamera üzerinde canlı gösterir. Ayrıntılar aşağıda.

### Ekran görüntüsü ve gizlilik

- Görüntü **tamamen tarayıcıda** oluşturulur: kamera karesi, 2D gözlük canvas'ı ya da 3D (WebGL) canvas'ı
  aynı ayna dönüşümüyle tek bir PNG'de birleştirilir (`src/render/snapshot.js`).
- Birleştirme, gözlük çizildikten hemen sonra aynı kare içinde yapılır. Böylece gözlük kameraya göre kaymaz ve
  WebGL tamponu temizlenmeden okunur.
- Görüntü ya da kamera karesi **hiçbir sunucuya gönderilmez**. Uygulama kodunda ağ gönderme API'si
  kullanılmaz (bir test bunu denetler). Yalnızca **İndir**'e basarsanız dosya bilgisayarınıza kaydedilir.
- Ekran görüntüsünde yüz noktaları ve geometri katmanları yer almaz; yalnızca kamera ve gözlük vardır.

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm test` | Birim testleri (Vitest) |
| `npm run build` | Üretim derlemesi (`dist/`) |
| `npm run bench:filter` | One Euro filtresi ölçüm tablosu (titreme azalması, gecikme; 15/30/60 FPS) |
| `npm run glasses` | Parametrik çerçevelerden SVG üretir, tüm SVG'leri `public/glasses/*.png`'ye çevirir |

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
assets/        Gözlük görsellerinin SVG kaynakları (classic-black elle çizildi, diğerleri üretilir)
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

## Yüz şekli analizi ve gözlük önerileri

> Sonuç kesin bir yüz şekli teşhisi değil, yüz noktalarından hesaplanan **yaklaşık geometrik bir tahmindir**. Öneriler estetik eğilimlerdir, kural değildir.

### Ölçümler (`src/core/faceShape.js`)

| Ölçüm | Noktalar | Not |
|---|---|---|
| Alın genişliği | 54 ↔ 284 | kaş üstü, alnın iki yanı |
| Elmacık genişliği | 234 ↔ 454 | yüzün en geniş yeri, normalizasyon birimi |
| Çene genişliği | 172 ↔ 397 | çene köşeleri |
| Çene ucu genişliği | 149 ↔ 378 | çenenin sivriliği |
| Yüz uzunluğu | 10 ↔ 152 | yüz ağının üst sınırı → çene ucu (saç çizgisi değil) |
| Çene köşesi açısı | 234 – 172 – 152 | iki yanın ortalaması, küçük açı = köşeli |

Genişlikler 3D mesafedir (x, y piksel; z·genişlik), bu yüzden kafanın küçük dönmelerinden az etkilenir. Hepsi elmacık genişliğine bölünür, böylece ölçekten bağımsız beş oran elde edilir:
`L = uzunluk/elmacık`, `F = alın/elmacık`, `J = çene/elmacık`, `C = çene ucu/elmacık`, `A = çene açısı`.

### Sınıflandırma

Her şekil bir prototip oran vektörüdür. Uzaklık `d² = Σ((oran − prototip)/σ)²`, olasılık `exp(−d²/2)`'nin normalize edilmiş halidir. Referans "ortalama yüz" olarak MediaPipe model dosyasındaki kanonik yüz ağı kullanılır (L 1.153, F 0.819, J 0.775, C 0.419, A 132°). Prototipler bu ortalamadan şu yönlerde kaydırıldı:

| Şekil | L | F | J | C | A |
|---|---|---|---|---|---|
| Oval | 1.20 | 0.82 | 0.76 | 0.41 | 134° |
| Yuvarlak | 1.05 | 0.81 | 0.80 | 0.43 | 140° |
| Kare | 1.07 | 0.84 | 0.85 | 0.47 | 127° |
| Kalp | 1.15 | 0.87 | 0.72 | 0.37 | 133° |
| Uzun | 1.32 | 0.81 | 0.78 | 0.42 | 132° |
| Elmas | 1.17 | 0.75 | 0.71 | 0.38 | 136° |

σ: L 0.05, F/J/C 0.03, A 5°. En yüksek olasılık %60'ın altındaysa ya da ikinci şekle farkı %30'dan azsa sonuç "iki şekil arasında" diye gösterilir.

### Güvenilirlik kontrolleri (`src/core/faceShapeEstimator.js`)

Bir kare ölçüme ancak şu koşullarla eklenir: |yaw| ≤ 12°, |pitch| ≤ 12°, |roll| ≤ 15°; elmacık genişliği ≥ 110 px; yüz kadrajda; ağız kapalı; oranlar makul aralıkta; alın görünür. Tahmin için en az 30 geçerli kare gerekir. Son 60 karenin **medyanı** alınır. Örnekler arası yayılım (MAD) eşiği aşarsa "kararsız" denir ve tahmin verilmez.

**Alın kontrolü** (`src/core/skinCheck.js`): MediaPipe alın noktalarını saç altında da tahmin eder. Bu yüzden her 10 karede bir yanak ve alın noktalarının çevresindeki pikseller okunur ve YCrCb uzayına çevrilir. Yanaktan ten rengi modeli (Cr, Cb ortalama ± 2.5σ) çıkarılır. Alın piksellerinin %60'ından azı bu modele uyuyorsa alın kapalı sayılır.

### Öneri puanı (`src/core/recommendations.js`)

Yüz oranlarından dört tanımlayıcı (uzunluk, köşelilik, üst ağırlık, elmacık baskınlığı) ve her çerçevenin nitelikleri (köşelilik, cam derinliği, üst/alt ağırlık) çarpılarak "denge ve karşıtlık" kuralları uygulanır. Puan `50 + 18·Σ katkı` (0–100) olarak hesaplanır. Her kuralın katkısı kartta gerekçe olarak gösterilir. Ortalama yüzde tüm çerçeveler 50 puan alır.

### Çerçeveler

Altı model var: Wayfarer, Yuvarlak, Kare, Dikdörtgen, Aviator, Cat-eye. Hepsi `src/core/frameStyles.js`'teki tek bir parametrik tanımdan (süperelips cam hattı + değiştiriciler) üretilir. Bu tanım `npm run glasses` ile 2D PNG'ye, Three.js ile 3D modele dönüşür. Bu yüzden her model iki modda da aynı ölçülerle denenebilir.

### Sınırlamalar

- Prototip eşikleri gerçek yüz verisiyle **kalibre edilmedi**. Sentetik testler algoritmanın tutarlılığını doğrular, gerçek yüzlerde doğruluğu kanıtlamaz.
- Yüz uzunluğu saç çizgisinden değil yüz ağının üst sınırından ölçülür. Alnı yüksek ya da kısa kişilerde L sapabilir.
- Çene hattı sakal veya gölgede MediaPipe tahminine dayanır.
- Ten kontrolü renk tabanlıdır: tene yakın renkte saç, güçlü renkli ışık veya makyaj yanıltabilir.
- Kamera lensi (geniş açı, yakın mesafe) yüz oranlarını perspektifle bozabilir. 50 cm civarı mesafe önerilir.

## Algoritma Modu

Sunum ve anlatım içindir. Varsayılan olarak **kapalıdır**. Kapalıyken kare döngüsü bu modu tek bir `if` ile atlar:
ek çizim, hesap ya da React güncellemesi yapılmaz, panel içeriği de çizilmez.

Açıkken her karede yalnızca **mevcut hesapların çıktıları** çizilir (`computePlacement`, `measureFace`,
`FaceShapeEstimator`). Yeni bir algoritma yoktur ve filtre davranışı değişmez. Çizimler iki katmandadır:

| Katman | Aynalı mı? | İçerik |
|---|---|---|
| Nokta canvas'ı | evet (videoyla aynı ham piksel koordinatı) | noktalar, ağ, çizgiler, halkalar |
| Etiket canvas'ı (`.stage-labels`) | hayır | sayılar, 3D eksenler; ham x ekranda `genişlik − x` konumunda |

Her katman paneldeki **Katmanlar** bölümünden ayrı açılıp kapatılır:

1. **Yüz noktaları:** 478 nokta bölgelere göre renklenir: yüz ovali, göz, kaş, iris, dudak (MediaPipe kontur
   listeleri) ve burun (kanonik ağdan seçilmiş yaklaşık liste). İsteğe bağlı olarak z derinliğine göre
   renklenir ya da yüz ağı (tesselasyon) çizilir. Kritik noktalar (33, 133, 362, 263) beyaz halkayla gösterilir;
   gözlük yerleştirmesi yalnızca bu dört göz köşesine dayanır.
   **Yalnızca yüz noktaları** düğmesi diğer katmanları kapatır; noktaların gerçek yüzle hizasını tek başına
   kontrol etmek içindir. **Varsayılan katmanlar** önceki seçime döner.
2. **2D yerleştirme:**
   - Göz merkezleri: R = (p₃₃ + p₁₃₃)/2, L = (p₃₆₂ + p₂₆₃)/2.
   - Referans çizgisi: Δ = L − R, d = |Δ|, θ = atan2(Δy, Δx). Kesikli yatay çizgi θ = 0'dır.
   - Ölçek: sx = d₂D / d_görsel, sy = d₃D / d_görsel. d_görsel, PNG'deki iki göz noktası arasıdır (540 px).
   - Afin matris: a = sx·cos θ, b = sx·sin θ, c = −sy·sin θ, d = sy·cos θ. (e, f) ötelemesi görseldeki göz
     orta noktasını yüzdeki göz merkezine taşır. Canvas `setTransform(a, b, c, d, e, f)` ile
     x′ = a·x + c·y + e, y′ = b·x + d·y + f uygular.
   - Mavi kesikli dörtgen, dönüştürülmüş gözlük görselinin sınırıdır. Panel canlı matrisi gösterir.
3. **3D kafa pozu:**
   - Eksen gizmosu gözlük merkezinde çizilir: X kırmızı, Y yeşil, Z mavi (yüzün baktığı yön). Eksenler,
     filtrelenmiş kuaterniyonun dönme matrisi sütunlarıdır (`poseAxes`).
   - Sağ üst köşede yaw, pitch ve roll değerleri gösterilir.
   - Three.js dönüşümü: `quaternion` matrisin dönme kısmından gelir. `position` göz merkezidir (X = x, Y = −y).
     `scale` px/cm = d₃D / 6,3 cm'dir.
   - 3D modda occlusion maskeleri renkli gösterilebilir.
4. **One Euro filtresi:**
   - Gri halkalar ham göz merkezleri, yeşil noktalar filtreli değerlerdir. Filtre kapatılınca üst üste düşerler.
   - Panelde α = r/(r+1), r = 2π·fc·Δt formülü, minCutoff, beta ve dCutoff açıklamaları, titreme RMS
     değerleri ve ham/filtreli zaman grafiği bulunur.
5. **Yüz şekli (deneysel):**
   - Kamera üzerinde alın (54–284), elmacık (234–454), çene (172–397) ve çene ucu (149–378) genişlikleri, yüz
     uzunluğu (10–152) ve çene köşesi açıları (234–172–152, 454–397–152) çizilir. Yanlarına elmacık
     genişliğine bölünmüş oranları yazılır.
   - Panel bu karenin oranlarını, medyanı ve ortalama yüzü yan yana gösterir.
   - Altı kabul koşulu tek tek ✓/✗ ile listelenir: poz, kadraj, uzaklık, ağız, makul oran, alın. Sıra,
     tahmin edicinin reddetme önceliğiyle aynıdır (`evaluateGates`).
   - Sınıflandırma gerçek yüz verisiyle doğrulanmamıştır.
6. **Performans:**
   - Algoritma çizimi kendi süre kalemiyle (`Algoritma`) ölçülür.
   - Panel, mod açıkken ve kapalıyken alınan FPS ve kare süresi örneklerini ayrı ayrı ortalar
     (`ModeComparison`). Mod değişiminden sonraki 1,5 sn atılır.
   - FPS kamerayla sınırlı olduğundan asıl karşılaştırma kare süresidir.
   - Ölçülen CPU çizim maliyeti (Chrome, M2, 1280×720): varsayılan katmanlar ≈ 0,09 ms/kare, ağ dahil tüm
     katmanlar ≈ 0,15 ms/kare.

## Teknik sınırlamalar

- **Yüz şekli** tahmini prototip oranlara dayanır ve gerçek yüz verisiyle kalibre edilmemiştir. Yüzdeler benzerliktir,
  doğrulanmış doğruluk oranı değildir.
- **Tek yüz** takip edilir. Kadrajda birden fazla kişi varsa ilk algılanan kullanılır.
- **Işık ve kamera kalitesi** sonucu etkiler: karanlık ortam, arkadan ışık ya da düşük çözünürlük noktaları titretir,
  alın kontrolünü yanıltabilir.
- **Gözlük modelleri** parametrik olarak üretilmiştir; gerçek marka/model ölçülerini birebir yansıtmaz. Gözlük
  ölçüsü ortalama göz bebeği mesafesine (6,3 cm) göre ayarlanır.
- **3D mod** WebGL ister. Desteklenmezse uygulama 2D moda düşer. Occlusion yüz ağı ve basit bir kafa elipsoidiyle
  yapılır; saç ve kulaklar modellenmez.
- **Performans** cihaza bağlıdır. M2 MacBook'ta GPU ile yaklaşık 30 FPS ölçüldü. Zayıf cihazlarda FPS düşebilir;
  One Euro filtresi gerçek kare süresini kullandığı için davranışı FPS'ten büyük ölçüde bağımsızdır.
- **Tarayıcı:** Chrome ile test edildi. Safari ve Firefox'ta `requestVideoFrameCallback` ve WebGL davranışları
  farklılık gösterebilir; kapsamlı olarak denenmedi.
- **Ekran:** Masaüstü ve tablet (≥ 768 px) için tasarlandı; telefon ekranında çalışır ama düzen sıkışıktır.

## Aşamalar

- [x] **Aşama 0:** Kurulum, kamera, performans ölçüm altyapısı
- [x] **Aşama 1:** Yüz noktası tespiti (478 nokta, canvas çizimi, yüz yok uyarısı)
- [x] **Aşama 2:** 2D gözlük yerleştirme (göz merkezleri, mesafe, eğim açısı, afin dönüşüm)
- [x] **Aşama 3:** 3D gözlük (Three.js): kafa pozu matrisi, 3D model, occlusion, 2D/3D geçişi
- [x] **Aşama 4:** Stabilizasyon (One Euro filtresi): titreme azaltma, ham/filtreli karşılaştırma paneli (tamamlandı)
- [x] **Aşama 5:** Yüz şekli tahmini ve gözlük önerileri: oranlar, çok kareli tahmin, güvenilirlik kontrolleri, 6 çerçeve (tamamlandı)
- [x] **Aşama 6:** Profesyonel arayüz: yeni düzen, katalog, kamera durumları, ekran görüntüsü (tamamlandı)
- [x] **Aşama 7:** Algoritma Modu: landmark bölgeleri, yerleştirme geometrisi, kafa pozu eksenleri, filtre ve yüz şekli görselleştirmesi (tamamlandı)
- [ ] Aşama 8: Test ve rapor
