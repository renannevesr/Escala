import { useEffect, useState, type FormEvent } from 'react';
import { crud } from '../api';
import { dataBR, type Ausencia } from '../tipos';
import type { DadosEmpresa } from './Empresa';

const TIPOS = ['ferias', 'atestado', 'licenca', 'afastamento', 'outro'];

export default function Ausencias({ empresa, funcionarios }: DadosEmpresa) {
  const [lista, setLista] = useState<Ausencia[]>([]);
  const [form, setForm] = useState({ funcionario_id: '', inicio: '', fim: '', tipo: 'ferias' });
  const [erro, setErro] = useState('');

  const carregar = () => crud.listar<Ausencia>('ausencias', { empresa_id: empresa.id }).then(setLista).catch((e) => setErro(e.message));
  useEffect(() => {
    carregar();
  }, [empresa.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    try {
      await crud.criar('ausencias', form);
      setForm({ ...form, inicio: '', fim: '' });
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="grade-2">
      <section>
        {erro && <p className="erro">{erro}</p>}
        {lista.length === 0 && <p className="sutil">Nenhuma ausência cadastrada.</p>}
        <table className="tabela">
          <tbody>
            {lista.map((a) => (
              <tr key={a.id}>
                <td>{funcionarios.find((f) => f.id === a.funcionario_id)?.nome}</td>
                <td>{a.tipo}</td>
                <td>
                  {dataBR(a.inicio)}/{a.inicio.slice(0, 4)} a {dataBR(a.fim)}/{a.fim.slice(0, 4)}
                </td>
                <td className="acoes">
                  <button className="link perigo" onClick={() => crud.excluir('ausencias', a.id).then(carregar)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="cartao">
        <h3>Nova ausência</h3>
        <form className="form" onSubmit={adicionar}>
          <label>
            Funcionário
            <select value={form.funcionario_id} onChange={(e) => setForm({ ...form, funcionario_id: e.target.value })} required>
              <option value="">Selecione…</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <div className="linha">
            <label>
              Início
              <input type="date" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} required />
            </label>
            <label>
              Fim
              <input type="date" value={form.fim} min={form.inicio} onChange={(e) => setForm({ ...form, fim: e.target.value })} required />
            </label>
          </div>
          <button className="primario">Adicionar</button>
          <p className="sutil">Depois de cadastrar, gere novamente a escala do mês para redistribuir as folgas.</p>
        </form>
      </section>
    </div>
  );
}
