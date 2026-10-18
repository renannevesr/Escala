import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class ErroHttp extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Contexto {
  req: VercelRequest;
  res: VercelResponse;
  /** Cliente Supabase autenticado como o usuário (as políticas RLS se aplicam). */
  db: SupabaseClient;
  userId: string;
}

function cors(req: VercelRequest, res: VercelResponse) {
  const permitidas = (process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim());
  const origem = req.headers.origin ?? '';
  const permitida = permitidas.includes('*') ? '*' : permitidas.includes(origem) ? origem : permitidas[0];
  res.setHeader('Access-Control-Allow-Origin', permitida);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

/** Envolve um handler com CORS, autenticação via token do Supabase e tratamento de erros. */
export function rota(metodos: Partial<Record<string, (ctx: Contexto) => Promise<unknown>>>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    try {
      const fn = metodos[req.method ?? 'GET'];
      if (!fn) throw new ErroHttp(405, 'Método não permitido');

      const url = process.env.SUPABASE_URL;
      const anon = process.env.SUPABASE_ANON_KEY;
      if (!url || !anon) throw new ErroHttp(500, 'SUPABASE_URL e SUPABASE_ANON_KEY não configurados');
      const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      if (!token) throw new ErroHttp(401, 'Faça login para continuar');
      const db = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) throw new ErroHttp(401, 'Sessão expirada, faça login novamente');

      const resultado = await fn({ req, res, db, userId: data.user.id });
      if (!res.headersSent) res.status(req.method === 'POST' ? 201 : 200).json(resultado ?? { ok: true });
    } catch (e) {
      const status = e instanceof ErroHttp ? e.status : 500;
      const msg = e instanceof Error ? e.message : String(e);
      if (status === 500) console.error(e);
      res.status(status).json({ erro: msg });
    }
  };
}

/** Lança erro HTTP se a consulta do Supabase falhar. */
export function ok<T>(r: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (r.error) {
    const status = r.error.code === 'PGRST116' ? 404 : r.error.code === '42501' ? 403 : 400;
    throw new ErroHttp(status, r.error.message);
  }
  return r.data as NonNullable<T>;
}

export function param(req: VercelRequest, nome: string): string | undefined {
  const v = req.query[nome];
  return Array.isArray(v) ? v[0] : v;
}

export function corpo(req: VercelRequest): Record<string, unknown> {
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ErroHttp(400, 'Corpo da requisição inválido');
  return b as Record<string, unknown>;
}
