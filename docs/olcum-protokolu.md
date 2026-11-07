# Gerçek Kamera Ölçüm Protokolü (Aşama 8-A)

Bu belge, teknik rapordaki performans ve stabilizasyon sonuçlarının **gerçek kamerayla** nasıl toplanacağını
anlatır. Uygulamadaki **Teknik ayrıntılar → Performans ölçümü** paneli senaryoları otomatik çalıştırır;
burada yalnızca koşullar, adımlar ve sonuçların nasıl iletileceği tanımlanır.

> Raporda üç tür sonuç birbirinden ayrı tutulur:
> 1. **Gerçek kamera ölçümleri:** bu protokolle toplananlar.
> 2. **Sentetik benchmark ve testler:** `npm run bench:filter`, `npm test`. Bilinen yapay gürültü ve hareketle
>    algoritmanın doğru çalıştığını gösterir.
> 3. **Teorik açıklamalar:** formüller ve parametrelerin anlamı.
>
> Gerçek kamera ölçümü yapılmadan raporda bu sonuçların yeri boş bırakılır; sayı uydurulmaz.

## 1. Ölçülen değerler

| Değer | Tanım (`src/core/benchmark.js`) |
|---|---|
| FPS | 1000 / ortalama kare aralığı (ms). Kamera kare hızıyla sınırlıdır (çoğu kamera 30). |
| Kare süresi ort / p95 | Bir karenin işlenme süresi: tespit + yerleştirme + çizim + 3D + algoritma + yüz şekli |
| Aşama süreleri | `Tespit` (MediaPipe), `Yerleştirme` (geometri + One Euro), `Çizim` (2D gözlük + nokta katmanı), `3D çizim`, `Algoritma`, `Yüz şekli`; her biri ort / p95 |
| Titreme (jitter) | Ardışık karelerde göz orta noktası yer değiştirmesinin RMS'i (px). Ham ve filtreli ayrı ayrı, ayrıca göz arası mesafeye (IPD) oranla % |
| Titreme azalması | 1 − filtreli / ham |
| Ortalama sapma | Filtreli ile ham göz orta noktası arasındaki ortalama uzaklık (px) |
| Gecikme | Filtreli dizinin ham diziye en iyi oturduğu zaman kayması (ms). Yalnızca hareketli baş senaryolarında ve baş en az 0,3 IPD hareket ettiyse geçerli sayılır |
| Yüz oranı | Kayıt sırasında yüz bulunan karelerin oranı (< %90 ise sonuç ⚠ ile işaretlenir) |

Her senaryo **3 sn ısınma** (kaydedilmez: ayarlar oturur, filtre ve tarayıcı ısınır) ve **10 sn** (isteğe bağlı
20 sn) kayıttan oluşur. Ortalama ve p95 yalnızca kayıt evresindeki karelerden hesaplanır.

## 2. Senaryolar

| Kod | Mod | Algoritma Modu | One Euro | Baş |
|---|---|---|---|---|
| S1 | 2D | kapalı | açık | sabit (referans) |
| S2 | 2D | açık, varsayılan katmanlar | açık | sabit |
| S3 | 2D | açık, tüm katmanlar (ağ, derinlik, yüz şekli dahil) | açık | sabit |
| S4 | 3D | kapalı | açık | sabit |
| S5 | 2D | kapalı | kapalı | sabit |
| S6 | 2D | kapalı | açık | hareketli |
| S7 | 2D | kapalı | kapalı | hareketli |

Karşılaştırmalar:

| Karşılaştırma | Senaryolar |
|---|---|
| Algoritma Modu kapalı → açık | S1 → S2 |
| Varsayılan → tüm katmanlar | S2 → S3 |
| 2D → 3D | S1 → S4 |
| Filtre kapalı → açık, sabit baş | S5 → S1 |
| Filtre kapalı → açık, hareketli baş | S7 → S6 |

## 3. Hazırlık (her tekrar için aynı)

1. Bilgisayar **şarja takılı** olsun; düşük güç modu kapalı olsun.
2. Yalnızca Chrome'da bu sekme açık olsun; diğer ağır uygulamaları (video, derleme, başka kamera uygulaması) kapatın.
3. Tarayıcı penceresi **ön planda ve görünür** kalsın. Ölçüm sırasında başka sekmeye ya da pencereye geçmeyin;
   tarayıcı arka plandaki sekmeyi yavaşlatır ve sonuçlar geçersiz olur.
4. Işık, mesafe (50–70 cm) ve oturma konumu tüm tekrarlarda aynı olsun. Arkada güçlü ışık olmasın.
5. Sayfayı yenileyin, kamerayı başlatın, yüz algılandıktan sonra **en az 10 sn** bekleyin.
6. **Teknik ayrıntılar** altında yalnızca **Performans ölçümü** açık olsun. Diğer paneller periyodik yenilenir
   ve küçük de olsa ek yük getirir.
