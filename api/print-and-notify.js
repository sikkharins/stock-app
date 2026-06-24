import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { imageDataUrl, docNum, message, user } = req.body || {};
    if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Missing or invalid imageDataUrl' });
    }

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const groupId = process.env.LINE_DEFAULT_GROUP_ID;
    const supabaseUrl = process.env.SUPABASE_URL || 'https://lqgvwxyjzpsoflczyzik.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in env' });

    const m = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'Invalid data URL format' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const buffer = Buffer.from(m[2], 'base64');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fileName = 'print/' + (docNum || 'doc').replace(/[^a-zA-Z0-9-_]/g, '_') + '-' + Date.now() + '.' + ext;
    const { error: upErr } = await supabase.storage
      .from('line-images')
      .upload(fileName, buffer, { contentType: 'image/' + ext, upsert: false });
    if (upErr) return res.status(500).json({ error: 'Upload failed: ' + upErr.message });

    const { data: pub } = supabase.storage.from('line-images').getPublicUrl(fileName);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) return res.status(500).json({ error: 'Could not resolve public URL' });

    const { data: job, error: insErr } = await supabase
      .from('print_jobs')
      .insert({ doc_num: docNum || '', image_url: publicUrl, status: 'pending', created_by: user || null })
      .select('id')
      .single();
    if (insErr) return res.status(500).json({ error: 'Queue insert failed: ' + insErr.message });

    // LINE text — best-effort: ห้ามทำให้ request ล้มถ้า LINE fail
    let lineSent = false, lineError = null;
    if (lineToken && groupId && message) {
      try {
        const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + lineToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: String(message).slice(0, 5000) }] }),
        });
        if (lineRes.ok) lineSent = true;
        else lineError = 'LINE API ' + lineRes.status + ': ' + (await lineRes.text());
      } catch (e) { lineError = e.message || String(e); }
    } else {
      lineError = 'LINE not configured or empty message';
    }

    return res.status(200).json({ success: true, jobId: job.id, imageUrl: publicUrl, lineSent, lineError });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + (e.message || String(e)) });
  }
}
