// lib.boxes.ts — Proxy به SQLite
// 🎯 نسخه اصلی در lib.boxes.sqlite.ts
// 🎯 این فایل همه توابع قبلی رو re-export می‌کنه

export {
  getBoxes,
  saveBox,
  deleteBox,
  getBoxTransactions,
  addBoxTransaction,
  deleteBoxTransaction,
  getAllBalances,
  getBoxKardex,
} from './lib.boxes.sqlite';
