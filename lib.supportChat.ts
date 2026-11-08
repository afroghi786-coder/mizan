import { getSupportMessages, sendSupportReply } from './lib.support';

// چت خصوصی هر کاربر با ادمین — فقط پیام‌های همان تیکت
export function listenSupportChat(ticketId: string, cb: (msgs: any[]) => void): () => void {
  let alive = true;
  let timer: any = null;

  const tick = async () => {
    if (!alive) return;
    try {
      const msgs = await getSupportMessages(ticketId);
      if (alive) cb(Array.isArray(msgs) ? msgs : []);
    } catch {}
  };

  tick();
  timer = setInterval(tick, 3000);

  return () => {
    alive = false;
    if (timer) clearInterval(timer);
  };
}

export async function sendSupportChatMessage(ticketId: string, text: string) {
  return await sendSupportReply(ticketId, text);
}
