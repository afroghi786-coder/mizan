// lib.fx.trade.ts — Fx Trades via SQLite
import { Trades } from './lib.all.sqlite';

export async function getAllTrades(): Promise<any[]> {
  return Trades.getAll();
}

export async function saveTrade(item: any): Promise<any> {
  return Trades.save(item);
}

export async function deleteTrade(id: string): Promise<void> {
  return Trades.delete(id);
}
