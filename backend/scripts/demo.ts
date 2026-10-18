/* Imprime no terminal as escalas dos dois cenários de exemplo: `npm run demo [ano] [mes]` */
import { formatarHoras, gerarEscala, type EntradaEscala } from '../src/engine';
import { entradaDoModelo, INDUSTRIA_5_5, LOJA_4 } from '../test/fixtures';

const ano = Number(process.argv[2] ?? 2026);
const mes = Number(process.argv[3] ?? 11);
const SIGLA: Record<string, string> = { folga: 'F', folga_compensatoria: 'FC', feriado: 'FER', ausencia: 'AUS', aniversario: 'ANIV' };
const DS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

function imprimir(titulo: string, entrada: EntradaEscala) {
  const r = gerarEscala(entrada);
  console.log(`\n=== ${titulo} — ${r.inicio} a ${r.fim} ===`);
  console.log('Feriados:', r.feriados.map((f) => `${f.data} ${f.nome}${f.fechado ? ' (fechado)' : ''}`).join('; ') || '—');
  for (const sem of r.semanas) {
    console.log(`\nSemana ${sem.inicio} → ${sem.fim} ${sem.feriados.length ? '[' + sem.feriados.join(', ') + ']' : ''}`);
    console.log('Nome'.padEnd(10) + DS.map((d, i) => `${d} ${sem.inicio.slice(8)}`.replace(/\d+$/, (x) => String(Number(x) + i).padStart(2, '0')).padEnd(13)).join('') + 'Horas');
    for (const f of entrada.funcionarios) {
      const linha = r.dias
        .filter((d) => d.funcionario_id === f.id && d.data >= sem.inicio && d.data <= sem.fim)
        .map((d) => (d.tipo === 'trabalho' ? `${d.inicio}-${d.fim}` : SIGLA[d.tipo]).padEnd(13))
        .join('');
      console.log(`${(f.nome + '(' + f.sexo + ')').padEnd(10)}${linha}${formatarHoras(sem.minutos[f.id] ?? 0)}`);
    }
  }
  console.log('\nAvisos:');
  for (const a of r.avisos) console.log(` [${a.nivel}] ${a.mensagem}`);
  if (!r.avisos.length) console.log(' nenhum');
}

imprimir('Loja de shopping', entradaDoModelo('shopping', LOJA_4, ano, mes));
imprimir('Indústria diurno/noturno', entradaDoModelo('industria', INDUSTRIA_5_5, ano, mes));
