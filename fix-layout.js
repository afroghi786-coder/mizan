// fix-layout.js — فقط چیدمان بازار عمومی
// ⚠️ به صدا، پیام، ثبت، چت دست نمی‌زند
const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;
let n = 0;

function rp(old, nw, label) {
  if (s.includes(old)) {
    s = s.replace(old, nw);
    console.log('✅ ' + label);
    n++;
    return true;
  }
  console.log('⚠️ ' + label);
  return false;
}

// ═══════════════════════════════════════════
// ۱. کارت دسته — زیباتر (با حفظ عملکرد)
// ═══════════════════════════════════════════
rp(
`  bigCard: {
    backgroundColor: '#0f2438',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderRightWidth: 4,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    minHeight: 82,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },`,
`  bigCard: {
    backgroundColor: '#0f2438',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderRightWidth: 5,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    minHeight: 88,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },`,
'کارت دسته'
);

rp(
`  bigCardIconBox: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },`,
`  bigCardIconBox: {
    width: 58, height: 58, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },`,
'آیکون دسته'
);

rp(
`  bigCardIcon: { fontSize: 26 },`,
`  bigCardIcon: { fontSize: 30 },`,
'سایز آیکون'
);

rp(
`  bigCardTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },`,
`  bigCardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },`,
'عنوان دسته'
);

rp(
`  bigCardSub: { color: '#94a3b8', fontSize: 11, textAlign: 'right', marginTop: 4 },`,
`  bigCardSub: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 5 },`,
'زیرنویس دسته'
);

// ═══════════════════════════════════════════
// ۲. کارت آگهی — بزرگ‌تر، فضای بیشتر
// ═══════════════════════════════════════════
rp(
`  card: {
    backgroundColor: '#0f2438',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderRightWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },`,
`  card: {
    backgroundColor: '#0f2438',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderRightWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },`,
'کارت آگهی'
);

// ═══════════════════════════════════════════
// ۳. متن‌های کارت آگهی — بزرگ‌تر برای خوانایی
// ═══════════════════════════════════════════
rp(
`  cardTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, textAlign: 'right', marginRight: 8 },`,
`  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'right', marginRight: 10, lineHeight: 22 },`,
'عنوان آگهی'
);

rp(
`  cardDesc: { color: '#cbd5e1', fontSize: 12, marginTop: 8, textAlign: 'right', lineHeight: 20 },`,
`  cardDesc: { color: '#cbd5e1', fontSize: 13, marginTop: 10, textAlign: 'right', lineHeight: 22 },`,
'توضیحات آگهی'
);

rp(
`  cardPrice: { color: '#10b981', fontSize: 14, fontWeight: 'bold', marginTop: 8, textAlign: 'right' },`,
`  cardPrice: { color: '#10b981', fontSize: 15, fontWeight: 'bold', marginTop: 10, textAlign: 'right' },`,
'قیمت'
);

rp(
`  cardBy: { color: '#64748b', fontSize: 10, marginTop: 6, textAlign: 'right' },`,
`  cardBy: { color: '#94a3b8', fontSize: 11, marginTop: 8, textAlign: 'right' },`,
'نویسنده آگهی'
);

// ═══════════════════════════════════════════
// ۴. padding لیست — فضای بیشتر
// ═══════════════════════════════════════════
rp(
  "contentContainerStyle={{ padding: 8, paddingBottom: 100 }}",
  "contentContainerStyle={{ padding: 12, paddingBottom: 120 }}",
  'پدینگ لیست'
);

// ═══════════════════════════════════════════
// ۵. FAB — بزرگ‌تر برای لمس راحت
// ═══════════════════════════════════════════
rp(
`  fab: { position: 'absolute', bottom: 24, right: 20, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 30, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },`,
`  fab: { position: 'absolute', bottom: 26, right: 20, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 32, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, elevation: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },`,
'FAB'
);

// ═══════════════════════════════════════════
// ۶. دکمه چت — بزرگ‌تر
// ═══════════════════════════════════════════
rp(
`  chatBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },`,
`  chatBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },`,
'دکمه چت'
);

rp(
`  chatBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },`,
`  chatBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },`,
'متن دکمه چت'
);

// ذخیره
if (s !== orig) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\n⚠️ هیچ تغییری اعمال نشد');
}