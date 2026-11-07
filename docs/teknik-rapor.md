# Gerçek Zamanlı Sanal Gözlük Deneme Sistemi — Teknik Rapor

**Ders:** Görüntü İşleme · **Tarih:** 31 Ekim 2026
**Kaynak kod:** https://github.com/senanurceylan/virtual-glasses-try-on

> **Okuma notu.** Bu raporda üç tür bilgi birbirinden ayrı tutulmuştur:
> - **[Gerçek ölçüm]:** gerçek kamerayla, tek bir cihazda toplanan veriler (Bölüm 13).
> - **[Sentetik]:** bilinen yapay girdilerle yapılan testler ve benchmark'lar. Algoritmanın tasarlandığı gibi
>   çalıştığını gösterir; gerçek dünya doğruluğunu kanıtlamaz.
> - **[Teorik]:** yöntemlerin formül ve gerekçeleri.
>
> Gerçek etiketli veri bulunmadığından yüz şekli sınıflandırması için doğruluk, kesinlik, duyarlılık ya da F1
> değeri **verilmemiştir**.

---

## 1. Özet

Bu çalışmada web tarayıcısında çalışan, gerçek zamanlı bir sanal gözlük deneme sistemi geliştirilmiştir.
Sistem, kullanıcının kamera görüntüsünü yalnızca istemci tarafında işler; hiçbir görüntü sunucuya gönderilmez.

- **Yüz takibi:** Her karede MediaPipe Face Landmarker ile 478 yüz noktası ve 4×4 kafa pozu matrisi elde edilir.
- **2D yerleştirme:** Gözlük görseli, göz köşelerinden hesaplanan göz merkezlerine bir afin dönüşümle
  (öteleme, dönme, anizotropik ölçek) yerleştirilir.
- **3D yerleştirme:** Parametrik olarak üretilmiş bir gözlük modeli, kafa pozu kuaterniyonu ve piksel ölçekli
  ortografik kamerayla çizilir. Gözlük saplarının kafa arkasında gizlenmesi için yüz ağı ve kafa elipsoidinden
  oluşan, yalnızca derinliğe yazan maskeler kullanılır.
- **Stabilizasyon:** Yerleştirme parametrelerindeki titreme One Euro filtresiyle azaltılır.
- **Yüz şekli ve öneri:** Normalize yüz oranlarından altı yüz şekli için prototip tabanlı, açıklanabilir bir
  tahmin üretilir ve buna göre sezgisel (heuristic) çerçeve önerileri yapılır.
- **Algoritma Modu:** Ara işlem adımları kamera görüntüsü üzerinde canlı gösterilir.

Sistem 312 otomatik testle doğrulanmıştır. Tek bir cihazda (1280×720 / 30 FPS kamera, Chrome 156, MediaPipe GPU
çıkarımı) yapılan üç tekrarlı ölçümde tüm senaryolarda ortalama hız yaklaşık 30 FPS'tir. Bu değer kameranın kare
hızı sınırıdır. Ortalama kare işleme süresi 16,6–17,3 ms arasındadır ve bu sürenin %94–98'ini yüz noktası
tespiti oluşturur.

## 2. Giriş ve problem tanımı

Gözlük alışverişinin çevrimiçi yapılması, kullanıcının çerçeveyi yüzünde görmeden seçmesini gerektirir.
Sanal deneme sistemleri bu sorunu artırılmış gerçeklik ile çözmeyi amaçlar. Problem, görüntü işleme açısından
şu alt problemlere ayrılır:

1. **Yüz geometrisinin kestirimi:** Tek bir RGB kameradan, her karede yüzün konumunu, ölçeğini ve yönünü bulmak.
2. **Geometrik yerleştirme:** Gözlük modelini bu geometriye göre görüntü düzlemine dönüştürmek.
3. **Görünürlük (occlusion):** Gözlüğün kafa tarafından örtülmesi gereken kısımlarını gizlemek.
4. **Zamansal kararlılık:** Kareden kareye oluşan tahmin gürültüsünün gözlükte titreme yaratmasını engellemek.
5. **Gerçek zamanlılık:** Tüm bunları tarayıcıda kare hızına yetişecek sürede yapmak.

Ek olarak, ölçülen yüz oranlarından yaklaşık bir yüz şekli tahmini ve buna dayalı çerçeve önerisi üretilmiştir.

## 3. Amaç ve kapsam

**Amaçlar**
- Tarayıcıda, kurulum gerektirmeden çalışan ve görüntüyü cihaz dışına çıkarmayan bir sistem.
- Hem 2D (görsel tabanlı) hem 3D (model tabanlı) yerleştirme ve aralarında kesintisiz geçiş.
- Her algoritmanın test edilebilir ve görselleştirilebilir olması (Algoritma Modu).
- Performansın ölçülebilir ve tekrar üretilebilir olması (ölçüm protokolü).

**Kapsam dışı**
- Birden fazla yüz: yalnızca bir yüz takip edilir (`numFaces = 1`).
- Gerçek marka/model gözlüklerin ölçüleri: çerçeveler parametrik olarak üretilmiştir.
- Kişiye özel göz bebeği mesafesi ölçümü: ölçek, ortalama göz bebeği mesafesi varsayımına dayanır.
- Yüz şekli sınıflandırmasının etiketli veriyle eğitimi ya da doğrulanması.
- Mobil cihazlarda ve Safari/Firefox'ta kapsamlı test.

## 4. Kullanılan teknolojiler

| Bileşen | Sürüm | Kullanım amacı |
|---|---|---|
| MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) | 1.1.1 | Face Landmarker: 478 nokta, kafa pozu matrisi |
| Three.js | 0.186.1 | 3D gözlük modeli, ortografik kamera, occlusion |
| React | 19.3.1 | Arayüz bileşenleri |
| Vite | 8.3.5 | Geliştirme sunucusu ve derleme |
| Vitest | 5.0.5 | Birim ve arayüz testleri |
| resvg-js | 2.6.2 | Yalnızca derleme betiğinde: gözlük SVG'lerinden PNG üretimi |
| Web API'leri | — | `getUserMedia` (kamera), `requestVideoFrameCallback` (kare döngüsü), Canvas 2D, WebGL |

Dış görüntü işleme kütüphanesi (ör. OpenCV) kullanılmamıştır. Geometri, filtreleme, yüz şekli ve ten kontrolü
hesapları proje içinde, React'ten bağımsız saf JavaScript modülleri (`src/core`) olarak yazılmıştır.

