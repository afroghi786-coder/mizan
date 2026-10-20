export type Group = 'main' | 'dashboard' | 'plusCreate' | 'plusManage' | 'plusTools';
export type NavItem = {
  key: string;
  label: { fa: string; ps: string };
  aliases: string[];
  icon: string;
  group: Group;
};

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

  { key: 'purchase', label: { fa: 'خرید', ps: 'پیرود' }, aliases: ['خرید', 'فاکتور خرید'], icon: '🧾', group: 'plusCreate' },
  { key: 'order', label: { fa: 'فروش', ps: 'پلور' }, aliases: ['فروش', 'سفارش'], icon: '🧮', group: 'plusCreate' },
  { key: 'exchange:form', label: { fa: 'معامله جدید', ps: 'نوی معامله' }, aliases: ['معامله جدید', 'معامله نو'], icon: '➕', group: 'plusCreate' },
  { key: 'exchange:hawalas', label: { fa: 'حواله جدید', ps: 'نوی حواله' }, aliases: ['حواله', 'حواله جدید'], icon: '📤', group: 'plusCreate' },
  { key: 'exchange:checks', label: { fa: 'چک جدید', ps: 'نوی چک' }, aliases: ['چک', 'چک جدید'], icon: '🧾', group: 'plusCreate' },
  { key: 'exchange:customers', label: { fa: 'مشتری جدید', ps: 'نوی پیرودونکی' }, aliases: ['مشتری', 'مشتری جدید'], icon: '👤', group: 'plusCreate' },
  { key: 'expenses', label: { fa: 'هزینه جدید', ps: 'نوی لګښت' }, aliases: ['هزینه جدید'], icon: '💸', group: 'plusCreate' },
  { key: 'employees', label: { fa: 'کارمند جدید', ps: 'نوی کارکوونکی' }, aliases: ['کارمند جدید'], icon: '👥', group: 'plusCreate' },

  { key: 'mgr', label: { fa: 'مدیریت', ps: 'مدیریت' }, aliases: ['مدیریت'], icon: '📋', group: 'plusManage' },
  { key: 'profit', label: { fa: 'سود', ps: 'ګټه' }, aliases: ['سود'], icon: '📈', group: 'plusManage' },
  { key: 'inventory', label: { fa: 'انبار', ps: 'ګدام' }, aliases: ['انبار'], icon: '📦', group: 'plusManage' },
  { key: 'bankMatch', label: { fa: 'بانک', ps: 'بانک' }, aliases: ['بانک'], icon: '🏦', group: 'plusManage' },

  { key: 'botLearning', label: { fa: 'آموزش ربات', ps: 'روزنه' }, aliases: ['آموزش'], icon: '🎓', group: 'plusTools' },
  { key: 'manualEntry', label: { fa: 'دستیار', ps: 'لاسنیوی' }, aliases: ['دستیار'], icon: '✍️', group: 'plusTools' },
  { key: 'settings', label: { fa: 'تنظیمات', ps: 'تنظیمات' }, aliases: ['تنظیمات'], icon: '⚙️', group: 'plusTools' },
];

export const byGroup = (g: Group) => NAV.filter((x) => x.group === g);
export const findNav = (text: string, lang: 'fa' | 'ps' = 'fa') => {
  const t = String(text || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
  return NAV.find((n) => n.aliases.some((a) => t.includes(a)) || n.label[lang].includes(t));
};
