import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key && url.startsWith('http'));
};

export const getSupabase = (): SupabaseClient => {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase no está configurado. Creá el archivo .env.local y copia VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver README).',
    );
  }
  client = createClient(url, key);
  return client;
};
