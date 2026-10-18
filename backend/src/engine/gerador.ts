import { diaSemana, diferencaDias, feriadosNacionais, periodoDoMes, somarDias } from './datas';
import { formatarHoras, horasDoTurno, intervaloMinimoExigido, janelaTurno, type HorasTurno } from './horas';
import {
  REGRAS_PADRAO,
  type Aviso,
  type DataISO,
  type DiaEscala,
  type EntradaEscala,
  type Feriado,
  type Funcionario,
  type Regras,
  type ResultadoEscala,
  type ResumoSemana,
  type TipoDia,
  type Turno,
} from './types';

/** Estado de cada funcionário carregado de uma semana para a outra. */
interface Estado {
  domingosSeguidos: number;
  totalDomingos: number;
  sequenciaDias: number;
  contagemTurno: Map<string, number>;
  /** Fim do último turno trabalhado, em minutos absolutos desde a 00:00 do início do período. */
  ultimoFimAbs: number | null;
}

interface Candidato {
  /** bit d = 1 → trabalha no dia d da semana (0 = segunda ... 6 = domingo) */
  mask: number;
  minutos: number;
  feriadosTrabalhados: number;
  custoProprio: number;
}

interface Plano {
  f: Funcionario;
  maxDomingos: number;
  candidatos: Candidato[];
  bloqueado: boolean[];
  motivoBloqueio: (TipoDia | null)[];
}

/** Contexto de uma semana de uma equipe. */
interface Semana {
  indice: number;
  datas: DataISO[];
  feriado: (Feriado | undefined)[];
  opera: boolean[];
  /** Dia em que a equipe normalmente trabalha (mesmo que fechado por feriado). */
  operaNormal: boolean[];
  demanda: number[];
  turnosDia: Turno[][];
  minutosDia: number[];
}

const N_REINICIOS = 40;
const DOMINGO = 6;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const trabalha = (mask: number, d: number) => ((mask >> d) & 1) === 1;
const contarBits = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};
const dataBR = (iso: DataISO) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function gerarEscala(entrada: EntradaEscala): ResultadoEscala {
  return new GeradorEscala(entrada).gerar();
}

class GeradorEscala {
  private regras: Regras;
  private inicio: DataISO;
  private fim: DataISO;
  private datas: DataISO[];
  private feriados = new Map<DataISO, Feriado>();
  private horasTurno = new Map<string, HorasTurno>();
  private ausencias = new Map<string, string>();
  private dias: DiaEscala[] = [];
  private semanas: ResumoSemana[] = [];
  private avisos: Aviso[] = [];
  private estados = new Map<string, Estado>();

  constructor(private entrada: EntradaEscala) {
    this.regras = { ...REGRAS_PADRAO, ...entrada.regras };
    const p = periodoDoMes(entrada.ano, entrada.mes);
    this.inicio = p.inicio;
    this.fim = p.fim;
    const n = diferencaDias(p.inicio, p.fim) + 1;
    this.datas = Array.from({ length: n }, (_, i) => somarDias(p.inicio, i));
  }

