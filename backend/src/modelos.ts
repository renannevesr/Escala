import { REGRAS_PADRAO, type Regras } from './engine/types';

/** Modelos prontos para cadastrar uma empresa com equipes, turnos e regras. */
export interface ModeloEmpresa {
  id: string;
  nome: string;
  descricao: string;
  regras: Partial<Regras>;
  equipes: {
    nome: string;
    turnos: { nome: string; dias: number[]; inicio: string; fim: string; intervalo_min: number; min_funcionarios: number }[];
  }[];
}

const TODOS = [1, 2, 3, 4, 5, 6, 7];
const SEG_SEX = [1, 2, 3, 4, 5];

export const MODELOS: ModeloEmpresa[] = [
  {
    id: 'shopping',
    nome: 'Loja de shopping (10h–22h, todos os dias)',
    descricao:
      'Operação de domingo a domingo, 10h às 22h. Escala 5x2 com 42h semanais: 8h24 por dia + 1h de intervalo. ' +
      'Dois turnos (abertura e fechamento) cobrem as 12h de funcionamento.',
    regras: { ...REGRAS_PADRAO },
    equipes: [
      {
        nome: 'Loja',
        turnos: [
          { nome: 'Abertura', dias: TODOS, inicio: '10:00', fim: '19:24', intervalo_min: 60, min_funcionarios: 1 },
          { nome: 'Fechamento', dias: TODOS, inicio: '12:36', fim: '22:00', intervalo_min: 60, min_funcionarios: 1 },
        ],
      },
    ],
  },
  {
    id: 'industria',
    nome: 'Operação diurna e noturna (seg. a sáb.)',
    descricao:
      'Diurno: seg–sex 06h–16h (1h de intervalo) e sáb 06h–10h. Noturno: seg–sex 22h–06h (1h de intervalo) e sáb 22h–01h30. ' +
      'Escala 5x2 mantendo gente aos sábados.',
    regras: { ...REGRAS_PADRAO },
    equipes: [
      {
        nome: 'Diurno',
        turnos: [
          { nome: 'Diurno semana', dias: SEG_SEX, inicio: '06:00', fim: '16:00', intervalo_min: 60, min_funcionarios: 3 },
          { nome: 'Diurno sábado', dias: [6], inicio: '06:00', fim: '10:00', intervalo_min: 0, min_funcionarios: 2 },
        ],
      },
      {
        nome: 'Noturno',
        turnos: [
          { nome: 'Noturno semana', dias: SEG_SEX, inicio: '22:00', fim: '06:00', intervalo_min: 60, min_funcionarios: 3 },
          { nome: 'Noturno sábado', dias: [6], inicio: '22:00', fim: '01:30', intervalo_min: 0, min_funcionarios: 2 },
        ],
      },
    ],
  },
];
