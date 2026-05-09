function esc(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function cap(str) {
  return str.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

function renderStats(purchases) {
  document.getElementById('stat-tracked').textContent = purchases.length;

  const spent = purchases.filter(p => p.price).reduce((s, p) => s + p.price, 0);
  document.getElementById('stat-spent').textContent =
    spent > 0 ? `$${spent.toFixed(0)}` : '$0';

  document.getElementById('stat-stores').textContent =
    new Set(purchases.map(p => p.site)).size;
}

function renderHistory(purchases) {
  const el = document.getElementById('history');

  if (purchases.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🃏</div>
        <div>No purchases tracked yet</div>
        <div class="empty-sub">Browse any card pack page and click<br>"Track this purchase" in the widget</div>
      </div>`;
    return;
  }

  el.innerHTML = purchases.map(p => {
    const date  = new Date(p.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const price = p.price ? `AU$${p.price.toFixed(2)}` : 'No price';
    const store = (p.site || '').replace('.com.au', '').replace('.com', '');

    return `
      <div class="item">
        <div class="item-game">${esc(cap(p.game || ''))}</div>
        <div class="item-name" title="${esc(p.productName)}">${esc(p.productName)}</div>
        <div class="item-meta">
          <span class="item-price">${price}</span>
          <span class="item-store">${esc(store)}</span>
          <span class="item-date">${date}</span>
        </div>
      </div>`;
  }).join('');
}

async function load() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_PURCHASES' });
  const purchases = res?.purchases || [];
  renderStats(purchases);
  renderHistory(purchases);
}

document.getElementById('clear-btn').addEventListener('click', async () => {
  if (!confirm('Clear all purchase history?')) return;
  await chrome.runtime.sendMessage({ type: 'CLEAR_PURCHASES' });
  load();
});

load();
