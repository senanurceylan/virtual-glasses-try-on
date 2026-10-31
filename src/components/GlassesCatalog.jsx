import { GLASSES } from '../render/glassesCatalog.js';

/** Katalog kartları: seçili model ve öneri sırası (1–3) işaretli. */
export function catalogItems(recommendations, selectedId) {
  const rank = new Map(recommendations.map((r, i) => [r.id, i + 1]));
  return GLASSES.map((g) => ({ ...g, selected: g.id === selectedId, recommendedRank: rank.get(g.id) ?? null }));
}

/**
 * Gözlük kataloğu: altı model görsel kartlarla. Kart seçilince yalnızca gözlük katmanı
 * değişir; kamera ve yüz takibi kesintisiz devam eder.
 */
export function GlassesCatalog({ recommendations, selectedId, onSelect }) {
  const items = catalogItems(recommendations, selectedId);
  return (
    <section className="catalog" aria-labelledby="catalog-title">
      <div className="catalog-head">
        <h2 id="catalog-title">Gözlük kataloğu</h2>
        <span className="muted small">
          {recommendations.length ? '★ işaretli modeller yüz analizinize göre önerilir' : 'Bir model seçin; anında denenir'}
        </span>
      </div>
      <div className="catalog-grid" role="radiogroup" aria-label="Gözlük modeli">
        {items.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={g.selected}
            className={`glasses-card ${g.selected ? 'is-selected' : ''} ${g.recommendedRank ? 'is-recommended' : ''}`}
            onClick={() => onSelect(g.id)}
            title={g.description}
          >
            {g.recommendedRank && <span className="badge-rec">★ Öneri {g.recommendedRank}</span>}
            <span className="glasses-card-img">
              <img src={g.src} alt="" />
            </span>
            <span className="glasses-card-name">{g.name}</span>
            <span className="glasses-card-desc">{g.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
