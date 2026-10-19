import { corpo, ErroHttp, ok, rota } from '../../src/http';
import { gerarEscala, periodoDoMes, REGRAS_PADRAO, somarDias, type Regras, type Turno } from '../../src/engine';

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : t);

// POST /api/escalas/gerar { empresa_id, ano, mes, seed? } → gera, grava e devolve a escala do mês
export default rota({
  POST: async ({ req, db }) => {
    const b = corpo(req);
    const empresaId = String(b.empresa_id ?? '');
    const ano = Number(b.ano);
    const mes = Number(b.mes);
    const seed = Number(b.seed ?? 1) || 1;
    if (!empresaId || !ano || !(mes >= 1 && mes <= 12)) throw new ErroHttp(400, 'Informe empresa_id, ano e mes');

    const { inicio, fim } = periodoDoMes(ano, mes);
    const empresa = ok(await db.from('empresas').select('*').eq('id', empresaId).single());
    const equipes = ok(await db.from('equipes').select('id, nome').eq('empresa_id', empresaId));
    const turnos = equipes.length ? ok(await db.from('turnos').select('*').in('equipe_id', equipes.map((e) => e.id))) : [];
    const funcionarios = ok(await db.from('funcionarios').select('*').eq('empresa_id', empresaId).eq('ativo', true).order('nome'));
    const ids = funcionarios.map((f) => f.id);
    const ausencias = ids.length ? ok(await db.from('ausencias').select('*').in('funcionario_id', ids).lte('inicio', fim).gte('fim', inicio)) : [];
    const feriados = ok(await db.from('feriados').select('data, nome, fechado').eq('empresa_id', empresaId));
    // Últimas 3 semanas antes do período, para continuar o revezamento de domingos e a contagem de dias seguidos
    const historico = ids.length
      ? ok(
          await db
            .from('escala_dias')
            .select('funcionario_id, data, tipo')
            .in('funcionario_id', ids)
            .gte('data', somarDias(inicio, -21))
            .lt('data', inicio)
            .range(0, 9999),
        )
      : [];

    const resultado = gerarEscala({
      ano,
      mes,
      seed,
      regras: { ...REGRAS_PADRAO, ...(empresa.regras as Partial<Regras>) },
      equipes,
      turnos: turnos.map((t) => ({ ...t, inicio: hhmm(t.inicio)!, fim: hhmm(t.fim)!, dias: t.dias as Turno['dias'] })),
      funcionarios,
      ausencias,
      feriados,
      historico,
    });

    const escalaId = ok(
      await db.rpc('salvar_escala', {
        p_empresa: empresaId,
        p_ano: ano,
        p_mes: mes,
        p_inicio: resultado.inicio,
        p_fim: resultado.fim,
        p_seed: seed,
        p_avisos: resultado.avisos,
        p_resumo: { semanas: resultado.semanas, feriados: resultado.feriados },
        p_dias: resultado.dias,
      }),
    );
    // Mesmo formato do GET /api/escalas
    return {
      id: escalaId,
      empresa_id: empresaId,
      ano,
      mes,
      seed,
      inicio: resultado.inicio,
      fim: resultado.fim,
      avisos: resultado.avisos,
      resumo: { semanas: resultado.semanas, feriados: resultado.feriados },
      dias: resultado.dias,
    };
  },
});
