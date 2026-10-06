import re
with open('ExchangeScreen.tsx') as f: c = f.read()
orig = c

# ═══════════════════════════════════════════
# ۱. افزودن state های جدید بعد از fDate
# ═══════════════════════════════════════════
old_states = """  const [fDate, setFDate] = useState(new Date().toLocaleDateString('fa-IR'));"""
new_states = """  const [fDate, setFDate] = useState(new Date().toLocaleDateString('fa-IR'));
  // خریدار — فیلدهای کامل
  const [fBuyerPhone, setFBuyerPhone] = useState('');
  const [fBuyerName, setFBuyerName] = useState('');
  const [fBuyerBank, setFBuyerBank] = useState('');
  const [fBuyerAccount, setFBuyerAccount] = useState('');
  const [fBuyerHolder, setFBuyerHolder] = useState('');
  const [fBuyerAddress, setFBuyerAddress] = useState('');
  const [fBuyerStatus, setFBuyerStatus] = useState('');
  // مشتری — فیلدهای کامل
  const [fCustBank, setFCustBank] = useState('');
  const [fCustAccount, setFCustAccount] = useState('');
  const [fCustHolder, setFCustHolder] = useState('');
  const [fCustAddress, setFCustAddress] = useState('');
  const [fCustStatus, setFCustStatus] = useState('');"""

c = c.replace(old_states, new_states, 1)
print("✅ state ها اضافه شدند")

# ═══════════════════════════════════════════
# ۲. بازنویسی lookupCustomer — کامل
# ═══════════════════════════════════════════
old_lookup = """  const lookupCustomer = (phone: string) => {
    const p = String(phone).replace(/[^\\d]/g, '');
    if (p.length < 5) return;
    const found = customers.find(c => String(c.phone || '').replace(/[^\\d]/g, '') === p);
    if (found) {
      setFCustName(found.name || '');
      setFCustCode(found.code || '');
      if (found.bank) setFBank(found.bank);
      if (found.holder_name) setFHolder(found.holder_name);
      showToast('✅ مشتری قبلی: ' + found.name);
    } else if (p.length === 11) {
      setFCustCode('');
      showToast('🆕 مشتری جدید — هنگام ثبت، کد ساخته می‌شود');
    }
  };"""

new_lookup = """  const lookupCustomer = (phone: string) => {
    const p = String(phone).replace(/[^\\d]/g, '');
    if (p.length < 5) return;
    const found = fxCustomers.find((cc: any) => String(cc.phone || '').replace(/[^\\d]/g, '') === p);
    if (found) {
      setFCustName(found.name || '');
      setFCustCode(found.code || '');
      setFCustBank(found.bank || '');
      setFCustAccount(found.account_number || '');
      setFCustHolder(found.holder_name || '');
      setFCustAddress(found.address || '');
      setFCustStatus('✅ قبلی');
      showToast('✅ مشتری قبلی: ' + found.name);
    } else if (p.length === 11) {
      setFCustCode('');
      setFCustStatus('🆕 جدید');
      showToast('🆕 مشتری جدید — هنگام ثبت، کد ساخته می‌شود');
    }
  };

  // ═══ انتخاب خریدار از لیست ═══
  const pickPartner = (b: any) => {
    setFPartner(b.code || '');
    setFBuyerName(b.name || '');
    setFBuyerPhone(b.phone || '');
    setFBuyerBank(b.bank || '');
    setFBuyerAccount(b.account_number || '');
    setFBuyerHolder(b.holder_name || '');
    setFBuyerAddress(b.address || '');
    setFBuyerStatus('✅ قبلی');
    setShowPartnerPick(false);
  };

  // ═══ تلفن خریدار → جستجو ═══
  const onBuyerPhoneChange = (v: string) => {
    const p = v.replace(/[^\\d]/g, '').slice(0, 11);
    setFBuyerPhone(p);
    setFBuyerStatus('');
    if (p.length === 11) {
      const found = fxBuyers.find((b: any) => String(b.phone || '').replace(/[^\\d]/g, '') === p);
      if (found) {
        setFPartner(found.code || '');
        setFBuyerName(found.name || '');
        setFBuyerBank(found.bank || '');
        setFBuyerAccount(found.account_number || '');
        setFBuyerHolder(found.holder_name || '');
        setFBuyerAddress(found.address || '');
        setFBuyerStatus('✅ قبلی');
      } else {
        setFPartner('');
        setFBuyerStatus('🆕 جدید');
      }
    }
  };"""

