import { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

export async function listGenerations(req: Request, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('generations')
    .select(`
      id,
      status,
      image_url,
      video_url,
      user_observations,
      final_prompt_used,
      created_at,
      exercises ( name, category ),
      camera_angles ( name )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
}

export async function deleteGeneration(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { error } = await supabase.from('generations').delete().eq('id', id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(204).send();
}
