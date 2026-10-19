import { useState, type FormEvent } from 'react';
import { supabase } from '../api';
import { Logo } from '../Logo';

const DESTAQUES = [
  'Escala 5x2 com jornada de 42h semanais',
  'Revezamento de domingos: mulher 1x1, homem 2x1',
  'Folga compensatória na semana do feriado',
  'Regras da convenção coletiva da categoria',
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [msg, setMsg] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setMsg('');
    const { error } =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password: senha })
        : await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin } });
    setCarregando(false);
    if (error) setMsg(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    else if (modo === 'cadastrar') setMsg('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.');
  }

  return (
    <div className="login">
      <aside className="login-marca">
        <Logo tamanho={40} />
        <h1>Escalas de trabalho montadas automaticamente, dentro da lei.</h1>
        <ul>
          {DESTAQUES.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </aside>
      <div className="login-form">
        <form className="cartao" onSubmit={enviar}>
          <h2>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</h2>
          <p className="sutil">{modo === 'entrar' ? 'Acesse as escalas dos seus clientes.' : 'Cadastre-se para começar a montar escalas.'}</p>
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Senha
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
          </label>
          <button className="primario grande" disabled={carregando}>
            {carregando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
          {msg && <p className="mensagem">{msg}</p>}
          <button type="button" className="link" onClick={() => { setModo(modo === 'entrar' ? 'cadastrar' : 'entrar'); setMsg(''); }}>
            {modo === 'entrar' ? 'Não tem conta? Cadastre-se' : 'Já tenho conta'}
          </button>
        </form>
      </div>
    </div>
  );
}
