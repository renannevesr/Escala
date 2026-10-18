import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, crud } from '../api';
import type { Empresa } from '../tipos';

interface Modelo {
  id: string;
  nome: string;
  descricao: string;
}

export default function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [form, setForm] = useState({ nome: '', cnpj: '', uf: '', municipio: '', modelo: 'shopping' });
  const [erro, setErro] = useState('');
  const navegar = useNavigate();

  useEffect(() => {
    crud.listar<Empresa>('empresas').then(setEmpresas).catch((e) => setErro(e.message));
    api<Modelo[]>('modelos').then(setModelos).catch(() => {});
  }, []);

  async function criar(e: FormEvent) {
    e.preventDefault();
    try {
      const empresa = await api<Empresa>('modelos', { method: 'POST', body: form });
      navegar(`/empresas/${empresa.id}/funcionarios`);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="grade-2">
      <section>
        <h2>Empresas</h2>
        {erro && <p className="erro">{erro}</p>}
        {empresas.length === 0 && <p className="sutil">Nenhuma empresa cadastrada ainda.</p>}
        <ul className="lista">
          {empresas.map((e) => (
            <li key={e.id}>
              <Link to={`/empresas/${e.id}`}>{e.nome}</Link>
              <span className="sutil">{[e.municipio, e.uf].filter(Boolean).join(' / ')}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="cartao">
        <h3>Nova empresa</h3>
        <form onSubmit={criar} className="form">
          <label>
            Nome
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </label>
          <div className="linha">
            <label>
              CNPJ
              <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </label>
            <label className="curto">
              UF
              <input value={form.uf} maxLength={2} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
            </label>
          </div>
          <label>
            Município
            <input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
          </label>
          <fieldset>
            <legend>Começar a partir de</legend>
            {modelos.map((m) => (
              <label key={m.id} className="opcao">
                <input type="radio" name="modelo" checked={form.modelo === m.id} onChange={() => setForm({ ...form, modelo: m.id })} />
                <span>
                  <strong>{m.nome}</strong>
                  <small>{m.descricao}</small>
                </span>
              </label>
            ))}
            <label className="opcao">
              <input type="radio" name="modelo" checked={form.modelo === ''} onChange={() => setForm({ ...form, modelo: '' })} />
              <span>
                <strong>Em branco</strong>
                <small>Cadastrar equipes e turnos manualmente.</small>
              </span>
            </label>
          </fieldset>
          <button className="primario">Criar empresa</button>
        </form>
      </section>
    </div>
  );
}