c = c.replace(old_lookup, new_lookup, 1)
print("✅ lookupCustomer بازنویسی شد + pickPartner اضافه شد")

# ═══════════════════════════════════════════
# ۳. بازنویسی submit
# ═══════════════════════════════════════════
old_submit_start = "  const submit = async () => {"
old_submit_end = "    await reload();\n    resetForm();\n    setSub('list');\n  };"

start_idx = c.find(old_submit_start)
end_idx = c.find(old_submit_end, start_idx)
if start_idx < 0 or end_idx < 0:
    print("❌ submit پیدا نشد")
    exit(1)
end_idx += len(old_submit_end)

new_submit = """  const submit = async () => {
    const buyerPhone = fBuyerPhone.replace(/[^\\d]/g, '');
    const custPhone = fPhone.replace(/[^\\d]/g, '');
    if (buyerPhone.length < 10) return showToast('تلفن خریدار الزامی (۱۱ رقم)', true);
    if (!fBuyerName && !fPartner) return showToast('نام یا انتخاب خریدار الزامی', true);
    if (custPhone.length < 10) return showToast('شماره تماس مشتری الزامی', true);
    if (!fCustName) return showToast('نام مشتری الزامی', true);
    const fq = parse(fFromQty), tq = parse(fToQty), r = parse(fRate);
    if (fq <= 0 || tq <= 0) return showToast('مقدارها را وارد کن', true);
    if (fFrom === fTo) return showToast('ارزها یکسانند', true);

    const buyerName = fBuyerName || (partners.find((p: any) => p.code === fPartner)?.name || '');
    const profit = calcProfit();

    const payload: any = {
      invoice_number: fInvoice,
      trade_type: fType,
      // خریدار
      buyer_code: fPartner || ('B_' + buyerPhone),
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      buyer_bank: fBuyerBank,
      buyer_account: fBuyerAccount,
      buyer_holder: fBuyerHolder,
      buyer_address: fBuyerAddress,
      // مشتری
      customer_code: fCustCode || ('X_' + custPhone),
      customer_name: fCustName,
      customer_phone: custPhone,
      customer_bank: fCustBank,
      customer_account: fCustAccount,
      customer_holder: fCustHolder,
      customer_address: fCustAddress,
      // سازگاری با کد قدیم
      partner_code: fPartner,
      partner_name: buyerName,
      bank: fCustBank,
      holder_name: fCustHolder,
      // معامله
      from_currency: fFrom, to_currency: fTo,
      from_qty: fq, to_qty: tq,
      rate: r || (fq > 0 ? tq / fq : 0),
      profit,
      description: fDesc,
      date: fDate,
    };

    try {
      let created;
      if (editId) {
        const all = await getAllTrades();
        const existing = all.find((x: any) => x.id === editId);
        created = await saveTrade({ ...existing, ...payload, id: editId });
        showToast('✅ ویرایش شد');
      } else {
        created = await saveTrade(payload);
        showToast('✅ معامله ثبت شد');
      }
      await reload();

      // ساخت فاکتور
      const allTrades = await getAllTrades();
      const buyerTrades = allTrades.filter((t: any) => t.buyer_code === created.buyer_code);
      const customerTrades = allTrades.filter((t: any) => t.customer_code === created.customer_code);
      const calcSummary = (list: any[]) => {
        let totalFrom = 0, totalTo = 0, profit = 0;
        list.forEach((t: any) => {
          totalFrom += Number(t.from_qty) || 0;
          totalTo += Number(t.to_qty) || 0;
          profit += Number(t.profit) || 0;
        });
        return { count: list.length, totalFrom, totalTo, profit };
      };
      setShowInvoice({
        trade: created,
        buyer: created.buyer_snapshot || { code: created.buyer_code, name: created.buyer_name, phone: created.buyer_phone },
        customer: created.customer_snapshot || { code: created.customer_code, name: created.customer_name, phone: created.customer_phone },
        buyerSummary: calcSummary(buyerTrades),
        customerSummary: calcSummary(customerTrades),
      });
      resetForm();
    } catch (e: any) {
      showToast('❌ ' + (e?.message || 'خطا در ذخیره'), true);
      console.log('submit error:', e);
    }
  };"""

