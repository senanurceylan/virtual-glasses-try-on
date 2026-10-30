import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FaceShapePanel } from '../src/components/FaceShapePanel.jsx';
import { SHAPES } from '../src/core/faceShape.js';
import { FaceShapeEstimator } from '../src/core/faceShapeEstimator.js';
import { shapeFace, W, H } from './shapeFace.js';

const render = (estimator, selectedId = 'classic-black') =>
  renderToString(createElement(FaceShapePanel, { faceShapeRef: { current: estimator }, selectedId, onSelect: () => {} }));

describe('FaceShapePanel', () => {
  it('yüz yokken durum mesajını ve tüm çerçeveleri gösterir, öneri göstermez', () => {
    const html = render(new FaceShapeEstimator());
    expect(html).toContain('Yüz algılanmadı');
    expect(html).toContain('Cat-eye');
    expect(html).not.toContain('Önerilen çerçeveler');
  });

  it('tahmin hazırsa yaklaşık sonucu, oranları ve 3 öneri kartını gösterir', () => {
    const est = new FaceShapeEstimator();
    for (let i = 0; i < 40; i++) est.update(shapeFace(SHAPES.heart.proto), { yaw: 0, pitch: 0, roll: 0 }, W, H);
    const html = render(est);
    expect(html).toContain('Yaklaşık tahmin');
    expect(html).toContain('Kalp');
    expect(html).toContain('Çene köşesi açısı');
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
