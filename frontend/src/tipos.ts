export interface Regras {
  dias_trabalho_semana: number;
  jornada_semanal_alvo_horas: number;
  jornada_semanal_max_horas: number;
  max_dias_consecutivos: number;
  max_domingos_consecutivos_feminino: number;
  max_domingos_consecutivos_masculino: number;
  feriado_compensacao_mesma_semana: boolean;
  feriado_folgado_conta_como_folga: boolean;
  feriados_fechados: string[];
  folga_aniversario: boolean;
  preferir_folgas_consecutivas: boolean;
  interjornada_min_horas: number;
  hora_noturna_reduzida: boolean;
  observacoes_cct: string;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  uf: string | null;
  municipio: string | null;
  regras: Regras;
}

export interface Equipe {
  id: string;
  empresa_id: string;
  nome: string;
}

export interface Turno {
  id: string;
  equipe_id: string;
  nome: string;
  dias: number[];
  inicio: string;
  fim: string;
  intervalo_min: number;
  min_funcionarios: number;
}

export interface Funcionario {
  id: string;
  empresa_id: string;
  equipe_id: string | null;
  nome: string;
  sexo: 'F' | 'M';
  data_nascimento: string | null;
  max_domingos_consecutivos: number | null;
  ativo: boolean;
}

export interface Ausencia {
  id: string;
  funcionario_id: string;
  inicio: string;
  fim: string;
  tipo: string;
}

export interface Feriado {
  id: string | null;
  data: string;
  nome: string;
  fechado: boolean;
  origem?: 'nacional' | 'empresa';
}

export type TipoDia = 'trabalho' | 'folga' | 'folga_compensatoria' | 'feriado' | 'ausencia' | 'aniversario';

export interface DiaEscala {
  funcionario_id: string;
  data: string;
  tipo: TipoDia;
  turno_id: string | null;
  inicio: string | null;
  fim: string | null;
  minutos_relogio: number;
  minutos_computados: number;
}

export interface Aviso {
  nivel: 'erro' | 'alerta' | 'info';
  mensagem: string;
  data?: string;
  funcionario_id?: string;
  equipe_id?: string;
}

export interface ResumoSemana {
  inicio: string;
  fim: string;
  feriados: string[];
  minutos: Record<string, number>;
}

export interface Escala {
  id: string;
  ano: number;
  mes: number;
  inicio: string;
  fim: string;
  seed: number;
  avisos: Aviso[];
  resumo: { semanas: ResumoSemana[]; feriados: Feriado[] };
  dias: DiaEscala[];
}

export const DIAS_SEMANA = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const horas = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;
export const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');
/** 1 = segunda ... 7 = domingo */
export const diaSemana = (iso: string) => ((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1;