## 5. Sistem mimarisi ve veri akışı

### 5.1 Katmanlar

```
src/core/        Saf, test edilebilir mantık (geometri, filtre, yüz şekli, öneri, ölçüm)
src/render/      Canvas 2D ve Three.js çizimleri
src/hooks/       React ile core arasındaki köprü (kamera, model, kare döngüsü, ölçüm)
src/components/  Arayüz bileşenleri
```

### 5.2 Kare başına işlem hattı (`src/hooks/useFaceTracking.js`)

```
kamera karesi (requestVideoFrameCallback)
  → [Tespit]       MediaPipe Face Landmarker (VIDEO modu): 478 nokta + 4×4 dönüşüm matrisi
  → [Yerleştirme]  göz merkezleri, mesafe, açı; matristen kuaterniyon
                   → One Euro stabilizasyonu
                   → 2D afin matris ve 3D poz (ikisi de filtrelenmiş ölçümden)
  → [Çizim]        2D gözlük canvas'ı; nokta/geometri katmanları
  → [Algoritma]    yalnızca Algoritma Modu açıkken
  → [3D çizim]     yalnızca 3D modda: Three.js, occlusion
  → [Yüz şekli]    oran ölçümü + çok kareli tahmin; her 10 karede bir alın ten kontrolü
```

Kare döngüsü React durumuna bağlı değildir. Paneller, son sonuçları referanslar üzerinden periyodik olarak
(4–5 Hz) okur. Böylece arayüz yeniden çizimi kare döngüsünü yavaşlatmaz.

### 5.3 Görüntü katmanları ve aynalama

Video ve tüm canvas'lar aynı iç çözünürlüğe (video çözünürlüğü, ör. 1280×720) ve aynı `object-fit: cover`
yerleşimine sahiptir. Ayna görüntüsü, video ile çizim canvas'larını içeren kapsayıcıya tek bir CSS
`scaleX(−1)` dönüşümüyle verilir. Tüm hesaplar aynalanmamış ham görüntü koordinatlarında yapılır.

Yazı içeren katmanlar (Algoritma Modu etiketleri, durum göstergeleri) aynalanmamış kapsayıcıdadır. Bu katmanda
ham x koordinatı ekranda `W − x` konumuna yazılır. Hizalamanın doğruluğu Bölüm 12'deki testlerle sınanmıştır.

### 5.4 Gizlilik

Görüntü işleme tamamen tarayıcıda yapılır. Ekran görüntüsü ve ölçüm sonuçları yalnızca kullanıcının
bilgisayarına indirilir. Kaynak kodda ağ isteği yapan bir çağrı (`fetch`, `XMLHttpRequest`, `sendBeacon`,
`WebSocket`) bulunmadığı bir testle denetlenir. Yalnızca model ve WASM dosyaları uygulamanın kendi
sunucusundan yüklenir.

## 6. Yüz landmark tespiti

### 6.1 Model [Teorik]

Google'ın MediaPipe Face Landmarker görevi kullanılmıştır [1]. Model paketi iki aşamalıdır:
1. **BlazeFace** tabanlı yüz tespit edicisi yüzü bulur [2].
2. **Yüz ağı modeli** yüz bölgesinden 478 adet 3D noktayı kestirir: 468 yüz yüzeyi noktası ve 10 iris
   noktası [3][4].

Paket, isteğe bağlı olarak bir dönüşüm matrisi de üretir. Bu matris, kanonik (ortalama) yüz modelinin metrik
uzaydaki noktalarını o kareye eşleyen katı dönüşümü Procrustes analiziyle kestirir [5]. Noktalar normalize
koordinatlardadır:
- x, y ∈ [0, 1], görüntü genişliği ve yüksekliğine göre;
- z göreli derinliktir ve x ile yaklaşık aynı ölçektedir; mutlak mesafe değildir.

### 6.2 Uygulama (`src/core/faceLandmarker.js`)

| Ayar | Değer |
|---|---|
| Çalışma modu | `VIDEO` (kareler zaman damgasıyla; model kareler arası takip yapar) |
| `numFaces` | 1 |
| `minFaceDetectionConfidence`, `minFacePresenceConfidence`, `minTrackingConfidence` | 0,5 (varsayılan değerler [1]) |
| Dönüşüm matrisi | açık (`outputFacialTransformationMatrixes`) |
| Blendshape | kapalı (kullanılmıyor) |
| Hızlandırıcı | önce GPU (WebGL), başarısız olursa CPU |

Piksel dönüşümü: `p = (x·W, y·H, z·W)`. Burada W, H video çözünürlüğüdür.

Yüz var/yok durumu histerezisle izlenir (`facePresence.js`):
- 8 kare art arda yüz bulunamazsa "kayıp" sayılır;
- yüz 2 kare art arda bulunursa yeniden "görünür" olur.

Tek karelik tespit kaçırmaları kullanıcı uyarısını yanıp söndürmez.

### 6.3 Bölge sınıflandırması (Algoritma Modu)

Noktalar görselleştirme için yedi bölgeye ayrılır: yüz ovali, göz, kaş, iris, dudak, burun, diğer.
- **Oval, göz, kaş, iris ve dudak:** MediaPipe'ın kontur bağlantı listelerinden alınır.
- **Burun:** Kütüphanenin bu sürümü burun konturu vermediğinden, kanonik yüz ağından seçilmiş yaklaşık
  40 noktalık bir listedir.

Bölgelerin anatomik yerleri, model dosyasındaki kanonik yüz ağı üzerinde otomatik testle doğrulanmıştır
[Sentetik]:
- kaşlar gözlerin üstünde;
- burun orta hatta, göz ile dudak arasında ve yüzün en önünde;
- dudaklar burnun altında;
- oval noktaları yüz çevresinde.

## 7. 2D gözlük yerleştirme ve geometrik dönüşümler

### 7.1 Göz merkezleri ve referans çizgisi (`src/core/eyeGeometry.js`)

Göz bebeği yerine göz köşeleri kullanılır, çünkü göz köşeleri bakış yönünden etkilenmez:

- R = (p₃₃ + p₁₃₃) / 2: kişinin sağ gözü (dış ve iç köşe)
- L = (p₃₆₂ + p₂₆₃) / 2: kişinin sol gözü

Bu iki merkezden şu büyüklükler türetilir:
- Δ = L − R
- d₂D = √(Δx² + Δy²)
- d₃D = √(Δx² + Δy² + Δz²)
- θ = atan2(Δy, Δx)
- merkez c = (R + L) / 2

