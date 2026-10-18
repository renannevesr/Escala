import { useEffect, useMemo, useState } from 'react';
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

function proximoMes() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export default function EscalaView({ empresa, equipes, turnos, funcionarios }: DadosEmpresa) {
  const [{ ano, mes }, setPeriodo] = useState(proximoMes);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setErro('');
    setEscala(null);
    api<Escala | null>(`escalas?empresa_id=${empresa.id}&ano=${ano}&mes=${mes}`).then(setEscala).catch((e) => setErro(e.message));
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
  const feriados = useMemo(() => new Map(escala?.resumo.feriados.map((f) => [f.data, f]) ?? []), [escala]);
  const nomeTurno = useMemo(() => new Map(turnos.map((t) => [t.id, t.nome])), [turnos]);
  const nomeFunc = useMemo(() => new Map(funcionarios.map((f) => [f.id, f.nome])), [funcionarios]);

  const naEscala = (fid: string) => escala?.dias.some((d) => d.funcionario_id === fid);

  return (
    <section>
      <div className="barra sem-impressao">
        <button onClick={() => mudarMes(-1)}>◀</button>
        <strong className="mes">{MESES[mes]} {ano}</strong>
        <button onClick={() => mudarMes(1)}>▶</button>
        <span className="espaco" />
        <button className="primario" disabled={carregando} onClick={() => gerar(1)}>
          {carregando ? 'Gerando…' : escala ? 'Gerar novamente' : 'Gerar escala'}
        </button>
        {escala && (
          <button disabled={carregando} onClick={() => gerar((escala.seed ?? 1) + 1)} title="Mantém as regras e sorteia outra combinação de folgas">
            Outra variação
          </button>
        )}
        {escala && <button onClick={() => window.print()}>Imprimir</button>}
      </div>
      {erro && <p className="erro">{erro}</p>}
      {!escala && !erro && <p className="sutil">Nenhuma escala gerada para {MESES[mes]} de {ano}.</p>}

      {escala && (
        <>
          <h3 className="so-impressao">
            {empresa.nome} — Escala de {MESES[mes]} {ano}
          </h3>
          <p className="sutil">
            Período: {dataBR(escala.inicio)} a {dataBR(escala.fim)} (semanas completas de segunda a domingo) · Jornada alvo{' '}
            {empresa.regras.jornada_semanal_alvo_horas}h · Escala {empresa.regras.dias_trabalho_semana}x{7 - empresa.regras.dias_trabalho_semana}
          </p>

          {escala.avisos.length > 0 && (
            <ul className="avisos">
              {escala.avisos.map((a, i) => (
                <li key={i} className={a.nivel}>
                  {a.mensagem}
                </li>
              ))}
            </ul>
          )}

          {equipes.map((eq) => {
            const funcs = funcionarios.filter((f) => f.equipe_id === eq.id && naEscala(f.id));
            if (!funcs.length) return null;
            return (
              <div key={eq.id} className="bloco-equipe">
                <h4>{eq.nome}</h4>
                <div className="rolagem">
                  <table className="escala">
                    <thead>
                      <tr>
                        <th className="nome">Funcionário</th>
                        {datas.map((d) => {
                          const wd = diaSemana(d);
                          const fer = feriados.get(d);
                          return (
                            <th key={d} className={[wd === 7 && 'domingo', fer && 'feriado', wd === 1 && 'inicio-semana'].filter(Boolean).join(' ')} title={fer?.nome}>
                              <span>{DIAS_SEMANA[wd]}</span>
                              <span>{d.slice(8)}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {funcs.map((f) => (
                        <tr key={f.id}>
                          <td className="nome">
                            {f.nome} <small>({f.sexo})</small>
                          </td>
                          {datas.map((d) => {
                            const c = porCelula.get(`${f.id}|${d}`);
                            const wd = diaSemana(d);
                            const cls = [c?.tipo, wd === 7 && 'domingo', wd === 1 && 'inicio-semana'].filter(Boolean).join(' ');
                            if (!c) return <td key={d} className={cls} />;
                            if (c.tipo === 'trabalho') {
                              return (
                                <td key={d} className={cls} title={`${nomeTurno.get(c.turno_id ?? '') ?? ''} · ${horas(c.minutos_computados)}`}>
                                  <span>{hhmm(c.inicio)}</span>
                                  <span>{hhmm(c.fim)}</span>
                                </td>
                              );
                            }
                            return (
                              <td key={d} className={cls}>
                                {SIGLA[c.tipo]}
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

          <h4>Horas por semana</h4>
          <div className="rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Funcionário</th>
                  {escala.resumo.semanas.map((s) => (
                    <th key={s.inicio}>
                      {dataBR(s.inicio)}–{dataBR(s.fim)}
                      {s.feriados.length > 0 && <small className="sutil"> feriado</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(escala.resumo.semanas[0]?.minutos ?? {}).map((fid) => (
                  <tr key={fid}>
                    <td>{nomeFunc.get(fid) ?? '—'}</td>
                    {escala.resumo.semanas.map((s) => (
                      <td key={s.inicio} className={(s.minutos[fid] ?? 0) > empresa.regras.jornada_semanal_max_horas * 60 ? 'erro' : ''}>
                        {horas(s.minutos[fid] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="legenda">
            <span className="trabalho">Trabalho</span>
            <span className="folga">Folga</span>
            <span className="folga_compensatoria">Folga compensatória (feriado trabalhado)</span>
            <span className="feriado">Feriado</span>
            <span className="ausencia">Férias/afastamento</span>
            <span className="aniversario">Folga de aniversário (CCT)</span>
          </p>
          {escala.resumo.feriados.length > 0 && (
            <p className="sutil">
              Feriados no período: {escala.resumo.feriados.map((f) => `${dataBR(f.data)} ${f.nome}${f.fechado ? ' (fechado)' : ''}`).join(' · ')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
