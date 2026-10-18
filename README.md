# Escala 5x2

Sistema para montar escalas de trabalho **5x2 com 42h semanais**, respeitando CLT e convenção coletiva (CCT).

```
organizacao escala/
├── supabase/migrations/   → banco (tabelas, RLS, função salvar_escala)
├── backend/               → API em Vercel Functions (TypeScript) + motor de escala
│   ├── api/               → rotas HTTP
│   ├── src/engine/        → motor: regras, feriados, horas, otimização
│   ├── src/modelos.ts     → modelos prontos (shopping, indústria diurno/noturno)
│   └── test/              → testes do motor (vitest)
└── frontend/              → React + Vite (login Supabase, cadastros, grade da escala, impressão)
```

## O que o motor garante

| Regra | Padrão | Onde ajustar |
|---|---|---|
| Escala 5x2 | 5 dias trabalhados por semana (seg–dom) | Regras / Convenção |
| Jornada | meta 42h, nunca passa de 44h (hora noturna reduzida conta) | Regras / Convenção + duração dos turnos |
| Mulher | no máximo 1 domingo seguido (trabalha um, folga o outro) | Regras, ou por funcionária |
| Homem | até 2 domingos seguidos, folga no 3º | Regras, ou por funcionário |
| Feriado trabalhado | folga compensatória **na mesma semana** (sem pagamento em dobro) | Regras / Convenção |
| Feriados | nacionais calculados (inclui Paixão de Cristo e 20/11) + estaduais/municipais cadastrados | Feriados |
| CCT | dias em que a operação fecha (ex.: 25/12, 01/01), folga de aniversário, observações | Regras / Convenção |
| Descanso | máx. 6 dias seguidos, 11h entre jornadas, intervalo mínimo do art. 71 | Regras / Convenção |
| Cobertura | mínimo de pessoas por turno e por dia (ex.: sábado coberto) | Equipes e turnos |
| Continuidade | o revezamento de domingos e dias seguidos continua do mês anterior | automático |

Cada mês usa **semanas completas de segunda a domingo** (as semanas cuja quinta-feira cai no mês), para a folga compensatória e o limite semanal valerem sempre dentro da mesma semana. Quando algo não fecha (pouca gente, turno sem intervalo legal, domingo descoberto), a escala vem com avisos explicando o motivo.

Ver no terminal os dois cenários de exemplo:

```bash
cd backend && npm install && npm run demo -- 2026 11
```

### Modelos prontos

- **Loja de shopping** — 10h às 22h todos os dias. Abertura 10:00–19:24 e fechamento 12:36–22:00 (8h24 + 1h de intervalo = 42h em 5 dias), mínimo 1 pessoa por turno.
- **Indústria diurno/noturno** — diurno seg–sex 06–16h (1h de intervalo) e sáb 06–10h; noturno seg–sex 22–06h (1h de intervalo) e sáb 22h–01h30. Com esses horários, 5 dias úteis dariam 45h no diurno, então o motor coloca todo mundo do diurno no sábado (40h/semana) e avisa que a meta de 42h não é atingida — para atingir, ajuste a duração dos turnos.

## Como publicar

### 1. Supabase
1. Crie um projeto em supabase.com.
2. Em **SQL Editor**, rode o arquivo `supabase/migrations/20261018000000_init.sql` (ou `supabase db push` com a CLI).
3. Em **Authentication → Providers**, deixe *Email* ativo. Para testes, pode desligar "Confirm email".
4. Anote em **Project Settings → API**: `Project URL` e `anon public key`.

### 2. Backend na Vercel
1. Novo projeto na Vercel → importe o repositório → **Root Directory: `backend`** (Framework: Other).
2. Variáveis de ambiente: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORS_ORIGIN` (URL do frontend, ex.: `https://escala.vercel.app`).
3. Deploy. Teste: `https://SEU-BACKEND.vercel.app/api/health`.

### 3. Frontend na Vercel
1. Outro projeto na Vercel com o mesmo repositório → **Root Directory: `frontend`** (Framework: Vite).
2. Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (URL do backend, sem barra no final).
3. Deploy e volte ao backend para conferir que `CORS_ORIGIN` é a URL final do frontend.

### Rodar localmente
```bash
cd backend && cp .env.example .env && npm install && npx vercel dev --listen 3001
cd frontend && cp .env.example .env && npm install && npm run dev
```

## API

Todas as rotas exigem `Authorization: Bearer <access_token do Supabase>`; as políticas RLS garantem que cada usuário só vê as próprias empresas.

| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/api/crud/:recurso` | lista/cria `empresas`, `equipes`, `turnos`, `funcionarios`, `ausencias`, `feriados` (filtros: `empresa_id`, `equipe_id`, `funcionario_id`) |
| GET/PATCH/DELETE | `/api/crud/:recurso/:id` | lê/altera/exclui |
| GET/POST | `/api/modelos` | modelos prontos / cria empresa a partir de um modelo |
| GET | `/api/calendario?empresa_id&ano` | feriados do ano (nacionais + cadastrados) |
| POST | `/api/escalas/gerar` | `{ empresa_id, ano, mes, seed? }` gera e grava a escala do mês |
| GET | `/api/escalas?empresa_id&ano&mes` | escala gravada com os dias |

## Testes

```bash
cd backend && npm test
```

Os testes geram os 12 meses de 2026 para os dois modelos e conferem: dias seguidos, domingos por sexo, 5 dias e 44h por semana, folga compensatória de feriado, cobertura mínima de cada turno, continuidade entre meses, feriado fechado pela CCT, aniversário e férias.

## Limitações atuais

- As regras da convenção coletiva são cadastradas manualmente (aba Regras / Convenção); o sistema não lê o PDF da CCT.
- Ainda não é possível editar a escala à mão célula a célula; para mudar, ajuste cadastros/regras e gere de novo, ou use "Outra variação".
