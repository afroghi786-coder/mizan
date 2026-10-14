// lib.app.registry.ts — ثبت صفحه‌ها برای ربات
// هر صفحه خودش رو ثبت می‌کنه تا ربات ببینه

export interface ScreenField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'choice' | 'date';
  value: any;
  aliases?: string[];
  choices?: string[];
  setter: (v: any) => void;
}

export interface ScreenButton {
  key: string;
  label: string;
  aliases?: string[];
  onPress: () => void;
}

export interface ScreenAction {
  key: string;
  label: string;
  aliases?: string[];
  run: (params?: any) => Promise<any> | any;
}

export interface RegisteredScreen {
  key: string;
  label: string;
  icon: string;
  aliases?: string[];
  fields?: ScreenField[];
  buttons?: ScreenButton[];
  actions?: ScreenAction[];
  getSummary?: () => string;
  registeredAt: number;
}

// ═══════════════════════════════════════════
// Registry global
// ═══════════════════════════════════════════
const _screens: Map<string, RegisteredScreen> = new Map();

export function registerScreen(screen: RegisteredScreen): () => void {
  _screens.set(screen.key, { ...screen, registeredAt: Date.now() });
  console.log('📺 registered:', screen.key);
  return () => {
    _screens.delete(screen.key);
    console.log('📺 unregistered:', screen.key);
  };
}

export function getRegisteredScreens(): RegisteredScreen[] {
  return Array.from(_screens.values());
}

export function getScreen(key: string): RegisteredScreen | undefined {
  return _screens.get(key);
}

// ═══════════════════════════════════════════
// نرمال‌سازی
// ═══════════════════════════════════════════
function norm(s: string): string {
  return String(s || '')
    .replace(/[يىئ]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function score(text: string, query: string): number {
  const t = norm(text);
  const q = norm(query);
  if (!t || !q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 85;
  if (t.includes(q)) return 70;
  if (q.includes(t)) return 60;
  return 0;
}

// ═══════════════════════════════════════════
// پیدا کردن صفحه با کلمه
// ═══════════════════════════════════════════
export function findScreen(query: string): RegisteredScreen | null {
  const q = String(query || '').trim();
  if (!q) return null;
  
  let best: RegisteredScreen | null = null;
  let bestScore = 0;
  
  for (const s of _screens.values()) {
    let sc = Math.max(
      score(s.label, q),
      score(s.key, q),
    );
    if (s.aliases) {
      for (const a of s.aliases) sc = Math.max(sc, score(a, q));
    }
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  return bestScore >= 50 ? best : null;
}

// ═══════════════════════════════════════════
// پیدا کردن فیلد در یه صفحه
// ═══════════════════════════════════════════
export function findField(screen: RegisteredScreen, query: string): ScreenField | null {
  if (!screen.fields) return null;
  const q = String(query || '').trim();
  
  let best: ScreenField | null = null;
  let bestScore = 0;
  
  for (const f of screen.fields) {
    let sc = Math.max(
      score(f.label, q),
      score(f.key, q),
    );
    if (f.aliases) {
      for (const a of f.aliases) sc = Math.max(sc, score(a, q));
    }
    if (sc > bestScore) { bestScore = sc; best = f; }
  }
  return bestScore >= 50 ? best : null;
}

// ═══════════════════════════════════════════
// پیدا کردن دکمه
// ═══════════════════════════════════════════
export function findButton(screen: RegisteredScreen, query: string): ScreenButton | null {
  if (!screen.buttons) return null;
  const q = String(query || '').trim();
  
  let best: ScreenButton | null = null;
  let bestScore = 0;
  
  for (const b of screen.buttons) {
    let sc = Math.max(
      score(b.label, q),
      score(b.key, q),
    );
    if (b.aliases) {
      for (const a of b.aliases) sc = Math.max(sc, score(a, q));
    }
    if (sc > bestScore) { bestScore = sc; best = b; }
  }
  return bestScore >= 50 ? best : null;
}

// ═══════════════════════════════════════════
// پیدا کردن action
// ═══════════════════════════════════════════
export function findAction(screen: RegisteredScreen, query: string): ScreenAction | null {
  if (!screen.actions) return null;
  const q = String(query || '').trim();
  
  let best: ScreenAction | null = null;
  let bestScore = 0;
  
  for (const a of screen.actions) {
    let sc = Math.max(
      score(a.label, q),
      score(a.key, q),
    );
    if (a.aliases) {
      for (const al of a.aliases) sc = Math.max(sc, score(al, q));
    }
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return bestScore >= 50 ? best : null;
}

// ═══════════════════════════════════════════
// خلاصه صفحه فعلی
// ═══════════════════════════════════════════
export function getScreenSummary(screen: RegisteredScreen): string {
  const lines: string[] = [];
  lines.push(screen.icon + ' ' + screen.label);
  
  if (screen.fields && screen.fields.length > 0) {
    lines.push('');
    lines.push('📋 فیلدها:');
    for (const f of screen.fields) {
      let val = f.value;
      if (f.type === 'boolean') val = val ? '✅ روشن' : '⚪ خاموش';
      else if (val === undefined || val === null || val === '') val = '— خالی';
      lines.push('   • ' + f.label + ': ' + val);
    }
  }
  
  if (screen.actions && screen.actions.length > 0) {
    lines.push('');
    lines.push('🎯 کارها:');
    for (const a of screen.actions) {
      lines.push('   • ' + a.label);
    }
  }
  
  if (screen.buttons && screen.buttons.length > 0) {
    lines.push('');
    lines.push('🔘 دکمه‌ها:');
    for (const b of screen.buttons) {
      lines.push('   • ' + b.label);
    }
  }
  
  if (screen.getSummary) {
    lines.push('');
    lines.push('📊 خلاصه:');
    lines.push(screen.getSummary());
  }
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════
// لیست همه صفحه‌ها
// ═══════════════════════════════════════════
export function listAllScreens(): string {
  const screens = getRegisteredScreens();
  if (!screens.length) return 'هیچ صفحه‌ای ثبت نشده';
  
  const lines: string[] = ['📺 صفحه‌های فعال:'];
  for (const s of screens) {
    lines.push('   ' + s.icon + ' ' + s.label);
  }
  return lines.join('\n');
}
