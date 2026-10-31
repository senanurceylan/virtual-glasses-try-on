import { useState } from 'react';

/**
 * Açılır bölüm (yerel <details>/<summary>: klavye ve ekran okuyucu desteği hazır).
 * İçerik yalnızca açıkken çizilir; kapalı teknik paneller periyodik okuma yapmaz,
 * böylece kare döngüsüne ek yük bindirmez.
 */
export function Collapsible({ title, hint, defaultOpen = false, className = '', children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className={`collapsible ${className}`} open={open || undefined} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span>{title}</span>
        {hint && <span className="collapsible-hint">{hint}</span>}
      </summary>
      {open && <div className="collapsible-body">{children}</div>}
    </details>
  );
}
