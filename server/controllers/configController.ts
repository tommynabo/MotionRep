import { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

export async function getConfig(req: Request, res: Response): Promise<void> {
  const { data, error } = await supabase.from('config').select('key, value');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Return as a key-value object
  const config = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  res.json(config);
}

export async function upsertConfig(req: Request, res: Response): Promise<void> {
  const { key, value } = req.body as { key: string; value: string };

  if (!key?.trim() || value === undefined) {
    res.status(400).json({ error: 'key and value are required' });
    return;
  }

  const { data, error } = await supabase
    .from('config')
    .upsert({ key: key.trim(), value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
}
