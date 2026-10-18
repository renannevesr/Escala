import { ErroHttp } from './http';

/** Tabelas expostas pelo CRUD genérico, com as colunas que podem ser gravadas e os filtros aceitos. */
export const RECURSOS: Record<string, { colunas: string[]; filtros: string[]; ordem: string }> = {
  empresas: { colunas: ['nome', 'cnpj', 'uf', 'municipio', 'regras'], filtros: [], ordem: 'nome' },
  equipes: { colunas: ['empresa_id', 'nome'], filtros: ['empresa_id'], ordem: 'nome' },
  turnos: {
    colunas: ['equipe_id', 'nome', 'dias', 'inicio', 'fim', 'intervalo_min', 'min_funcionarios'],
    filtros: ['equipe_id'],
    ordem: 'inicio',
  },
  funcionarios: {
    colunas: ['empresa_id', 'equipe_id', 'nome', 'sexo', 'data_nascimento', 'max_domingos_consecutivos', 'ativo'],
    filtros: ['empresa_id', 'equipe_id'],
    ordem: 'nome',
  },
  ausencias: { colunas: ['funcionario_id', 'inicio', 'fim', 'tipo'], filtros: ['funcionario_id'], ordem: 'inicio' },
  feriados: { colunas: ['empresa_id', 'data', 'nome', 'fechado'], filtros: ['empresa_id'], ordem: 'data' },
};

export function recurso(nome: string | undefined) {
  const r = nome ? RECURSOS[nome] : undefined;
  if (!r) throw new ErroHttp(404, `Recurso desconhecido: ${nome}`);
  return r;
}

/** Mantém só as colunas permitidas; strings vazias viram null. */
export function filtrarColunas(colunas: string[], dados: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const c of colunas) {
    if (c in dados) out[c] = dados[c] === '' ? null : dados[c];
  }
  return out;
}
