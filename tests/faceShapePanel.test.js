import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FaceShapePanel } from '../src/components/FaceShapePanel.jsx';
import { SHAPES } from '../src/core/faceShape.js';
import { FaceShapeEstimator } from '../src/core/faceShapeEstimator.js';
import { useFaceShapeView } from '../src/hooks/useFaceShapeState.js';
import { shapeFace, W, H } from './shapeFace.js';

// Panel, useFaceShapeState() çıktısını alır; testte aynı görünüm hesabı doğrudan yapılır.
function Harness({ estimator, selectedId }) {
  const view = useFaceShapeView({ ...estimator.state });
  return createElement(FaceShapePanel, { view, selectedId, onSelect: () => {} });
}
const render = (estimator, selectedId = 'classic-black') => renderToString(createElement(Harness, { estimator, selectedId }));

describe('FaceShapePanel', () => {
  it('yüz yokken durum mesajını ve ölçüm yönergelerini (açık) gösterir, öneri göstermez', () => {
    const html = render(new FaceShapeEstimator());
    expect(html).toContain('Yüz algılanmadı');
    expect(html).toContain('50–70 cm');
    expect(html).toContain('collapsible-body'); // yönergeler sonuç yokken açık başlar
    expect(html).not.toContain('önerilen çerçeveler');
  });

  it('olasılıkların doğrulanmış doğruluk oranı olmadığını belirtir', () => {
    expect(render(new FaceShapeEstimator())).toContain('doğrulanmış bir doğruluk oranı değildir');
  });

  it('ölçüm sürerken ilerleme çubuğu gösterir', () => {
    const est = new FaceShapeEstimator();
    for (let i = 0; i < 12; i++) est.update(shapeFace(SHAPES.oval.proto), { yaw: 0, pitch: 0, roll: 0 }, W, H);
    const html = render(est);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="40"');
  });

  it('tahmin hazırsa yaklaşık sonucu, oranları ve 3 öneri kartını gösterir', () => {
    const est = new FaceShapeEstimator();
    for (let i = 0; i < 40; i++) est.update(shapeFace(SHAPES.heart.proto), { yaw: 0, pitch: 0, roll: 0 }, W, H);
    const html = render(est);
    expect(html).toContain('Yaklaşık yüz şekli');
    expect(html).toContain('Kalp');
    expect(html).toContain('Kullanılan yüz oranları'); // oran tablosu açılır panelde
    expect(html.match(/class="rec-card/g)).toHaveLength(3);
    expect(html).toContain('kesin kurallar değildir');
  });
});

describe('FaceShapePanel — ağız açıkken', () => {
  it('uyarıyı, ağız açıklığı değerini ve "güncel ölçüm değil" notunu gösterir', () => {
    const est = new FaceShapeEstimator();
    for (let i = 0; i < 40; i++) est.update(shapeFace(SHAPES.oval.proto), { yaw: 0, pitch: 0, roll: 0 }, W, H);
    for (let i = 0; i < 5; i++) est.update(shapeFace(SHAPES.oval.proto, { mouth: 0.1 }), { yaw: 0, pitch: 0, roll: 0 }, W, H);
    const html = render(est).replace(/<!-- -->/g, '');
    expect(html).toContain('Yüz şekli analizi için lütfen ağzınızı kapatın.');
    expect(html).toContain('Ağız açıklığı: 0.100');
    expect(html).toContain('güncel ölçüm değildir');
    expect(html).toContain('is-stale');
  });
});
