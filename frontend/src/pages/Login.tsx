import { useState, type FormEvent } from 'react';
import { supabase } from '../api';

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
    if (error) setMsg(error.message);
    else if (modo === 'cadastrar') setMsg('Conta criada. Se o Supabase pedir confirmação, verifique seu e-mail.');
  }

  return (
    <div className="login">
      <form className="cartao" onSubmit={enviar}>
        <h1>Escala 5x2</h1>
        <p className="sutil">Organização de escalas com regras da CLT e da convenção coletiva.</p>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
        </label>
        <button className="primario" disabled={carregando}>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
        {msg && <p className="mensagem">{msg}</p>}
        <button type="button" className="link" onClick={() => setModo(modo === 'entrar' ? 'cadastrar' : 'entrar')}>
          {modo === 'entrar' ? 'Não tem conta? Cadastre-se' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  );
}
