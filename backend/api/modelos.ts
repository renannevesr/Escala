import { corpo, ErroHttp, ok, rota } from '../src/http';
import { MODELOS } from '../src/modelos';
import { REGRAS_PADRAO } from '../src/engine';

// GET  /api/modelos → modelos disponíveis
// POST /api/modelos { modelo, nome, cnpj?, uf?, municipio? } → cria empresa com equipes e turnos do modelo
export default rota({
  GET: async () => MODELOS.map(({ id, nome, descricao, equipes }) => ({ id, nome, descricao, equipes })),
  POST: async ({ req, db }) => {
    const b = corpo(req);
    const modelo = b.modelo ? MODELOS.find((m) => m.id === b.modelo) : undefined;
    if (b.modelo && !modelo) throw new ErroHttp(400, 'Modelo inválido');
    if (!b.nome || typeof b.nome !== 'string') throw new ErroHttp(400, 'Informe o nome da empresa');

    const empresa = ok(
      await db
        .from('empresas')
        .insert({ nome: b.nome, cnpj: b.cnpj || null, uf: b.uf || null, municipio: b.municipio || null, regras: { ...REGRAS_PADRAO, ...modelo?.regras } })
        .select()
        .single(),
    );
    for (const eq of modelo?.equipes ?? []) {
      const equipe = ok(await db.from('equipes').insert({ empresa_id: empresa.id, nome: eq.nome }).select().single());
      ok(await db.from('turnos').insert(eq.turnos.map((t) => ({ ...t, equipe_id: equipe.id }))));
    }
    return empresa;
  },
});
