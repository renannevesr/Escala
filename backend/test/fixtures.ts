import { MODELOS } from '../src/modelos';
import { REGRAS_PADRAO, type EntradaEscala, type Funcionario, type Turno } from '../src/engine';

/** Monta a entrada do motor a partir de um modelo, com funcionários fictícios. */
export function entradaDoModelo(
  modeloId: string,
  funcionariosPorEquipe: { nome: string; sexo: 'F' | 'M'; data_nascimento?: string }[][],
  ano: number,
  mes: number,
  extra: Partial<EntradaEscala> = {},
): EntradaEscala {
  const modelo = MODELOS.find((m) => m.id === modeloId)!;
  const equipes = modelo.equipes.map((e, i) => ({ id: `eq${i}`, nome: e.nome }));
  const turnos: Turno[] = modelo.equipes.flatMap((e, i) =>
    e.turnos.map((t, j) => ({ ...t, id: `eq${i}-t${j}`, equipe_id: `eq${i}`, dias: t.dias as Turno['dias'] })),
  );
  const funcionarios: Funcionario[] = funcionariosPorEquipe.flatMap((lista, i) =>
    lista.map((f, j) => ({ id: `eq${i}-f${j}`, equipe_id: `eq${i}`, ...f })),
  );
  return {
    ano,
    mes,
    regras: { ...REGRAS_PADRAO, ...modelo.regras },
    equipes,
    turnos,
    funcionarios,
    ausencias: [],
    feriados: [],
    historico: [],
    ...extra,
  };
}

export const LOJA_4 = [
  [
    { nome: 'Ana', sexo: 'F' as const },
    { nome: 'Bruna', sexo: 'F' as const },
    { nome: 'Carlos', sexo: 'M' as const },
    { nome: 'Diego', sexo: 'M' as const },
  ],
];

export const INDUSTRIA_5_5 = [
  ['Edu', 'Fábio', 'Gabi', 'Hugo', 'Iara'].map((nome, i) => ({ nome, sexo: (i % 2 ? 'F' : 'M') as 'F' | 'M' })),
  ['João', 'Karla', 'Lucas', 'Marta', 'Nina'].map((nome, i) => ({ nome, sexo: (i % 2 ? 'F' : 'M') as 'F' | 'M' })),
];
