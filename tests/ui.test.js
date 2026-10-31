// Arayüz testleri (sunucu tarafı render; tarayıcı/kamera gerekmez).
// Etkileşim (tıklama) yerine bileşenlerin farklı durumlarda ne gösterdiği test edilir.
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { CameraStage } from '../src/components/CameraStage.jsx';
import { Collapsible } from '../src/components/Collapsible.jsx';
import { catalogItems, GlassesCatalog } from '../src/components/GlassesCatalog.jsx';
import { StageToolbar } from '../src/components/StageToolbar.jsx';
import { trackingStatus } from '../src/components/TrackingPanel.jsx';
import { SHAPES } from '../src/core/faceShape.js';
import { FRAME_STYLES } from '../src/core/frameStyles.js';
import { recommendFrames } from '../src/core/recommendations.js';

const html = (el) => renderToString(el).replace(/<!-- -->/g, '');

describe('uygulama iskeleti', () => {
  const page = html(h(App));

  it('başlık, kamera sahnesi, katalog, yüz analizi ve teknik paneller birlikte görünür', () => {
    expect(page).toContain('Sanal Gözlük Deneme');
    expect(page).toContain('class="stage"');
    expect(page).toContain('Gözlük kataloğu');
    expect(page).toContain('Yüz analizi');
    expect(page).toContain('Teknik ayrıntılar');
    expect(page).toContain('class="status-bar"');
  });

  it('teknik paneller varsayılan olarak kapalı (içerikleri çizilmez)', () => {
    for (const t of ['Algoritma katmanları', 'Stabilizasyon (One Euro)', 'Yerleştirme hesapları', 'Model bilgisi']) {
      expect(page).toContain(t);
    }
    expect(page).not.toContain('minCutoff'); // stabilizasyon kaydırıcıları kapalı panelde
    expect(page).not.toContain('2D yerleştirme hesapları');
  });

  it('kamera başlamadan "Kamerayı başlat" düğmesi var', () => {
    expect(page).toContain('Kamerayı başlat');
  });
});

describe('gözlük kataloğu', () => {
  const recs = recommendFrames(SHAPES.heart.proto, FRAME_STYLES, 3);

  it('altı model kart olarak listelenir', () => {
    const out = html(h(GlassesCatalog, { recommendations: [], selectedId: 'classic-black', onSelect: () => {} }));
    expect(out.match(/class="glasses-card[ "]/g)).toHaveLength(6);
    for (const name of ['Wayfarer', 'Yuvarlak', 'Kare', 'Dikdörtgen', 'Aviator', 'Cat-eye']) expect(out).toContain(name);
  });

  it('seçili model işaretli (aria-checked) ve tek', () => {
    const out = html(h(GlassesCatalog, { recommendations: [], selectedId: 'aviator-silver', onSelect: () => {} }));
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(catalogItems([], 'aviator-silver').find((g) => g.selected).id).toBe('aviator-silver');
  });

  it('önerilen modeller sıra numarasıyla rozetlenir', () => {
    const items = catalogItems(recs, 'classic-black');
    const ranked = items.filter((g) => g.recommendedRank).sort((a, b) => a.recommendedRank - b.recommendedRank);
    expect(ranked.map((g) => g.id)).toEqual(recs.map((r) => r.id));
    const out = html(h(GlassesCatalog, { recommendations: recs, selectedId: 'classic-black', onSelect: () => {} }));
    expect(out).toContain('★ Öneri 1');
    expect(out).toContain('★ Öneri 3');
  });
});

