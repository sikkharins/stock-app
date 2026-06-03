import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { imageDataUrl, docNum, message } = req.body || {};
    if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Missing or invalid imageDataUrl' });
    }

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const groupId = process.env.LINE_DEFAULT_GROUP_ID;
    const supabaseUrl = process.env.SUPABASE_URL || 'https://lqgvwxyjzpsoflczyzik.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!lineToken) return res.status(500).json({ error: 'LINE_CHANNEL_ACCESS_TOKEN not set in env' });
    if (!groupId) return res.status(500).json({ error: 'LINE_DEFAULT_GROUP_ID not set in env' });
    if (!supabaseServiceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in env' });

    // Parse data URL
    const m = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'Invalid data URL format' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const buffer = Buffer.from(m[2], 'base64');

    // Upload to Supabase Storage (bucket "line-images" must exist + be public-read)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fileName = 'line/' + (docNum || 'doc').replace(/[^a-zA-Z0-9-_]/g, '_') + '-' + Date.now() + '.' + ext;
    const { error: upErr } = await supabase.storage
      .from('line-images')
      .upload(fileName, buffer, { contentType: 'image/' + ext, upsert: false });
    if (upErr) return res.status(500).json({ error: 'Upload failed: ' + upErr.message });

    // Get public URL
    const { data: pub } = supabase.storage.from('line-images').getPublicUrl(fileName);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) return res.status(500).json({ error: 'Could not resolve public URL' });

    // POST to LINE Messaging API
    const messages = [];
    if (message) messages.push({ type: 'text', text: String(message).slice(0, 5000) });
    messages.push({ type: 'image', originalContentUrl: publicUrl, previewImageUrl: publicUrl });

    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + lineToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: groupId, messages }),
    });

    if (!lineRes.ok) {
      const errText = await lineRes.text();
      return res.status(500).json({ error: 'LINE API ' + lineRes.status + ': ' + errText });
    }

    return res.status(200).json({ success: true, imageUrl: publicUrl });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + (e.message || String(e)) });
  }
}
