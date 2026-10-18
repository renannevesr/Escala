import { ErroHttp, ok, param, rota } from '../src/http';
import { feriadosNacionais, REGRAS_PADRAO, type Regras } from '../src/engine';

// GET /api/calendario?empresa_id=...&ano=2026 → feriados nacionais + cadastrados, já com os fechados pela CCT
export default rota({
  GET: async ({ req, db }) => {
    const empresaId = param(req, 'empresa_id');
    const ano = Number(param(req, 'ano'));
    if (!empresaId || !ano) throw new ErroHttp(400, 'Informe empresa_id e ano');
    const empresa = ok(await db.from('empresas').select('regras').eq('id', empresaId).single());
    const regras: Regras = { ...REGRAS_PADRAO, ...(empresa.regras as Partial<Regras>) };
    const proprios = ok(await db.from('feriados').select('*').eq('empresa_id', empresaId).gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`));

    const nacionais = feriadosNacionais(ano).map((f) => ({ ...f, origem: 'nacional' as const, id: null }));
    const lista = [...nacionais.filter((n) => !proprios.some((p) => p.data === n.data)), ...proprios.map((p) => ({ ...p, origem: 'empresa' as const }))];
    return lista
      .map((f) => ({ ...f, fechado: f.fechado || regras.feriados_fechados.includes(f.data.slice(5)) }))
      .sort((a, b) => a.data.localeCompare(b.data));
  },
});
