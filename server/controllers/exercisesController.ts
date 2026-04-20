import { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

export async function listExercises(req: Request, res: Response): Promise<void> {
  const { q, category } = req.query as { q?: string; category?: string };

  let query = supabase
    .from('exercises')
    .select('id, name, category, base_technique, equipment')
    .order('name');

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json(data);
}

export async function createExercise(req: Request, res: Response): Promise<void> {
  const { name, base_technique, category } = req.body as {
    name: string;
    base_technique?: string;
    category?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: name.trim(), base_technique: base_technique ?? '', category: category ?? 'General' })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(data);
}

export async function deleteExercise(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { error } = await supabase.from('exercises').delete().eq('id', id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(204).send();
}
