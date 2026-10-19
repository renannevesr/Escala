import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { crud } from '../api';
import type { Empresa, Equipe, Funcionario, Turno } from '../tipos';
import EscalaView from './Escala';
import Funcionarios from './Funcionarios';
import Turnos from './Turnos';
import Feriados from './Feriados';
import Ausencias from './Ausencias';
import RegrasForm from './Regras';

export interface DadosEmpresa {
  empresa: Empresa;
  equipes: Equipe[];
  turnos: Turno[];
  funcionarios: Funcionario[];
  recarregar: () => Promise<void>;
}

export default function EmpresaPage() {
  const { id } = useParams();
  const [dados, setDados] = useState<Omit<DadosEmpresa, 'recarregar'> | null>(null);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    try {
      const [empresas, equipes, funcionarios] = await Promise.all([
        crud.listar<Empresa>('empresas'),
        crud.listar<Equipe>('equipes', { empresa_id: id! }),
        crud.listar<Funcionario>('funcionarios', { empresa_id: id! }),
      ]);
      const empresa = empresas.find((e) => e.id === id);
      if (!empresa) throw new Error('Empresa não encontrada');
      const turnos = (await Promise.all(equipes.map((e) => crud.listar<Turno>('turnos', { equipe_id: e.id })))).flat();
      setDados({ empresa, equipes, turnos, funcionarios });
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  if (erro) return <p className="alerta-erro">{erro}</p>;
  if (!dados) return <p className="sutil">Carregando…</p>;
  const props: DadosEmpresa = { ...dados, recarregar };
  const { empresa } = dados;

  return (
    <>
      <div className="cabecalho-empresa sem-impressao">
        <Link to="/" className="voltar">‹ Empresas</Link>
        <h1>{empresa.nome}</h1>
        <div className="chips">
          {(empresa.municipio || empresa.uf) && <span className="chip">{[empresa.municipio, empresa.uf].filter(Boolean).join(' / ')}</span>}
          <span className="chip">
            Escala {empresa.regras.dias_trabalho_semana}x{7 - empresa.regras.dias_trabalho_semana}
          </span>
          <span className="chip">{empresa.regras.jornada_semanal_alvo_horas}h semanais</span>
          <span className="chip">{dados.equipes.length} equipe(s)</span>
          <span className="chip">{dados.funcionarios.filter((f) => f.ativo).length} funcionário(s) ativo(s)</span>
        </div>
      </div>
      <nav className="abas sem-impressao">
        <NavLink to="escala">Escala</NavLink>
        <NavLink to="funcionarios">Funcionários ({dados.funcionarios.length})</NavLink>
        <NavLink to="turnos">Equipes e turnos</NavLink>
        <NavLink to="ausencias">Férias e afastamentos</NavLink>
        <NavLink to="feriados">Feriados</NavLink>
        <NavLink to="regras">Regras / Convenção</NavLink>
      </nav>
      <Routes>
        <Route index element={<Navigate to="escala" replace />} />
        <Route path="escala" element={<EscalaView {...props} />} />
        <Route path="funcionarios" element={<Funcionarios {...props} />} />
        <Route path="turnos" element={<Turnos {...props} />} />
        <Route path="ausencias" element={<Ausencias {...props} />} />
        <Route path="feriados" element={<Feriados {...props} />} />
        <Route path="regras" element={<RegrasForm {...props} />} />
      </Routes>
    </>
  );
}
