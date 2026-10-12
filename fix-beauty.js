// fix-beauty.js — زیباسازی نهایی بازار عمومی
const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
let n = 0;

function rp(old, nw, label) {
  if (s.includes(old)) {
    s = s.replace(old, nw);
    console.log('✅ ' + label);
    n++;
  } else {
    console.log('⚠️ ' + label + ' — پیدا نشد');
  }
}

// ═══ ۱. کارت دسته — بزرگ‌تر و درخشان‌تر ═══
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
    padding: 18,
    borderRadius: 18,
    marginBottom: 14,
    borderRightWidth: 5,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    minHeight: 96,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },`,
'کارت دسته بزرگ‌تر'
);

// ═══ ۲. آیکون باکس — بزرگ‌تر ═══
rp(
`  bigCardIconBox: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },`,
`  bigCardIconBox: {
    width: 62, height: 62, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },`,
'آیکون باکس بزرگ‌تر'
);

rp(
`  bigCardIcon: { fontSize: 26 },`,
`  bigCardIcon: { fontSize: 32 },`,
'آیکون دسته'
);

rp(
`  bigCardTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },`,
`  bigCardTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'right', letterSpacing: 0.3 },`,
'عنوان دسته'
);

rp(
`  bigCardSub: { color: '#94a3b8', fontSize: 11, textAlign: 'right', marginTop: 4 },`,
`  bigCardSub: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 6 },`,
'زیرنویس دسته'
);

rp(
`  bigCardArrowBox: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },`,
`  bigCardArrowBox: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },`,
'جعبه فلش'
);

rp(
`  bigCardArrow: { fontSize: 22, fontWeight: 'bold', lineHeight: 24 },`,
`  bigCardArrow: { fontSize: 26, fontWeight: 'bold', lineHeight: 28 },`,
'فلش'
);

// ═══ ۳. کارت آگهی — بزرگ‌تر ═══
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

// ═══ ۴. متن‌های کارت آگهی ═══
rp(
`  cardTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, textAlign: 'right', marginRight: 8 },`,
`  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'right', marginRight: 8, lineHeight: 22 },`,
'عنوان آگهی'
);

rp(
`  cardDesc: { color: '#cbd5e1', fontSize: 12, marginTop: 8, textAlign: 'right', lineHeight: 20 },`,
`  cardDesc: { color: '#cbd5e1', fontSize: 13.5, marginTop: 10, textAlign: 'right', lineHeight: 22 },`,
'توضیحات'
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

// ═══ ۵. دکمه چت ═══
rp(
`  chatBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },`,
`  chatBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },`,
'دکمه چت'
);

rp(
`  chatBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },`,
`  chatBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.3 },`,
'متن دکمه چت'
);

// ═══ ۶. FAB — بزرگ‌تر ═══
rp(
`  fab: { position: 'absolute', bottom: 24, right: 20, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 30, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },`,
`  fab: { position: 'absolute', bottom: 28, right: 20, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 32, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, elevation: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },`,
'FAB'
);

rp(
`  fabTxt: { fontSize: 20 },`,
`  fabTxt: { fontSize: 22 },`,
'آیکون FAB'
);

rp(
`  fabLbl: { color: '#fff', fontWeight: 'bold', fontSize: 14 },`,
`  fabLbl: { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.3 },`,
'متن FAB'
);

// ═══ ۷. input — بزرگ‌تر ═══
rp(
`  inp: { backgroundColor: '#0a1628', color: '#fff', borderWidth: 1.5, borderColor: '#334155', borderRadius: 10, padding: 12, fontSize: 13, textAlign: 'right', marginBottom: 4 },`,
`  inp: { backgroundColor: '#0a1628', color: '#fff', borderWidth: 2, borderColor: '#334155', borderRadius: 12, padding: 14, fontSize: 14, textAlign: 'right', marginBottom: 6 },`,
'input'
);

// ═══ ۸. هدر مودال ═══
rp(
`  mHead: { padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },`,
`  mHead: { padding: 18, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },`,
'هدر مودال'
);

rp(
`  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },`,
`  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, flex: 1, textAlign: 'right' },`,
'عنوان مودال'
);

// ═══ ۹. دکمه‌ها ═══
rp(
`  btn: { padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },`,
`  btn: { padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },`,
'دکمه‌ها'
);

rp(
`  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },`,
`  btnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.3 },`,
'متن دکمه'
);

// ═══ ذخیره ═══
if (n > 0) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\n⚠️ هیچ تغییری اعمال نشد');
}