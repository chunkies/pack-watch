chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_PRICES') {
    handleFetchPrices(message.query)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'TRACK_PURCHASE') {
    handleTrackPurchase(message.purchase)
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'GET_PURCHASES') {
    chrome.storage.local.get('purchases', ({ purchases = [] }) => {
      sendResponse({ ok: true, purchases });
    });
    return true;
  }

  if (message.type === 'CLEAR_PURCHASES') {
    chrome.storage.local.set({ purchases: [] }, () => sendResponse({ ok: true }));
    return true;
  }
});

async function handleFetchPrices(query) {
  const encodedQuery = encodeURIComponent(query);
  const result = {
    ebay: null,
    links: buildLinks(encodedQuery),
  };

  try {
    result.ebay = await fetchEbayAU(query);
  } catch (e) {
    // eBay unavailable — links-only mode
  }

  return result;
}

async function fetchEbayAU(query) {
  const url = `https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_BIN=1&_sop=15&_ipg=25`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!resp.ok) throw new Error(`eBay ${resp.status}`);
  const html = await resp.text();
  return parseEbayPrices(html, url);
}

function parseEbayPrices(html, searchUrl) {
  const prices = [];

  // itemprop price content attribute (most reliable)
  const re1 = /itemprop="price"[^>]*content="([\d.]+)"/g;
  let m;
  while ((m = re1.exec(html)) !== null) {
    const p = parseFloat(m[1]);
    if (p > 0.5 && p < 5000) prices.push(p);
  }

  // Fallback: text price in s-item__price span
  if (prices.length === 0) {
    const re2 = /class="s-item__price"[^>]*>\s*(?:AU\s*)?\$([\d,]+\.?\d*)/g;
    while ((m = re2.exec(html)) !== null) {
      const p = parseFloat(m[1].replace(',', ''));
      if (p > 0.5 && p < 5000) prices.push(p);
    }
  }

  if (prices.length === 0) return null;

  prices.sort((a, b) => a - b);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  return {
    lowest: prices[0],
    average: Math.round(avg * 100) / 100,
    count: prices.length,
    currency: 'AUD',
    searchUrl,
  };
}

function buildLinks(encodedQuery) {
  return {
    ebay_au:       `https://www.ebay.com.au/sch/i.html?_nkw=${encodedQuery}&_sop=15`,
    ebay_us:       `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sop=15`,
    tcgplayer:     `https://www.tcgplayer.com/search/all/product?q=${encodedQuery}`,
    cardmarket:    `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodedQuery}`,
    amazon_au:     `https://www.amazon.com.au/s?k=${encodedQuery}`,
    google_shop:   `https://www.google.com/search?q=${encodedQuery}+buy+price&tbm=shop`,
  };
}

async function handleTrackPurchase(purchase) {
  const { purchases = [] } = await chrome.storage.local.get('purchases');
  purchases.unshift({
    ...purchase,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: new Date().toISOString(),
  });
  if (purchases.length > 200) purchases.splice(200);
  await chrome.storage.local.set({ purchases });
}
