import re
with open('ExchangeScreen.tsx') as f: c = f.read()
orig = c

# پیدا کردن محدوده فرم
start = c.find("{sub === 'form' && (")
end_marker = c.find("        {/* ═══════ مشتریان ═══════ */}", start)
if start < 0 or end_marker < 0:
    print("❌ محدوده فرم پیدا نشد")
    exit(1)

new_form = """{sub === 'form' && (
          <View style={s.formCard}>
            <Text style={s.formTitle}>{editId ? '✏️ ویرایش معامله' : '➕ معامله جدید'}</Text>

            <Text style={s.lbl}>🧾 شماره فاکتور</Text>
            <TextInput style={s.inp} value={fInvoice} onChangeText={setFInvoice} editable={!editId} />

            <Text style={s.lbl}>📅 تاریخ</Text>
            <TextInput style={s.inp} value={fDate} onChangeText={setFDate} />

            {/* ══════ خریدار ══════ */}
            <View style={{ backgroundColor: '#ecfdf5', borderRadius: 10, padding: 10, marginTop: 12, marginBottom: 12, borderWidth: 1, borderColor: '#a7f3d0' }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#065f46', textAlign: 'right' }}>🏢 اطلاعات خریدار</Text>
                {fBuyerStatus ? <Text style={{ fontSize: 11, fontWeight: 'bold', color: fBuyerStatus.includes('قبلی') ? '#059669' : '#ea580c' }}>{fBuyerStatus}</Text> : null}
              </View>

              <Text style={s.lbl}>👤 نام خریدار (کلیک برای انتخاب از لیست)</Text>
              <TouchableOpacity style={s.inp} onPress={() => setShowPartnerPick(true)}>
                <Text style={{ color: fBuyerName ? '#0f2438' : '#94a3b8', textAlign: 'right' }}>
                  {fBuyerName || '🔍 انتخاب از لیست خریداران...'}
                </Text>
              </TouchableOpacity>

              <Text style={s.lbl}>📞 تلفن خریدار *</Text>
              <TextInput style={s.inp} value={fBuyerPhone} onChangeText={onBuyerPhoneChange} keyboardType="phone-pad" maxLength={11} placeholder="09..." placeholderTextColor="#94a3b8" />

              {fPartner ? <View style={{ backgroundColor: '#d1fae5', padding: 6, borderRadius: 6, marginTop: 4 }}><Text style={{ color: '#065f46', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>🆔 {fPartner}</Text></View> : null}

              <Text style={s.lbl}>🏦 بانک</Text>
              <TextInput style={s.inp} value={fBuyerBank} onChangeText={setFBuyerBank} placeholder="نام بانک" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>💳 شماره حساب</Text>
              <TextInput style={s.inp} value={fBuyerAccount} onChangeText={setFBuyerAccount} keyboardType="numeric" placeholder="شماره حساب" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>👤 صاحب حساب</Text>
              <TextInput style={s.inp} value={fBuyerHolder} onChangeText={setFBuyerHolder} placeholder="نام صاحب حساب" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>📍 آدرس</Text>
              <TextInput style={[s.inp, { minHeight: 40 }]} value={fBuyerAddress} onChangeText={setFBuyerAddress} multiline placeholder="آدرس" placeholderTextColor="#94a3b8" />
            </View>

            {/* ══════ مشتری ══════ */}
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#bfdbfe' }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e3a8a', textAlign: 'right' }}>👤 اطلاعات مشتری</Text>
                {fCustStatus ? <Text style={{ fontSize: 11, fontWeight: 'bold', color: fCustStatus.includes('قبلی') ? '#059669' : '#ea580c' }}>{fCustStatus}</Text> : null}
              </View>

              <Text style={s.lbl}>📞 شماره تماس مشتری * (اول تلفن بزن)</Text>
              <TextInput style={s.inp} value={fPhone} onChangeText={v => { const d = v.replace(/[^\\d]/g, '').slice(0, 11); setFPhone(d); if (d.length === 11) lookupCustomer(d); }} keyboardType="phone-pad" maxLength={11} placeholder="09123456789" placeholderTextColor="#94a3b8" />

              {fCustCode ? <View style={{ backgroundColor: '#dbeafe', padding: 6, borderRadius: 6, marginTop: 4 }}><Text style={{ color: '#1e40af', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>🆔 {fCustCode}</Text></View> : null}

              <Text style={s.lbl}>👤 نام و نام خانوادگی *</Text>
              <TextInput style={s.inp} value={fCustName} onChangeText={setFCustName} placeholder="نام کامل" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>🏦 بانک</Text>
              <TextInput style={s.inp} value={fCustBank} onChangeText={setFCustBank} placeholder="نام بانک" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>💳 شماره حساب</Text>
              <TextInput style={s.inp} value={fCustAccount} onChangeText={setFCustAccount} keyboardType="numeric" placeholder="شماره حساب" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>👤 صاحب حساب</Text>
              <TextInput style={s.inp} value={fCustHolder} onChangeText={setFCustHolder} placeholder="نام صاحب حساب" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>📍 آدرس</Text>
              <TextInput style={[s.inp, { minHeight: 40 }]} value={fCustAddress} onChangeText={setFCustAddress} multiline placeholder="آدرس" placeholderTextColor="#94a3b8" />
            </View>

            {/* ══════ معامله ══════ */}
            <Text style={s.lbl}>🔀 نوع معامله</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity onPress={() => { setFType('buy'); setFFrom('AFN'); setFTo('USD'); }} style={[s.typeBtn, fType === 'buy' && s.typeBtnBuy]}>
                <Text style={[s.typeBtnTxt, fType === 'buy' && { color: '#fff' }]}>📥 خرید ارز</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setFType('sell'); setFFrom('USD'); setFTo('AFN'); }} style={[s.typeBtn, fType === 'sell' && s.typeBtnSell]}>
                <Text style={[s.typeBtnTxt, fType === 'sell' && { color: '#fff' }]}>📤 فروش ارز</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.lbl}>📤 از ارز (می‌دهم) *</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity style={s.curPick} onPress={() => setShowFromCur(true)}>
                <Text style={s.curPickTxt}>{CUR[fFrom]?.flag} {fFrom}</Text>
              </TouchableOpacity>
              <TextInput style={[s.inp, { flex: 1 }]} value={fFromQty} onChangeText={v => { setFFromQty(v); recalc('from', v); }} keyboardType="numeric" placeholder="مقدار" placeholderTextColor="#94a3b8" />
            </View>

            <Text style={s.lbl}>💹 نرخ تبدیل</Text>
            <TextInput style={s.inp} value={fRate} onChangeText={v => { setFRate(v); recalc('rate', v); }} keyboardType="numeric" placeholder="مثلاً 70500" placeholderTextColor="#94a3b8" />

            <Text style={s.lbl}>📥 به ارز (می‌گیرم) *</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity style={s.curPick} onPress={() => setShowToCur(true)}>
                <Text style={s.curPickTxt}>{CUR[fTo]?.flag} {fTo}</Text>
              </TouchableOpacity>
              <TextInput style={[s.inp, { flex: 1 }]} value={fToQty} onChangeText={v => { setFToQty(v); recalc('to', v); }} keyboardType="numeric" placeholder="مقدار" placeholderTextColor="#94a3b8" />
            </View>

            <Text style={s.lbl}>📝 توضیحات</Text>
            <TextInput style={[s.inp, { minHeight: 60, textAlignVertical: 'top' }]} value={fDesc} onChangeText={setFDesc} multiline placeholderTextColor="#94a3b8" />

            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => { resetForm(); setSub('list'); }}>
                <Text style={s.btnTxt}>↩️ برگشت</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submit}>
                <Text style={s.btnTxt}>{editId ? '💾 ذخیره' : '✅ ثبت معامله'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

"""

c = c[:start] + new_form + c[end_marker:]
print("✅ فرم بازنویسی شد")

# آپدیت modal انتخاب شریک — استفاده از pickPartner
old_pick = re.search(r'onPress=\{\(\) => \{ setFPartner\([^}]+\)[^}]+\}\}', c)
if old_pick:
    c = c.replace(old_pick.group(0), "onPress={() => pickPartner(p)}", 1)
    print("✅ pickPartner در modal")

with open('ExchangeScreen.tsx', 'w') as f: f.write(c)
print("changed:", c != orig)
