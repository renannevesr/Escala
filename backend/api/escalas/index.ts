import { ErroHttp, ok, param, rota } from '../../src/http';

// GET /api/escalas?empresa_id=...&ano=2026&mes=11 → escala do mês com os dias (ou null)
export default rota({
  GET: async ({ req, db }) => {
    const empresaId = param(req, 'empresa_id');
    const ano = Number(param(req, 'ano'));
    const mes = Number(param(req, 'mes'));
    if (!empresaId || !ano || !mes) throw new ErroHttp(400, 'Informe empresa_id, ano e mes');
    const escala = ok(await db.from('escalas').select('*').eq('empresa_id', empresaId).eq('ano', ano).eq('mes', mes).maybeSingle());
    if (!escala) return null;
    const dias = ok(await db.from('escala_dias').select('*').eq('escala_id', escala.id).order('data').range(0, 9999));
    return { ...escala, dias };
  },
});
