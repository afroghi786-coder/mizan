const fs = require('fs');

// ═══════════════════════════════════════════
// ۱. App.tsx — حذف ExchangeBell جدید (چون با LiveMarket تداخل داره)
// ═══════════════════════════════════════════
console.log('═══ App.tsx ═══');
let a = fs.readFileSync('App.tsx', 'utf8');
const aOrig = a;

a = a.replace(/import ExchangeBell from '\.\/ExchangeBell';\n?/g, '');
a = a.replace(/\s*\{tab === 'exchange' && <ExchangeBell[^}]*\/>\}/g, '');

if (a !== aOrig) {
  fs.writeFileSync('App.tsx', a, 'utf8');
  console.log('✅ ExchangeBell جدید حذف شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

// ═══════════════════════════════════════════
// ۲. LiveMarketScreen — اضافه badge + 3 دکمه
// ═══════════════════════════════════════════
console.log('');
console.log('═══ LiveMarketScreen.tsx ═══');
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;

// ۲.۱ state برای unread counts
if (!s.includes('notifUnread')) {
  const anchor = "const [prefs, setPrefs] = useState<any>({});";
  if (s.includes(anchor)) {
    s = s.replace(anchor, anchor + "\n  const [notifUnread, setNotifUnread] = useState<any>({});");
    console.log('✅ state notifUnread اضافه شد');
  }
}

// ۲.۲ useEffect برای شمارش
if (!s.includes('setNotifUnread')) {
  const anchor = "useEffect(() => { refresh(); return () => stopAllListeners(); }, [refresh]);";
  if (s.includes(anchor)) {
    const effect = "\n\n  // 🔢 شمارش پیام‌های نخوانده هر طرف\n  useEffect(() => {\n    if (!notifList || !notifList.length) return;\n    let alive = true;\n    const tick = async () => {\n      try {\n        const m = await import('./lib.network');\n        const sb = (m as any)._sb;\n        const myE = net.email;\n        if (!sb || !myE) return;\n        const map: any = {};\n        for (const nt of notifList) {\n          const p = nt.payload || {};\n          let rId = '';\n          if (nt.type === 'direct_hawala' || nt.type === 'direct_accepted') rId = 'dh_' + p.hawalaId;\n          else if (nt.type === 'hawala_taken' || nt.type === 'hawala_new') rId = 'hw_' + (p.taskId || p.hawalaId);\n          else if (nt.type === 'fx_new' || nt.type === 'fx_taken') rId = 'fx_' + p.offerId;\n          if (!rId || map[rId] !== undefined) continue;\n          const { data } = await sb.from('net_messages').select('is_read').eq('room_id', rId).eq('to_email', myE);\n          map[rId] = (data || []).filter((x: any) => !x.is_read).length;\n        }\n        if (alive) setNotifUnread(map);\n      } catch {}\n    };\n    tick();\n    const iv = setInterval(tick, 5000);\n    return () => { alive = false; clearInterval(iv); };\n  }, [notifList, net.email]);";
    s = s.replace(anchor, anchor + effect);
    console.log('✅ useEffect شمارش اضافه شد');
  }
}

// ۲.۳ جایگزینی دکمه پیام
const idx = s.indexOf('openChatFromNotif(n)');
if (idx > 0) {
  const btnStart = s.lastIndexOf('<TouchableOpacity', idx);
  const btnEnd = s.indexOf('</TouchableOpacity>', idx) + '</TouchableOpacity>'.length;
  const oldBtn = s.substring(btnStart, btnEnd);
  console.log('✅ دکمه پیام پیدا شد (' + oldBtn.length + ' بایت)');

  const newBtn = `{(() => {
                        const p = n.payload || {};
                        const t = String(n.type || '');
                        const isDone = t.includes('delivered');
                        const isInfo = t.includes('group');
                        const hasDeal = !!(p.hawalaId || p.offerId || p.taskId);
                        const isAccepted = t.includes('taken') || t.includes('accepted');
                        let rId = '';
                        if (t === 'direct_hawala' || t === 'direct_accepted') rId = 'dh_' + p.hawalaId;
                        else if (t === 'hawala_taken' || t === 'hawala_new') rId = 'hw_' + (p.taskId || p.hawalaId);
                        else if (t === 'fx_new' || t === 'fx_taken') rId = 'fx_' + p.offerId;
                        const cnt = notifUnread[rId] || 0;
                        return (
                          <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                            <TouchableOpacity
                              onPress={() => openChatFromNotif(n)}
                              style={{ backgroundColor: '#0891b2', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}
                            >
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>💬 پیام</Text>
                              {cnt > 0 ? (
                                <View style={{ backgroundColor: '#ef4444', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{cnt > 9 ? '۹+' : cnt}</Text>
                                </View>
                              ) : null}
                            </TouchableOpacity>
                            {hasDeal && !isDone && !isInfo ? (
                              !isAccepted ? (
                                <TouchableOpacity
                                  onPress={async () => {
                                    try {
                                      const m = await import('./lib.network');
                                      if (t.includes('direct') && p.hawalaId) await (m as any).acceptDirectHawala?.(p.hawalaId);
                                      else if (t.includes('hawala') && (p.hawalaId || p.taskId)) await (m as any).claimHawala?.(p.hawalaId || p.taskId);
                                      else if (t.includes('fx') && p.offerId) await (m as any).claimFXOffer?.(p.offerId);
                                      showToast?.('✅ قبول شد');
                                      refresh();
                                    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
                                  }}
                                  style={{ backgroundColor: '#059669', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 }}
                                >
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✅ قبول</Text>
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity
                                  onPress={async () => {
                                    try {
                                      const m = await import('./lib.network');
                                      if (t.includes('direct') && p.hawalaId) await (m as any).deliverDirectHawala?.(p.hawalaId, net.email);
                                      else if (t.includes('hawala') && (p.hawalaId || p.taskId)) await (m as any).deliverHawalaByUser?.(p.hawalaId || p.taskId);
                                      showToast?.('✅ تحویل شد');
                                      refresh();
                                    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
                                  }}
                                  style={{ backgroundColor: '#7c3aed', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 }}
                                >
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>📦 تحویل</Text>
                                </TouchableOpacity>
                              )
                            ) : null}
                            {hasDeal && !isDone && !isInfo ? (
                              <TouchableOpacity
                                onPress={async () => {
                                  if (typeof window !== 'undefined' && window.confirm && !window.confirm('لغو شود؟')) return;
                                  try {
                                    const m = await import('./lib.network');
                                    if (t.includes('direct') && p.hawalaId) await (m as any).cancelDirectHawala?.(p.hawalaId);
                                    else if (t.includes('hawala') && (p.hawalaId || p.taskId)) await (m as any).cancelHawala?.(p.hawalaId || p.taskId);
                                    else if (t.includes('fx') && p.offerId) await (m as any).cancelFXOffer?.(p.offerId);
                                    showToast?.('🗑 لغو شد');
                                    setNotifList((prev: any[]) => prev.filter((x: any) => x.id !== n.id));
                                  } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
                                }}
                                style={{ backgroundColor: '#dc2626', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 }}
                              >
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>❌ لغو</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })()}`;

  s = s.substring(0, btnStart) + newBtn + s.substring(btnEnd);
  console.log('✅ دکمه پیام با ۳ دکمه + badge جایگزین شد');
}

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');