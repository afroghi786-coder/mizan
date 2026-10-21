import { displayDate, displayDateOnly } from './lib-date';
// lib.learning.intents.ts — لیست intent های قابل آموزش
export const LEARNABLE_INTENTS = [
  { id: 'open_box', label: '📦 باز کردن صندوق', example: 'صندوق احمد' },
  { id: 'list_boxes', label: '📋 لیست صندوق‌ها', example: 'همه صندوق‌ها' },
  { id: 'deposit', label: '➕ واریز به صندوق', example: '۵۰۰ به احمد اضافه' },
  { id: 'withdraw', label: '➖ برداشت از صندوق', example: '۱۰۰ از احمد کم' },
  { id: 'balance', label: '💰 مانده مشتری', example: 'مانده رضا' },
  { id: 'open_customer', label: '👤 باز کردن مشتری', example: 'مشتری رضا' },
  { id: 'list_customers', label: '👥 لیست مشتریان', example: 'همه مشتری‌ها' },
  { id: 'open_invoice', label: '📄 باز کردن فاکتور', example: 'فاکتور ۱۲۳۴' },
  { id: 'today_profit', label: '📊 سود و گزارش', example: 'سود امروز' },
  { id: 'help', label: '❓ راهنما', example: 'راهنما' },
];
