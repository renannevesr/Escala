import { useState, type FormEvent } from 'react';
import { crud } from '../api';
import type { Funcionario } from '../tipos';
import type { DadosEmpresa } from './Empresa';

const VAZIO = { nome: '', sexo: 'F' as 'F' | 'M', equipe_id: '', data_nascimento: '', max_domingos_consecutivos: '', ativo: true };

export default function Funcionarios({ empresa, equipes, funcionarios, recarregar }: DadosEmpresa) {
  const [form, setForm] = useState(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  function editar(f: Funcionario) {
    setEditando(f.id);
    setForm({
      nome: f.nome,
      sexo: f.sexo,
      equipe_id: f.equipe_id ?? '',
      data_nascimento: f.data_nascimento ?? '',
      max_domingos_consecutivos: f.max_domingos_consecutivos?.toString() ?? '',
      ativo: f.ativo,
    });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    const dados = {
      ...form,
      empresa_id: empresa.id,
      equipe_id: form.equipe_id || null,
      data_nascimento: form.data_nascimento || null,
      max_domingos_consecutivos: form.max_domingos_consecutivos === '' ? null : Number(form.max_domingos_consecutivos),
    };
    try {
      if (editando) await crud.atualizar('funcionarios', editando, dados);
      else await crud.criar('funcionarios', dados);
      setForm({ ...VAZIO, equipe_id: form.equipe_id });
      setEditando(null);
      await recarregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function excluir(f: Funcionario) {
    if (!confirm(`Excluir ${f.nome}? As escalas já geradas perdem os dias desse funcionário.`)) return;
    await crud.excluir('funcionarios', f.id).catch((e) => setErro(e.message));
    await recarregar();
  }

  const domingosPadrao = (sexo: string) =>
    sexo === 'F' ? empresa.regras.max_domingos_consecutivos_feminino : empresa.regras.max_domingos_consecutivos_masculino;

  return (
    <div className="grade-2">
      <section>
        {erro && <p className="erro">{erro}</p>}
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Sexo</th>
              <th>Equipe</th>
              <th>Domingos seguidos (máx.)</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {funcionarios.map((f) => (
              <tr key={f.id}>
                <td>{f.nome}</td>
                <td>{f.sexo === 'F' ? 'Feminino' : 'Masculino'}</td>
                <td>{equipes.find((e) => e.id === f.equipe_id)?.nome ?? <span className="erro">sem equipe</span>}</td>
                <td>{f.max_domingos_consecutivos ?? domingosPadrao(f.sexo)}</td>
                <td>{f.ativo ? 'Ativo' : 'Inativo'}</td>
                <td className="acoes">
                  <button className="link" onClick={() => editar(f)}>Editar</button>
                  <button className="link perigo" onClick={() => excluir(f)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="cartao">
        <h3>{editando ? 'Editar funcionário' : 'Novo funcionário'}</h3>
        <form className="form" onSubmit={salvar}>
          <label>
            Nome
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </label>
          <div className="linha">
            <label>
              Sexo
              <select value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value as 'F' | 'M' })}>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
              </select>
            </label>
            <label>
              Equipe
              <select value={form.equipe_id} onChange={(e) => setForm({ ...form, equipe_id: e.target.value })} required>
                <option value="">Selecione…</option>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="linha">
            <label>
              Nascimento
              <input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
            </label>
            <label>
              Domingos seguidos
              <input
                type="number"
                min={0}
                max={6}
                placeholder={`padrão: ${domingosPadrao(form.sexo)}`}
                value={form.max_domingos_consecutivos}
                onChange={(e) => setForm({ ...form, max_domingos_consecutivos: e.target.value })}
              />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo (entra na escala)
          </label>
          <div className="linha">
            <button className="primario">{editando ? 'Salvar' : 'Adicionar'}</button>
            {editando && (
              <button type="button" onClick={() => { setEditando(null); setForm(VAZIO); }}>
                Cancelar
              </button>
            )}
          </div>
          <p className="sutil">
            Padrão: mulher trabalha no máximo {empresa.regras.max_domingos_consecutivos_feminino} domingo seguido; homem até{' '}
            {empresa.regras.max_domingos_consecutivos_masculino}. Preencha "Domingos seguidos" só para exceções.
          </p>
        </form>
      </section>
    </div>
  );
}
