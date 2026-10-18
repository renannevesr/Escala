import { useState, type FormEvent } from 'react';
import { crud } from '../api';
import type { Regras } from '../tipos';
import type { DadosEmpresa } from './Empresa';

type CampoNum = { [K in keyof Regras]: Regras[K] extends number ? K : never }[keyof Regras];
type CampoBool = { [K in keyof Regras]: Regras[K] extends boolean ? K : never }[keyof Regras];

const NUMEROS: [CampoNum, string, string][] = [
  ['dias_trabalho_semana', 'Dias trabalhados por semana', '5 = escala 5x2'],
  ['jornada_semanal_alvo_horas', 'Meta de horas semanais', 'Redução de 44h para 42h'],
  ['jornada_semanal_max_horas', 'Limite de horas semanais', 'Nunca é ultrapassado'],
  ['max_dias_consecutivos', 'Máx. dias seguidos trabalhados', 'CLT: descanso até o 7º dia → 6'],
  ['max_domingos_consecutivos_feminino', 'Mulher: máx. domingos seguidos', 'Trabalha 1, folga o outro → 1'],
  ['max_domingos_consecutivos_masculino', 'Homem: máx. domingos seguidos', 'Trabalha 2, folga o 3º → 2'],
  ['interjornada_min_horas', 'Descanso entre jornadas (h)', 'CLT art. 66 → 11h'],
];

const BOOLEANOS: [CampoBool, string][] = [
  ['feriado_compensacao_mesma_semana', 'Quem trabalha no feriado ganha folga compensatória na mesma semana (sem pagamento em dobro)'],
  ['feriado_folgado_conta_como_folga', 'Quando o funcionário folga no feriado, o feriado conta como uma das folgas da semana'],
  ['folga_aniversario', 'Folga no dia do aniversário (quando previsto na convenção)'],
  ['preferir_folgas_consecutivas', 'Preferir as folgas da semana em dias seguidos'],
  ['hora_noturna_reduzida', 'Hora noturna reduzida (52min30s entre 22h e 5h)'],
];

export default function RegrasForm({ empresa, recarregar }: DadosEmpresa) {
  const [r, setR] = useState<Regras>(empresa.regras);
  const [fechados, setFechados] = useState((empresa.regras.feriados_fechados ?? []).map((d) => d.split('-').reverse().join('/')).join(', '));
  const [msg, setMsg] = useState('');

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const feriados_fechados = fechados
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map((d) => {
        const [dia, mes] = d.split('/');
        return `${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      });
    try {
      await crud.atualizar('empresas', empresa.id, { regras: { ...r, feriados_fechados } });
      await recarregar();
      setMsg('Regras salvas. Gere a escala novamente para aplicar.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <form className="form regras" onSubmit={salvar}>
      <section className="cartao">
        <h3>Jornada e escala</h3>
        <div className="grade-campos">
          {NUMEROS.map(([campo, rotulo, dica]) => (
            <label key={campo}>
              {rotulo}
              <input type="number" step="0.5" value={r[campo]} onChange={(e) => setR({ ...r, [campo]: Number(e.target.value) })} />
              <small className="sutil">{dica}</small>
            </label>
          ))}
        </div>
      </section>
      <section className="cartao">
        <h3>Convenção coletiva da categoria</h3>
        {BOOLEANOS.map(([campo, rotulo]) => (
          <label key={campo} className="check">
            <input type="checkbox" checked={r[campo]} onChange={(e) => setR({ ...r, [campo]: e.target.checked })} /> {rotulo}
          </label>
        ))}
        <label>
          Feriados em que a operação fecha todo ano (dd/mm, separados por vírgula)
          <input value={fechados} onChange={(e) => setFechados(e.target.value)} placeholder="25/12, 01/01, 01/05" />
        </label>
        <label>
          Observações da CCT (número do registro, vigência, cláusulas de descanso…)
          <textarea rows={5} value={r.observacoes_cct} onChange={(e) => setR({ ...r, observacoes_cct: e.target.value })} />
        </label>
      </section>
      <div className="linha">
        <button className="primario">Salvar regras</button>
        {msg && <span className="mensagem">{msg}</span>}
      </div>
    </form>
  );
}
