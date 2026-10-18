import { useState, type FormEvent } from 'react';
import { crud } from '../api';
import { DIAS_SEMANA, hhmm, horas, type Equipe, type Turno } from '../tipos';
import type { DadosEmpresa } from './Empresa';

const minutos = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
/** Duração de relógio sem o intervalo (o backend ainda aplica a hora noturna reduzida). */
const duracao = (t: Pick<Turno, 'inicio' | 'fim' | 'intervalo_min'>) => {
  let d = minutos(hhmm(t.fim)) - minutos(hhmm(t.inicio));
  if (d <= 0) d += 1440;
  return d - t.intervalo_min;
};

const TURNO_VAZIO = { nome: '', dias: [1, 2, 3, 4, 5], inicio: '08:00', fim: '17:24', intervalo_min: 60, min_funcionarios: 1 };

function FormTurno({ equipe, turno, aoSalvar, aoCancelar }: { equipe: Equipe; turno?: Turno; aoSalvar: () => void; aoCancelar: () => void }) {
  const [f, setF] = useState(turno ? { ...turno, inicio: hhmm(turno.inicio), fim: hhmm(turno.fim) } : TURNO_VAZIO);
  const [erro, setErro] = useState('');

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dados = { equipe_id: equipe.id, nome: f.nome, dias: [...f.dias].sort(), inicio: f.inicio, fim: f.fim, intervalo_min: Number(f.intervalo_min), min_funcionarios: Number(f.min_funcionarios) };
    try {
      if (turno) await crud.atualizar('turnos', turno.id, dados);
      else await crud.criar('turnos', dados);
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const alternarDia = (d: number) => setF({ ...f, dias: f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d] });

  return (
    <form className="form turno-form" onSubmit={salvar}>
      <div className="linha">
        <label>
          Nome
          <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required placeholder="Ex.: Abertura" />
        </label>
        <label className="curto">
          Início
          <input type="time" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} required />
        </label>
        <label className="curto">
          Fim
          <input type="time" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} required />
        </label>
        <label className="curto">
          Intervalo (min)
          <input type="number" min={0} value={f.intervalo_min} onChange={(e) => setF({ ...f, intervalo_min: Number(e.target.value) })} />
        </label>
        <label className="curto">
          Mín. pessoas
          <input type="number" min={0} value={f.min_funcionarios} onChange={(e) => setF({ ...f, min_funcionarios: Number(e.target.value) })} />
        </label>
      </div>
      <div className="dias">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <label key={d} className="check">
            <input type="checkbox" checked={f.dias.includes(d)} onChange={() => alternarDia(d)} /> {DIAS_SEMANA[d]}
          </label>
        ))}
        <span className="sutil">Trabalho efetivo: {horas(duracao(f))}</span>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="linha">
        <button className="primario">Salvar turno</button>
        <button type="button" onClick={aoCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

export default function Turnos({ empresa, equipes, turnos, recarregar }: DadosEmpresa) {
  const [novaEquipe, setNovaEquipe] = useState('');
  const [editando, setEditando] = useState<string | null>(null); // id do turno ou `novo:<equipe>`
  const [erro, setErro] = useState('');

  async function criarEquipe(e: FormEvent) {
    e.preventDefault();
    await crud.criar('equipes', { empresa_id: empresa.id, nome: novaEquipe }).catch((e) => setErro(e.message));
    setNovaEquipe('');
    await recarregar();
  }

  async function excluir(recurso: 'equipes' | 'turnos', id: string, nome: string) {
    if (!confirm(`Excluir ${nome}?`)) return;
    await crud.excluir(recurso, id).catch((e) => setErro(e.message));
    await recarregar();
  }

  const salvo = async () => {
    setEditando(null);
    await recarregar();
  };

  return (
    <section>
      <p className="sutil">
        Cada equipe é escalada separadamente (ex.: loja, diurno, noturno). Os turnos dizem os horários de cada dia e quantas pessoas são
        necessárias no mínimo — o sistema distribui as folgas 5x2 garantindo essa cobertura.
      </p>
      {erro && <p className="erro">{erro}</p>}
      {equipes.map((eq) => (
        <div key={eq.id} className="cartao bloco-equipe">
          <div className="barra">
            <h3>{eq.nome}</h3>
            <span className="espaco" />
            <button onClick={() => setEditando(`novo:${eq.id}`)}>+ Turno</button>
            <button className="link perigo" onClick={() => excluir('equipes', eq.id, `a equipe ${eq.nome} e seus turnos`)}>Excluir equipe</button>
          </div>
          <table className="tabela">
            <thead>
              <tr>
                <th>Turno</th>
                <th>Dias</th>
                <th>Horário</th>
                <th>Intervalo</th>
                <th>Trabalho efetivo</th>
                <th>Mín. pessoas</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {turnos
                .filter((t) => t.equipe_id === eq.id)
                .map((t) =>
                  editando === t.id ? (
                    <tr key={t.id}>
                      <td colSpan={7}>
                        <FormTurno equipe={eq} turno={t} aoSalvar={salvo} aoCancelar={() => setEditando(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id}>
                      <td>{t.nome}</td>
                      <td>{t.dias.map((d) => DIAS_SEMANA[d]).join(', ')}</td>
                      <td>
                        {hhmm(t.inicio)}–{hhmm(t.fim)}
                      </td>
                      <td>{t.intervalo_min} min</td>
                      <td>{horas(duracao(t))}</td>
                      <td>{t.min_funcionarios}</td>
                      <td className="acoes">
                        <button className="link" onClick={() => setEditando(t.id)}>Editar</button>
                        <button className="link perigo" onClick={() => excluir('turnos', t.id, `o turno ${t.nome}`)}>Excluir</button>
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </table>
          {editando === `novo:${eq.id}` && <FormTurno equipe={eq} aoSalvar={salvo} aoCancelar={() => setEditando(null)} />}
        </div>
      ))}
      <form className="barra" onSubmit={criarEquipe}>
        <input value={novaEquipe} onChange={(e) => setNovaEquipe(e.target.value)} placeholder="Nome da nova equipe" required />
        <button className="primario">Adicionar equipe</button>
      </form>
      <p className="sutil">
        Dica: para 42h em 5 dias, cada dia tem 8h24 de trabalho + intervalo. Em loja das 10h às 22h, use abertura 10:00–19:24 e
        fechamento 12:36–22:00 com 1h de intervalo.
      </p>
    </section>
  );
}