  gerar(): ResultadoEscala {
    const { entrada, regras } = this;

    // Feriados: nacionais + cadastrados (estaduais/municipais). A CCT pode fechar a operação em alguns.
    for (const ano of [entrada.ano - 1, entrada.ano, entrada.ano + 1]) {
      for (const f of feriadosNacionais(ano)) this.feriados.set(f.data, f);
    }
    for (const f of entrada.feriados) this.feriados.set(f.data, { ...f });
    for (const [data, f] of this.feriados) {
      if (regras.feriados_fechados.includes(data.slice(5))) f.fechado = true;
    }

    for (const t of entrada.turnos) {
      const h = horasDoTurno(t, regras);
      this.horasTurno.set(t.id, h);
      const exigido = intervaloMinimoExigido(h.relogio);
      if (t.intervalo_min < exigido) {
        this.avisos.push({
          nivel: 'erro',
          equipe_id: t.equipe_id,
          mensagem: `Turno "${t.nome}" (${t.inicio}–${t.fim}) tem ${t.intervalo_min}min de intervalo; a CLT exige ${exigido}min para ${formatarHoras(h.relogio)} de trabalho.`,
        });
      }
    }

    for (const a of entrada.ausencias) {
      for (let d = a.inicio; d <= a.fim; d = somarDias(d, 1)) this.ausencias.set(`${a.funcionario_id}|${d}`, a.tipo);
    }

    for (let i = 0; i < this.datas.length; i += 7) {
      const sem = this.datas.slice(i, i + 7);
      this.semanas.push({
        inicio: sem[0],
        fim: sem[6],
        feriados: sem.filter((d) => this.feriados.has(d)).map((d) => `${dataBR(d)} ${this.feriados.get(d)!.nome}`),
        minutos: {},
      });
    }

    const idsEquipes = new Set(entrada.equipes.map((e) => e.id));
    for (const f of entrada.funcionarios) {
      if (!f.equipe_id || !idsEquipes.has(f.equipe_id)) {
        this.avisos.push({ nivel: 'alerta', funcionario_id: f.id, mensagem: `${f.nome} não está em nenhuma equipe e ficou fora da escala.` });
      }
    }

    for (const equipe of entrada.equipes) {
      const turnos = entrada.turnos.filter((t) => t.equipe_id === equipe.id);
      const funcs = entrada.funcionarios.filter((f) => f.equipe_id === equipe.id);
      if (funcs.length === 0) continue;
      if (turnos.length === 0) {
        this.avisos.push({ nivel: 'alerta', equipe_id: equipe.id, mensagem: `Equipe "${equipe.nome}" não tem turnos cadastrados.` });
        continue;
      }
      this.gerarEquipe(equipe.id, equipe.nome, turnos, funcs);
    }

    return {
      inicio: this.inicio,
      fim: this.fim,
      dias: this.dias,
      feriados: this.datas.filter((d) => this.feriados.has(d)).map((d) => this.feriados.get(d)!),
      semanas: this.semanas,
      avisos: this.avisos,
    };
  }

  private maxDomingos(f: Funcionario): number {
    return (
      f.max_domingos_consecutivos ??
      (f.sexo === 'F' ? this.regras.max_domingos_consecutivos_feminino : this.regras.max_domingos_consecutivos_masculino)
    );
  }

  private gerarEquipe(equipeId: string, equipeNome: string, turnos: Turno[], funcs: Funcionario[]) {
    const { regras } = this;
    const sorteio = rng((this.entrada.seed ?? 1) * 7919 + this.entrada.ano * 100 + this.entrada.mes + hash(equipeId));
    const turnosDoDia = (d: number) => turnos.filter((t) => t.dias.includes((d + 1) as Turno['dias'][number]));
    const demandaNormal = (d: number) => turnosDoDia(d).reduce((s, t) => s + t.min_funcionarios, 0);

    // Diagnóstico de capacidade da equipe
    let demandaTotal = 0;
    for (let d = 0; d < 7; d++) demandaTotal += demandaNormal(d);
    const capacidade = funcs.length * regras.dias_trabalho_semana;
    if (demandaTotal > capacidade) {
      this.avisos.push({
        nivel: 'erro',
        equipe_id: equipeId,
        mensagem: `Equipe "${equipeNome}": os turnos pedem ${demandaTotal} plantões por semana, mas ${funcs.length} funcionário(s) em ${regras.dias_trabalho_semana}x${7 - regras.dias_trabalho_semana} cobrem só ${capacidade}. São necessários pelo menos ${Math.ceil(demandaTotal / regras.dias_trabalho_semana)}.`,
      });
    }
    const mediaDomingos = funcs.reduce((s, f) => s + this.maxDomingos(f) / (this.maxDomingos(f) + 1), 0);
    if (demandaNormal(DOMINGO) > 0 && mediaDomingos < demandaNormal(DOMINGO)) {
      this.avisos.push({
        nivel: 'alerta',
        equipe_id: equipeId,
        mensagem: `Equipe "${equipeNome}": pelo revezamento de domingos a equipe garante em média ${mediaDomingos.toFixed(1)} pessoa(s) por domingo, mas os turnos pedem ${demandaNormal(DOMINGO)}.`,
      });
    }

    // Estado inicial a partir das escalas anteriores (continuidade entre meses)
    const historico = new Map(this.entrada.historico.map((h) => [`${h.funcionario_id}|${h.data}`, h.tipo]));
    for (const f of funcs) {
      const trabalhou = (d: DataISO) => historico.get(`${f.id}|${d}`) === 'trabalho';
      let seq = 0;
      for (let d = somarDias(this.inicio, -1); trabalhou(d); d = somarDias(d, -1)) seq++;
      let dom = 0;
      for (let d = somarDias(this.inicio, -1); trabalhou(d); d = somarDias(d, -7)) dom++;
      this.estados.set(f.id, { domingosSeguidos: dom, totalDomingos: 0, sequenciaDias: seq, contagemTurno: new Map(), ultimoFimAbs: null });
    }

    for (let s = 0; s < this.semanas.length; s++) {
      const datas = this.datas.slice(s * 7, s * 7 + 7);
      const feriado = datas.map((d) => this.feriados.get(d));
      const opera = datas.map((_, d) => turnosDoDia(d).length > 0 && !feriado[d]?.fechado);
      const turnosDia = datas.map((_, d) => (opera[d] ? turnosDoDia(d) : []));
      const semana: Semana = {
        indice: s,
        datas,
        feriado,
        opera,
        operaNormal: datas.map((_, d) => turnosDoDia(d).length > 0),
        turnosDia,
        demanda: turnosDia.map((ts) => ts.reduce((a, t) => a + t.min_funcionarios, 0)),
        minutosDia: turnosDia.map((ts) => Math.max(0, ...ts.map((t) => this.horasTurno.get(t.id)!.computados))),
      };
      // Demanda de domingo da próxima semana, para não "queimar" todos os domingos de uma vez
      const demandaProxDomingo = demandaNormal(DOMINGO);

      const planos = funcs.map((f) => this.montarCandidatos(f, semana, equipeId));
      const escolha = this.otimizarSemana(planos, semana, demandaProxDomingo, sorteio);
      this.gravarSemana(planos, escolha, semana);
    }

    this.verificarCobertura(equipeId, equipeNome, turnos, funcs);
  }

