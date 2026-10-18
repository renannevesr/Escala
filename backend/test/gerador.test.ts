import { describe, expect, it } from 'vitest';
import { feriadosNacionais, gerarEscala, horasDoTurno, pascoa, periodoDoMes, REGRAS_PADRAO, somarDias, type EntradaEscala, type ResultadoEscala } from '../src/engine';
import { entradaDoModelo, INDUSTRIA_5_5, LOJA_4 } from './fixtures';

/** Verifica as regras legais/CCT sobre o resultado. */
function validar(entrada: EntradaEscala, r: ResultadoEscala) {
  const regras = { ...REGRAS_PADRAO, ...entrada.regras };
  for (const f of entrada.funcionarios) {
    const dias = r.dias.filter((d) => d.funcionario_id === f.id).sort((a, b) => a.data.localeCompare(b.data));
    expect(dias.length).toBe(r.dias.length / entrada.funcionarios.length);

    // Dias seguidos
    let seq = 0;
    for (const d of dias) {
      seq = d.tipo === 'trabalho' ? seq + 1 : 0;
      expect(seq, `${f.nome} ${d.data}`).toBeLessThanOrEqual(regras.max_dias_consecutivos);
    }

    // Domingos seguidos: mulher 1, homem 2
    const max = f.sexo === 'F' ? regras.max_domingos_consecutivos_feminino : regras.max_domingos_consecutivos_masculino;
    let dom = 0;
    for (const d of dias.filter((_, i) => i % 7 === 6)) {
      dom = d.tipo === 'trabalho' ? dom + 1 : 0;
      expect(dom, `${f.nome} domingo ${d.data}`).toBeLessThanOrEqual(max);
    }

    for (let s = 0; s < dias.length / 7; s++) {
      const semana = dias.slice(s * 7, s * 7 + 7);
      const trabalhados = semana.filter((d) => d.tipo === 'trabalho');
      // 5x2 e limite de 44h
      expect(trabalhados.length).toBeLessThanOrEqual(regras.dias_trabalho_semana);
      expect(trabalhados.reduce((a, d) => a + d.minutos_computados, 0)).toBeLessThanOrEqual(regras.jornada_semanal_max_horas * 60);
      // Feriado trabalhado → folga compensatória na mesma semana
      const feriadosTrab = trabalhados.filter((d) => r.feriados.some((h) => h.data === d.data)).length;
      expect(semana.filter((d) => d.tipo === 'folga_compensatoria').length, `${f.nome} semana ${semana[0].data}`).toBe(feriadosTrab);
      expect(trabalhados.length).toBeLessThanOrEqual(regras.dias_trabalho_semana - feriadosTrab);
    }
  }
  // Cobertura mínima de cada turno
  for (const t of entrada.turnos) {
    for (let d = r.inicio; d <= r.fim; d = somarDias(d, 1)) {
      const wd = ((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
      if (!t.dias.includes(wd as never) || r.feriados.some((h) => h.data === d && h.fechado)) continue;
      const qtd = r.dias.filter((x) => x.data === d && x.turno_id === t.id).length;
      expect(qtd, `${t.nome} ${d}`).toBeGreaterThanOrEqual(t.min_funcionarios);
    }
  }
}

describe('datas e feriados', () => {
  it('calcula a Páscoa e a Paixão de Cristo', () => {
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
    expect(feriadosNacionais(2026).find((f) => f.nome === 'Paixão de Cristo')!.data).toBe('2026-04-03');
  });

  it('usa semanas completas de segunda a domingo sem sobrepor meses', () => {
    expect(periodoDoMes(2026, 11)).toEqual({ inicio: '2026-11-02', fim: '2026-11-29' });
    expect(periodoDoMes(2026, 12)).toEqual({ inicio: '2026-11-30', fim: '2027-01-03' });
    for (let m = 1; m < 12; m++) {
      expect(somarDias(periodoDoMes(2026, m).fim, 1)).toBe(periodoDoMes(2026, m + 1).inicio);
    }
  });
});

describe('horas do turno', () => {
  it('loja 10:00–19:24 com 1h de intervalo = 8h24 (42h em 5 dias)', () => {
    expect(horasDoTurno({ inicio: '10:00', fim: '19:24', intervalo_min: 60 }, REGRAS_PADRAO).computados).toBe(504);
  });
  it('noturno 22:00–06:00 com 1h = 7h de relógio e 8h computadas (hora reduzida + prorrogação)', () => {
    const h = horasDoTurno({ inicio: '22:00', fim: '06:00', intervalo_min: 60 }, REGRAS_PADRAO);
    expect(h.relogio).toBe(420);
    expect(h.computados).toBe(480);
  });
  it('sábado noturno 22:00–01:30 = 4h computadas', () => {
    expect(horasDoTurno({ inicio: '22:00', fim: '01:30', intervalo_min: 0 }, REGRAS_PADRAO).computados).toBe(240);
  });
});

describe('gerador', () => {
  for (let mes = 1; mes <= 12; mes++) {
    it(`loja 4 funcionários respeita as regras — ${mes}/2026`, () => {
      const e = entradaDoModelo('shopping', LOJA_4, 2026, mes);
      const r = gerarEscala(e);
      validar(e, r);
      expect(r.avisos.filter((a) => a.nivel === 'erro')).toEqual([]);
    });
    it(`indústria diurno/noturno mantém sábado coberto — ${mes}/2026`, () => {
      const e = entradaDoModelo('industria', INDUSTRIA_5_5, 2026, mes);
      const r = gerarEscala(e);
      validar(e, r);
      expect(r.avisos.filter((a) => a.nivel === 'erro')).toEqual([]);
    });
  }

  it('loja só com mulheres alterna domingos', () => {
    const mulheres = [['Ana', 'Bia', 'Cris', 'Duda'].map((nome) => ({ nome, sexo: 'F' as const }))];
    const e = entradaDoModelo('shopping', mulheres, 2026, 3);
    const r = gerarEscala(e);
    validar(e, r);
    expect(r.avisos.filter((a) => a.nivel === 'erro')).toEqual([]);
  });

  it('continua o revezamento de domingos a partir do mês anterior', () => {
    const out = gerarEscala(entradaDoModelo('shopping', LOJA_4, 2026, 10));
    const nov = entradaDoModelo('shopping', LOJA_4, 2026, 11, { historico: out.dias });
    const r = gerarEscala(nov);
    for (const f of nov.funcionarios.filter((f) => f.sexo === 'F')) {
      const ultimoDomingoOut = out.dias.find((d) => d.funcionario_id === f.id && d.data === out.fim)!;
      const primeiroDomingoNov = r.dias.find((d) => d.funcionario_id === f.id && d.data === somarDias(r.inicio, 6))!;
      if (ultimoDomingoOut.tipo === 'trabalho') expect(primeiroDomingoNov.tipo).not.toBe('trabalho');
    }
  });

  it('feriado fechado pela CCT não é escalado e folga no aniversário', () => {
    const e = entradaDoModelo('shopping', LOJA_4, 2026, 12, {
      regras: { ...REGRAS_PADRAO, feriados_fechados: ['12-25', '01-01'], folga_aniversario: true },
    });
    e.funcionarios[0].data_nascimento = '1990-12-10';
    const r = gerarEscala(e);
    validar(e, r);
    expect(r.dias.filter((d) => d.data === '2026-12-25' && d.tipo === 'trabalho')).toEqual([]);
    expect(r.dias.find((d) => d.funcionario_id === e.funcionarios[0].id && d.data === '2026-12-10')!.tipo).toBe('aniversario');
  });

  it('férias tiram o funcionário da escala e avisa se faltar gente', () => {
    const e = entradaDoModelo('shopping', LOJA_4, 2026, 11, {
      ausencias: [{ funcionario_id: 'eq0-f0', inicio: '2026-11-09', fim: '2026-11-22', tipo: 'ferias' }],
    });
    const r = gerarEscala(e);
    validar({ ...e, turnos: [] }, r);
    expect(r.dias.filter((d) => d.funcionario_id === 'eq0-f0' && d.data >= '2026-11-09' && d.data <= '2026-11-22').every((d) => d.tipo === 'ausencia')).toBe(true);
  });
});
