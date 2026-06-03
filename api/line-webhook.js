export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(200).end(); return; }

  try {
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!lineToken) return res.status(200).end();

    const events = req.body?.events || [];
    for (const ev of events) {
      if (ev.type === 'message' && ev.message?.type === 'text' && ev.replyToken) {
        const src = ev.source || {};
        const sourceType = src.type || 'unknown';
        const sourceId = src.groupId || src.roomId || src.userId || 'unknown';
        const reply = 'Source type: ' + sourceType + '\nID: ' + sourceId + '\n\nคัดลอก ID นี้ไปวางใน LINE_DEFAULT_GROUP_ID env var';

        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + lineToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ replyToken: ev.replyToken, messages: [{ type: 'text', text: reply }] }),
        });
      }
    }
    return res.status(200).end();
  } catch (e) {
    return res.status(200).end();
  }
}