  /** Lista todas as combinações de dias trabalhados que respeitam as regras para o funcionário na semana. */
  private montarCandidatos(f: Funcionario, sem: Semana, equipeId: string): Plano {
    const { regras } = this;
    const est = this.estados.get(f.id)!;
    const maxDom = this.maxDomingos(f);

    const motivo: (TipoDia | null)[] = sem.datas.map((data, d) => {
      const aus = this.ausencias.get(`${f.id}|${data}`);
      if (aus) return 'ausencia';
      if (regras.folga_aniversario && f.data_nascimento && f.data_nascimento.slice(5) === data.slice(5) && sem.opera[d]) return 'aniversario';
      return null;
    });
    const bloqueado = sem.datas.map((_, d) => motivo[d] !== null || !sem.opera[d]);
    const diasAusente = motivo.filter((m) => m === 'ausencia').length;

    let meta = regras.dias_trabalho_semana;
    if (diasAusente > 0) meta = Math.round((meta * (7 - diasAusente)) / 7);
    if (motivo.includes('aniversario')) meta -= 1;
    // Feriados em dias normalmente de operação (abertos ou fechados), fora de ausências
    const feriadosValidos = sem.feriado.filter((fer, d) => fer && sem.operaNormal[d] && motivo[d] !== 'ausencia').length;
    if (!regras.feriado_folgado_conta_como_folga) meta -= feriadosValidos;
    meta = Math.max(0, meta);

    const metaMinutos = (regras.jornada_semanal_alvo_horas * 60 * meta) / regras.dias_trabalho_semana;
    const proibeDomingo = est.domingosSeguidos >= maxDom;

    const avaliar = (mask: number, folga: number): Candidato | null => {
      let feriadosTrab = 0;
      let minutos = 0;
      for (let d = 0; d < 7; d++) {
        if (!trabalha(mask, d)) continue;
        if (bloqueado[d]) return null;
        if (sem.feriado[d]) feriadosTrab++;
        minutos += sem.minutosDia[d];
      }
      const exigido = (regras.feriado_compensacao_mesma_semana && regras.feriado_folgado_conta_como_folga ? meta - feriadosTrab : meta) - folga;
      if (contarBits(mask) !== Math.max(0, exigido)) return null;
      if (proibeDomingo && trabalha(mask, DOMINGO)) return null;
      if (minutos > regras.jornada_semanal_max_horas * 60) return null;
      // Dias seguidos trabalhados, incluindo o final da semana anterior
      let seq = est.sequenciaDias;
      for (let d = 0; d < 7; d++) {
        seq = trabalha(mask, d) ? seq + 1 : 0;
        if (seq > regras.max_dias_consecutivos) return null;
      }

      let custo = 0;
      if (regras.preferir_folgas_consecutivas) {
        let blocos = 0;
        for (let d = 0; d < 7; d++) if (!trabalha(mask, d) && sem.opera[d] && (d === 0 || trabalha(mask, d - 1) || !sem.opera[d - 1])) blocos++;
        custo += Math.max(0, blocos - 1) * 3;
      }
      if (trabalha(mask, DOMINGO)) custo += 4 * est.totalDomingos;
      custo += (Math.max(0, metaMinutos - minutos) / 60) * 4;
      // Evita terminar a semana com sequência longa (força folga na segunda seguinte)
      custo += Math.max(0, seq - 4);
      return { mask, minutos, feriadosTrabalhados: feriadosTrab, custoProprio: custo };
    };

    let candidatos: Candidato[] = [];
    let folga = 0;
    for (; candidatos.length === 0; folga++) {
      for (let mask = 0; mask < 128; mask++) {
        const c = avaliar(mask, folga);
        if (c) candidatos.push(c);
      }
    }
    if (folga > 1) {
      this.avisos.push({
        nivel: 'alerta',
        funcionario_id: f.id,
        equipe_id: equipeId,
        data: sem.datas[0],
        mensagem: `${f.nome}: na semana de ${dataBR(sem.datas[0])} não deu para completar ${meta} dia(s) respeitando domingos, dias seguidos e limite de ${regras.jornada_semanal_max_horas}h — escalado(a) com ${folga - 1} dia(s) a menos.`,
      });
    }
    candidatos = candidatos.sort((a, b) => a.custoProprio - b.custoProprio);
    return { f, maxDomingos: maxDom, candidatos, bloqueado, motivoBloqueio: motivo };
  }

