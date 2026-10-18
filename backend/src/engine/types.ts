/** Data no formato ISO `YYYY-MM-DD`. */
export type DataISO = string;

/** 1 = segunda ... 7 = domingo (ISO-8601). */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Regras da escala. Os valores padrão seguem a CLT e a proposta 5x2 / 42h;
 * os campos marcados como "CCT" devem ser ajustados conforme a convenção coletiva da categoria.
 */
export interface Regras {
  /** Dias trabalhados por semana (5 = escala 5x2). */
  dias_trabalho_semana: number;
  /** Meta de horas semanais (ex.: redução de 44h para 42h). */
  jornada_semanal_alvo_horas: number;
  /** Limite legal/CCT de horas semanais — nunca é ultrapassado. */
  jornada_semanal_max_horas: number;
  /** Máximo de dias seguidos trabalhados (CLT: o descanso semanal vem até o 7º dia → 6). */
  max_dias_consecutivos: number;
  /** Mulher: no máximo 1 domingo seguido (trabalha um, folga o outro — CLT art. 386). */
  max_domingos_consecutivos_feminino: number;
  /** Homem: até 2 domingos seguidos, folga no 3º (Lei 10.101/2000 art. 6º). */
  max_domingos_consecutivos_masculino: number;
  /** Quem trabalha no feriado recebe folga compensatória na mesma semana (evita pagamento em dobro). */
  feriado_compensacao_mesma_semana: boolean;
  /** Se o funcionário folga no feriado, o feriado conta como uma das folgas da semana. */
  feriado_folgado_conta_como_folga: boolean;
  /** CCT: feriados em que a operação não abre, formato `MM-DD` (ex.: "12-25", "01-01"). */
  feriados_fechados: string[];
  /** CCT: folga no dia do aniversário do funcionário. */
  folga_aniversario: boolean;
  /** Preferir as 2 folgas em dias seguidos. */
  preferir_folgas_consecutivas: boolean;
  /** Descanso mínimo entre jornadas (CLT art. 66: 11h). */
  interjornada_min_horas: number;
  /** Considerar hora noturna reduzida (52min30s) entre 22h e 5h. */
  hora_noturna_reduzida: boolean;
  /** Anotações sobre a convenção coletiva aplicada. */
  observacoes_cct: string;
}

export const REGRAS_PADRAO: Regras = {
  dias_trabalho_semana: 5,
  jornada_semanal_alvo_horas: 42,
  jornada_semanal_max_horas: 44,
  max_dias_consecutivos: 6,
  max_domingos_consecutivos_feminino: 1,
  max_domingos_consecutivos_masculino: 2,
  feriado_compensacao_mesma_semana: true,
  feriado_folgado_conta_como_folga: true,
  feriados_fechados: [],
  folga_aniversario: false,
  preferir_folgas_consecutivas: true,
  interjornada_min_horas: 11,
  hora_noturna_reduzida: true,
  observacoes_cct: '',
};

export interface Turno {
  id: string;
  equipe_id: string;
  nome: string;
  dias: DiaSemana[];
  /** `HH:MM` */
  inicio: string;
  /** `HH:MM` — se menor que o início, o turno termina no dia seguinte. */
  fim: string;
  intervalo_min: number;
  min_funcionarios: number;
}

export interface Equipe {
  id: string;
  nome: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  sexo: 'F' | 'M';
  equipe_id: string | null;
  data_nascimento?: DataISO | null;
  max_domingos_consecutivos?: number | null;
}

export interface Ausencia {
  funcionario_id: string;
  inicio: DataISO;
  fim: DataISO;
  tipo: string;
}

export interface Feriado {
  data: DataISO;
  nome: string;
  /** A operação não abre nesse dia. */
  fechado: boolean;
}

export type TipoDia =
  | 'trabalho'
  | 'folga'
  | 'folga_compensatoria'
  | 'feriado'
  | 'ausencia'
  | 'aniversario';

/** Dia já escalado antes do período (para continuidade entre meses). */
export interface DiaHistorico {
  funcionario_id: string;
  data: DataISO;
  tipo: TipoDia;
}

export interface EntradaEscala {
  ano: number;
  mes: number;
  regras: Regras;
  equipes: Equipe[];
  turnos: Turno[];
  funcionarios: Funcionario[];
  ausencias: Ausencia[];
  /** Feriados estaduais/municipais/da CCT. Os nacionais são acrescentados automaticamente. */
  feriados: Feriado[];
  historico: DiaHistorico[];
  /** Muda a variação gerada mantendo as regras. */
  seed?: number;
}

export interface DiaEscala {
  funcionario_id: string;
  data: DataISO;
  tipo: TipoDia;
  turno_id: string | null;
  inicio: string | null;
  fim: string | null;
  minutos_relogio: number;
  minutos_computados: number;
}

export type NivelAviso = 'erro' | 'alerta' | 'info';

export interface Aviso {
  nivel: NivelAviso;
  mensagem: string;
  data?: DataISO;
  funcionario_id?: string;
  equipe_id?: string;
}

export interface ResumoSemana {
  inicio: DataISO;
  fim: DataISO;
  feriados: string[];
  /** funcionario_id -> minutos computados na semana */
  minutos: Record<string, number>;
}

export interface ResultadoEscala {
  inicio: DataISO;
  fim: DataISO;
  dias: DiaEscala[];
  feriados: Feriado[];
  semanas: ResumoSemana[];
  avisos: Aviso[];
}
