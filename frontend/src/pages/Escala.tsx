import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { dataBR, DIAS_SEMANA, diaSemana, hhmm, horas, MESES, type Escala, type TipoDia } from '../tipos';
import type { DadosEmpresa } from './Empresa';

const SIGLA: Record<Exclude<TipoDia, 'trabalho'>, string> = {
  folga: 'Folga',
  folga_compensatoria: 'F. comp.',
  feriado: 'Feriado',
  ausencia: 'Ausente',
  aniversario: 'Aniv.',
};

const LEGENDA: [string, string][] = [
  ['folga', 'Folga'],
  ['folga_compensatoria', 'Folga compensatória (feriado trabalhado)'],
  ['feriado', 'Feriado'],
  ['ausencia', 'Férias / afastamento'],
  ['aniversario', 'Folga de aniversário (CCT)'],
];

function proximoMes() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export default function EscalaView({ empresa, equipes, turnos, funcionarios }: DadosEmpresa) {
  const [{ ano, mes }, setPeriodo] = useState(proximoMes);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [buscando, setBuscando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setErro('');
    setEscala(null);
    setBuscando(true);
    api<Escala | null>(`escalas?empresa_id=${empresa.id}&ano=${ano}&mes=${mes}`)
      .then((e) => setEscala(e && Array.isArray(e.dias) ? e : null))
      .catch((e) => setErro(e.message))
      .finally(() => setBuscando(false));
  }, [empresa.id, ano, mes]);

  async function gerar(seed = 1) {
    setCarregando(true);
    setErro('');
    try {
      setEscala(await api<Escala>('escalas/gerar', { method: 'POST', body: { empresa_id: empresa.id, ano, mes, seed } }));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  function mudarMes(delta: number) {
    const m = mes + delta;
    setPeriodo({ ano: ano + Math.floor((m - 1) / 12), mes: ((m - 1 + 12) % 12) + 1 });
  }

  const datas = useMemo(() => {
    if (!escala) return [];
    const out: string[] = [];
    for (let d = new Date(escala.inicio + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= escala.fim; d.setUTCDate(d.getUTCDate() + 1)) {
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [escala]);

  const porCelula = useMemo(() => new Map(escala?.dias.map((d) => [`${d.funcionario_id}|${d.data}`, d]) ?? []), [escala]);
  const feriados = useMemo(() => new Map(escala?.resumo?.feriados?.map((f) => [f.data, f]) ?? []), [escala]);
  const nomeFunc = useMemo(() => new Map(funcionarios.map((f) => [f.id, f.nome])), [funcionarios]);
  /** Cor do turno: posição dele dentro da equipe (t0, t1, …) */
  const corTurno = useMemo(() => {
    const m = new Map<string, number>();
    for (const eq of equipes) turnos.filter((t) => t.equipe_id === eq.id).forEach((t, i) => m.set(t.id, i % 4));
    return m;
  }, [equipes, turnos]);
  const turnoPorId = useMemo(() => new Map(turnos.map((t) => [t.id, t])), [turnos]);

  const naEscala = (fid: string) => escala?.dias.some((d) => d.funcionario_id === fid);
  const semanas = escala?.resumo?.semanas ?? [];
  const avisos = escala?.avisos ?? [];
  const nErros = avisos.filter((a) => a.nivel === 'erro').length;
  const nAlertas = avisos.filter((a) => a.nivel === 'alerta').length;
  const funcsNaEscala = funcionarios.filter((f) => naEscala(f.id));

  return (
    <section>
      <div className="barra-escala sem-impressao">
        <div className="seletor-mes">
          <button className="icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
          <strong>
            {MESES[mes]} <span className="sutil">{ano}</span>
          </strong>
          <button className="icone" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
        </div>
        <span className="espaco" />
        {escala && <button onClick={() => window.print()}>Imprimir</button>}
        {escala && (
          <button disabled={carregando} onClick={() => gerar((escala.seed ?? 1) + 1)} title="Mantém as regras e sorteia outra combinação de folgas">
            Outra variação
          </button>
        )}
        <button className="primario" disabled={carregando || buscando} onClick={() => gerar(1)}>
          {carregando ? 'Gerando…' : escala ? 'Gerar novamente' : 'Gerar escala'}
        </button>
      </div>
      {erro && <p className="alerta-erro">{erro}</p>}

      {!escala && !erro && !buscando && (
        <div className="vazio grande">
          <strong>Nenhuma escala para {MESES[mes]} de {ano}.</strong>
          {funcionarios.length === 0 ? (
            <span>
              Primeiro cadastre os funcionários na aba <Link to="../funcionarios">Funcionários</Link>.
            </span>
          ) : (
            <span>O sistema distribui as folgas 5x2 respeitando domingos, feriados e a cobertura mínima de cada turno.</span>
          )}
          <button className="primario grande" disabled={carregando || funcionarios.length === 0} onClick={() => gerar(1)}>
            {carregando ? 'Gerando…' : 'Gerar escala'}
          </button>
        </div>
      )}

      {escala && (
        <>
          <h2 className="so-impressao">
            {empresa.nome} — Escala de {MESES[mes]} {ano}
          </h2>

          <div className="kpis sem-impressao">
            <div className="kpi">
              <span>Período</span>
              <strong>
                {dataBR(escala.inicio)} – {dataBR(escala.fim)}
              </strong>
              <small>{semanas.length} semanas, de segunda a domingo</small>
            </div>
            <div className="kpi">
              <span>Funcionários</span>
              <strong>{funcsNaEscala.length}</strong>
              <small>
                Escala {empresa.regras.dias_trabalho_semana}x{7 - empresa.regras.dias_trabalho_semana} · meta {empresa.regras.jornada_semanal_alvo_horas}h
              </small>
            </div>
            <div className="kpi">
              <span>Feriados</span>
              <strong>{escala.resumo?.feriados?.length ?? 0}</strong>
              <small>{escala.resumo?.feriados?.map((f) => dataBR(f.data)).join(', ') || 'nenhum no período'}</small>
            </div>
            <div className={`kpi ${nErros ? 'kpi-erro' : nAlertas ? 'kpi-alerta' : 'kpi-ok'}`}>
              <span>Situação</span>
              <strong>{nErros ? `${nErros} problema(s)` : nAlertas ? `${nAlertas} alerta(s)` : 'Tudo certo'}</strong>
              <small>{nErros || nAlertas ? 'veja os detalhes abaixo' : 'todas as regras atendidas'}</small>
            </div>
          </div>

          {avisos.length > 0 && (
            <ul className="avisos sem-impressao">
              {avisos.map((a, i) => (
                <li key={i} className={a.nivel}>
                  <span className="aviso-nivel">{a.nivel === 'erro' ? 'Problema' : a.nivel === 'alerta' ? 'Atenção' : 'Info'}</span>
                  {a.mensagem}
                </li>
              ))}
            </ul>
          )}

          {equipes.map((eq) => {
            const funcs = funcionarios.filter((f) => f.equipe_id === eq.id && naEscala(f.id));
            if (!funcs.length) return null;
            const turnosEq = turnos.filter((t) => t.equipe_id === eq.id);
            return (
              <div key={eq.id} className="cartao bloco-escala">
                <div className="bloco-titulo">
                  <h3>{eq.nome}</h3>
                  <div className="legenda">
                    {turnosEq.map((t) => (
                      <span key={t.id} className={`t${corTurno.get(t.id)}`}>
                        {t.nome} · {hhmm(t.inicio)}–{hhmm(t.fim)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rolagem">
                  <table className="escala">
                    <thead>
                      <tr>
                        <th className="nome">Funcionário</th>
                        {datas.map((d) => {
                          const wd = diaSemana(d);
                          const fer = feriados.get(d);
                          return (
                            <th key={d} className={[wd >= 6 && 'fim-semana', fer && 'feriado', wd === 1 && 'inicio-semana'].filter(Boolean).join(' ')} title={fer?.nome}>
                              <span className="ds">{DIAS_SEMANA[wd]}</span>
                              <span className="dn">{d.slice(8)}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {funcs.map((f) => (
                        <tr key={f.id}>
                          <td className="nome">
                            <span className={`sexo sexo-${f.sexo}`}>{f.sexo}</span>
                            {f.nome}
                          </td>
                          {datas.map((d) => {
                            const c = porCelula.get(`${f.id}|${d}`);
                            const wd = diaSemana(d);
                            const base = [wd === 1 && 'inicio-semana', wd >= 6 && 'fim-semana'].filter(Boolean).join(' ');
                            if (!c) return <td key={d} className={base} />;
                            if (c.tipo === 'trabalho') {
                              const t = turnoPorId.get(c.turno_id ?? '');
                              return (
                                <td key={d} className={base} title={`${t?.nome ?? ''} · ${horas(c.minutos_computados)}`}>
                                  <span className={`celula t${corTurno.get(c.turno_id ?? '') ?? 0}`}>
                                    <span>{hhmm(c.inicio)}</span>
                                    <span>{hhmm(c.fim)}</span>
                                  </span>
                                </td>
                              );
                            }
                            return (
                              <td key={d} className={base}>
                                <span className={`celula ${c.tipo}`}>{SIGLA[c.tipo]}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="cobertura">
                        <td className="nome">Trabalhando</td>
                        {datas.map((d) => (
                          <td key={d} className={diaSemana(d) === 1 ? 'inicio-semana' : ''}>
                            {funcs.filter((f) => porCelula.get(`${f.id}|${d}`)?.tipo === 'trabalho').length}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <div className="legenda legenda-geral">
            {LEGENDA.map(([cls, txt]) => (
              <span key={cls} className={cls}>
                {txt}
              </span>
            ))}
          </div>

          <div className="cartao bloco-escala">
            <h3>Horas por semana</h3>
            <div className="rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    {semanas.map((s) => (
                      <th key={s.inicio}>
                        {dataBR(s.inicio)} – {dataBR(s.fim)}
                        {s.feriados.length > 0 && <span className="tag">feriado</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(semanas[0]?.minutos ?? {}).map((fid) => (
                    <tr key={fid}>
                      <td>{nomeFunc.get(fid) ?? '—'}</td>
                      {semanas.map((s) => {
                        const min = s.minutos[fid] ?? 0;
                        const cls = min > empresa.regras.jornada_semanal_max_horas * 60 ? 'num erro' : 'num';
                        return (
                          <td key={s.inicio} className={cls}>
                            {horas(min)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
