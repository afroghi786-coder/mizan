// این رو در Console مرورگر پیست کن
(async () => {
  const BOX_TX_KEY = '@mizan_local_fx_box_tx';
  const BOX_KEY = '@mizan_local_fx_boxes';
  
  const txs = JSON.parse(localStorage.getItem(BOX_TX_KEY) || '[]');
  const boxes = JSON.parse(localStorage.getItem(BOX_KEY) || '[]');
  const boxMap = {};
  boxes.forEach(b => { boxMap[b.id || b.local_id] = b; });
  
  let fixed = 0;
  const newTxs = txs.map(t => {
    const box = boxMap[t.box_id];
    if (box && box.owner_code && !t.counterparty_code) {
      fixed++;
      return { ...t, counterparty_code: box.owner_code, counterparty_name: box.owner_name, owner_code: box.owner_code, owner_name: box.owner_name };
    }
    return t;
  });
  
  localStorage.setItem(BOX_TX_KEY, JSON.stringify(newTxs));
  console.log('✅ اصلاح شد:', fixed, 'تراکنش');
  console.log('📊 کل تراکنش‌ها:', newTxs.length);
})();