### 7.2 Afin dönüşüm [Teorik + uygulama]

Gözlük görseli 1200×460 piksellik bir PNG'dir. Görseldeki göz noktaları (çapalar) a_R = (330, 200) ve
a_L = (870, 200) konumundadır; aralarındaki mesafe d_g = 540 px, açıları θ_g = 0'dır. Dönüşüm, görseli bu
çapalar yüzdeki göz merkezlerine oturacak şekilde ölçekler, döndürür ve öteler [6]:

```
sx = d₂D / d_g          sy = d₃D / d_g          φ = θ − θ_g
a = sx·cos φ            c = −sy·sin φ
b = sx·sin φ            d =  sy·cos φ
e = c_x − (a·m_x + c·m_y)      f = c_y − (b·m_x + d·m_y)      (m: çapaların orta noktası)

x′ = a·x + c·y + e
y′ = b·x + d·y + f      → Canvas setTransform(a, b, c, d, e, f)
```

**Anizotropik ölçek (sx ≠ sy).** Kafa yana döndüğünde göz çizgisinin görüntüdeki izdüşümü (d₂D) kısalır.
Derinlik bileşenini içeren d₃D ise yaklaşık sabit kalır. Yatay ölçeğin d₂D'den, dikey ölçeğin d₃D'den alınması,
düz bir görselde yanal dönüşün yaklaşık bir karşılığıdır. Gerçek bir perspektif dönüşüm değildir; büyük yaw
açılarında 3D mod tercih edilmelidir.

## 8. 3D kafa pozu ve occlusion

### 8.1 Koordinat sistemleri (`src/core/headPose.js`)

| Uzay | Eksenler |
|---|---|
| Video pikseli | x sağa, y aşağı, z kameradan uzağa |
| Three.js dünyası (bu projede) | X = x, Y = −y, Z = −z (x sağa, y yukarı, z kameraya doğru) |
| MediaPipe metrik uzayı | sağ el kuralı, y yukarı, z kameraya doğru, birim cm [5] |

### 8.2 Poz

- **Dönme:** Dönüşüm matrisi ayrıştırılır (konum, kuaterniyon, ölçek). Yalnızca dönme kısmı (birim
  kuaterniyon) kullanılır. Euler açıları 'YXZ' sırasıyla raporlanır: yaw (y), pitch (x), roll (z).
- **Konum ve ölçek:** Matrisin öteleme kısmı MediaPipe'ın varsaydığı sanal perspektif kameraya göredir. Gerçek
  kameranın iç parametreleri bilinmediğinden konum ve ölçek matristen alınmaz; landmark'lardan hesaplanır:
  - konum = göz merkezi c'nin dünya koordinatı (c_x, −c_y, −c_z);
  - ölçek: px/cm = d₃D / 6,3 cm.
- **Ölçek varsayımı:** 3D model santimetre cinsinden kurulmuştur. 6,3 cm, yetişkin göz bebeği mesafesi için
  literatürde verilen ortalamaya yakın bir değerdir [7]. Gerçek mesafe kişiden kişiye değiştiğinden, gözlüğün
  mutlak boyutu yaklaşıktır.

### 8.3 Kamera modeli (`src/render/three/GlassesScene.js`)

Sahne, sınırları video pikselleriyle çakışan bir ortografik kamerayla çizilir. Böylece 3D gözlük 2D moddakiyle
aynı göz merkezine oturur. Bu, zayıf perspektif (weak perspective) yaklaşımıdır [6]: Webcam senaryosunda yüzün
kameraya uzaklığı yüzün kendi derinliğinden çok büyük olduğundan, perspektif bozulması küçüktür. Yaklaşımın
avantajı gerçek kameranın görüş açısını gerektirmemesidir.

### 8.4 Occlusion (`src/render/three/occluders.js`)

Gözlük sapları kafa yana döndüğünde kafanın arkasında kalmalıdır. Bunun için renk tamponuna yazmayan
(`colorWrite = false`), yalnızca derinlik tamponuna yazan iki görünmez maske kullanılır [8]:

1. **Yüz ağı maskesi:** 478 noktadan her karede güncellenen gerçek yüz yüzeyi. Üçgenler MediaPipe tesselasyon
   kenarlarından elde edilir.
2. **Kafa elipsoidi:** Yüz ağı kafanın yalnızca önünü kapsar. Arka kısım için kafa pozuna bağlı bir elipsoid
   kullanılır (yerel merkez (0; 1,0; −8,6) cm, yarıçaplar (6,9; 9,2; 9,6) cm).

Çizim iki geçişte yapılır:
1. Maskeler (`renderOrder = −1`) ve saplar çizilir. Saplar derinlik testinden geçemezse gizlenir.
2. Derinlik tamponu temizlenir; ön çerçeve, camlar ve köprü çizilir. Böylece ön çerçeve burunla kesişip
   kırpılmaz.

**Sınırlama:** Saç ve kulaklar modellenmemiştir; elipsoid kaba bir kafa yaklaşımıdır.

## 9. One Euro filtresi

### 9.1 Yöntem [Teorik] (Casiez, Roussel ve Vogel [9])

```
α(fc, Δt) = r / (r + 1),   r = 2π · fc · Δt
ẋ  = (x − x̂ₖ₋₁) / Δt
ẋ̂ = ẋ̂ₖ₋₁ + α(dCutoff, Δt) · (ẋ − ẋ̂ₖ₋₁)
fc = minCutoff + β · |ẋ̂|
x̂ = x̂ₖ₋₁ + α(fc, Δt) · (x − x̂ₖ₋₁)
```

- Yavaş harekette fc ≈ minCutoff olur ve güçlü yumuşatma yapılır (titreme azalır).
- Hızlı harekette fc büyür ve filtre ham değeri yakından izler (gecikme azalır).
- Δt gerçek kare zaman damgalarından alınır. Böylece filtre farklı FPS'lerde saniye cinsinden benzer davranır.

### 9.2 Uygulama (`src/core/oneEuroFilter.js`, `src/core/stabilizer.js`)

Parametreler: minCutoff = 1,0 Hz, β = 2,0, dCutoff = 1,0 Hz (arayüzden ayarlanabilir).

