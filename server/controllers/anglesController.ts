import { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

export async function listAngles(req: Request, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('camera_angles')
    .select('id, name, prompt_modifier')
    .eq('is_active', true)
    .order('name');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
}

export async function createAngle(req: Request, res: Response): Promise<void> {
  const { name, prompt_modifier } = req.body as { name: string; prompt_modifier?: string };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const { data, error } = await supabase
    .from('camera_angles')
    .insert({ name: name.trim(), prompt_modifier: prompt_modifier ?? '' })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(data);
}

export async function deleteAngle(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { error } = await supabase.from('camera_angles').delete().eq('id', id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(204).send();
}
