import { useEffect, useState } from 'react';
import { toDegrees } from '../core/eyeGeometry.js';

const REFRESH_MS = 200;

const deg = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}°`;

/**
 * Yerleştirme hesaplarının canlı değerleri (2D afin dönüşüm ve 3D kafa pozu).
 * Ekran aynalı olduğu için koordinatlar ekranda görüldüğü gibi gösterilir (x_ekran = genişlik − x).
 */
export function PlacementPanel({ placementRef, mode }) {
  const [p, setP] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setP(placementRef.current), REFRESH_MS);
    return () => clearInterval(id);
  }, [placementRef]);

  const is3D = mode === '3d';
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
    <div className="panel-body">
      {is3D && (
        <>
          <h3 className="subhead">3D kafa pozu</h3>
          {pose ? <KeyValues rows={rows3D} /> : <p className="muted">Yüz algılandığında değerler burada görünür.</p>}
        </>
      )}

      <h3 className="subhead">2D yerleştirme hesapları</h3>
      {m ? <KeyValues rows={rows2D} /> : <p className="muted">Yüz algılandığında değerler burada görünür.</p>}
    </div>
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
