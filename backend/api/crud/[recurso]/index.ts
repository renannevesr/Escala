import { corpo, ok, param, rota } from '../../../src/http';
import { filtrarColunas, recurso } from '../../../src/recursos';

// GET /api/crud/:recurso?empresa_id=...  → lista
// POST /api/crud/:recurso                 → cria
export default rota({
  GET: async ({ req, db }) => {
    const nome = param(req, 'recurso')!;
    const r = recurso(nome);
    // Ausências filtradas pela empresa via join com funcionários
    let q =
      nome === 'ausencias' && param(req, 'empresa_id')
        ? db.from(nome).select('*, funcionarios!inner(empresa_id)').eq('funcionarios.empresa_id', param(req, 'empresa_id')!)
        : db.from(nome).select('*');
    for (const f of r.filtros) {
      const v = param(req, f);
      if (v) q = q.eq(f, v);
    }
    return ok(await q.order(r.ordem));
  },
  POST: async ({ req, db }) => {
    const r = recurso(param(req, 'recurso'));
    return ok(await db.from(param(req, 'recurso')!).insert(filtrarColunas(r.colunas, corpo(req))).select().single());
  },
});
