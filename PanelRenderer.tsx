// PanelRenderer.tsx — نمایش‌دهنده پنل‌ها توی اتاق ربات
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { Panel, PanelAction } from './lib.app.panels';

interface Props {
  panel: Panel;
  onAction: (action: PanelAction) => void;
  onItemClick?: (item: any) => void;
  onClose: () => void;
}

export default function PanelRenderer({ panel, onAction, onItemClick, onClose }: Props) {
  if (!panel) return null;

  const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');

  // ═══════════════════════════════════════════
  // Header
  // ═══════════════════════════════════════════
  const Header = () => (
    <View style={s.head}>
      <Text style={s.headIcon}>{panel.icon}</Text>
      <Text style={s.headTitle}>{panel.title}</Text>
      <TouchableOpacity onPress={onClose} style={s.headClose}>
        <Text style={s.headCloseTxt}>×</Text>
      </TouchableOpacity>
    </View>
  );

  // ═══════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════
  const ActionsRow = ({ actions }: { actions?: PanelAction[] }) => {
    if (!actions || !actions.length) return null;
    return (
      <View style={s.actionsRow}>
        {actions.map((a, i) => (
          <TouchableOpacity
            key={i}
            style={[s.actionBtn, a.confirm && { backgroundColor: '#dc2626' }]}
            onPress={() => onAction(a)}
          >
            <Text style={s.actionIcon}>{a.icon}</Text>
            <Text style={s.actionTxt}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ═══════════════════════════════════════════
  // Render by type
  // ═══════════════════════════════════════════

  // ─── Welcome ───
  if (panel.type === 'welcome') {
    return (
      <View style={s.card}>
        <Header />
        <Text style={s.welcomeMsg}>{panel.data.message}</Text>
        <View style={s.hints}>
          {panel.data.hints?.map((h: string, i: number) => (
            <Text key={i} style={s.hint}>• {h}</Text>
          ))}
        </View>
      </View>
    );
  }

  // ─── Help ───
  if (panel.type === 'help') {
    return (
      <View style={s.card}>
        <Header />
        {panel.data.sections?.map((sec: any, i: number) => (
          <View key={i} style={s.helpSection}>
            <Text style={s.helpTitle}>{sec.title}</Text>
            {sec.items?.map((it: string, j: number) => (
              <Text key={j} style={s.helpItem}>  {it}</Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  // ─── Box Card ───
  if (panel.type === 'box') {
    const d = panel.data;
    const isPos = (d.balance || 0) >= 0;
    return (
      <View style={[s.card, { borderColor: '#10b981' }]}>
        <Header />
        
        <Text style={s.title}>{d.box.name}</Text>
        <View style={s.subInfo}>
          {d.code ? <Text style={s.subTxt}>🔖 {d.code}</Text> : null}
          {d.currency ? <Text style={s.subTxt}>💱 {d.currency}</Text> : null}
          {d.owner ? <Text style={s.subTxt}>👤 {d.owner}</Text> : null}
        </View>
        
        <View style={s.balBox}>
          <Text style={s.balLbl}>موجودی</Text>
          <Text style={[s.balNum, { color: isPos ? '#10b981' : '#ef4444' }]}>
            {Math.abs(d.balance || 0).toLocaleString('en-US')}
          </Text>
          <Text style={s.balCur}>{d.currency || 'AFN'}</Text>
        </View>
        
        <ActionsRow actions={panel.actions} />

        {d.txs && d.txs.length > 0 && (
          <View style={s.txSection}>
            <Text style={s.txTitle}>📋 کارتکس ({d.txCount} تراکنش)</Text>
            {d.txs.map((tx: any, i: number) => {
              const isDep = tx.type === 'deposit' || tx.type === 'in' || tx.type === 'transfer_in';
              return (
                <View key={i} style={s.txRow}>
                  <Text style={[s.txAmt, { color: isDep ? '#10b981' : '#ef4444' }]}>
                    {isDep ? '➕' : '➖'} {fmt(tx.amount)} {tx.currency || ''}
                  </Text>
                  <Text style={s.txDesc} numberOfLines={1}>{tx.description || ''}</Text>
                  <Text style={s.txDate}>
                    {tx.date ? new Date(tx.date).toLocaleDateString('fa-IR') : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  // ─── Box List ───
  if (panel.type === 'box_list') {
    const list = panel.data.list || [];
    return (
      <View style={[s.card, { borderColor: '#0891b2' }]}>
        <Header />
        {list.length === 0 ? (
          <Text style={s.empty}>هیچ صندوقی نیست</Text>
        ) : (
          list.map((b: any, i: number) => (
            <TouchableOpacity
              key={b.id || i}
              style={s.itemRow}
              onPress={() => onItemClick?.({ type: 'box', name: b.name })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>📦 {b.name}</Text>
                {b.owner ? <Text style={s.itemSub}>👤 {b.owner}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.itemAmt}>{fmt(b.balance)} {b.currency}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <ActionsRow actions={panel.actions} />
      </View>
    );
  }

  // ─── Customer Card ───
  if (panel.type === 'customer') {
    const d = panel.data;
    const isPos = (d.balance || 0) >= 0;
    return (
      <View style={[s.card, { borderColor: '#7c3aed' }]}>
        <Header />
        
        <Text style={s.title}>{d.customer.name}</Text>
        <View style={s.subInfo}>
          {d.phone ? <Text style={s.subTxt}>📞 {d.phone}</Text> : null}
          {d.bank ? <Text style={s.subTxt}>🏦 {d.bank}</Text> : null}
          {d.code ? <Text style={s.subTxt}>🔖 {d.code}</Text> : null}
        </View>
        
        <View style={s.balBox}>
          <Text style={s.balLbl}>مانده</Text>
          <Text style={[s.balNum, { color: isPos ? '#10b981' : '#ef4444' }]}>
            {Math.abs(d.balance || 0).toLocaleString('en-US')}
          </Text>
          <Text style={[s.balCur, { color: isPos ? '#10b981' : '#ef4444' }]}>
            {d.balance > 0 ? '🟢 طلبکار' : d.balance < 0 ? '🔴 بدهکار' : '⚪ تسویه'}
          </Text>
        </View>
        
        <ActionsRow actions={panel.actions} />
      </View>
    );
  }

  // ─── Customer List ───
  if (panel.type === 'customer_list') {
    const list = panel.data.list || [];
    return (
      <View style={[s.card, { borderColor: '#7c3aed' }]}>
        <Header />
        {list.length === 0 ? (
          <Text style={s.empty}>هیچ مشتری‌ای نیست</Text>
        ) : (
          list.slice(0, 50).map((c: any, i: number) => (
            <TouchableOpacity
              key={c.id || i}
              style={s.itemRow}
              onPress={() => onItemClick?.({ type: 'customer', name: c.name })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>👤 {c.name}</Text>
                {c.phone ? <Text style={s.itemSub}>📞 {c.phone}</Text> : null}
              </View>
              {c.balance !== undefined && (
                <Text style={[s.itemAmt, { color: c.balance >= 0 ? '#10b981' : '#ef4444' }]}>
                  {Math.abs(c.balance).toLocaleString('en-US')}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
        <ActionsRow actions={panel.actions} />
      </View>
    );
  }

  // ─── Invoice List ───
  if (panel.type === 'invoice_list') {
    const list = panel.data.list || [];
    return (
      <View style={[s.card, { borderColor: '#f59e0b' }]}>
        <Header />
        {list.length === 0 ? (
          <Text style={s.empty}>هیچ فاکتوری نیست</Text>
        ) : (
          list.slice(0, 30).map((inv: any, i: number) => (
            <TouchableOpacity
              key={inv.id || i}
              style={s.itemRow}
              onPress={() => onItemClick?.({ type: 'invoice', invoice: inv.invoice })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>📄 {inv.invoice}</Text>
                <Text style={s.itemSub}>{inv.name} {inv.phone ? '— ' + inv.phone : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.itemAmt}>{fmt(inv.total)}</Text>
                {inv.paid < inv.total && (
                  <Text style={s.itemSub2}>باقی: {fmt(inv.total - inv.paid)}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
        <ActionsRow actions={panel.actions} />
      </View>
    );
  }

  // ─── Invoice Card ───
  if (panel.type === 'invoice') {
    const d = panel.data;
    const inv = d.invoice;
    return (
      <View style={[s.card, { borderColor: '#f59e0b' }]}>
        <Header />
        <Text style={s.title}>فاکتور {inv.invoice}</Text>
        <View style={s.subInfo}>
          <Text style={s.subTxt}>👤 {inv.name}</Text>
          {inv.phone ? <Text style={s.subTxt}>📞 {inv.phone}</Text> : null}
          {inv.date ? <Text style={s.subTxt}>📅 {new Date(inv.date).toLocaleDateString('fa-IR')}</Text> : null}
        </View>
        
        <View style={s.balBox}>
          <Text style={s.balLbl}>جمع کل</Text>
          <Text style={s.balNum}>{fmt(d.total)}</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 20, marginTop: 8 }}>
            <Text style={[s.balCur, { color: '#10b981' }]}>پرداخت: {fmt(d.paid)}</Text>
            <Text style={[s.balCur, { color: '#dc2626' }]}>باقی: {fmt(d.remaining)}</Text>
          </View>
        </View>
        
        {d.items && d.items.length > 0 && (
          <View style={s.txSection}>
            <Text style={s.txTitle}>📋 اقلام ({d.items.length})</Text>
            {d.items.map((it: any, i: number) => (
              <View key={i} style={s.txRow}>
                <Text style={s.txAmt}>{it.model_name || '—'}</Text>
                <Text style={s.txDesc}>{it.quantity} × {fmt(it.price_unit)}</Text>
                <Text style={s.txDate}>{fmt((Number(it.quantity) || 0) * (Number(it.price_unit) || 0))}</Text>
              </View>
            ))}
          </View>
        )}
        
        <ActionsRow actions={panel.actions} />
      </View>
    );
  }

  // ─── Hawala List ───
  if (panel.type === 'hawala_list') {
    const list = panel.data.list || [];
    return (
      <View style={[s.card, { borderColor: '#10b981' }]}>
        <Header />
        {list.length === 0 ? (
          <Text style={s.empty}>هیچ حواله‌ای نیست</Text>
        ) : (
          list.slice(0, 30).map((h: any, i: number) => (
            <View key={h.id || i} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>💸 {h.code || '—'}</Text>
                <Text style={s.itemSub}>
                  {h.direction === 'send' ? '📤' : '📥'} {h.sender || h.beneficiary || '—'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.itemAmt}>{fmt(h.amount)} {h.currency}</Text>
                <Text style={[s.itemSub, {
                  color: h.status === 'done' ? '#10b981' : h.status === 'cancelled' ? '#dc2626' : '#f59e0b'
                }]}>
                  {h.status === 'done' ? '✅ انجام' : h.status === 'cancelled' ? '❌ لغو' : '⏳ در جریان'}
                </Text>
              </View>
            </View>
          ))
        )}
        <ActionsRow actions={panel.actions} />
      </View>
    );
  }

  // ─── Check List ───
  if (panel.type === 'check_list') {
    const list = panel.data.list || [];
    return (
      <View style={[s.card, { borderColor: '#0891b2' }]}>
        <Header />
        {list.length === 0 ? (
          <Text style={s.empty}>هیچ چکی نیست</Text>
        ) : (
          list.slice(0, 30).map((c: any, i: number) => (
            <View key={c.id || i} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>🧾 {c.number || '—'}</Text>
                <Text style={s.itemSub}>{c.bank || '—'} — {c.direction === 'in' ? 'دریافتی' : 'پرداختی'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.itemAmt}>{fmt(c.amount)} {c.currency}</Text>
              </View>
            </View>
          ))
        )}
        <ActionsRow actions={panel.actions} />
      </View>
    );
  }

  // ─── Rate List ───
  if (panel.type === 'rate_list') {
    const list = panel.data.list || [];
    return (
      <View style={[s.card, { borderColor: '#10b981' }]}>
        <Header />
        {list.length === 0 ? (
          <Text style={s.empty}>هیچ نرخی نیست</Text>
        ) : (
          list.map((r: any, i: number) => (
            <View key={i} style={s.itemRow}>
              <Text style={s.itemName}>💱 {r.currency}</Text>
              <Text style={s.itemAmt}>{fmt(r.rate)}</Text>
            </View>
          ))
        )}
        <ActionsRow actions={panel.actions} />
      </View>
    );
  }

  // ─── Stats ───
  if (panel.type === 'stats') {
    const d = panel.data;
    const isPos = (d.profit || 0) >= 0;
    return (
      <View style={[s.card, { borderColor: '#10b981' }]}>
        <Header />
        <Text style={s.title}>{d.rangeLabel}</Text>
        
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statLbl}>فروش</Text>
            <Text style={s.statNum}>{d.salesCount}</Text>
            <Text style={s.statSub}>{fmt(d.totalSales)}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLbl}>خرید</Text>
            <Text style={s.statNum}>{d.purchasesCount}</Text>
            <Text style={s.statSub}>{fmt(d.totalPurchases)}</Text>
          </View>
        </View>
        
        <View style={[s.balBox, { marginTop: 12 }]}>
          <Text style={s.balLbl}>سود خالص</Text>
          <Text style={[s.balNum, { color: isPos ? '#10b981' : '#dc2626' }]}>
            {isPos ? '+' : ''}{fmt(d.profit)}
          </Text>
        </View>
      </View>
    );
  }

  // ─── Search ───
  if (panel.type === 'search') {
    const d = panel.data;
    return (
      <View style={[s.card, { borderColor: '#7c3aed' }]}>
        <Header />
        <Text style={s.subTxt}>🔍 «{d.query}» — {d.results.length} نتیجه</Text>
        {d.results.length === 0 ? (
          <Text style={s.empty}>چیزی پیدا نشد</Text>
        ) : (
          d.results.map((r: any, i: number) => (
            <TouchableOpacity
              key={i}
              style={s.itemRow}
              onPress={() => onItemClick?.({ type: r.type, name: r.name })}
            >
              <Text style={s.itemName}>
                {r.type === 'box' ? '📦' : r.type === 'customer' ? '👤' : '📋'} {r.name}
              </Text>
              <Text style={s.itemSub}>{r.subtitle || ''}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  }

  // ─── Error ───
  if (panel.type === 'error') {
    return (
      <View style={[s.card, { borderColor: '#dc2626' }]}>
        <Header />
        <Text style={s.errorTxt}>{panel.data.message}</Text>
      </View>
    );
  }

  // ─── Default ───
  return (
    <View style={s.card}>
      <Header />
      <Text style={s.empty}>نوع پنل نامشخص: {panel.type}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#0f2438', borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 2, borderColor: '#334155' },
  head: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 10 },
  headIcon: { fontSize: 20, marginLeft: 6 },
  headTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  headClose: { padding: 4 },
  headCloseTxt: { color: '#dc2626', fontSize: 24, fontWeight: 'bold' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  subInfo: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  subTxt: { color: '#94a3b8', fontSize: 12, textAlign: 'right' },
  balBox: { backgroundColor: '#1a2332', padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 10 },
  balLbl: { color: '#94a3b8', fontSize: 12 },
  balNum: { fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  balCur: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  actionsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, minWidth: 80, backgroundColor: '#0891b2', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 4 },
  actionIcon: { fontSize: 16 },
  actionTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  txSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  txTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 },
  txRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a2332', padding: 8, borderRadius: 6, marginTop: 4 },
  txAmt: { fontSize: 13, fontWeight: 'bold', color: '#fff' },
  txDesc: { flex: 1, fontSize: 11, color: '#94a3b8', textAlign: 'right', marginRight: 6 },
  txDate: { fontSize: 10, color: '#64748b' },
  itemRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a2332', padding: 12, borderRadius: 10, marginTop: 6, borderWidth: 1, borderColor: '#334155' },
  itemName: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  itemSub: { color: '#94a3b8', fontSize: 11, marginTop: 2, textAlign: 'right' },
  itemSub2: { color: '#f59e0b', fontSize: 10, marginTop: 2, textAlign: 'right' },
  itemAmt: { color: '#10b981', fontSize: 14, fontWeight: 'bold' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 13 },
  welcomeMsg: { color: '#cbd5e1', fontSize: 14, textAlign: 'right', marginBottom: 10 },
  hints: { backgroundColor: '#1a2332', padding: 10, borderRadius: 8 },
  hint: { color: '#cbd5e1', fontSize: 12, marginTop: 4, textAlign: 'right' },
  helpSection: { marginTop: 10 },
  helpTitle: { color: '#10b981', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  helpItem: { color: '#cbd5e1', fontSize: 12, marginTop: 3, textAlign: 'right' },
  statsRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  statBox: { flex: 1, backgroundColor: '#1a2332', padding: 12, borderRadius: 10, alignItems: 'center' },
  statLbl: { color: '#94a3b8', fontSize: 11 },
  statNum: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  statSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  errorTxt: { color: '#dc2626', fontSize: 13, textAlign: 'center', padding: 10 },
});