describe('kamera araç çubuğu (2D/3D, ekran görüntüsü)', () => {
  const base = {
    mode: '2d',
    onModeChange: vi.fn(),
    showGlasses: true,
    onShowGlassesChange: vi.fn(),
    onSnapshot: vi.fn(),
    canSnapshot: true,
    busy: false,
    scene3D: { status: 'idle' },
  };

  it('seçili modu işaretler', () => {
    const out = html(h(StageToolbar, { ...base, mode: '3d' }));
    expect(out).toMatch(/class="is-active"[^>]*title="Three\.js/);
    expect(out).toMatch(/<input[^>]*value="3d"[^>]*checked=""|<input[^>]*checked=""[^>]*value="3d"/);
    expect(out).not.toMatch(/<input[^>]*value="2d"[^>]*checked=""|<input[^>]*checked=""[^>]*value="2d"/);
  });

  it('kamera yokken ekran görüntüsü düğmesi devre dışı', () => {
    expect(html(h(StageToolbar, { ...base, canSnapshot: false }))).toMatch(/disabled=""[^>]*title="Önce kamerayı başlatın"/);
  });

  it('görüntü hazırlanırken düğme meşgul görünür', () => {
    expect(html(h(StageToolbar, { ...base, busy: true }))).toContain('Hazırlanıyor');
  });

  it('3D başlatılamazsa 2D’ye düşüldüğünü söyler', () => {
    expect(html(h(StageToolbar, { ...base, mode: '3d', scene3D: { status: 'error' } }))).toContain('3D başlatılamadı, 2D gösteriliyor');
  });
});

describe('kamera durumları', () => {
  const stage = (props) => html(h(CameraStage, { videoRef: { current: null }, info: null, onStart: () => {}, ...props }));

  it('açılırken yükleniyor göstergesi', () => {
    const out = stage({ status: 'starting' });
    expect(out).toContain('spinner');
    expect(out).toContain('Kamera açılıyor');
  });

  it('izin reddedilince adım adım çözüm ve "Tekrar dene"', () => {
    const out = stage({ status: 'error', errorName: 'NotAllowedError', error: 'Kamera izni reddedildi.' });
    expect(out).toContain('Kamera izni verilmedi');
    expect(out).toContain('Gizlilik ve Güvenlik');
    expect(out).toContain('Tekrar dene');
  });

  it('diğer hatalarda hata mesajını gösterir', () => {
    const out = stage({ status: 'error', errorName: 'NotFoundError', error: 'Uygun bir kamera bulunamadı.' });
    expect(out).toContain('Kamera açılamadı');
    expect(out).toContain('Uygun bir kamera bulunamadı.');
  });

  it('kamera kapalıyken "Kamerayı başlat" ve gizlilik notu', () => {
    const out = stage({ status: 'idle' });
    expect(out).toContain('Kamera kapalı');
    expect(out).toContain('hiçbir yere gönderilmez');
  });

  it('hazırken araç çubuğu ve yüz bulunamadı uyarısı görünür; mesaj katmanı yok', () => {
    const out = stage({
      status: 'ready',
      notice: { tone: 'warn', title: 'Yüz algılanamadı' },
      toolbar: h('div', { className: 'stage-toolbar' }),
    });
    expect(out).toContain('Yüz algılanamadı');
    expect(out).toContain('stage-toolbar');
    expect(out).not.toContain('stage-message');
  });

  it('kamera hazır değilken araç çubuğu gösterilmez', () => {
    expect(stage({ status: 'starting', toolbar: h('div', { className: 'stage-toolbar' }) })).not.toContain('stage-toolbar');
  });
});

describe('yardımcı bileşenler', () => {
  it('Collapsible kapalıyken içerik çizmez, açıkken çizer', () => {
    expect(html(h(Collapsible, { title: 'T' }, 'GİZLİ'))).not.toContain('GİZLİ');
    expect(html(h(Collapsible, { title: 'T', defaultOpen: true }, 'AÇIK'))).toContain('AÇIK');
  });

  it('başlıktaki takip durumu', () => {
    const ready = { status: 'ready' };
    expect(trackingStatus({ model: { status: 'loading' }, running: true, faceVisible: false }).text).toContain('yükleniyor');
    expect(trackingStatus({ model: ready, running: false, faceVisible: false }).text).toBe('Kamera kapalı');
    expect(trackingStatus({ model: ready, running: true, faceVisible: false }).text).toBe('Yüz aranıyor');
    expect(trackingStatus({ model: ready, running: true, faceVisible: true }).tone).toBe('ok');
  });
});