  /** Busca local com reinícios aleatórios: escolhe uma combinação de dias por funcionário minimizando o custo da semana. */
  private otimizarSemana(planos: Plano[], sem: Semana, demandaProxDomingo: number, sorteio: () => number): number[] {
    const n = planos.length;
    const cobertura = new Array(7).fill(0);

    const custoTotal = (escolha: number[]) => {
      cobertura.fill(0);
      let custo = 0;
      let bloqueadosProxDomingo = 0;
      for (let i = 0; i < n; i++) {
        const c = planos[i].candidatos[escolha[i]];
        custo += c.custoProprio;
        for (let d = 0; d < 7; d++) if (trabalha(c.mask, d)) cobertura[d]++;
        const est = this.estados.get(planos[i].f.id)!;
        const domSeguidos = trabalha(c.mask, DOMINGO) ? est.domingosSeguidos + 1 : 0;
        if (domSeguidos >= planos[i].maxDomingos) bloqueadosProxDomingo++;
      }
      for (let d = 0; d < 7; d++) {
        if (!sem.opera[d]) continue;
        const falta = Math.max(0, sem.demanda[d] - cobertura[d]);
        custo += 1000 * falta * falta;
        // Distribui as sobras de forma equilibrada entre os dias
        const sobra = cobertura[d] - sem.demanda[d];
        if (sobra > 0) custo += 2 * sobra * sobra;
      }
      const faltaProx = Math.max(0, demandaProxDomingo - (n - bloqueadosProxDomingo));
      custo += 300 * faltaProx;
      return custo;
    };

    let melhor: number[] = [];
    let melhorCusto = Infinity;
    for (let r = 0; r < N_REINICIOS; r++) {
      const escolha = planos.map((p) => (r === 0 ? 0 : Math.floor(sorteio() * p.candidatos.length)));
      let custo = custoTotal(escolha);
      for (let melhorou = true; melhorou; ) {
        melhorou = false;
        const ordem = Array.from({ length: n }, (_, i) => i).sort(() => sorteio() - 0.5);
        for (const i of ordem) {
          const atual = escolha[i];
          for (let c = 0; c < planos[i].candidatos.length; c++) {
            if (c === atual) continue;
            escolha[i] = c;
            const novo = custoTotal(escolha);
            if (novo < custo - 1e-9) {
              custo = novo;
              melhorou = true;
              break;
            }
            escolha[i] = atual;
          }
        }
      }
      if (custo < melhorCusto) {
        melhorCusto = custo;
        melhor = [...escolha];
      }
    }
    return melhor;
  }

