import type { DataISO, DiaSemana, Feriado } from './types';

const DIA_MS = 86_400_000;

export function paraData(iso: DataISO): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function paraISO(d: Date): DataISO {
  return d.toISOString().slice(0, 10);
}

export function somarDias(iso: DataISO, n: number): DataISO {
  return paraISO(new Date(paraData(iso).getTime() + n * DIA_MS));
}

export function diferencaDias(a: DataISO, b: DataISO): number {
  return Math.round((paraData(b).getTime() - paraData(a).getTime()) / DIA_MS);
}

export function diaSemana(iso: DataISO): DiaSemana {
  const d = paraData(iso).getUTCDay(); // 0 = domingo
  return (d === 0 ? 7 : d) as DiaSemana;
}

/**
 * Período da escala de um mês: semanas completas (segunda a domingo) cuja quinta-feira cai no mês.
 * Assim as escalas de meses seguidos nunca se sobrepõem e toda semana fica inteira
 * (necessário para folga compensatória de feriado e limite semanal de horas).
 */
export function periodoDoMes(ano: number, mes: number): { inicio: DataISO; fim: DataISO } {
  const primeiro = paraISO(new Date(Date.UTC(ano, mes - 1, 1)));
  const ultimo = paraISO(new Date(Date.UTC(ano, mes, 0)));
  const segundaDaSemana = (iso: DataISO) => somarDias(iso, 1 - diaSemana(iso));
  let inicio = segundaDaSemana(primeiro);
  if (paraData(somarDias(inicio, 3)).getUTCMonth() !== mes - 1) inicio = somarDias(inicio, 7);
  let fim = somarDias(segundaDaSemana(ultimo), 6);
  if (paraData(somarDias(fim, -3)).getUTCMonth() !== mes - 1) fim = somarDias(fim, -7);
  return { inicio, fim };
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): DataISO {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return paraISO(new Date(Date.UTC(ano, mes - 1, dia)));
}

/** Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023). */
export function feriadosNacionais(ano: number): Feriado[] {
  const fixo = (mmdd: string, nome: string): Feriado => ({ data: `${ano}-${mmdd}`, nome, fechado: false });
  return [
    fixo('01-01', 'Confraternização Universal'),
    { data: somarDias(pascoa(ano), -2), nome: 'Paixão de Cristo', fechado: false },
    fixo('04-21', 'Tiradentes'),
    fixo('05-01', 'Dia do Trabalho'),
    fixo('09-07', 'Independência do Brasil'),
    fixo('10-12', 'Nossa Senhora Aparecida'),
    fixo('11-02', 'Finados'),
    fixo('11-15', 'Proclamação da República'),
    fixo('11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
    fixo('12-25', 'Natal'),
  ];
}
