// Yüz ağı üçgenleri.
//
// MediaPipe yüz ağını (FACE_LANDMARKS_TESSELATION) üçgen listesi olarak değil,
// kenar listesi ({start, end}) olarak verir. İncelendiğinde liste 852 üçgenin
// kenarlarının art arda yazılmasından oluşur: her ardışık 3 kenar kapalı bir
// üçgendir (a→b, b→c, c→a). 2556 kenar = 852 × 3.
// Occlusion için yüz yüzeyini 3D'de çizerken bu üçgenler kullanılır.

/**
 * @param {Array<{start:number, end:number}>} edges  üçgen kenarları, üçer üçer
 * @returns {number[]} düz üçgen indeks dizisi [a0, b0, c0, a1, b1, c1, ...]
 * @throws kenar sayısı 3'ün katı değilse ya da bir üçlü kapalı üçgen değilse
 */
export function trianglesFromTesselation(edges) {
  if (edges.length % 3 !== 0) throw new Error('Kenar sayısı 3ün katı olmalı');
  const indices = [];
  for (let i = 0; i < edges.length; i += 3) {
    const [ab, bc, ca] = [edges[i], edges[i + 1], edges[i + 2]];
    if (ab.end !== bc.start || bc.end !== ca.start || ca.end !== ab.start) {
      throw new Error(`Kenar ${i}–${i + 2} kapalı bir üçgen değil`);
    }
    indices.push(ab.start, bc.start, ca.start);
  }
  return indices;
}
