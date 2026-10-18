-- Sistema de organização de escalas (5x2 / 42h)
-- Executar no SQL Editor do Supabase ou via `supabase db push`.

create extension if not exists "pgcrypto";

-- Empresas (clientes) ---------------------------------------------------------
create table public.empresas (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null,
  cnpj        text,
  uf          char(2),
  municipio   text,
  -- Regras da escala e da convenção coletiva (ver backend/src/engine/types.ts -> Regras)
  regras      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Equipes: grupos de funcionários que cobrem os mesmos turnos (ex.: diurno, noturno, loja)
create table public.equipes (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nome        text not null,
  created_at  timestamptz not null default now()
);

-- Turnos de trabalho de uma equipe. dias: 1=segunda ... 7=domingo
create table public.turnos (
  id                uuid primary key default gen_random_uuid(),
  equipe_id         uuid not null references public.equipes(id) on delete cascade,
  nome              text not null,
  dias              smallint[] not null,
  inicio            time not null,
  fim               time not null,
  intervalo_min     integer not null default 60 check (intervalo_min >= 0),
  min_funcionarios  integer not null default 1 check (min_funcionarios >= 0),
  created_at        timestamptz not null default now(),
  constraint turnos_dias_validos check (dias <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(dias) > 0)
);

create table public.funcionarios (
  id                          uuid primary key default gen_random_uuid(),
  empresa_id                  uuid not null references public.empresas(id) on delete cascade,
  equipe_id                   uuid references public.equipes(id) on delete set null,
  nome                        text not null,
  sexo                        char(1) not null check (sexo in ('F','M')),
  data_nascimento             date,
  -- Sobrescreve a regra padrão por sexo (F=1, M=2) quando preenchido
  max_domingos_consecutivos   smallint check (max_domingos_consecutivos between 0 and 6),
  ativo                       boolean not null default true,
  created_at                  timestamptz not null default now()
);

-- Férias, afastamentos, atestados
create table public.ausencias (
  id              uuid primary key default gen_random_uuid(),
  funcionario_id  uuid not null references public.funcionarios(id) on delete cascade,
  inicio          date not null,
  fim             date not null,
  tipo            text not null default 'ferias',
  check (fim >= inicio)
);

-- Feriados estaduais/municipais da empresa (os nacionais são calculados pelo sistema)
create table public.feriados (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  data        date not null,
  nome        text not null,
  -- true = a operação não abre nesse dia (ex.: previsto na convenção coletiva)
  fechado     boolean not null default false,
  unique (empresa_id, data)
);

-- Escalas geradas (uma por empresa/mês) --------------------------------------
create table public.escalas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  ano         integer not null,
  mes         integer not null check (mes between 1 and 12),
  inicio      date not null,
  fim         date not null,
  seed        integer not null default 1,
  avisos      jsonb not null default '[]'::jsonb,
  resumo      jsonb not null default '{}'::jsonb,
  gerada_em   timestamptz not null default now(),
  unique (empresa_id, ano, mes)
);

create table public.escala_dias (
  id                  uuid primary key default gen_random_uuid(),
  escala_id           uuid not null references public.escalas(id) on delete cascade,
  funcionario_id      uuid not null references public.funcionarios(id) on delete cascade,
  data                date not null,
  -- trabalho | folga | folga_compensatoria | feriado | ausencia | aniversario
  tipo                text not null,
  turno_id            uuid references public.turnos(id) on delete set null,
  inicio              time,
  fim                 time,
  minutos_relogio     integer not null default 0,
  minutos_computados  integer not null default 0,
  unique (escala_id, funcionario_id, data)
);

create index on public.equipes (empresa_id);
create index on public.turnos (equipe_id);
create index on public.funcionarios (empresa_id);
create index on public.ausencias (funcionario_id);
create index on public.escala_dias (funcionario_id, data);

-- Row Level Security: cada usuário só enxerga as empresas que cadastrou -------
alter table public.empresas     enable row level security;
alter table public.equipes      enable row level security;
alter table public.turnos       enable row level security;
alter table public.funcionarios enable row level security;
alter table public.ausencias    enable row level security;
alter table public.feriados     enable row level security;
alter table public.escalas      enable row level security;
alter table public.escala_dias  enable row level security;

create or replace function public.is_dono_empresa(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.empresas e where e.id = eid and e.owner_id = auth.uid());
$$;

create policy empresas_dono on public.empresas
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy equipes_dono on public.equipes
  for all using (public.is_dono_empresa(empresa_id)) with check (public.is_dono_empresa(empresa_id));

create policy turnos_dono on public.turnos
  for all using (exists (select 1 from public.equipes q where q.id = equipe_id and public.is_dono_empresa(q.empresa_id)))
  with check (exists (select 1 from public.equipes q where q.id = equipe_id and public.is_dono_empresa(q.empresa_id)));

create policy funcionarios_dono on public.funcionarios
  for all using (public.is_dono_empresa(empresa_id)) with check (public.is_dono_empresa(empresa_id));

create policy ausencias_dono on public.ausencias
  for all using (exists (select 1 from public.funcionarios f where f.id = funcionario_id and public.is_dono_empresa(f.empresa_id)))
  with check (exists (select 1 from public.funcionarios f where f.id = funcionario_id and public.is_dono_empresa(f.empresa_id)));

create policy feriados_dono on public.feriados
  for all using (public.is_dono_empresa(empresa_id)) with check (public.is_dono_empresa(empresa_id));

create policy escalas_dono on public.escalas
  for all using (public.is_dono_empresa(empresa_id)) with check (public.is_dono_empresa(empresa_id));

create policy escala_dias_dono on public.escala_dias
  for all using (exists (select 1 from public.escalas s where s.id = escala_id and public.is_dono_empresa(s.empresa_id)))
  with check (exists (select 1 from public.escalas s where s.id = escala_id and public.is_dono_empresa(s.empresa_id)));

-- Grava uma escala gerada de forma atômica (substitui a do mesmo mês). Roda com as permissões do usuário (RLS).
create or replace function public.salvar_escala(
  p_empresa uuid, p_ano int, p_mes int, p_inicio date, p_fim date, p_seed int,
  p_avisos jsonb, p_resumo jsonb, p_dias jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  insert into public.escalas (empresa_id, ano, mes, inicio, fim, seed, avisos, resumo, gerada_em)
  values (p_empresa, p_ano, p_mes, p_inicio, p_fim, p_seed, p_avisos, p_resumo, now())
  on conflict (empresa_id, ano, mes) do update
    set inicio = excluded.inicio, fim = excluded.fim, seed = excluded.seed,
        avisos = excluded.avisos, resumo = excluded.resumo, gerada_em = now()
  returning id into v_id;

  delete from public.escala_dias where escala_id = v_id;

  insert into public.escala_dias (escala_id, funcionario_id, data, tipo, turno_id, inicio, fim, minutos_relogio, minutos_computados)
  select v_id, d.funcionario_id, d.data, d.tipo, d.turno_id, d.inicio, d.fim, d.minutos_relogio, d.minutos_computados
  from jsonb_to_recordset(p_dias) as d(
    funcionario_id uuid, data date, tipo text, turno_id uuid, inicio time, fim time,
    minutos_relogio int, minutos_computados int
  );

  return v_id;
end;
$$;
