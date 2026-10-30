import { useEffect, useState } from 'react';
import { toDegrees } from '../core/eyeGeometry.js';

const REFRESH_MS = 200;

const deg = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}°`;

/**
 * Gözlük paneli: 2D/3D mod seçimi, görünüm ayarları ve yerleştirme hesaplarının canlı değerleri.
 * Ekran aynalı olduğu için koordinatlar ekranda görüldüğü gibi gösterilir (x_ekran = genişlik − x).
 */
export function PlacementPanel({ placementRef, glasses, view, onViewChange, scene3D }) {
  const [p, setP] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setP(placementRef.current), REFRESH_MS);
    return () => clearInterval(id);
  }, [placementRef]);

  const set = (key) => (e) => onViewChange({ ...view, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const is3D = view.mode === '3d';
  const m = p?.metrics;
  const t = p?.transform;
  const pose = p?.pose;

  const rows2D = m
    ? [
        ['Sağ göz merkezi', `(${Math.round(p.width - m.right.x)}, ${Math.round(m.right.y)})`],
        ['Sol göz merkezi', `(${Math.round(p.width - m.left.x)}, ${Math.round(m.left.y)})`],
        ['Gözler arası (2D)', `${m.distance2D.toFixed(1)} px`],
        ['Gözler arası (3D)', `${m.distance3D.toFixed(1)} px`],
        ['Eğim açısı θ', deg(-toDegrees(m.angle))],
        ['Ölçek (sx, sy)', t ? `${t.scaleX.toFixed(3)}, ${t.scaleY.toFixed(3)}` : '–'],
        ['Yatay daralma', `${((1 - m.distance2D / m.distance3D) * 100).toFixed(1)} %`],
      ]
    : [];

  const rows3D = pose
    ? [
        ['Yaw (sola +)', deg(pose.angles.yaw)],
        ['Pitch (aşağı +)', deg(pose.angles.pitch)],
        ['Roll (sağ omza +)', deg(pose.angles.roll)],
        ['Roll – göz çizgisi', deg(pose.eyeRoll)],
        ['Ölçek', `${pose.pxPerCm.toFixed(2)} px/cm`],
        ['Konum (ekran)', `(${Math.round(p.width - pose.position.x)}, ${Math.round(-pose.position.y)})`],
      ]
    : [];

  return (
    <section className="card">
      <h2>Gözlük</h2>
      <div className="glasses-current">
        <img src={glasses.src} alt="" className="glasses-thumb" />
        <div>
          <strong>{glasses.name}</strong>
          <p className="muted">{glasses.description}</p>
        </div>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Görünüm modu">
        {[
          ['2d', '2D (PNG)'],
          ['3d', '3D (Three.js)'],
        ].map(([value, label]) => (
          <label key={value} className={view.mode === value ? 'is-active' : ''}>
            <input type="radio" name="mode" value={value} checked={view.mode === value} onChange={set('mode')} />
            {label}
          </label>
        ))}
      </div>
      {is3D && scene3D.status === 'error' && <p className="error-text">{scene3D.error} 2D moda geçebilirsiniz.</p>}

      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={view.showGlasses} onChange={set('showGlasses')} />
          <span>Gözlüğü göster</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={view.showGeometry} onChange={set('showGeometry')} />
          <span>Yerleştirme geometrisi (göz merkezleri, açı)</span>
        </label>
        {is3D && (
          <label className="toggle">
            <input type="checkbox" checked={view.showOccluders} onChange={set('showOccluders')} />
            <span>Occlusion maskelerini göster (yüz ağı, kafa)</span>
          </label>
        )}
      </div>

      {is3D && (
        <>
          <h3 className="subhead">3D kafa pozu</h3>
          {pose ? <KeyValues rows={rows3D} /> : <p className="muted">Yüz algılandığında değerler burada görünür.</p>}
        </>
      )}

      <h3 className="subhead">2D yerleştirme hesapları</h3>
      {m ? <KeyValues rows={rows2D} /> : <p className="muted">Yüz algılandığında değerler burada görünür.</p>}
    </section>
  );
}

function KeyValues({ rows }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} className="kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
