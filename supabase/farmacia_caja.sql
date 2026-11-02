-- ════════════════════════════════════════════════════════════════
--  MicMEDIC · Módulo Farmacia & Caja
--  Ejecutar UNA vez en Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════════

-- 1) LISTA ORIGINAL (catálogo maestro)
create table if not exists fc_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code        text,
  type        text not null check (type in ('MEDICAMENTO','HIDRATACION','INSUMO')),
  name        text not null,
  cost        numeric(12,2) not null default 0,
  price       numeric(12,2) not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 2) PAQUETES DE PROCEDIMIENTOS
create table if not exists fc_procedures (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  professional_fee  numeric(12,2) not null default 0,
  margin_pct        numeric(6,2)  not null default 0,
  price             numeric(12,2),            -- precio a cobrar (null = usar sugerido)
  notes             text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists fc_procedure_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  procedure_id  uuid not null references fc_procedures(id) on delete cascade,
  product_id    uuid not null references fc_products(id) on delete cascade,
  qty           numeric(10,2) not null default 1
);

-- 3) CAJA DIARIA (una por día)
create table if not exists fc_daily_cash (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date                 date not null,
  consult_count        integer not null default 0,
  consult_price        numeric(12,2) not null default 0,
  reserve_per_consult  numeric(12,2) not null default 0,
  notes                text,
  created_at           timestamptz not null default now(),
  unique (user_id, date)
);

-- Procedimientos realizados en el día (se guarda copia de costo/precio del momento)
create table if not exists fc_daily_procedures (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cash_id       uuid not null references fc_daily_cash(id) on delete cascade,
  procedure_id  uuid references fc_procedures(id) on delete set null,
  name          text not null,
  qty           numeric(10,2) not null default 1,
  unit_cost     numeric(12,2) not null default 0,
  unit_price    numeric(12,2) not null default 0,
  note          text,
  created_at    timestamptz not null default now()
);

-- Productos vendidos/usados en el día
create table if not exists fc_daily_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cash_id     uuid not null references fc_daily_cash(id) on delete cascade,
  product_id  uuid references fc_products(id) on delete set null,
  name        text not null,
  type        text not null,
  qty         numeric(10,2) not null default 1,
  unit_cost   numeric(12,2) not null default 0,
  unit_price  numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- 4) BALANCE: gastos fijos
create table if not exists fc_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  period      text not null default 'MENSUAL' check (period in ('MENSUAL','ANUAL')),
  amount      numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- Configuración (precio consulta, reserva, proyección, distribución de utilidad)
create table if not exists fc_settings (
  user_id               uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  consult_price         numeric(12,2) not null default 0,
  reserve_per_consult   numeric(12,2) not null default 0,
  patients_per_day      numeric(8,2)  not null default 0,
  days_worked           numeric(8,2)  not null default 22,
  variable_per_consult  numeric(12,2) not null default 0,
  dist_salary           numeric(6,2)  not null default 50,
  dist_debt             numeric(6,2)  not null default 20,
  dist_savings          numeric(6,2)  not null default 15,
  dist_reinvest         numeric(6,2)  not null default 15
);

-- Índices
create index if not exists fc_products_user_idx   on fc_products(user_id);
create index if not exists fc_proc_items_proc_idx on fc_procedure_items(procedure_id);
create index if not exists fc_daily_cash_date_idx on fc_daily_cash(user_id, date);
create index if not exists fc_dproc_cash_idx      on fc_daily_procedures(cash_id);
create index if not exists fc_dprod_cash_idx      on fc_daily_products(cash_id);

-- Seguridad: cada usuario solo ve sus datos
do $$
declare t text;
begin
  foreach t in array array['fc_products','fc_procedures','fc_procedure_items','fc_daily_cash',
                           'fc_daily_procedures','fc_daily_products','fc_expenses','fc_settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "fc_own" on %I', t);
    execute format('create policy "fc_own" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