  /** Distribui os turnos do dia entre quem trabalha e grava a semana. */
  private gravarSemana(planos: Plano[], escolha: number[], sem: Semana) {
    const { regras } = this;
    const minInterjornada = regras.interjornada_min_horas * 60;
    const turnoDe = new Map<string, Turno | null>(); // `${id}|${d}`
    const ultimoTurnoSemana = new Map<string, string>();

    for (let d = 0; d < 7; d++) {
      const turnos = sem.turnosDia[d];
      const presentes = planos.filter((p, i) => trabalha(p.candidatos[escolha[i]].mask, d));
      if (turnos.length === 0) continue;
      const alocados = new Map<string, number>(turnos.map((t) => [t.id, 0]));
      const baseAbs = (sem.indice * 7 + d) * 1440;

      const custo = (p: Plano, t: Turno) => {
        const est = this.estados.get(p.f.id)!;
        let c = (est.contagemTurno.get(t.id) ?? 0) * 2; // rodízio ao longo do mês
        if (ultimoTurnoSemana.get(p.f.id) === t.id) c -= 5; // estabilidade dentro da semana
        if (est.ultimoFimAbs !== null && baseAbs + janelaTurno(t).ini - est.ultimoFimAbs < minInterjornada) c += 10_000;
        return c;
      };

      const livres = [...presentes];
      // 1º: preenche o mínimo de cada turno
      for (;;) {
        let melhor: { p: Plano; t: Turno; c: number } | null = null;
        for (const t of turnos) {
          if (alocados.get(t.id)! >= t.min_funcionarios) continue;
          for (const p of livres) {
            const c = custo(p, t);
            if (!melhor || c < melhor.c) melhor = { p, t, c };
          }
        }
        if (!melhor) break;
        alocados.set(melhor.t.id, alocados.get(melhor.t.id)! + 1);
        turnoDe.set(`${melhor.p.f.id}|${d}`, melhor.t);
        livres.splice(livres.indexOf(melhor.p), 1);
      }
      // 2º: quem sobra reforça o turno com menos gente proporcionalmente
      for (const p of livres) {
        const t = [...turnos].sort(
          (a, b) =>
            alocados.get(a.id)! / Math.max(1, a.min_funcionarios) + custo(p, a) / 100 -
            (alocados.get(b.id)! / Math.max(1, b.min_funcionarios) + custo(p, b) / 100),
        )[0];
        alocados.set(t.id, alocados.get(t.id)! + 1);
        turnoDe.set(`${p.f.id}|${d}`, t);
      }
      for (const p of presentes) {
        const t = turnoDe.get(`${p.f.id}|${d}`)!;
        const est = this.estados.get(p.f.id)!;
        const j = janelaTurno(t);
        if (est.ultimoFimAbs !== null && baseAbs + j.ini - est.ultimoFimAbs < minInterjornada) {
          this.avisos.push({
            nivel: 'erro',
            funcionario_id: p.f.id,
            data: sem.datas[d],
            mensagem: `${p.f.nome}: descanso entre jornadas menor que ${regras.interjornada_min_horas}h antes de ${dataBR(sem.datas[d])}.`,
          });
        }
        est.ultimoFimAbs = baseAbs + j.fim;
        est.contagemTurno.set(t.id, (est.contagemTurno.get(t.id) ?? 0) + 1);
        ultimoTurnoSemana.set(p.f.id, t.id);
      }
    }

    // Grava os dias e atualiza o estado
    for (let i = 0; i < planos.length; i++) {
      const p = planos[i];
      const c = p.candidatos[escolha[i]];
      const est = this.estados.get(p.f.id)!;
      let compensatorias = regras.feriado_compensacao_mesma_semana && regras.feriado_folgado_conta_como_folga ? c.feriadosTrabalhados : 0;
      // A folga compensatória fica no dia de folga mais próximo do feriado trabalhado
      const diasCompensatorios = new Set<number>();
      if (compensatorias > 0) {
        const feriadosTrab = sem.feriado.map((f, d) => (f && trabalha(c.mask, d) ? d : -1)).filter((d) => d >= 0);
        const folgas = [0, 1, 2, 3, 4, 5, 6].filter((d) => !trabalha(c.mask, d) && !p.bloqueado[d] && !sem.feriado[d]);
        folgas.sort((a, b) => Math.min(...feriadosTrab.map((h) => Math.abs(a - h))) - Math.min(...feriadosTrab.map((h) => Math.abs(b - h))));
        for (const d of folgas) {
          if (compensatorias-- <= 0) break;
          diasCompensatorios.add(d);
        }
      }

      let minutosSemana = 0;
      for (let d = 0; d < 7; d++) {
        const data = sem.datas[d];
        const dia: DiaEscala = { funcionario_id: p.f.id, data, tipo: 'folga', turno_id: null, inicio: null, fim: null, minutos_relogio: 0, minutos_computados: 0 };
        if (trabalha(c.mask, d)) {
          const t = turnoDe.get(`${p.f.id}|${d}`)!;
          const h = this.horasTurno.get(t.id)!;
          Object.assign(dia, { tipo: 'trabalho', turno_id: t.id, inicio: t.inicio, fim: t.fim, minutos_relogio: h.relogio, minutos_computados: h.computados });
          minutosSemana += h.computados;
        } else if (p.motivoBloqueio[d]) {
          dia.tipo = p.motivoBloqueio[d]!;
        } else if (sem.feriado[d]) {
          dia.tipo = 'feriado';
        } else if (diasCompensatorios.has(d)) {
          dia.tipo = 'folga_compensatoria';
        }
        this.dias.push(dia);
      }
      this.semanas[sem.indice].minutos[p.f.id] = minutosSemana;

      const domingo = trabalha(c.mask, DOMINGO);
      est.domingosSeguidos = domingo ? est.domingosSeguidos + 1 : 0;
      if (domingo) est.totalDomingos++;
      let seq = est.sequenciaDias;
      for (let d = 0; d < 7; d++) seq = trabalha(c.mask, d) ? seq + 1 : 0;
      est.sequenciaDias = seq;
    }
  }

