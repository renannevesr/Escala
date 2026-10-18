import type { Regras, Turno } from './types';

export function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function formatarHoras(minutos: number): string {
  const sinal = minutos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutos));
  return `${sinal}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
}

/** Início e fim do turno em minutos a partir da 00:00 do dia de início (fim pode passar de 1440). */
export function janelaTurno(t: Pick<Turno, 'inicio' | 'fim'>): { ini: number; fim: number } {
  const ini = paraMinutos(t.inicio);
  let fim = paraMinutos(t.fim);
  if (fim <= ini) fim += 1440;
  return { ini, fim };
}

export interface HorasTurno {
  /** Minutos efetivamente trabalhados no relógio (sem o intervalo). */
  relogio: number;
  /** Minutos para fins de jornada, com hora noturna reduzida quando aplicável. */
  computados: number;
  /** Minutos de relógio no período noturno. */
  noturnos: number;
}

/**
 * Calcula a duração do turno. Período noturno: 22h às 5h (CLT art. 73), prorrogado
 * após as 5h quando a jornada começa dentro do período noturno (Súmula 60, II, TST).
 * O intervalo é descontado do período em que cai o meio do turno.
 */
export function horasDoTurno(t: Pick<Turno, 'inicio' | 'fim' | 'intervalo_min'>, regras: Pick<Regras, 'hora_noturna_reduzida'>): HorasTurno {
  const { ini, fim } = janelaTurno(t);
  let noturnos = 0;
  for (const base of [-1440, 0, 1440]) {
    const nIni = base + 22 * 60;
    let nFim = base + 29 * 60;
    if (ini >= nIni && ini < nFim && fim > nFim) nFim = fim; // prorrogação
    noturnos += Math.max(0, Math.min(fim, nFim) - Math.max(ini, nIni));
  }
  const total = fim - ini;
  let diurnos = total - noturnos;
  const meio = (ini + fim) / 2;
  const meioNoturno = [-1440, 0, 1440].some((b) => meio >= b + 22 * 60 && meio < b + 29 * 60);
  const intervalo = Math.min(t.intervalo_min, total);
  if (meioNoturno) {
    const n = Math.min(intervalo, noturnos);
    noturnos -= n;
    diurnos -= intervalo - n;
  } else {
    const d = Math.min(intervalo, diurnos);
    diurnos -= d;
    noturnos -= intervalo - d;
  }
  const fator = regras.hora_noturna_reduzida ? 60 / 52.5 : 1;
  return {
    relogio: diurnos + noturnos,
    computados: Math.round(diurnos + noturnos * fator),
    noturnos,
  };
}

/** Intervalo mínimo exigido (CLT art. 71): >6h → 1h; >4h → 15min. */
export function intervaloMinimoExigido(minutosRelogioSemIntervalo: number): number {
  if (minutosRelogioSemIntervalo > 6 * 60) return 60;
  if (minutosRelogioSemIntervalo > 4 * 60) return 15;
  return 0;
}