| Kanal | Filtrelenen büyüklük | Normalizasyon |
|---|---|---|
| Konum | göz orta noktası (x, y, z) | hız, göz arası mesafeye bölünür ("saniyede kaç IPD"), böylece β uzaklıktan bağımsızdır |
| Ölçek | log d₂D, log d₃D | oransal değişim |
| Açı | θ | ±π sarmasına karşı açı farkı sarılır |
| Dönme | kuaterniyon | açısal hız; yumuşatma küresel doğrusal ara değerle (slerp) [10] |

- **Ortak durum:** 2D ve 3D modlar aynı filtrelenmiş durumu kullanır. Bu yüzden modlar arası geçişte sıçrama olmaz.
- **Sıfırlama:** Yüz kaybolduğunda ya da kareler arasında 0,5 sn'den uzun boşluk olduğunda filtre durumu
  sıfırlanır. Böylece yeniden görünen yüz eski konumdan "kayarak" gelmez.

## 10. Yüz şekli sınıflandırması

> **Önemli:** Bu bölümdeki sınıflandırma, gerçek etiketli bir yüz veri kümesiyle eğitilmemiş ve
> doğrulanmamıştır. Prototip değerleri, kanonik yüz modeline göre literatürdeki niteliksel tanımlar yönünde
> elle belirlenmiştir. Sonuç, kullanıcıya "yaklaşık tahmin" olarak sunulur.

### 10.1 Ölçümler (`src/core/faceShape.js`)

| Ölçü | Landmark'lar | Uzay |
|---|---|---|
| Alın genişliği | 54 ↔ 284 | 3D |
| Elmacık genişliği (normalizasyon birimi) | 234 ↔ 454 | 3D |
| Çene genişliği | 172 ↔ 397 | 3D |
| Çene ucu genişliği | 149 ↔ 378 | 3D |
| Yüz uzunluğu | 10 ↔ 152 | 3D |
| Çene köşesi açısı | 234–172–152 ve 454–397–152 (iki yanın ortalaması) | 2D |
| Ağız açıklığı | iç dudak çiftleri 13↔14, 82↔87, 312↔317 ortalaması | 3D |

**Normalize oranlar** (ölçek ve uzaklıktan bağımsız):
- L = uzunluk / elmacık
- F = alın / elmacık
- J = çene / elmacık
- C = çene ucu / elmacık
- A = çene köşesi açısı (°)

Kanonik yüzde bu değerler L = 1,153, F = 0,819, J = 0,775, C = 0,419, A = 132,2°'dir.

### 10.2 Sınıflandırma

Her şekil bir prototip vektörüyle tanımlanır:

| Şekil | L | F | J | C | A (°) |
|---|---|---|---|---|---|
| Oval | 1,20 | 0,82 | 0,76 | 0,41 | 134 |
| Yuvarlak | 1,05 | 0,81 | 0,80 | 0,43 | 140 |
| Kare | 1,07 | 0,84 | 0,85 | 0,47 | 127 |
| Kalp | 1,15 | 0,87 | 0,72 | 0,37 | 133 |
| Uzun | 1,32 | 0,81 | 0,78 | 0,42 | 132 |
| Elmas | 1,17 | 0,75 | 0,71 | 0,38 | 136 |

Ölçek parametreleri σ_L = 0,05, σ_F = σ_J = σ_C = 0,03 ve σ_A = 5°'dir. Sınıflandırma şöyle yapılır:

```
d²(s) = Σₖ ((rₖ − protoₖ(s)) / σₖ)²
P(s)  = exp(−d²(s)/2) / Σ_s′ exp(−d²(s′)/2)
```

En yüksek olasılıklı şekil tahmindir. Sonuç ancak P ≥ 0,6 ve ikinci şekle göre fark ≥ 0,3 ise "belirgin"
olarak sunulur; aksi halde iki şekil arasında kalındığı belirtilir. P değeri bir benzerlik ölçüsüdür;
**doğrulanmış bir doğruluk oranı değildir.**

### 10.3 Güvenilirlik koşulları (`src/core/faceShapeEstimator.js`)

Bir karenin ölçümü yalnızca aşağıdaki koşulların hepsi sağlanırsa örneğe eklenir. İlk sağlanmayan koşul
kullanıcıya bildirilir.

1. **Baş düz:** |yaw| ≤ 12°, |pitch| ≤ 12°, |roll| ≤ 15°.
2. **Kadraj:** Ölçülen noktalar kadraj içinde.
3. **Uzaklık:** Elmacık genişliği ≥ 110 px.
4. **Ağız kapalı.** Açık ağız çeneyi indirip L'yi büyütür. Histerezis uygulanır: açıklık > 0,045 olunca "açık"
   durumuna geçilir, < 0,03 olunca çıkılır.
5. **Makul oranlar:** Oranlar makul aralıkta ve iki çene açısı farkı ≤ 15°.
6. **Alın görünür.** Ten oranı ≥ 0,6. Bu oran YCrCb uzayında yanak ten modeline göre hesaplanır [11]:
   - eşikler: |ΔCr|, |ΔCb| ≤ max(2,5σ, 6) ve Y ≥ 0,55·μ_Y;
   - her 10 karede bir, en uzun kenarı 160 px'e küçültülmüş görüntüden örneklenir.

Kararlılık için son 60 geçerli örneğin her oranda **medyanı** alınır. En az 30 örnek gerekir. Medyan mutlak
sapma (MAD) eşiği aşılırsa ölçüm "kararsız" sayılır ve tahmin verilmez. Yüz 15 kare boyunca görünmezse
örnekler silinir; kameranın önüne başka biri geçmiş olabilir.

### 10.4 Değerlendirme

**[Sentetik]** 51 test, istenen oranlara sahip sentetik yüzlerle şunları doğrular:
- ölçümlerin oranları geri bulması;
- ölçek ve roll değişimine dayanıklılık;
- küçük yaw'da (±10°) kararlılık;
- büyük yaw'da (25°) çene açısının bozulduğunun ve bu yüzden reddedildiğinin gösterilmesi;
- ağız histerezisi;
- medyanın aykırı karelere dayanıklılığı.

Bu testler algoritmanın **iç tutarlılığını** gösterir: prototipe göre üretilmiş bir yüz o prototip olarak
sınıflanır. Gerçek yüzlerde sınıflandırma doğruluğu hakkında bilgi vermez. Gerçek etiketli veri olmadığından
doğruluk, kesinlik, duyarlılık ya da F1 değeri raporlanmamıştır.

