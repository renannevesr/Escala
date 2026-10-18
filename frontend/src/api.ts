import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Chama o backend enviando o token da sessão do Supabase. */
export async function api<T = unknown>(caminho: string, opcoes: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const resp = await fetch(`${API}/api/${caminho}`, {
    method: opcoes.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
  });
  const json = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(json?.erro ?? `Erro ${resp.status}`);
  return json as T;
}

export const crud = {
  listar: <T,>(recurso: string, filtros: Record<string, string> = {}) =>
    api<T[]>(`crud/${recurso}?${new URLSearchParams(filtros)}`),
  criar: <T,>(recurso: string, dados: object) => api<T>(`crud/${recurso}`, { method: 'POST', body: dados }),
  atualizar: <T,>(recurso: string, id: string, dados: object) => api<T>(`crud/${recurso}/${id}`, { method: 'PATCH', body: dados }),
  excluir: (recurso: string, id: string) => api(`crud/${recurso}/${id}`, { method: 'DELETE' }),
};
