// Yüz var/yok durumunu histerezisle takip eder.
//
// Tek bir karede tespit kaçması (göz kırpma, hızlı hareket, bulanıklık) uyarıyı
// yanıp söndürmesin diye durum ancak art arda birkaç kare boyunca değişirse değişir:
//   - görünür → kayıp : `lostAfter` kare boyunca yüz yoksa
//   - kayıp → görünür : `foundAfter` kare boyunca yüz varsa

export class FacePresence {
  constructor({ lostAfter = 8, foundAfter = 2 } = {}) {
    this.lostAfter = lostAfter;
    this.foundAfter = foundAfter;
    this.reset();
  }

  reset() {
    this.visible = false;
    this.streak = 0; // mevcut durumla çelişen art arda kare sayısı
    this.totalFrames = 0;
    this.detectedFrames = 0;
  }

  /** @returns {boolean} güncel (kararlı) görünürlük durumu */
  update(detected) {
    this.totalFrames++;
    if (detected) this.detectedFrames++;

    if (detected === this.visible) {
      this.streak = 0;
    } else {
      this.streak++;
      const needed = this.visible ? this.lostAfter : this.foundAfter;
      if (this.streak >= needed) {
        this.visible = detected;
        this.streak = 0;
      }
    }
    return this.visible;
  }

  /** Oturum boyunca yüz bulunan karelerin oranı (0–1). */
  get detectionRate() {
    return this.totalFrames ? this.detectedFrames / this.totalFrames : 0;
  }
}
