// ═══════════════════════════════════════════════════════════
//  📖 CommandBus — دفترچه فرمان‌های ربات
// ═══════════════════════════════════════════════════════════

type Command = () => void | Promise<void>;
type Scope = Record<string, Command>;

const registry: Record<string, Scope> = {};

export function registerCommands(scope: string, commands: Scope) {
  registry[scope] = commands;
  console.log('📖 دفترچه «' + scope + '» ثبت شد — ' + Object.keys(commands).length + ' فرمان');
}

export function unregisterCommands(scope: string) {
  delete registry[scope];
}

export function getRegistry() {
  return registry;
}

function norm(s: string): string {
  return (s || '').toString().trim()
    .replace(/[\u200c\u200f]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function stripVerb(t: string): string {
  return t.replace(/^(برو|باز کن|بزن|کلیک کن|نشونم بده|باز|نشان بده)\s+/, '').trim();
}

export function findAndRun(rawText: string, preferredScope?: string) {
  const t0 = norm(rawText);
  const t = stripVerb(t0) || t0;

  const order: string[] = [];
  if (preferredScope && preferredScope !== 'main') order.push(preferredScope);
  order.push('main');
  for (const s of Object.keys(registry)) if (!order.includes(s)) order.push(s);

  // مرحله ۱: تطابق دقیق
  for (const scope of order) {
    const cmds = registry[scope];
    if (!cmds) continue;
    for (const key of Object.keys(cmds)) {
      if (norm(key) === t || norm(key) === t0) {
        try {
          cmds[key]();
          return { found: true, scope, key, reply: key };
        } catch (e: any) {
          return { found: true, scope, key, error: e.message };
        }
      }
    }
  }

  // مرحله ۲: تطابق شامل
  for (const scope of order) {
    const cmds = registry[scope];
    if (!cmds) continue;
    for (const key of Object.keys(cmds)) {
      const k = norm(key);
      if (k.length >= 2 && (t.includes(k) || k.includes(t))) {
        try {
          cmds[key]();
          return { found: true, scope, key, reply: key };
        } catch (e: any) {
          return { found: true, scope, key, error: e.message };
        }
      }
    }
  }

  return { found: false };
}