**[Gerçek gözlem, nitel]** Gerçek kamera testlerinde güvenilirlik koşullarının (baş dönük, ağız açık, uzak,
saç alnı kapatıyor) uyarıları beklendiği gibi verdiği gözlenmiştir. Bu gözlem tahminin doğru olduğu anlamına
gelmez.

## 11. Gözlük öneri sistemi

Öneriler, optik perakendede yaygın olan "denge ve karşıtlık" ilkesinin sayısal bir yorumudur. Bilimsel olarak
doğrulanmış bir model değil, **estetik/sezgisel (heuristic) bir yaklaşımdır.** Puan, yüz şekli etiketine değil
doğrudan ölçülen oranlara dayanır. Böylece iki şekil arasında kalan yüzler de tutarlı puan alır
(`src/core/recommendations.js`).

**Yüz tanımlayıcıları** (kanonik yüze göre, [−2, 2] ile sınırlı):

```
uzunluk     = (L − 1,153) / 0,08
köşelilik   = (132,2 − A) / 6
üst ağırlık = ((F − J) − 0,044) / 0,06
elmacık     = (0,797 − (F + J)/2) / 0,035
```

**Çerçeve nitelikleri:** köşelilik ∈ [0, 1], üst ağırlık, alt ağırlık ve cam derinliği (yükseklik/genişlik).
Altı çerçeve tek bir parametrik tanımdan (süper elips cam ve kenar parametreleri) hem 2D görsel hem 3D model
olarak üretilir: Wayfarer, Yuvarlak, Kare, Dikdörtgen, Aviator, Cat-eye.

**Kurallar** (puan = 50 + 18·Σ ağırlık·katkı, [0, 100] ile sınırlı):

| Kural | Ağırlık | İlke |
|---|---|---|
| Karşıtlık | 1,3 | köşeli yüz → yuvarlak çerçeve; yumuşak hatlı yüz → köşeli çerçeve |
| Uzunluk | 0,8 | uzun yüz → derin cam; kısa yüz → sığ, geniş cam |
| Denge | 0,8 | alnı geniş yüz → altı ağır çerçeve; çenesi baskın yüz → üstü ağır çerçeve |
| Elmacık | 0,6 | elmacık baskın yüz → üst kenarı vurgulu, yumuşak hatlı çerçeve |

Her öneri, katkısı belirgin kuralların metinsel gerekçesiyle sunulur. **[Sentetik]** 41 test kuralların
tutarlılığını sınar; örneğin kare yüzde yuvarlak çerçevenin ilk üçte, yuvarlak yüzde köşeli ve sığ
dikdörtgen çerçevenin önde olması. Bu testler önerilerin kullanıcı memnuniyetini ölçmez.

## 12. Testler ve deneysel değerlendirme

### 12.1 Otomatik testler [Sentetik]

`npm test` ile 23 dosyada **312 test** çalışır ve hepsi başarılıdır (31.10.2026).

| Alan | Dosyalar (test sayısı) |
|---|---|
| Kamera ve durum makinesi | camera (5), cameraController (8), facePresence (6) |
| Landmark ve hizalama | landmarkUtils (4), landmarkOverlay (6), faceContours (2), faceMesh (4), landmarkAlignment (13) |
| 2D geometri | eyeGeometry (15), glassesRenderer (3) |
| 3D poz ve model | headPose (17), glassesModel3D (10), occluders (4) |
| Stabilizasyon | oneEuroFilter (24), stabilizer (10) |
| Yüz şekli, ten kontrolü ve öneri | faceShape (51), faceShapePanel (5), recommendations (41; ten kontrolü testleri dahil) |
| Algoritma Modu | algorithmMode (34) |
| Ölçüm altyapısı | benchmark (18), perfMonitor (7) |
| Arayüz ve ekran görüntüsü | ui (18), snapshot (7) |

Öne çıkan doğrulamalar:
- **Landmark hizalama:** MediaPipe kanonik yüz ağı 6 farklı baş pozuna döndürülüp ölçeklendiğinde, 478 noktanın
  her biri tam landmark pikseline çizilir. Göz köşesi noktaları gözlüğün kullandığı göz merkezleriyle aynıdır.
  Aynalanmamış etiket katmanı aynı noktayı `W − x` konumuna yazar. İki kasıtlı hata (aynalı çizim, yanlış bölge
  rengi) eklendiğinde bu testlerin başarısız olduğu ayrıca doğrulanmıştır.
- **Kafa pozu:** Bilinen Euler açılarından üretilen matrislerden yaw/pitch/roll ve işaret yönleri geri bulunur.
  3D konumun göz merkezlerinin orta noktası, ölçeğin d₃D / 6,3 cm olduğu ve yüz yaklaşınca ölçeğin oransal
  büyüdüğü doğrulanır.
- **Gizlilik:** Kaynak kodda ağ isteği yapan çağrı bulunmaz.

### 12.2 Sentetik filtre benchmark'ı [Sentetik] (`npm run bench:filter`)

Girdiler yapaydır: σ = 1 px beyaz gürültü, 120 px (1 IPD) ani sıçrama ve 360 px/s sabit hızlı hareket.
Bu girdiler gerçek kamera gürültüsünü temsil etmeyebilir.

| Durum | 15 FPS | 30 FPS | 60 FPS |
|---|---|---|---|
| Sabit yüz, kareden kareye titreme azalması | %76,0 | %86,4 | %92,2 |
| Ani sıçramada %90'a ulaşma süresi | 133 ms | 67 ms | 33 ms |
| Aynı, β = 0 (düz alçak geçiren) | 467 ms | 433 ms | 383 ms |
| 360 px/s harekette gecikme | 18,4 ms | 16,1 ms | 13,4 ms |

Sentetik sonuç, hız terimi (β) sayesinde düz alçak geçiren filtreye göre gecikmenin büyük ölçüde azaldığını
gösterir. Gerçek kamera sonuçları (Bölüm 13.4) ayrıca ve farklı biçimde değerlendirilmelidir.

### 12.3 Gerçek kamera ile işlevsel kontroller [Gerçek gözlem, nitel]

Her geliştirme aşamasının sonunda kullanıcı gerçek kamerayla kontrol listeleri uygulamıştır. Doğrulanan
işlevler:
- kamera başlatma/durdurma ve izin hataları;
- 478 noktanın ve renkli bölgelerin yüzle hizası;
- baş hareketlerinin izlenmesi;
- 2D ve 3D yerleştirme;
- occlusion;
- ham/filtreli karşılaştırma;
- yüz şekli kabul koşulları ve ağız histerezisi;
- ekran görüntüsü.

