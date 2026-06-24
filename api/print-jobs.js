import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const token = req.method === 'GET' ? req.query.token : (req.body && req.body.token);
  const expected = process.env.PRINT_STATION_TOKEN;
  if (!expected || token !== expected) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://lqgvwxyjzpsoflczyzik.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) { res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in env' }); return; }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (req.method === 'GET') {
      const status = req.query.status || 'pending';
      let q;
      if (status === 'printed') {
        q = supabase.from('print_jobs').select('id, doc_num, image_url, created_at')
          .eq('status', 'printed').order('printed_at', { ascending: false }).limit(20);
      } else {
        q = supabase.from('print_jobs').select('id, doc_num, image_url, created_at')
          .eq('status', status).order('created_at', { ascending: true });
      }
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      const jobs = (data || []).map((r) => ({ id: r.id, docNum: r.doc_num, imageUrl: r.image_url, createdAt: r.created_at }));
      return res.status(200).json({ jobs });
    }

    if (req.method === 'POST') {
      const { id, status } = req.body || {};
      const allowed = ['pending', 'printing', 'printed', 'error', 'cleared'];
      if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

      if (id == null) {
        // bulk: คืน orphaned printing -> pending (สถานีเริ่มใหม่)
        if (status === 'pending') {
          const { error } = await supabase.from('print_jobs').update({ status: 'pending' }).eq('status', 'printing');
          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ success: true });
        }
        // bulk: ล้างคิว pending -> cleared
        if (status === 'cleared') {
          const { error } = await supabase.from('print_jobs').update({ status: 'cleared' }).eq('status', 'pending');
          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Missing id' });
      }

      const patch = { status };
      if (status === 'printed') patch.printed_at = new Date().toISOString();
      const { error } = await supabase.from('print_jobs').update(patch).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + (e.message || String(e)) });
  }
}
