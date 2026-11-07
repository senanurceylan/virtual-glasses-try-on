# Canlı Demo Planı (3–5 dakika)

## Demo öncesi hazırlık (sunumdan 10 dk önce)

- [ ] `npm run dev` çalışıyor, Chrome'da http://localhost:5173 açık; başka sekme yok.
- [ ] Bilgisayar şarjda; Zoom/FaceTime gibi kamerayı kullanan uygulamalar kapalı.
- [ ] Kamera izni verilmiş. Bir kez açıp kapatarak deneyin.
- [ ] Yüz önden ve eşit aydınlatılmış; arkada pencere yok; kameradan 50–70 cm uzaktasınız.
- [ ] Algoritma Modu kapalı. Mod 2D, gözlük açık, Wayfarer seçili. Teknik paneller kapalı.
- [ ] Yedek olarak bir ekran görüntüsü (gözlüklü) ve `docs/teknik-rapor.md` açık bir sekmede hazır.
- [ ] Saç alnı kapatmıyor; yüz şekli ölçümü için gerekli.

## Akış

| Süre | Adım | Ekranda yapılacak | Söylenecek (özet) |
|---|---|---|---|
| 0:00–0:30 | **1. Giriş** | Uygulama açık, kamera çalışıyor | "Tarayıcıda çalışan, görüntüyü hiçbir yere göndermeyen gerçek zamanlı sanal gözlük sistemi. Her karede MediaPipe ile 478 yüz noktası çıkarıyoruz." |
| 0:30–1:15 | **2. 2D yerleştirme** | Başınızı sağa sola yatırın ve yaklaşıp uzaklaşın. Katalogdan 2–3 çerçeve seçin. | "Göz köşelerinden göz merkezlerini, aradaki mesafeyi ve açıyı buluyoruz; gözlük görselini afin dönüşümle öteleyip döndürüp ölçekliyoruz." |
| 1:15–2:15 | **3. Algoritma Modu** | Araç çubuğunda **Algoritma**'yı açın. Önce **Yalnızca yüz noktaları**, sonra **Varsayılan katmanlar**. Başınızı yatırın. | "Renkli bölgeler göz, kaş, burun, dudak. Beyaz halkalar gözlüğün kullandığı dört nokta. d gözler arası mesafe, θ eğim açısı. Panelde canlı afin matris var." Gri halkaları gösterin: "Gri ham ölçüm, yeşil One Euro ile filtrelenmiş değer." |
| 2:15–3:00 | **4. 3D ve occlusion** | **3D**'ye geçin, başınızı yavaşça yana çevirin. Panelde **3 · 3D kafa pozu → Occlusion maskelerini göster**'i açıp kapatın. | "MediaPipe'ın dönüşüm matrisinden kafa yönünü alıyoruz; eksenler yaw, pitch, roll. Görünmez yüz ağı ve kafa elipsoidi derinlik tamponuna yazılıyor; sap kafanın arkasına geçince gizleniyor." |
| 3:00–3:45 | **5. Yüz şekli ve öneri** | Algoritma Modu kapalı, 2D. Düz bakın, ilerleme dolsun. Önerilen çerçevede **Dene**'ye basın. İsterseniz ağzı açıp uyarıyı gösterin. | "Genişlikleri elmacık genişliğine bölerek uzaklıktan bağımsız oranlar elde ediyoruz ve altı prototiple karşılaştırıyoruz. Baş dönükse ya da ağız açıksa ölçüm alınmıyor. **Bu sınıflandırma gerçek etiketli veriyle doğrulanmadı; öneriler sezgisel.**" |
| 3:45–4:30 | **6. Performans ve ekran görüntüsü** | Alttaki FPS çubuğunu gösterin. **📷 Ekran görüntüsü** alıp önizlemeyi açın. | "Kameranın sınırı olan 30 FPS'te çalışıyor. Kare işleme yaklaşık 17 ms ve bunun %94–98'i yüz tespiti. Ölçümler tek cihazda yapıldı. Sabit başta filtre titremeyi %13–30 azalttı; hareketli başta sonuç kesin değil." |
| 4:30–5:00 | **7. Kapanış** | — | "Kod 312 testle doğrulandı. Sınırlamalar: tek cihaz, doğrulanmamış yüz şekli sınıflandırması, kaba occlusion. Gelecekte etiketli veriyle kalibrasyon ve çoklu cihaz ölçümü planlıyoruz." |

3 dakikaya sığdırmak için 5. ve 6. adımları kısaltın: yalnızca sonucu ve FPS'i gösterin.

## Olası sorular ve kısa cevaplar

- **"Neden göz bebeği değil göz köşeleri?"** Göz köşeleri bakış yönüyle oynamaz; göz bebeği bakışla kayar.
- **"sx ve sy neden farklı?"** Baş yana dönünce gözler arası 2D mesafe kısalır, 3D mesafe değişmez. Yatay
  ölçek 2D, dikey ölçek 3D mesafeden alınır.
- **"Neden ortografik kamera?"** Gerçek kameranın görüş açısı bilinmiyor. Yüz kameraya göre sığ olduğundan zayıf
  perspektif yeterli, ve 3D gözlük 2D ile aynı piksele oturuyor.
- **"One Euro neden düz alçak geçiren değil?"** Kesim frekansı hıza göre artar: durağanken güçlü yumuşatma,
  hareket ederken düşük gecikme. Sentetik testte %90'a ulaşma süresi β = 0 ile 433 ms, One Euro ile 67 ms (30 FPS).
- **"Yüz şekli ne kadar doğru?"** Bilinmiyor. Etiketli veri olmadığı için doğruluk ölçülmedi. Testler yalnızca
  iç tutarlılığı gösteriyor.
- **"30 FPS'ten hızlı olabilir mi?"** Kamera 30 FPS veriyor. Kare işleme ≈17 ms olduğundan bu cihazda daha
  hızlı bir kamerada daha yüksek FPS mümkün olabilir, ancak bu ölçülmedi.

## Bir şey ters giderse

| Sorun | Çözüm |
|---|---|
| Kamera açılmıyor | Adres çubuğundaki kamera simgesinden izin verip **Tekrar dene**. Olmazsa hazır ekran görüntüsü ve raporla anlatın. |
| "Yüz algılanamadı" | Işığa dönün, biraz yaklaşın, yüzün tamamı kadrajda olsun. |
| 3D açılmıyor (WebGL) | Uygulama otomatik 2D'ye düşer. Bunu bir güvenlik özelliği olarak belirtin. |
| Yüz şekli sonuç vermiyor | Paneldeki ilk ✗ koşulu okuyun (baş düz, ağız kapalı, alın açık). Bu da sistemin güvenilirlik kontrolünü gösterir. |
| FPS düşük | Diğer uygulamaları kapatın; Algoritma Modu'nda **Varsayılan katmanlar**'a dönün. |