Bu kontroller nitel gözlemdir; sayısal bir doğruluk ölçüsü değildir.

## 13. Performans karşılaştırmaları [Gerçek ölçüm]

### 13.1 Ortam ve yöntem

| Özellik | Değer |
|---|---|
| Cihaz | Tek bir Mac bilgisayar (model bilgisi ölçüm dosyalarında yok; rapora eklenecek) |
| Tarayıcı | Chrome 156 |
| MediaPipe çıkarımı | GPU (WebGL) |
| Kamera | 1280×720, 30 FPS |
| Protokol | 7 senaryo × (3 sn ısınma + 10 sn kayıt), **3 tam tekrar** (31.10.2026) |
| Ham veri | `docs/olcumler/olcum-2026-10-31-15-33.json`, `-15-38.json`, `-15-39.json` |
| Tablo üretimi | `node scripts/summarize-measurements.mjs` |

Dördüncü dosya (`-15-36.json`) yalnızca S1–S3'ü içeren ara bir dışa aktarımdır. İçindeki değerler `-15-38`
dosyasıyla aynıdır; ayrı bir tekrar olarak sayılmamıştır.

Ölçüm altyapısı (`src/core/benchmark.js`) her karenin şu verilerini kaydeder:
- kare aralığı ve işlem süresi;
- aşama süreleri;
- ham ve filtreli göz orta noktası.

