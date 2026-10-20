export type Group = 'main' | 'dashboard' | 'plusCreate' | 'plusTools';
export type NavItem = { key: string; label: { fa: string; ps: string }; aliases: string[]; icon: string; group: Group };

export const NAV: NavItem[] = [
  { key: 'dashboard', label: { fa: 'داشبورد', ps: 'ډشبورډ' }, aliases: ['داشبورد', 'خانه'], icon: '🏠', group: 'main' },
  { key: 'exchange', label: { fa: 'صرافی', ps: 'صرافي' }, aliases: ['صرافی'], icon: '💱', group: 'main' },
  { key: 'publicMarket', label: { fa: 'بازار عمومی', ps: 'عامه بازار' }, aliases: ['بازار', 'بازار عمومی'], icon: '🛒', group: 'main' },
  { key: 'employees', label: { fa: 'کارمندان', ps: 'کارکوونکي' }, aliases: ['کارمند', 'کارمندان'], icon: '👥', group: 'main' },
  { key: 'expenses', label: { fa: 'هزینه‌ها', ps: 'لګښتونه' }, aliases: ['هزینه', 'هزینه‌ها'], icon: '💸', group: 'main' },

  { key: 'mgr', label: { fa: 'مدیریت', ps: 'مدیریت' }, aliases: ['مدیریت', 'مدیر'], icon: '📋', group: 'dashboard' },
  { key: 'profit', label: { fa: 'سود', ps: 'ګټه' }, aliases: ['سود', 'درآمد'], icon: '📈', group: 'dashboard' },
  { key: 'inventory', label: { fa: 'انبار', ps: 'ګدام' }, aliases: ['انبار', 'موجودی'], icon: '📦', group: 'dashboard' },
  { key: 'bankMatch', label: { fa: 'بانک و پیامک', ps: 'بانک' }, aliases: ['بانک', 'پیامک'], icon: '🏦', group: 'dashboard' },
  { key: 'botLearning', label: { fa: 'آموزش ربات', ps: 'روزنه' }, aliases: ['آموزش'], icon: '🎓', group: 'dashboard' },
  { key: 'manualEntry', label: { fa: 'دستیار', ps: 'لاسنیوی' }, aliases: ['دستیار'], icon: '✍️', group: 'dashboard' },
  { key: 'settings', label: { fa: 'تنظیمات', ps: 'تنظیمات' }, aliases: ['تنظیمات'], icon: '⚙️', group: 'dashboard' },

  { key: 'order', label: { fa: 'فروش جدید', ps: 'نوی پلور' }, aliases: ['فروش جدید'], icon: '🧮', group: 'plusCreate' },
  { key: 'purchase', label: { fa: 'خرید جدید', ps: 'نوی پیرود' }, aliases: ['خرید جدید'], icon: '🧾', group: 'plusCreate' },
  { key: 'exchange:form', label: { fa: 'معامله جدید', ps: 'نوی معامله' }, aliases: ['معامله جدید'], icon: '➕', group: 'plusCreate' },
  { key: 'exchange:hawalas', label: { fa: 'حواله جدید', ps: 'نوی حواله' }, aliases: ['حواله جدید'], icon: '📤', group: 'plusCreate' },
  { key: 'exchange:checks', label: { fa: 'چک جدید', ps: 'نوی چک' }, aliases: ['چک جدید'], icon: '🧾', group: 'plusCreate' },
  { key: 'exchange:customers', label: { fa: 'مشتری جدید', ps: 'نوی پیرودونکی' }, aliases: ['مشتری جدید'], icon: '👤', group: 'plusCreate' },
  { key: 'exchange:partners', label: { fa: 'صراف جدید', ps: 'نوی صراف' }, aliases: ['صراف جدید'], icon: '🤝', group: 'plusCreate' },
  { key: 'exchange:boxes', label: { fa: 'صندوق جدید', ps: 'نوی صندوق' }, aliases: ['صندوق جدید'], icon: '🗃️', group: 'plusCreate' },
  
  { key: 'botLearning', label: { fa: 'آموزش ربات', ps: 'روزنه' }, aliases: ['آموزش'], icon: '🎓', group: 'plusTools' },
  { key: 'manualEntry', label: { fa: 'دستیار', ps: 'لاسنیوی' }, aliases: ['دستیار'], icon: '✍️', group: 'plusTools' },
  { key: 'settings', label: { fa: 'تنظیمات', ps: 'تنظیمات' }, aliases: ['تنظیمات'], icon: '⚙️', group: 'plusTools' },
];

export const byGroup = (g: Group) => NAV.filter((x) => x.group === g);
export const findNav = (text: string, lang: 'fa' | 'ps' = 'fa') => {
  const t = String(text || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
  return NAV.find((n) => n.aliases.some((a) => t.includes(a)) || n.label[lang].includes(t));
};
