import { corpo, ok, param, rota } from '../../../src/http';
import { filtrarColunas, recurso } from '../../../src/recursos';

// GET | PATCH | DELETE /api/crud/:recurso/:id
export default rota({
  GET: async ({ req, db }) => {
    recurso(param(req, 'recurso'));
    return ok(await db.from(param(req, 'recurso')!).select('*').eq('id', param(req, 'id')!).single());
  },
  PATCH: async ({ req, db }) => {
    const r = recurso(param(req, 'recurso'));
    return ok(
      await db.from(param(req, 'recurso')!).update(filtrarColunas(r.colunas, corpo(req))).eq('id', param(req, 'id')!).select().single(),
    );
  },
  DELETE: async ({ req, db }) => {
    recurso(param(req, 'recurso'));
    ok(await db.from(param(req, 'recurso')!).delete().eq('id', param(req, 'id')!));
    return { ok: true };
  },
});
