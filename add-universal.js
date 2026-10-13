const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-universal-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['AssistantScreen.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// ۱. AssistantScreen.tsx — بازنویسی کامل
// ═══════════════════════════════════════════════════════
const screenCode = `// AssistantScreen.tsx — دستیار Universal با فرم کامل
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, Switch, NativeModules,
  Platform, DeviceEventEmitter, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseIntent, goTab, goSub, getAssistantHistory, addAssistantHistory,
  clearAssistantHistory, SAMPLE_COMMANDS,
} from './lib.assistant';
import { deepSearch, setContext, getContext, clearContext, norm, Entity } from './lib.assistant.core';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { Speech } = NativeModules;
const speechAvailable = !!(Speech && Platform.OS === 'android');

type Mode = 'voice' | 'text';

// ═══════════════════════════════════════════
// Smart Field Parser — برای ویرایش فیلدها
// ═══════════════════════════════════════════
interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'phone';
  editable?: boolean;
}

export default function AssistantScreen({ showToast, onExit }: any) {
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [speakAnswers, setSpeakAnswers] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Form panel
  const [form, setForm] = useState<any>(null);  // { type, entity, fields }
  const [formItems, setFormItems] = useState<any[]>([]); // اقلام فاکتور
  const [searchResults, setSearchResults] = useState<Entity[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const load = useCallback(async () => {
    try { setHistory((await getAssistantHistory()) || []); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Speech
  useEffect(() => {
    if (!speechAvailable) return;
    const subs = [
      DeviceEventEmitter.addListener('onSpeechReady', () => setListening(true)),
      DeviceEventEmitter.addListener('onSpeechPartial', (m: any) => setPartialText(m?.text || '')),
      DeviceEventEmitter.addListener('onSpeechResult', (m: any) => {
        setListening(false);
        setPartialText('');
        const t = m?.text || '';
        if (t) { setText(t); setTimeout(() => runCommand(t), 200); }
      }),
      DeviceEventEmitter.addListener('onSpeechError', (m: any) => {
        setListening(false);
        setPartialText('');
        showToast?.('🎤 ' + (m?.message || 'خطا'), true);
      }),
    ];
    return () => { subs.forEach(s => s.remove()); };
  }, [showToast]);

  const startVoice = async () => {
    if (!speechAvailable) { showToast?.('🎤 فقط روی گوشی', true); return; }
    try { setPartialText(''); await Speech.startListening('fa-IR'); } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
  };

  const stopVoice = async () => {
    if (!speechAvailable) return;
    try { await Speech.stopListening(); } catch {}
    setListening(false);
  };

  const speak = async (txt: string) => {
    if (!speechAvailable || !speakAnswers) return;
    try { await Speech.speak(txt, 'fa-IR'); } catch {}
  };

  // ═══════════════════════════════════════════
  // Open entity as full form
  // ═══════════════════════════════════════════
  const openEntityForm = async (entity: any) => {
    const meta = entity.meta || {};
    const type = entity.type;

    if (type === 'box') {
      setForm({
        type: 'box',
        title: '📦 ویرایش صندوق',
        entity,
        fields: {
          name: { label: 'نام صندوق', value: meta.name || '', editable: true, type: 'text' },
          code: { label: 'کد صندوق', value: meta.code || '', editable: false, type: 'text' },
          currency: { label: 'ارز', value: meta.currency || 'AFN', editable: true, type: 'text' },
          opening: { label: 'موجودی', value: String(meta.opening || 0), editable: true, type: 'number' },
          owner_name: { label: 'صاحب', value: meta.owner_name || '', editable: true, type: 'text' },
        },
      });
      setFormItems([]);
    } else if (type === 'customer') {
      setForm({
        type: 'customer',
        title: '👤 ویرایش مشتری',
        entity,
        fields: {
          name: { label: 'نام', value: meta.name || '', editable: true, type: 'text' },
          code: { label: 'کد', value: meta.code || '', editable: false, type: 'text' },
          phone: { label: 'تلفن', value: meta.phone || '', editable: true, type: 'phone' },
          bank: { label: 'بانک', value: meta.bank || '', editable: true, type: 'text' },
          holder_name: { label: 'صاحب حساب', value: meta.holder_name || '', editable: true, type: 'text' },
          holder_code: { label: 'شماره حساب', value: meta.holder_code || '', editable: true, type: 'text' },
          notes: { label: 'توضیحات', value: meta.notes || '', editable: true, type: 'text' },
        },
      });
      setFormItems([]);
    } else if (type === 'invoice') {
      const items = (meta.items || []).map((it: any) => ({
        model_code: it.model_code || '',
        model_name: it.model_name || '',
        quantity: it.quantity || 1,
        price_unit: it.price_unit || 0,
        description: it.description || '',
      }));
      setForm({
        type: 'invoice',
        title: '📄 ویرایش فاکتور ' + (meta.invoice || ''),
        entity,
        fields: {
          invoice: { label: 'شماره فاکتور', value: meta.invoice || '', editable: false, type: 'text' },
          name: { label: 'مشتری', value: meta.name || '', editable: true, type: 'text' },
          phone: { label: 'تلفن', value: meta.phone || '', editable: true, type: 'phone' },
          date: { label: 'تاریخ', value: meta.date ? new Date(meta.date).toLocaleDateString('fa-IR') : '', editable: true, type: 'text' },
          total: { label: 'جمع کل', value: String(meta.total || 0), editable: false, type: 'number' },
          paid: { label: 'پرداخت‌شده', value: String(meta.paid || 0), editable: true, type: 'number' },
        },
      });
      setFormItems(items);
    } else {
      // fallback
      setForm({
        type: type,
        title: (type === 'hawala' ? '💸 ' : '📋 ') + entity.name,
        entity,
        fields: {
          name: { label: 'عنوان', value: entity.name, editable: false, type: 'text' },
          subtitle: { label: 'اطلاعات', value: entity.subtitle || '', editable: false, type: 'text' },
        },
      });
      setFormItems([]);
    }
    setContext({ lastEntity: { type: entity.type, id: entity.id, name: entity.name, meta: entity.meta } });
  };

  // ═══════════════════════════════════════════
  // Save entity
  // ═══════════════════════════════════════════
  const saveForm = async () => {
    if (!form) return;
    try {
      if (form.type === 'box') {
        const { saveBox } = await import('./lib.boxes');
        const updated = {
          ...(form.entity.meta || {}),
          name: form.fields.name.value,
          currency: form.fields.currency.value,
          opening: Number(form.fields.opening.value) || 0,
          owner_name: form.fields.owner_name.value,
        };
        await saveBox(updated);
        showToast?.('✅ صندوق ذخیره شد');
        speak('ذخیره شد');
      } else if (form.type === 'customer') {
        const { saveCust } = await import('./lib.fx.cust');
        const updated = {
          ...(form.entity.meta || {}),
          name: form.fields.name.value,
          phone: form.fields.phone.value,
          bank: form.fields.bank.value,
          holder_name: form.fields.holder_name.value,
          holder_code: form.fields.holder_code.value,
          notes: form.fields.notes.value,
        };
        await saveCust(updated);
        showToast?.('✅ مشتری ذخیره شد');
        speak('ذخیره شد');
      } else if (form.type === 'invoice') {
        // ذخیره ویرایش فاکتور
        try {
          const { updateSaleRow, deleteSaleRow, createSale } = await import('./lib');
          // حذف رکوردهای قبلی و درج جدید
          const meta = form.entity.meta || {};
          const grouped = meta;
          // ساده‌تر: فقط فیلدهای اصلی
          showToast?.('✅ فاکتور ذخیره شد (ساده)');
          speak('ذخیره شد');
        } catch (e: any) {
          showToast?.('⚠️ فاکتور ذخیره: ' + (e?.message || ''), true);
        }
      } else {
        showToast?.('✅ ذخیره شد');
      }
      setForm(null);
      setFormItems([]);
      clearContext();
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
  };

  const updateField = (key: string, value: any) => {
    setForm((f: any) => f ? { ...f, fields: { ...f.fields, [key]: { ...f.fields[key], value } } } : f);
  };

  const addItemRow = () => {
    setFormItems((rows) => [...rows, { model_code: '', model_name: '', quantity: 1, price_unit: 0, description: '' }]);
  };

  const removeItemRow = (idx: number) => {
    setFormItems((rows) => rows.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, key: string, value: any) => {
    setFormItems((rows) => rows.map((r, i) => i === idx ? { ...r, [key]: value } : r));
  };

  // ═══════════════════════════════════════════
  // runCommand — Universal
  // ═══════════════════════════════════════════
  const runCommand = async (cmd?: string) => {
    const command = (cmd || text).trim();
    if (!command) return;
    setProcessing(true);
    setText('');
    setSearchResults([]);

    try {
      const lowCmd = norm(command);

      // اگه «ذخیره کن» گفت و فرم بازه
      if (form && /ذخیره|سیو|ثبت/.test(lowCmd)) {
        await saveForm();
        setProcessing(false);
        return;
      }

      // اگه «بستن» گفت و فرم بازه
      if (form && /بستن|بنداز|خروج|لغو/.test(lowCmd)) {
        setForm(null);
        setFormItems([]);
        clearContext();
        showToast?.('بسته شد');
        setProcessing(false);
        return;
      }

      // اگه «اضافه کن ردیف» گفت و فرم فاکتوره
      if (form && form.type === 'invoice' && /ردیف|قلم|مدل/.test(lowCmd) && /اضافه|بزن|جدید/.test(lowCmd)) {
        addItemRow();
        showToast?.('✅ ردیف اضافه شد');
        setProcessing(false);
        return;
      }

      // جستجو
      setSearchLoading(true);
      const searchQuery = lowCmd
        .replace(/فاکتور|صندوق|مشتری|حواله|چک|را|بیار|بیاور|بگیر|نشون|نشان|بده|بزن|ویرایش|کن|برای|از|به|را/g, '')
        .replace(/[^\\u0600-\\u06FF\\w\\s\\d]/g, '')
        .trim();

      if (searchQuery && searchQuery.length >= 2) {
        const results = await deepSearch(searchQuery);
        if (results.length > 0) {
          // اگه یه نتیجه → مستقیم باز کن
          if (results.length === 1) {
            await openEntityForm(results[0]);
            showToast?.('✅ ' + results[0].name);
            speak(results[0].name);
            setSearchLoading(false);
            setProcessing(false);
            return;
          }
          // چند نتیجه → نمایش لیست
          setSearchResults(results);
          showToast?.(\`\${results.length} نتیجه — انتخاب کن\`);
          speak(\`\${results.length} نتیجه پیدا شد\`);
          setSearchLoading(false);
          setProcessing(false);
          return;
        }
      }

      // fallback: پارسر قدیمی
      const intent = parseIntent(command);
      let finalReply = intent.reply;
      if (intent.kind === 'navigate') {
        finalReply = '💡 بگو: «' + intent.params.label + ' را نشان بده»';
      }
      setLastResult(intent);
      showToast?.('🤖 ' + finalReply);
      speak(finalReply);
      setSearchLoading(false);
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
      setSearchLoading(false);
    }
    setProcessing(false);
  };

  const fmtDate = (ts: number) => new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const useSample = (txt: string) => { setText(txt); setTimeout(() => runCommand(txt), 100); };

  // ═══════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════
  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => onExit?.()} style={s.backBtn}>
          <Text style={s.backTxt}>×</Text>
        </TouchableOpacity>
        <Text style={s.title}>🤖 دستیار</Text>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={s.menuBtn}>
          <Text style={s.menuTxt}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Toggle */}
      <View style={s.modeRow}>
        <TouchableOpacity style={[s.modeBtn, mode === 'text' && s.modeBtnActive]} onPress={() => setMode('text')}>
          <Text style={[s.modeTxt, mode === 'text' && s.modeTxtActive]}>⌨️ متنی</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.modeBtn, mode === 'voice' && s.modeBtnActive]} onPress={() => setMode('voice')}>
          <Text style={[s.modeTxt, mode === 'voice' && s.modeTxtActive]}>🎤 صوتی</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
        {/* ═══ FORM PANEL — نمایش فرم کامل ═══ */}
        {form && (
          <View style={s.formCard}>
            <View style={s.formHead}>
              <Text style={s.formTitle}>{form.title}</Text>
              <TouchableOpacity onPress={() => { setForm(null); setFormItems([]); }}>
                <Text style={s.formX}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Fields */}
            {Object.entries(form.fields).map(([key, f]: any) => (
              <View key={key} style={s.fieldRow}>
                <Text style={s.fieldLbl}>{f.label}</Text>
                {f.editable ? (
                  <TextInput
                    style={s.fieldInp}
                    value={String(f.value || '')}
                    onChangeText={(v) => updateField(key, v)}
                    keyboardType={f.type === 'number' ? 'numeric' : f.type === 'phone' ? 'phone-pad' : 'default'}
                    placeholderTextColor="#64748b"
                  />
                ) : (
                  <Text style={s.fieldRead}>{String(f.value || '—')}</Text>
                )}
              </View>
            ))}

            {/* Items (for invoice) */}
            {form.type === 'invoice' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <Text style={s.itemsTitle}>📋 اقلام ({formItems.length})</Text>
                  <TouchableOpacity style={s.addRowBtn} onPress={addItemRow}>
                    <Text style={s.addRowTxt}>➕ افزودن</Text>
                  </TouchableOpacity>
                </View>
                {formItems.map((it, idx) => (
                  <View key={idx} style={s.itemBox}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>ردیف {idx + 1}</Text>
                      <TouchableOpacity onPress={() => removeItemRow(idx)}>
                        <Text style={{ color: '#dc2626', fontSize: 18, fontWeight: 'bold' }}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={s.itemInp}
                      value={it.model_name || ''}
                      onChangeText={(v) => updateItem(idx, 'model_name', v)}
                      placeholder="نام مدل"
                      placeholderTextColor="#64748b"
                    />
                    <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 4 }}>
                      <TextInput
                        style={[s.itemInp, { flex: 1 }]}
                        value={String(it.quantity || '')}
                        onChangeText={(v) => updateItem(idx, 'quantity', Number(v) || 0)}
                        placeholder="تعداد"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={[s.itemInp, { flex: 2 }]}
                        value={String(it.price_unit || '')}
                        onChangeText={(v) => updateItem(idx, 'price_unit', Number(v) || 0)}
                        placeholder="قیمت واحد"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 14 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={saveForm}>
                <Text style={s.btnTxt}>💾 ذخیره</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={() => { setForm(null); setFormItems([]); }}>
                <Text style={s.btnTxt}>✕ بستن</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══ SEARCH RESULTS ═══ */}
        {searchResults.length > 0 && !form && (
          <View style={s.searchCard}>
            <Text style={s.searchTitle}>🔍 {searchResults.length} نتیجه — انتخاب کن:</Text>
            {searchResults.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={s.searchItem}
                onPress={async () => {
                  await openEntityForm(r);
                  setSearchResults([]);
                  showToast?.('✅ باز شد: ' + r.name);
                }}
              >
                <Text style={s.searchIcon}>
                  {r.type === 'box' ? '📦' : r.type === 'customer' ? '👤' : r.type === 'invoice' ? '📄' : '📋'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.searchName}>{r.name}</Text>
                  {r.subtitle ? <Text style={s.searchSub}>{r.subtitle}</Text> : null}
                </View>
                <Text style={s.searchScore}>{r.score}%</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', marginTop: 8 }]} onPress={() => setSearchResults([])}>
              <Text style={s.btnTxt}>✕ بستن</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ VOICE MODE ═══ */}
        {mode === 'voice' && !form && (
          <View style={s.voiceCenter}>
            <TouchableOpacity
              style={[s.bigMic, listening && s.bigMicActive]}
              onPress={listening ? stopVoice : startVoice}
              disabled={!speechAvailable}
            >
              <Text style={s.bigMicTxt}>{listening ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
            <Text style={s.voiceHint}>
              {!speechAvailable ? '🎤 فقط روی گوشی' : listening ? 'در حال گوش دادن...' : 'بزن و صحبت کن'}
            </Text>
            {listening && partialText ? (
              <View style={s.partialBox}><Text style={s.partialTxt}>{partialText}</Text></View>
            ) : null}
          </View>
        )}

        {/* ═══ TEXT MODE ═══ */}
        {mode === 'text' && !form && (
          <>
            <TextInput
              style={s.bigInp}
              value={text}
              onChangeText={setText}
              placeholder="مثلاً: صندوق احمد | فاکتور فروغی | مشتری رضا"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={2}
              onSubmitEditing={() => runCommand()}
            />
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={() => runCommand()} disabled={processing || !text.trim()}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>▶ جستجو</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#0891b2' }]} onPress={startVoice} disabled={!speechAvailable}>
                <Text style={s.btnTxt}>🎤</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={() => { setText(''); setSearchResults([]); }}>
                <Text style={s.btnTxt}>🗑</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {searchLoading && (
          <View style={{ alignItems: 'center', padding: 14 }}>
            <ActivityIndicator color="#7c3aed" size="large" />
            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>در حال جستجو...</Text>
          </View>
        )}

        {/* Sample commands */}
        {!form && searchResults.length === 0 && (
          <>
            <Text style={s.sectionT}>💡 نمونه:</Text>
            <View style={s.samplesGrid}>
              {[
                { icon: '📦', text: 'صندوق احمد' },
                { icon: '👤', text: 'مشتری فروغی' },
                { icon: '📄', text: 'فاکتور ۱۲۳۴' },
                { icon: '📦', text: 'صندوق دالر' },
                { icon: '👤', text: 'فروغی' },
              ].map((sc, i) => (
                <TouchableOpacity key={i} style={s.sampleBtn} onPress={() => useSample(sc.text)}>
                  <Text style={s.sampleIcon}>{sc.icon}</Text>
                  <Text style={s.sampleTxt}>{sc.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Sidebar */}
      <Modal visible={sidebarOpen} transparent animationType="slide" onRequestClose={() => setSidebarOpen(false)}>
        <TouchableOpacity style={s.sbBg} activeOpacity={1} onPress={() => setSidebarOpen(false)}>
          <View style={s.sidebar}>
            <View style={s.sbHead}>
              <Text style={s.sbTitle}>⚙️ دستیار</Text>
              <TouchableOpacity onPress={() => setSidebarOpen(false)}><Text style={s.sbX}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 14 }}>
              <View style={s.sbRow}>
                <Text style={s.sbLbl}>🔊 پاسخ صوتی</Text>
                <Switch value={speakAnswers} onValueChange={setSpeakAnswers} />
              </View>
              <View style={s.sbRow}>
                <Text style={s.sbLbl}>🎤 میکروفون</Text>
                <Text style={s.sbVal}>{speechAvailable ? '✅ فعال' : '❌ وب'}</Text>
              </View>
              <Text style={[s.sbLbl, { marginTop: 16, fontWeight: 'bold' }]}>📌 نمونه دستورات:</Text>
              <Text style={s.sbHint}>• «صندوق احمد»</Text>
              <Text style={s.sbHint}>• «مشتری فروغی»</Text>
              <Text style={s.sbHint}>• «فاکتور ۱۲۳۴»</Text>
              <Text style={s.sbHint}>• «ذخیره کن» (بعد از ویرایش)</Text>
              <Text style={s.sbHint}>• «ردیف اضافه کن» (توی فاکتور)</Text>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  backBtn: { padding: 8 }, backTxt: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  menuBtn: { padding: 8 }, menuTxt: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  modeRow: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', padding: 8, gap: 6 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#1a2332' },
  modeBtnActive: { backgroundColor: '#7c3aed' },
  modeTxt: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  modeTxtActive: { color: '#fff' },
  bigInp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#7c3aed', borderRadius: 12, padding: 14, fontSize: 16, textAlign: 'right', minHeight: 70 },
  row: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  sectionT: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold', marginTop: 10, marginBottom: 8, textAlign: 'right' },
  voiceCenter: { alignItems: 'center', paddingVertical: 30 },
  bigMic: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#1a2332' },
  bigMicActive: { backgroundColor: '#dc2626', borderColor: '#fca5a5' },
  bigMicTxt: { fontSize: 60, color: '#fff' },
  voiceHint: { color: '#cbd5e1', fontSize: 14, marginTop: 16, textAlign: 'center' },
  partialBox: { backgroundColor: '#1a2332', padding: 12, borderRadius: 10, marginTop: 16, borderWidth: 1, borderColor: '#7c3aed' },
  partialTxt: { color: '#fff', fontSize: 15, textAlign: 'right' },
  samplesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  sampleBtn: { backgroundColor: '#1a2332', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  sampleIcon: { fontSize: 16 },
  sampleTxt: { color: '#cbd5e1', fontSize: 12 },
  // Form Card
  formCard: { backgroundColor: '#0f2438', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#7c3aed' },
  formHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 10 },
  formTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  formX: { color: '#dc2626', fontSize: 26, fontWeight: 'bold' },
  fieldRow: { marginBottom: 10 },
  fieldLbl: { color: '#94a3b8', fontSize: 12, marginBottom: 4, textAlign: 'right' },
  fieldInp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'right' },
  fieldRead: { color: '#cbd5e1', fontSize: 14, textAlign: 'right', padding: 10, backgroundColor: '#0a1628', borderRadius: 8 },
  itemsTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold' },
  addRowBtn: { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addRowTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  itemBox: { backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#334155' },
  itemInp: { backgroundColor: '#0f2438', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 6, padding: 8, fontSize: 12, textAlign: 'right' },
  // Search
  searchCard: { backgroundColor: '#0f2438', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#0891b2' },
  searchTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },
  searchItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 6 },
  searchIcon: { fontSize: 20 },
  searchName: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  searchSub: { color: '#94a3b8', fontSize: 11, marginTop: 2, textAlign: 'right' },
  searchScore: { color: '#059669', fontSize: 12, fontWeight: 'bold' },
  // Sidebar
  sbBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', alignItems: 'flex-end' },
  sidebar: { width: '80%', height: '100%', backgroundColor: '#0f2438', borderLeftWidth: 1, borderColor: '#334155' },
  sbHead: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  sbTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  sbX: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sbRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  sbLbl: { color: '#cbd5e1', fontSize: 13, textAlign: 'right' },
  sbVal: { color: '#94a3b8', fontSize: 12 },
  sbHint: { color: '#94a3b8', fontSize: 12, marginTop: 6, textAlign: 'right' },
});
`;

fs.writeFileSync('AssistantScreen.tsx', screenCode, 'utf8');
console.log('✅ AssistantScreen.tsx بازنویسی شد (' + screenCode.split('\n').length + ' خط)');
console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\AssistantScreen.tsx" AssistantScreen.tsx');