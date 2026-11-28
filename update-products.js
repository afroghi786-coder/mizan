const fs = require('fs');

const appPath = 'App.tsx';
if (!fs.existsSync(appPath)) {
  console.error('App.tsx not found');
  process.exit(1);
}

const baks = fs.readdirSync('.').filter((f) => f.startsWith('App.tsx.bak-perf-'));
if (baks.length === 0) {
  fs.copyFileSync(appPath, appPath + '.bak-perf-' + Date.now());
}
const latestBak = fs
  .readdirSync('.')
  .filter((f) => f.startsWith('App.tsx.bak-perf-'))
  .sort()
  .pop();

const lines = fs.readFileSync(latestBak, 'utf8').split(/\r?\n/);
const startIdx = lines.findIndex((l) => l.startsWith('function ProductsSection('));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith('function InvoiceView('));

if (startIdx < 0 || endIdx < 0) {
  console.error('Markers not found:', startIdx, endIdx);
  process.exit(1);
}

const newSection = `function ProductsSection({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      const sorted = [...(data || [])].sort((a: any, b: any) => {
        const ca = String(a.code || '');
        const cb = String(b.code || '');
        if (!ca && !cb) return 0;
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb, undefined, { numeric: true, sensitivity: 'base' });
      });
      setList(sorted);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const normQ = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normQ) return list;
    return list.filter((p: any) =>
      (String(p.code || '') + ' ' + String(p.name || '') + ' ' + String(p.shelf || '') + ' ' + String(p.pack_unit || '') + ' ' + String(p.base_unit || '')).toLowerCase().includes(normQ)
    );
  }, [list, normQ]);

  const getNextProductCode = useCallback((listData: any[], draftData: any[], excludeIdx: number = -1) => {
    let best: { prefix: string; n: number; width: number } | null = null;
    let lastCode = '';
    const scanCode = (c: any) => {
      const str = String(c || '').trim();
      if (!str) return;
      lastCode = str;
      const m = str.match(/^(.*?)(\\d+)$/);
      if (m) {
        const n = parseInt(m[2], 10);
        if (!best || n > best.n) best = { prefix: m[1], n, width: m[2].length };
      }
    };
    for (let i = 0; i < listData.length; i++) scanCode(listData[i]?.code);
    for (let i = 0; i < draftData.length; i++) if (i !== excludeIdx) scanCode(draftData[i]?.code);
    if (!best && !lastCode) return '';
    if (best) return best.prefix + String(best.n + 1).padStart(best.width, '0');
    return lastCode + '-2';
  }, []);

  const autoProductCode = useCallback(() => {
    if (!editing || editing.id || editing.local_id) return;
    if (String(editing.code || '').trim()) return;
    const next = getNextProductCode(list, drafts, -1);
    if (next) setEditing((prev: any) => (prev ? { ...prev, code: next } : prev));
  }, [editing, list, drafts, getNextProductCode]);

  const checkDuplicateName = useCallback((name: string, excludeLocalId?: string, excludeId?: string) => {
    const n = String(name || '').trim();
    if (!n) return null;
    return list.find((x: any) => (x.local_id !== excludeLocalId) && (x.id !== excludeId) && String(x.name || '').trim() === n) || null;
  }, [list]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name) { showToast('نام الزامی است', true); return; }
    if (checkDuplicateName(editing.name, editing.local_id, editing.id)) { showToast('⚠️ این نام کالا قبلاً ثبت شده', true); return; }
    const dupCode = list.find((x: any) => (x.local_id !== editing.local_id) && (x.id !== editing.id) && String(x.code || '').trim() === String(editing.code || '').trim());
    if (dupCode && editing.code) { showToast('⚠️ این کد کالا قبلاً ثبت شده', true); return; }
    const finalCode = editing.code || getNextProductCode(list, drafts, -1);
    try {
      const packSizeNum = Number(editing.pack_size) || 0;
      const discBaseNum = Number(editing.discount_base_unit) || 0;
      const discPackNum = Number(editing.discount_pack_unit) || (packSizeNum > 0 && discBaseNum > 0 ? discBaseNum * packSizeNum : 0);
      const payload: any = {
        ...editing,
        code: finalCode,
        pack_size: packSizeNum,
        base_unit: String(editing.base_unit || 'عدد').trim() || 'عدد',
        pack_unit: String(editing.pack_unit || 'بسته').trim() || 'بسته',
        discount_base_unit: discBaseNum,
        discount_unit: discBaseNum,
        discount_pack_unit: discPackNum,
      };
      delete payload.id;
      if (editing.id || editing.local_id) await updateProduct(editing.local_id || editing.id, payload);
      else await createProduct(payload);
      clearInventoryCache();
      showToast('✅ کالا ذخیره شد');
      setEditing(null);
      load();
    } catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const remove = useCallback(async (p: any) => {
    const ok = await confirmMsg('حذف کالا', '«' + (p.name || '') + '» حذف شود؟');
    if (!ok) return;
    try {
      await deleteProduct(p.local_id || p.id || p._localId || p.code);
      clearInventoryCache();
      load();
      showToast('✅ حذف شد');
    } catch (e: any) { showToast(e?.message || String(e), true); }
  }, []);

  const startNew = () => {
    const nextCode = getNextProductCode(list, drafts);
    setDrafts((prev: any[]) => [...prev, { id: null, code: nextCode, name: '', price: 0, shelf: '', uom_label: 'عدد', pack_size: 0, base_unit: 'عدد', pack_unit: 'بسته', discount_base_unit: 0, discount_pack_unit: 0 }]);
  };

  const updateDraft = (idx: number, field: string, value: any) => {
    setDrafts((prev: any[]) => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const removeDraft = (idx: number) => {
    setDrafts((prev: any[]) => prev.filter((_, i) => i !== idx));
  };

  const saveDrafts = async () => {
    if (!drafts.length) return;
    for (const d of drafts) if (!d.name) { showToast('نام در همه ردیف‌ها الزامی است', true); return; }

    for (let i = 0; i < drafts.length; i++) {
      const name = String(drafts[i].name || '').trim();
      if (list.find((x: any) => String(x.name || '').trim() === name)) {
        showToast('⚠️ نام «' + name + '» قبلاً ثبت شده است', true);
        return;
      }
      if (drafts.find((x: any, j: number) => j !== i && String(x.name || '').trim() === name)) {
        showToast('⚠️ نام «' + name + '» در ردیف‌های دیگر تکراری است', true);
        return;
      }
    }

    const newDrafts = drafts.map((d, i) => (d.code ? d : { ...d, code: getNextProductCode(list, drafts, i) }));
    let success = 0;
    for (const d of newDrafts) {
      try { await createProduct(d); success++; }
      catch (e: any) { showToast('خطا: ' + (e?.message || String(e)), true); }
    }
    if (success) {
      clearInventoryCache();
      showToast('✅ ' + success + ' کالا ذخیره شد');
      setDrafts([]);
      load();
    }
  };

  const renderProductRow = useCallback(({ item: p, index: i }: { item: any; index: number }) => (
    <View style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>
      <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
      <Text style={[s.tdCell, { width: 200, fontSize: 12, color: C.text, fontWeight: 'bold', textAlign: 'right' }]} numberOfLines={1}>{p.name || '—'}</Text>
      <Text style={[s.tdCell, { width: 130, fontSize: 12, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(p.price || 0)}</Text>
      <Text style={[s.tdCell, { width: 120, fontSize: 12, color: C.text }]}>{p.shelf || '—'}</Text>
      <Text style={[s.tdCell, { width: 110, fontSize: 12, color: '#0ea5e9', fontWeight: 'bold' }]}>{p.uom_label || p.base_unit || p.unit_label || 'عدد'}</Text>
      <Text style={[s.tdCell, { width: 90, fontSize: 12, color: C.text }]}>{p.pack_size ? toFaNum(p.pack_size) : '—'}</Text>
      <Text style={[s.tdCell, { width: 90, fontSize: 12, color: C.text }]}>{p.base_unit || 'عدد'}</Text>
      <Text style={[s.tdCell, { width: 90, fontSize: 12, color: C.text }]}>{p.pack_unit || 'بسته'}</Text>
      <Text style={[s.tdCell, { width: 95, fontSize: 11, color: '#0891b2', textAlign: 'center' }]}>{p.discount_base_unit ? fmt(p.discount_base_unit) : '—'}</Text>
      <Text style={[s.tdCell, { width: 95, fontSize: 11, color: '#0891b2', textAlign: 'center' }]}>{p.discount_pack_unit ? fmt(p.discount_pack_unit) : '—'}</Text>
      <Text style={[s.tdCell, { width: 140, fontSize: 11, color: '#7c3aed' }]}>{p.code || '—'}</Text>
      <View style={[s.tdCell, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
        <TouchableOpacity onPress={() => setEditing({ ...p, pack_unit: p.pack_unit || 'بسته', base_unit: p.base_unit || 'عدد', discount_base_unit: Number(p.discount_base_unit) || 0, discount_pack_unit: Number(p.discount_pack_unit) || 0 })} style={{ backgroundColor: '#dbeafe', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>✏️</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => remove(p)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>🗑</Text></TouchableOpacity>
      </View>
    </View>
  ), [remove]);

  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 10 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={startNew}>
          <Text style={s.btnTxt}>➕ افزودن ردیف</Text>
        </TouchableOpacity>
        {drafts.length > 0 && (
          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={saveDrafts}>
            <Text style={s.btnTxt}>💾 ذخیره همه ({drafts.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو در کالاها..." placeholderTextColor={C.textMut} />
      <Text style={s.secT}>📦 کالاها ({toFaNum(filtered.length)})</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse', position: 'relative', zIndex: 10 }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 200 }]}>نام</Text>
            <Text style={[s.thCell, { width: 130 }]}>قیمت</Text>
            <Text style={[s.thCell, { width: 120 }]}>قفسه</Text>
            <Text style={[s.thCell, { width: 110 }]}>واحد</Text>
            <Text style={[s.thCell, { width: 90 }]}>تعداد در بسته</Text>
            <Text style={[s.thCell, { width: 90 }]}>واحد پایه</Text>
            <Text style={[s.thCell, { width: 90 }]}>واحد بسته</Text>
            <Text style={[s.thCell, { width: 95 }]}>تخفیف پایه</Text>
            <Text style={[s.thCell, { width: 95 }]}>تخفیف بسته</Text>
            <Text style={[s.thCell, { width: 140 }]}>کد</Text>
            <Text style={[s.thCell, { width: 100 }]}>عملیات</Text>
          </View>

          {drafts.map((d, idx) => (
            <View key={'draft-' + idx} style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
              <Text style={[s.tdCell, { width: 40, textAlign: 'center', color: '#d4af37', fontWeight: 'bold' }]}>D{idx + 1}</Text>
              <View style={{ width: 200, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.name || '')} onChangeText={(v: string) => updateDraft(idx, 'name', v)} placeholder="نام *" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 130, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.price || '')} onChangeText={(v: string) => updateDraft(idx, 'price', parseFloat(v) || 0)} keyboardType="numeric" placeholder="قیمت" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 120, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.shelf || '')} onChangeText={(v: string) => updateDraft(idx, 'shelf', v)} placeholder="قفسه" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 110, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.uom_label || '')} onChangeText={(v: string) => updateDraft(idx, 'uom_label', v)} placeholder="واحد" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 90, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.pack_size || '')} onChangeText={(v: string) => updateDraft(idx, 'pack_size', parseFloat(v) || 0)} keyboardType="numeric" placeholder="در بسته" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 90, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.base_unit || '')} onChangeText={(v: string) => updateDraft(idx, 'base_unit', v)} placeholder="واحد پایه" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 90, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.pack_unit || '')} onChangeText={(v: string) => updateDraft(idx, 'pack_unit', v)} placeholder="واحد بسته" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 95, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.discount_base_unit || '')} onChangeText={(v: string) => updateDraft(idx, 'discount_base_unit', parseNum(v))} keyboardType="numeric" placeholder="تخفیف پایه" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 95, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.discount_pack_unit || '')} onChangeText={(v: string) => updateDraft(idx, 'discount_pack_unit', parseNum(v))} keyboardType="numeric" placeholder="تخفیف بسته" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 140, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.code || '')} onChangeText={(v: string) => updateDraft(idx, 'code', v)} placeholder="کد" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 100, flexDirection: 'row-reverse', gap: 4, justifyContent: 'center' }}>
                <TouchableOpacity onPress={() => removeDraft(idx)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff', fontSize: 12 }}>✕</Text></TouchableOpacity>
              </View>
            </View>
          ))}

          {editing && (
            <View style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
              <Text style={[s.tdCell, { width: 40 }]}>✏️</Text>
              <View style={{ width: 200, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.name || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, name: v }))} onEndEditing={autoProductCode} placeholder="نام *" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 130, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.price || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, price: parseFloat(v) || 0 }))} keyboardType="numeric" placeholder="قیمت" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 120, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.shelf || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, shelf: v }))} placeholder="قفسه" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 110, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.uom_label || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, uom_label: v }))} placeholder="واحد" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 90, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.pack_size || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, pack_size: parseFloat(v) || 0 }))} keyboardType="numeric" placeholder="در بسته" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 90, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.base_unit || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, base_unit: v }))} placeholder="واحد پایه" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 90, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.pack_unit || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, pack_unit: v }))} placeholder="واحد بسته" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 95, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.discount_base_unit || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, discount_base_unit: parseNum(v) }))} keyboardType="numeric" placeholder="تخفیف پایه" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 95, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.discount_pack_unit || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, discount_pack_unit: parseNum(v) }))} keyboardType="numeric" placeholder="تخفیف بسته" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 140, paddingHorizontal: 2 }}>
                <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.code || '')} onChangeText={(v: string) => setEditing((prev: any) => ({ ...prev, code: v }))} placeholder="کد" placeholderTextColor={C.textMut} />
              </View>
              <View style={{ width: 100, flexDirection: 'row-reverse', gap: 4, justifyContent: 'center' }}>
                <TouchableOpacity onPress={save} style={{ backgroundColor: '#059669', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff', fontSize: 12 }}>💾</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setEditing(null)} style={{ backgroundColor: '#64748b', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff', fontSize: 12 }}>✕</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {loading ? (
            <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item: any, idx: number) => String(item.local_id || item.id || item.code || idx)}
              renderItem={renderProductRow}
              style={{ maxHeight: 440 }}
              nestedScrollEnabled
              initialNumToRender={16}
              maxToRenderPerBatch={16}
              windowSize={7}
              removeClippedSubviews
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

`;

const out = [...lines.slice(0, startIdx), newSection, ...lines.slice(endIdx)].join('\n');
fs.writeFileSync(appPath, out, 'utf8');
console.log('Updated ProductsSection successfully from:', latestBak);