Bu verilerden ortalama, p95, titreme (ardışık karelerde göz orta noktası yer değiştirmesinin RMS'i) ve gecikme
(filtreli dizinin ham diziye en iyi oturduğu zaman kayması) hesaplanır.

**Ölçüm sınırlamaları:**
- Tüm sonuçlar tek cihaz, tek kamera ve tek kullanıcıyla alınmıştır; başka donanımlara genellenemez.
- 30 FPS, kameranın kare hızıdır. Ölçülen FPS'in bu değere eşit olması sistemin daha hızlı çalışamayacağı
  anlamına gelmez; kare hızının işlem tarafından düşürülmediğini gösterir.
- Chrome, `performance.now()` çözünürlüğünü bu ortamda 0,1 ms'ye sınırlar. Yerleştirme ve çizim gibi
  0,1 ms'nin altındaki aşamaların ortalamaları yaklaşıktır. p95 değerlerinin tam 0,100 çıkması bu
  çözünürlükten kaynaklanır.
- Senaryolar ardışık çalıştırıldığından ortam koşulları (ışık, kullanıcının duruşu) tekrarlar arasında
  değişebilir.

### 13.2 Kare hızı ve kare işleme süresi

Değerler üç tekrarın ortalamasıdır; köşeli parantez içinde en küçük–en büyük değer verilmiştir.

| Senaryo | FPS | Kare süresi ort (ms) | Kare süresi p95 (ms) | Kare aralığı p95 (ms) | Yüz bulunan kare (%) |
|---|---|---|---|---|---|
| S1 2D, Algoritma kapalı, filtre açık (referans) | 30,00 [30,00–30,00] | 17,21 [16,33–17,90] | 21,84 [21,10–23,00] | 39,6 [34,4–50,0] | 100 |
| S2 2D, Algoritma açık (varsayılan) | 29,98 [29,95–30,00] | 16,56 [15,47–18,12] | 21,38 [20,33–22,31] | 38,2 [34,7–43,8] | 100 |
| S3 2D, Algoritma açık (tüm katmanlar) | 30,00 [30,00–30,00] | 17,29 [16,96–17,53] | 22,20 [21,40–23,71] | 44,0 [34,9–49,6] | 100 |
| S4 3D, Algoritma kapalı | 30,00 [30,00–30,00] | 17,05 [15,56–18,35] | 21,77 [21,40–22,40] | 37,8 [34,3–44,8] | 100 |
| S5 2D, filtre kapalı, sabit baş | 29,95 [29,95–29,95] | 16,77 [16,02–17,68] | 20,73 [20,20–21,20] | 44,9 [34,4–50,1] | 100 |
| S6 2D, filtre açık, hareketli baş | 29,94 [29,85–30,00] | 17,01 [16,68–17,47] | 22,47 [22,01–22,80] | 41,5 [34,4–46,0] | 87,3 [75,3–100] |
| S7 2D, filtre kapalı, hareketli baş | 29,98 [29,95–30,00] | 17,18 [16,48–17,63] | 22,20 [20,50–24,10] | 42,9 [39,0–50,0] | 92,7 [78,0–100] |

### 13.3 Aşama süreleri (ortalama, ms)

| Senaryo | Tespit | Yerleştirme | Çizim | 3D çizim | Algoritma | Yüz şekli |
|---|---|---|---|---|---|---|
| S1 | 16,77 | 0,016 | 0,021 | – | – | 0,395 |
| S2 | 15,95 | 0,012 | 0,019 | – | 0,177 [0,166–0,184] | 0,388 |
| S3 | 16,29 | 0,017 | 0,018 | – | 0,604 [0,598–0,609] | 0,350 |
| S4 | 16,30 | 0,015 | 0,010 | 0,314 [0,303–0,322] | – | 0,406 |
| S5 | 16,38 | 0,011 | 0,022 | – | – | 0,349 |
| S6 | 16,66 | 0,017 | 0,022 | – | – | 0,300 |
| S7 | 16,84 | 0,009 | 0,018 | – | – | 0,300 |

p95 değerleri: Tespit 19,9–21,9 ms; Algoritma 0,3 ms (varsayılan) ve 0,7 ms (tüm katmanlar); 3D çizim
0,43 ms; Yüz şekli 2,2–2,9 ms. Tablonun tamamı ölçüm betiğinin çıktısındadır.

### 13.4 Bulgular ve yorum

1. **Gerçek zamanlılık.** Tüm senaryolarda ortalama FPS kamera sınırına (≈30) eşittir. Ortalama kare süresi
   (16,6–17,3 ms) ve p95 kare süresi (20,7–22,5 ms), 30 FPS'in kare bütçesi olan 33,3 ms'nin altındadır.
2. **Darboğaz.** Kare süresinin %94–98'i MediaPipe tespitidir (≈16–17 ms). Projede yazılan
   yerleştirme, filtre ve 2D çizim hesapları kare başına 0,1 ms'nin altındadır.
3. **Algoritma Modu maliyeti.** Doğrudan ölçülen ek çizim süresi varsayılan katmanlarda ≈0,18 ms, tüm
   katmanlarda ≈0,60 ms'dir. Toplam kare süresinde S1→S2 farkı −0,65 ms, S2→S3 farkı +0,73 ms çıkmıştır.
   Ancak tekrarlar arası değişim (ör. S1'de 16,33–17,90 ms) bu farklardan büyüktür. Bu nedenle toplam kare
   süresi farkları Algoritma Modu'na **atfedilemez.** Maliyet en doğru biçimde doğrudan ölçülen "Algoritma"
   aşama süresiyle ifade edilir.
4. **3D maliyeti.** Three.js çizimi ≈0,31 ms'dir (p95 ≈0,43 ms). 2D/3D arasında toplam kare süresi farkı
   tekrarlar arası değişimin içinde kalmıştır.
5. **Yüz şekli p95.** Ortalama ≈0,3–0,4 ms iken p95 ≈2,4 ms'dir. Fark, her 10 karede bir yapılan alın ten
   kontrolündeki piksel okumasından (`getImageData`) kaynaklanır.
6. **Kare aralığı p95.** Değerin 34–50 ms aralığında olması, kayıtların bir kısmında ara sıra bir kamera
   karesinin atlandığını (≈50 ms = iki kare aralığı) gösterir. Ortalama FPS'e etkisi %0,5'ten küçüktür.

### 13.5 Stabilizasyon: gerçek kamera sonuçları

Titreme, filtre açıkken aynı kayıtta hem ham hem filtreli dizi üzerinden ölçülür. Bu nedenle "azalma" değeri
aynı karelerin ham ve filtreli hâllerinin karşılaştırmasıdır.

**Sabit baş koşulunun denetimi.** Sabit baş senaryolarında (S1–S5), göz orta noktasının x yönündeki hareket
genliği 0,3·IPD'yi aşmışsa baş sabit tutulmamış kabul edilmiştir. Bu ölçüt S3 ve S4'ün 2 tekrarını, S5'in
2 tekrarını dışarıda bırakmıştır. O tekrarlarda genlik 33–129 px'tir. Bu tekrarların titreme değeri gerçek baş
hareketini içerdiğinden aşağıdaki tabloya alınmamıştır (ayrıntı: ölçüm betiği Tablo D).

| Senaryo | Geçerli tekrar | Titreme ham (px) | Titreme filtreli (px) | Filtreli / IPD (%) | Azalma (%) |
|---|---|---|---|---|---|
| S1 (filtre açık) | 3/3 | 0,41 [0,31–0,60] | 0,32 [0,22–0,51] | 0,34 | 22,1 [14,2–29,3] |
| S2 (filtre açık) | 3/3 | 0,25 [0,21–0,28] | 0,18 [0,15–0,21] | 0,19 | 27,9 [25,4–30,3] |
| S3 (filtre açık) | 1/3 | 0,15 | 0,11 | 0,12 | 25,7 |
| S4 (filtre açık, 3D) | 1/3 | 0,48 | 0,42 | 0,45 | 12,7 |
| S5 (filtre kapalı) | 1/3 | 0,32 | 0,32 | 0,34 | 0 (tanım gereği) |

IPD burada göz merkezleri arası 3D piksel mesafesidir (≈91–97 px).

**Yorum.**
- Baş sabitken One Euro filtresi göz orta noktasının kareden kareye titremesini bu cihazda, geçerli
  tekrarlarda %13–30 (S1–S2 ortalaması ≈%22–28) azaltmıştır.
- Ham titreme zaten küçüktür: ≈0,2–0,6 px, yani göz arası mesafenin ≈%0,2–0,6'sı.
- Gerçek azalma, sentetik benchmark'taki %86'dan belirgin biçimde düşüktür. Olası açıklamalar şunlardır;
  bunlar **sınanmamış varsayımlardır:**
  - MediaPipe VIDEO modunun kareler arası takip yaptığından ham çıktının zaten kısmen yumuşak olması;
  - "sabit" başta da bulunan nefes, duruş salınımı gibi düşük frekanslı gerçek hareketlerin filtrenin geçirmek
    üzere tasarlandığı bantta kalması;
  - sentetik testteki beyaz gürültünün gerçek gürültü dağılımını temsil etmemesi.
- Senaryolar arası farklar (ör. S1 ile S2 ham titremesi) koşul değişiminden çok kullanıcının duruşundaki
  farklılıklardan kaynaklanıyor olabilir. Bu nedenle senaryolar arası titreme karşılaştırması yapılmamıştır.

**Hareketli baş (S6, S7).** S6'da (filtre açık) gecikme tahmini 64, 30 ve 35 ms olarak ölçülmüştür. Ancak:
- iki tekrarda yüz bulunan kare oranı %90'ın altındadır (%87, %75);
- S7'nin bir tekrarında da oran %78'dir;
- hareket genliği tekrarlar arasında çok farklıdır (40–241 px);
- yüz kaybolduğunda filtre sıfırlandığından, kesintili kayıtlarda gecikme kestirimi daha kısa parçalara dayanır.

Bu nedenle **filtrenin hareketli baştaki davranışı (gecikme ve yumuşatma) bu ölçümlerle kesin olarak
kanıtlanmamıştır.** Gecikme değerleri yalnızca büyüklük mertebesi olarak (onlarca milisaniye)
değerlendirilmelidir. Hareketli başta "titreme azalması" (%1,7–7,9) gerçek hareketi de içerdiğinden titreme
ölçüsü olarak yorumlanmamalıdır.

## 14. Sınırlamalar ve gelecek çalışmalar

**Sınırlamalar**
- **Yüz şekli:** Prototip eşikleri elle seçilmiştir ve gerçek etiketli veriyle doğrulanmamıştır. Yüz uzunluğu
  saç çizgisinden değil yüz ağının üst sınırından ölçülür. Kamera perspektifi, makyaj, sakal ve ışık ölçümleri
  etkileyebilir.
- **Öneriler:** Estetik ilkelere dayalı sezgisel kurallardır; kullanıcı çalışmasıyla değerlendirilmemiştir.
- **Ölçek:** Gözlük boyutu ortalama göz bebeği mesafesi (6,3 cm) varsayımına dayanır. Gerçek mesafe kişiye, yaşa ve
  cinsiyete göre değişir [7]; bu yüzden gözlüğün mutlak boyutu yaklaşıktır.
- **3D:** Zayıf perspektif varsayımı vardır; occlusion kaba bir kafa elipsoidiyle yapılır, saç ve kulak yoktur.
  Işıklandırma sahneye göre uyarlanmaz.
- **Performans ölçümü:** Tek cihaz, tek kamera, tek kullanıcı ve üç tekrarla alınmıştır. Zayıf donanımda,
  CPU çıkarımında, başka tarayıcılarda ve mobilde ölçülmemiştir.
- **Stabilizasyon:** Hareketli baş ölçümleri yüz kaybı ve değişken hareket genliği nedeniyle sonuç vermemiştir.
  Filtre parametreleri gerçek veriyle optimize edilmemiştir.
- **Tarayıcı:** Yalnızca Chrome'da test edilmiştir.

**Gelecek çalışmalar**
1. Etiketli bir yüz veri kümesiyle (izinli ve anonim) yüz şekli eşiklerinin kalibrasyonu, ardından karışıklık
   matrisi ve sınıf başına kesinlik/duyarlılık raporlanması.
2. Hareketli baş için kontrollü protokol: metronomla sabit tempo, sabit genlik ve daha uzun kayıt. Filtre
   parametrelerinin (minCutoff, β) gerçek veriyle ayarlanması.
3. Birden fazla cihazda (farklı GPU'lar, CPU çıkarımı, mobil) ve tarayıcıda ölçüm.
4. Kamera iç parametrelerinin kestirimiyle perspektif doğru 3D yerleştirme ve kişiye özel ölçek.
5. Saç ve kulak bölütlemesiyle daha gerçekçi occlusion; ortam ışığına uyarlanmış malzeme.
6. Öneri sisteminin kullanıcı çalışmasıyla değerlendirilmesi.

## 15. Sonuç

Çalışmada tarayıcıda ve tamamen istemci tarafında çalışan bir sanal gözlük deneme sistemi geliştirilmiştir.
MediaPipe'ın 478 noktalı yüz ağı üzerine şu bileşenler, test edilebilir modüller olarak eklenmiştir:
- 2D afin ve 3D poz tabanlı yerleştirme;
- derinlik maskeleriyle occlusion;
- One Euro filtresiyle stabilizasyon;
- güvenilirlik kontrollü, açıklanabilir bir yüz şekli tahmini;
- sezgisel bir öneri sistemi;
- işlem adımlarını gösteren Algoritma Modu.

Tek bir cihazda yapılan ölçümlerde sistem kameranın 30 FPS sınırında çalışmış; kare işleme süresi kare
bütçesinin yaklaşık yarısında kalmış ve bu sürenin büyük kısmını yüz noktası tespiti oluşturmuştur. Filtre,
sabit başta küçük olan ham titremeyi yaklaşık %13–30 azaltmıştır. Hareketli baştaki davranışı ve yüz şekli
sınıflandırmasının gerçek doğruluğu bu çalışmada doğrulanmamıştır; bu konular gelecek çalışma olarak
belirtilmiştir.

## Kaynakça

[1] Google AI Edge. *Face landmark detection guide (MediaPipe Face Landmarker).*
https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker (erişim: 31.10.2026)

[2] V. Bazarevsky, Y. Kartynnik, A. Vakunov, K. Raveendran, M. Grundmann. "BlazeFace: Sub-millisecond Neural
Face Detection on Mobile GPUs." *CVPR Workshop on Computer Vision for Augmented and Virtual Reality*, 2019.
arXiv:1907.05047.

[3] Y. Kartynnik, A. Ablavatski, I. Grishchenko, M. Grundmann. "Real-time Facial Surface Geometry from Monocular
Video on Mobile GPUs." *CVPR Workshop on Computer Vision for Augmented and Virtual Reality*, 2019.
arXiv:1907.06724.

[4] I. Grishchenko, A. Ablavatski, Y. Kartynnik, K. Raveendran, M. Grundmann. "Attention Mesh: High-fidelity Face
Mesh Prediction in Real-time." *CVPR Workshop on Computer Vision for Augmented and Virtual Reality*, 2020.
arXiv:2006.10962.

[5] Google. *MediaPipe Face Mesh (Legacy Solutions) — Face Transform Module.*
https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md (erişim: 31.10.2026)

[6] R. Szeliski. *Computer Vision: Algorithms and Applications*, 2nd ed. Texts in Computer Science. Springer,
Cham, 2022. doi:10.1007/978-3-030-34372-9.

[7] N. A. Dodgson. "Variation and extrema of human interpupillary distance." *Proc. SPIE 5291, Stereoscopic
Displays and Virtual Reality Systems XI*, pp. 36–46, 2004. doi:10.1117/12.529999.

[8] three.js. *Documentation* (Material, OrthographicCamera, WebGLRenderer), r186. https://threejs.org/docs/
(erişim: 31.10.2026)

[9] G. Casiez, N. Roussel, D. Vogel. "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in
Interactive Systems." *Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '12)*,
pp. 2527–2530. ACM, 2012. doi:10.1145/2207676.2208639.

[10] K. Shoemake. "Animating rotation with quaternion curves." *ACM SIGGRAPH Computer Graphics* 19(3)
(SIGGRAPH '85), pp. 245–254, 1985. doi:10.1145/325165.325242.

[11] ITU-R. *Recommendation BT.601-7: Studio encoding parameters of digital television for standard 4:3 and wide
screen 16:9 aspect ratios.* International Telecommunication Union, 2011.

[12] C. Lugaresi, J. Tang, H. Nash, C. McClanahan, E. Uboweja, M. Hays, F. Zhang, C.-L. Chang, M. G. Yong, J. Lee,
W.-T. Chang, W. Hua, M. Georg, M. Grundmann. "MediaPipe: A Framework for Building Perception Pipelines."
arXiv:1906.08172, 2019.

[13] W3C. *Media Capture and Streams* (Candidate Recommendation Draft). https://www.w3.org/TR/mediacapture-streams/

[14] WICG. *HTMLVideoElement.requestVideoFrameCallback()* (Draft Community Group Report).
https://wicg.github.io/video-rvfc/

---

### Ek A — Tekrar üretilebilirlik

```bash
npm install
npm run model          # MediaPipe model dosyası (WASM dosyaları dev/build öncesi otomatik kopyalanır)
npm test               # 312 test
npm run bench:filter   # sentetik filtre benchmark'ı
node scripts/summarize-measurements.mjs   # gerçek ölçüm tabloları (docs/olcumler)
```

Ölçüm protokolü: `docs/olcum-protokolu.md`.
