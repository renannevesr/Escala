import { useEffect, useState, type FormEvent } from 'react';
import { api, crud } from '../api';
import { dataBR, DIAS_SEMANA, diaSemana, type Feriado } from '../tipos';
import type { DadosEmpresa } from './Empresa';

export default function Feriados({ empresa }: DadosEmpresa) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [lista, setLista] = useState<Feriado[]>([]);
  const [form, setForm] = useState({ data: '', nome: '', fechado: false });
  const [erro, setErro] = useState('');

  const carregar = () => api<Feriado[]>(`calendario?empresa_id=${empresa.id}&ano=${ano}`).then(setLista).catch((e) => setErro(e.message));
  useEffect(() => {
    carregar();
  }, [ano]); // eslint-disable-line react-hooks/exhaustive-deps

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    try {
      await crud.criar('feriados', { ...form, empresa_id: empresa.id });
      setForm({ data: '', nome: '', fechado: false });
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function excluir(f: Feriado) {
    if (f.id) await crud.excluir('feriados', f.id).catch((e) => setErro(e.message));
    await carregar();
  }

  return (
    <div className="grade-2">
      <section>
        <div className="barra">
          <button onClick={() => setAno(ano - 1)}>◀</button>
          <strong className="mes">{ano}</strong>
          <button onClick={() => setAno(ano + 1)}>▶</button>
        </div>
        {erro && <p className="erro">{erro}</p>}
        <table className="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Feriado</th>
              <th>Origem</th>
              <th>Operação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.data}>
                <td>
                  {dataBR(f.data)} <small className="sutil">{DIAS_SEMANA[diaSemana(f.data)]}</small>
                </td>
                <td>{f.nome}</td>
                <td>{f.origem === 'nacional' ? 'Nacional' : 'Estadual/municipal'}</td>
                <td>{f.fechado ? 'Fechada' : 'Aberta (com folga compensatória)'}</td>
                <td className="acoes">{f.origem === 'empresa' && <button className="link perigo" onClick={() => excluir(f)}>Excluir</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="cartao">
        <h3>Adicionar feriado estadual/municipal</h3>
        <form className="form" onSubmit={adicionar}>
          <label>
            Data
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
          </label>
          <label>
            Nome
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required placeholder="Ex.: Aniversário da cidade" />
          </label>
          <label className="check">
            <input type="checkbox" checked={form.fechado} onChange={(e) => setForm({ ...form, fechado: e.target.checked })} /> A operação não abre nesse dia
          </label>
          <button className="primario">Adicionar</button>
        </form>
        <p className="sutil">
          Os feriados nacionais (inclusive Paixão de Cristo e 20 de novembro) já são calculados automaticamente. Datas em que a convenção
          coletiva manda fechar todo ano (ex.: 25/12 e 01/01) são configuradas na aba Regras / Convenção.
        </p>
      </section>
    </div>
  );
}