  private verificarCobertura(equipeId: string, equipeNome: string, turnos: Turno[], funcs: Funcionario[]) {
    const ids = new Set(funcs.map((f) => f.id));
    const porDia = new Map<string, number>();
    for (const d of this.dias) {
      if (d.tipo === 'trabalho' && ids.has(d.funcionario_id)) porDia.set(`${d.data}|${d.turno_id}`, (porDia.get(`${d.data}|${d.turno_id}`) ?? 0) + 1);
    }
    for (const data of this.datas) {
      if (this.feriados.get(data)?.fechado) continue;
      for (const t of turnos) {
        if (!t.dias.includes(diaSemana(data))) continue;
        const qtd = porDia.get(`${data}|${t.id}`) ?? 0;
        if (qtd < t.min_funcionarios) {
          this.avisos.push({
            nivel: 'erro',
            equipe_id: equipeId,
            data,
            mensagem: `${dataBR(data)}: turno "${t.nome}" com ${qtd} de ${t.min_funcionarios} funcionário(s) necessários.`,
          });
        }
      }
    }
    // Resumo de horas da equipe nas semanas sem feriado/ausência
    const alvo = this.regras.jornada_semanal_alvo_horas * 60;
    const medias: number[] = [];
    for (const f of funcs) {
      const semanasCheias = this.semanas.filter(
        (s) =>
          !s.feriados.length &&
          !this.dias.some((d) => d.funcionario_id === f.id && d.data >= s.inicio && d.data <= s.fim && (d.tipo === 'ausencia' || d.tipo === 'aniversario')),
      );
      if (semanasCheias.length) medias.push(semanasCheias.reduce((a, s) => a + (s.minutos[f.id] ?? 0), 0) / semanasCheias.length);
    }
    if (medias.length) {
      const min = Math.min(...medias);
      const max = Math.max(...medias);
      if (Math.abs(min - alvo) >= 30 || Math.abs(max - alvo) >= 30) {
        const faixa = Math.round(min) === Math.round(max) ? formatarHoras(min) : `${formatarHoras(min)} a ${formatarHoras(max)}`;
        this.avisos.push({
          nivel: 'info',
          equipe_id: equipeId,
          mensagem: `Equipe "${equipeNome}": jornada semanal de ${faixa} nas semanas sem feriado (meta ${formatarHoras(alvo)}, limite ${formatarHoras(this.regras.jornada_semanal_max_horas * 60)}). Para chegar à meta, ajuste a duração dos turnos.`,
        });
      }
    }
  }
}
