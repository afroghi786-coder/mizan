const fs = require('fs');

// حذف import و render و tab دستیار از App.tsx
let app = fs.readFileSync('App.tsx', 'utf8');
const orig = app;
const crlf = app.includes('\r\n');
if (crlf) app = app.replace(/\r\n/g, '\n');

app = app.replace(/\nimport AssistantScreen from '\.\/AssistantScreen';?/g, '');
app = app.replace(/\nimport \{ setNavigator[^;]*;/g, '');
app = app.replace(/\n\s*\{tab === 'assistant' && <AssistantScreen[^}]*\/>\}/g, '');
app = app.replace(/,\s*\n\s*\{ key: 'assistant'[^}]*\}/g, '');
app = app.replace(/\{tab !== 'exchange' && tab !== 'publicMarket' && tab !== 'assistant'/g, "{tab !== 'exchange' && tab !== 'publicMarket'");

if (crlf) app = app.replace(/\n/g, '\r\n');
if (app !== orig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('✅ App.tsx برگشت');
} else {
  console.log('ℹ️ App.tsx تغییری نکرد');
}