7. Altta görünen **Kamera** çözünürlüğünü (ör. 1280×720 @ 30 fps) not edin. Tüm tekrarlar aynı çözünürlükte olmalı.

## 4. Ölçüm adımları

1. **Performans ölçümü** panelinde kayıt süresini seçin (10 sn önerilir; daha kararlı sonuç için 20 sn).
2. **▶ Ölçüm protokolünü başlat**'a basın. Yaklaşık 1,5 dk (20 sn ile ~2,7 dk) sürer.
3. Kamera üzerindeki yönergeye uyun:
   - **Sabit baş** (S1–S5): doğrudan kameraya bakın, başınızı kıpırdatmayın, konuşmayın.
   - **Hareketli baş** (S6, S7): başınızı yavaşça sağa ve sola çevirin (yaklaşık saniyede bir gidiş-dönüş, ±20°).
     İki senaryoda da aynı hızda hareket etmeye çalışın.
4. Ölçüm bitince ayarlarınız kendiliğinden geri yüklenir. Sonuç tablosunda ⚠ işaretine bakın:
   - `yüz %…`: yüz kaybolmuş. O senaryoyu **yalnız bunu ölç** ile tekrarlayın.
   - `3D açılamadı`: WebGL sorunu. S4 geçersizdir; durumu not edin.
   - `hareket az`: hareketli senaryoda baş yeterince hareket etmemiş. Gecikme hesaplanmaz; tekrarlayın.
5. **JSON indir** ve **CSV indir** ile dosyaları kaydedin (dosya adında tarih ve saat var).
6. Protokolü **3 kez** tekrarlayın. Her tekrardan sonra dosyaları indirin; yeni tam ölçüm öncekinin yerine geçer.
   Tekrarlar arasında 1 dk bekleyin.

İsteğe bağlı: 3D modda Algoritma Modu açık maliyeti için S4'ü ölçtükten sonra 3D modda modu elle açıp
**6 · Performans** tablosuna bakabilirsiniz. Bu protokolün parçası değildir.

## 5. Uçtan uca doğrulama listesi (Aşama 8-1)

Ölçümden önce ya da sonra bir kez işaretleyin:

- [ ] Kamera başlat / durdur / yeniden başlat; izin reddedilince yardım metni ve "Tekrar dene"
- [ ] 478 nokta (Algoritma Modu → Yalnızca yüz noktaları) yüzle hizalı
- [ ] 2D gözlük gözlere oturuyor, baş eğilince dönüyor
- [ ] 3D gözlük kafa pozunu izliyor; yana dönünce saplar kafanın arkasında gizleniyor (occlusion)
- [ ] One Euro açıkken sabit başta gözlük titremiyor, kapalıyken hafif titreme görülüyor
- [ ] Yüz şekli: düz bakınca birkaç saniyede tahmin; baş dönük, ağız açık, uzak durumlarda uyarı
- [ ] Altı gözlük modeli 2D ve 3D'de seçilebiliyor; önerilen modeller ★ ile işaretli
- [ ] Algoritma Modu açılıp kapanıyor, katmanlar ayrı ayrı çalışıyor
- [ ] Ekran görüntüsü alınıyor, önizleme ve indirme çalışıyor
- [ ] Performans ölçümü protokolü tamamlanıyor, ayarlar geri yükleniyor

## 6. Bana iletilecekler

1. Üç tekrarın **JSON** dosyaları (ya da **Markdown tabloyu kopyala** çıktısı ve CSV).
2. Cihaz: Mac modeli ve işlemci (ör. MacBook Air M2), macOS sürümü, Chrome sürümü (`chrome://version`).
3. Kamera: dahili mi harici mi; paneldeki çözünürlük ve kare hızı.
4. Ortam notu: ışık (gün ışığı / yapay), yaklaşık mesafe.
5. Doğrulama listesinde işaretlenmeyen madde varsa açıklaması.

JSON dosyası yalnızca özet istatistikleri ve ortam bilgisini (çözünürlük, hızlandırıcı, tarayıcı kimliği) içerir.
Görüntü ya da yüz noktası içermez.

## 7. Sonuçların yorumlanması (rapor için ilkeler)

- FPS kamerayla sınırlı olduğundan iki senaryonun FPS'i aynı (≈30) çıkabilir. Maliyet farkı **kare süresi**
  (ort ve p95) ile gösterilir. Kare süresi kare aralığından (≈33 ms) küçük kaldıkça gerçek zamanlılık korunur.
- Titreme sabit baş senaryolarında yorumlanır. Hareketli başta kareden kareye değişim gerçek hareketi de
  içerdiğinden "azalma" titreme değil, yumuşatma + gecikme etkisidir.
- Gecikme, ölçülen hareket ve kare hızına bağlıdır; tek bir sabit değer değildir.
- Sentetik benchmark (`npm run bench:filter`) ile gerçek ölçüm aynı tabloda karıştırılmaz.
- Üç tekrarın ortalaması ve en küçük–en büyük aralığı raporlanır.
