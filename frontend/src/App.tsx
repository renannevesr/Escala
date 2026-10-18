import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './api';
import Login from './pages/Login';
import Empresas from './pages/Empresas';
import EmpresaPage from './pages/Empresa';

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (sessao === undefined) return <p className="centro">Carregando…</p>;
  if (!sessao) return <Login />;

  return (
    <>
      <header className="topo">
        <Link to="/" className="marca">Escala 5x2</Link>
        <span className="usuario">
          {sessao.user.email}
          <button className="link" onClick={() => supabase.auth.signOut()}>Sair</button>
        </span>
      </header>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Empresas />} />
          <Route path="/empresas/:id/*" element={<EmpresaPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}
