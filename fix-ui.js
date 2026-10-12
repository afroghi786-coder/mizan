// fix-ui.js — فقط زیباسازی UI بازار عمومی
const fs = require('fs');

let pms = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
let changed = 0;

function replaceOnce(oldStr, newStr, label) {
  if (pms.includes(oldStr)) {
    pms = pms.replace(oldStr, newStr);
    console.log('✅ ' + label);
    changed++;
    return true;
  }
  console.log('⚠️ ' + label + ' — الگو پیدا نشد');
  return false;
}

// ═══ ۱. کارت دسته‌ها — بزرگ‌تر و با سایه ═══
replaceOnce(
  `  bigCard: { backgroundColor: '#0f2438', padding: 16, borderRadius: 12, marginBottom: 10, borderRightWidth: 4, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, minHeight: 70 },
  bigCardIcon: { fontSize: 34 },
  bigCardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  bigCardSub: { color: '#94a3b8', fontSize: 11, textAlign: 'right', marginTop: 4 },
  bigCardArrow: { color: '#94a3b8', fontSize: 32, fontWeight: 'bold', marginLeft: 8 },`,
  `  bigCard: { backgroundColor: '#0f2438', padding: 18, borderRadius: 16, marginBottom: 12, borderRightWidth: 5, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, minHeight: 90, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  bigCardIcon: { fontSize: 40 },
  bigCardTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'right' },
  bigCardSub: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 6 },
  bigCardArrow: { color: '#94a3b8', fontSize: 36, fontWeight: 'bold', marginLeft: 10 },`,
  'کارت دسته‌ها'
);

// ═══ ۲. input — بزرگ‌تر با border واضح ═══
replaceOnce(
  `  inp: { backgroundColor: '#0a1628', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },`,
  `  inp: { backgroundColor: '#0a1628', color: '#fff', borderWidth: 2, borderColor: '#334155', borderRadius: 12, padding: 14, fontSize: 14, textAlign: 'right', marginBottom: 6 },`,
  'input'
);

// ═══ ۳. label — واضح‌تر ═══
replaceOnce(
  `  lbl: { color: '#94a3b8', fontSize: 11, marginTop: 10, marginBottom: 4, textAlign: 'right', fontWeight: 'bold' },`,
  `  lbl: { color: '#cbd5e1', fontSize: 13, marginTop: 14, marginBottom: 6, textAlign: 'right', fontWeight: 'bold' },`,
  'label'
);

// ═══ ۴. هدر — بزرگ‌تر ═══
replaceOnce(
  `  head: { backgroundColor: '#0f2438', padding: 14, borderBottomWidth: 2, borderBottomColor: '#d4af37' },`,
  `  head: { backgroundColor: '#0f2438', paddingHorizontal: 18, paddingVertical: 20, borderBottomWidth: 2, borderBottomColor: '#d4af37' },`,
  'هدر'
);

// ═══ ۵. زیرتب‌ها — بزرگ‌تر ═══
replaceOnce(
  `  subTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0f2438', borderWidth: 1, borderColor: '#334155' },`,
  `  subTab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, backgroundColor: '#0f2438', borderWidth: 1.5, borderColor: '#334155', minWidth: 110, alignItems: 'center' },`,
  'زیرتب‌ها'
);

replaceOnce(
  `  subTabTxt: { color: '#94a3b8', fontSize: 12 },`,
  `  subTabTxt: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },`,
  'متن زیرتب'
);

// ═══ ۶. کارت آگهی — بزرگ‌تر + سایه ═══
replaceOnce(
  `  card: { backgroundColor: '#0f2438', padding: 12, borderRadius: 10, marginBottom: 8, borderRightWidth: 3 },`,
  `  card: { backgroundColor: '#0f2438', padding: 16, borderRadius: 14, marginBottom: 12, borderRightWidth: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },`,
  'کارت آگهی'
);

// ═══ ۷. عنوان آگهی ═══
replaceOnce(
  `  cardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', flex: 1, textAlign: 'right', marginRight: 8 },`,
  `  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'right', marginRight: 8, lineHeight: 22 },`,
  'عنوان آگهی'
);

// ═══ ۸. توضیحات ═══
replaceOnce(
  `  cardDesc: { color: '#cbd5e1', fontSize: 12, marginTop: 6, textAlign: 'right' },`,
  `  cardDesc: { color: '#cbd5e1', fontSize: 13.5, marginTop: 8, textAlign: 'right', lineHeight: 22 },`,
  'توضیحات'
);

// ═══ ۹. قیمت ═══
replaceOnce(
  `  cardPrice: { color: '#10b981', fontSize: 13, fontWeight: 'bold', marginTop: 6, textAlign: 'right' },`,
  `  cardPrice: { color: '#10b981', fontSize: 15, fontWeight: 'bold', marginTop: 8, textAlign: 'right' },`,
  'قیمت'
);

// ═══ ۱۰. دکمه چت ═══
replaceOnce(
  `  chatBtn: { paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 8 },`,
  `  chatBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },`,
  'دکمه چت'
);

// ═══ ۱۱. chips ═══
replaceOnce(
  `  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#0f2438', borderWidth: 1, borderColor: '#334155' },`,
  `  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, backgroundColor: '#0f2438', borderWidth: 1.5, borderColor: '#334155' },`,
  'chips'
);

// ═══ ذخیره ═══
if (changed > 0) {
  fs.writeFileSync('PublicMarketScreen.tsx', pms, 'utf8');
  console.log('\n💾 ذخیره شد — ' + changed + ' تغییر');
} else {
  console.log('\n⚠️ هیچ تغییر اعمال نشد');
}