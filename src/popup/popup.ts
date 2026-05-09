import type { Purchase } from '../types';

function esc(str: string): string {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)
  );
}

function cap(str: string): string {
  return str.split(' ').map(w => (w[0]?.toUpperCase() ?? '') + w.slice(1)).join(' ');
}

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function renderStats(purchases: Purchase[]): void {
  el('stat-tracked').textContent = String(purchases.length);

  const spent = purchases
    .filter(p => p.price != null)
    .reduce((s, p) => s + (p.price ?? 0), 0);
  el('stat-spent').textContent = spent > 0 ? `$${spent.toFixed(0)}` : '$0';

  el('stat-stores').textContent = String(new Set(purchases.map(p => p.site)).size);
}

function renderHistory(purchases: Purchase[]): void {
  const container = el('history');

  if (purchases.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🃏</div>
        <div>No purchases tracked yet</div>
        <div class="empty-sub">Browse any TCG product page and click<br>"Track this purchase" in the widget</div>
      </div>`;
    return;
  }

  container.innerHTML = purchases.map(p => {
    const date  = new Date(p.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const price = p.price != null ? `AU$${p.price.toFixed(2)}` : 'No price';
    const store = (p.site ?? '').replace('.com.au', '').replace('.com', '');
    const typeLabel = p.productType === 'graded' ? '🏆 Graded'
      : p.productType === 'card' ? '🃏 Card'
      : '📦 Pack';

    return `
      <div class="item">
        <div class="item-game">${esc(cap(p.game ?? ''))} <span class="item-type">${typeLabel}</span></div>
        <div class="item-name" title="${esc(p.productName)}">${esc(p.productName)}</div>
        <div class="item-meta">
          <span class="item-price">${price}</span>
          <span class="item-store">${esc(store)}</span>
          <span class="item-date">${date}</span>
        </div>
      </div>`;
  }).join('');
}

async function load(): Promise<void> {
  const res = await chrome.runtime.sendMessage({ type: 'GET_PURCHASES' }) as
    { ok: boolean; purchases: Purchase[] } | undefined;
  const purchases = res?.purchases ?? [];
  renderStats(purchases);
  renderHistory(purchases);
}

el('clear-btn').addEventListener('click', async () => {
  if (!confirm('Clear all purchase history?')) return;
  await chrome.runtime.sendMessage({ type: 'CLEAR_PURCHASES' });
  void load();
});

void load();