c = c[:start_idx] + new_submit + c[end_idx:]
print("✅ submit بازنویسی شد")

# ═══════════════════════════════════════════
# ۴. بازنویسی resetForm
# ═══════════════════════════════════════════
old_reset = """  const resetForm = () => {
    setEditId(null); setFInvoice(''); setFType('buy');
    setFPartner(''); setFPhone(''); setFCustName(''); setFCustCode('');
    setFBank(''); setFHolder(''); setFFrom('AFN'); setFTo('USD');
    setFFromQty(''); setFToQty(''); setFRate(''); setFDesc('');
    setFDate(new Date().toLocaleDateString('fa-IR'));
  };"""

new_reset = """  const resetForm = () => {
    setEditId(null); setFInvoice(''); setFType('buy');
    setFPartner(''); setFPhone(''); setFCustName(''); setFCustCode('');
    setFBank(''); setFHolder(''); setFFrom('AFN'); setFTo('USD');
    setFFromQty(''); setFToQty(''); setFRate(''); setFDesc('');
    setFDate(new Date().toLocaleDateString('fa-IR'));
    setFBuyerPhone(''); setFBuyerName(''); setFBuyerBank('');
    setFBuyerAccount(''); setFBuyerHolder(''); setFBuyerAddress(''); setFBuyerStatus('');
    setFCustBank(''); setFCustAccount(''); setFCustHolder(''); setFCustAddress(''); setFCustStatus('');
  };"""

c = c.replace(old_reset, new_reset, 1)
print("✅ resetForm بازنویسی شد")

# ═══════════════════════════════════════════
# ۵. بازنویسی openEdit — پر کردن همه فیلدها
# ═══════════════════════════════════════════
old_open_start = "  const openEdit = (t: any) => {"
old_open_end = "    setSub('form');\n  };"
start_idx = c.find(old_open_start)
end_idx = c.find(old_open_end, start_idx)
if start_idx < 0 or end_idx < 0:
    print("❌ openEdit پیدا نشد")
else:
    end_idx += len(old_open_end)
    new_open = """  const openEdit = (t: any) => {
    setEditId(t.id || t.local_id);
    setFInvoice(t.invoice_number || '');
    setFType(t.trade_type || 'buy');
    setFPartner(t.buyer_code || t.partner_code || '');
    setFBuyerName(t.buyer_name || t.partner_name || '');
    setFBuyerPhone(t.buyer_phone || '');
    setFBuyerBank(t.buyer_bank || '');
    setFBuyerAccount(t.buyer_account || '');
    setFBuyerHolder(t.buyer_holder || '');
    setFBuyerAddress(t.buyer_address || '');
    setFBuyerStatus('✅ قبلی');
    setFPhone(t.customer_phone || '');
    setFCustName(t.customer_name || '');
    setFCustCode(t.customer_code || '');
    setFCustBank(t.customer_bank || t.bank || '');
    setFCustAccount(t.customer_account || '');
    setFCustHolder(t.customer_holder || t.holder_name || '');
    setFCustAddress(t.customer_address || '');
    setFCustStatus('✅ قبلی');
    setFFrom(t.from_currency || 'AFN');
    setFTo(t.to_currency || 'USD');
    setFFromQty(String(t.from_qty || ''));
    setFToQty(String(t.to_qty || ''));
    setFRate(String(t.rate || ''));
    setFDesc(t.description || '');
    setFDate(t.date || new Date().toLocaleDateString('fa-IR'));
    setSub('form');
  };"""
    c = c[:start_idx] + new_open + c[end_idx:]
    print("✅ openEdit بازنویسی شد")

with open('ExchangeScreen.tsx', 'w') as f: f.write(c)
print()
print("changed:", c != orig)
