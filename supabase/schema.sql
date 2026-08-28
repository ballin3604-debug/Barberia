-- ═══════════════════════════════════════════════════════════════
--  Agenda de Barbería — Esquema de Supabase
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
--  Se puede ejecutar más de una vez (es idempotente).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. CLIENTES ────────────────────────────────────────────────
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text unique,                   -- solo dígitos, ej: 525512345678 (opcional)
  last_visit date,                     -- último corte (para el saludo de bienvenida)
  created_at timestamptz not null default now()
);

create index if not exists clients_phone_idx on public.clients (phone);

-- ── 2. HORARIOS DEL DÍA (slots) ────────────────────────────────
create table if not exists public.slots (
  id bigint generated always as identity primary key,
  date date not null,
  time text not null,                  -- 'HH:MM'
  is_available boolean not null default true,
  unique (date, time)
);

create index if not exists slots_date_idx on public.slots (date);

-- ── 3. CITAS ───────────────────────────────────────────────────
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  time text not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'attended', 'cancelled')),
  reference_url text,                  -- link de TikTok / Instagram / foto
  reference_image_url text,            -- foto subida a Storage
  note text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_date_idx on public.appointments (date);
create index if not exists appointments_client_idx on public.appointments (client_id);

-- Un solo turno activo por horario (evita doble reserva)
create unique index if not exists one_active_booking_per_slot
  on public.appointments (date, time)
  where status <> 'cancelled';

-- ═══════════════════════════════════════════════════════════════
--  REGLA: UNA SOLA RESERVA ACTIVA POR CLIENTE
--  Evita que una misma persona sature el sistema con varios turnos.
--  (Los índices de Postgres solo admiten predicados IMMUTABLE, por
--   eso la parte "hoy o futuro" se controla desde la app.)
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  delete from public.appointments a
  using public.appointments b
  where a.client_id = b.client_id
    and a.status <> 'cancelled' and b.status <> 'cancelled'
    and a.id <> b.id
    and a.created_at < b.created_at;
end $$;

create unique index if not exists one_active_booking_per_client
  on public.appointments (client_id)
  where status <> 'cancelled';

-- ── 4. DÍAS LABORABLES ─────────────────────────────────────────
create table if not exists public.day_config (
  date date primary key,
  is_open boolean not null default true
);

-- ── 5. CONFIGURACIÓN PÚBLICA DEL NEGOCIO ───────────────────────
create table if not exists public.business_settings (
  id int primary key default 1,
  business_name text not null default 'Barbería El Maestro',
  phone text not null default '',      -- WhatsApp del barbero (código de país)
  webhook_url text not null default '',-- URL del workflow de Pabbly Connect
  webhook_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.business_settings (id) values (1)
  on conflict (id) do nothing;

-- ── 6. SEGURIDAD (RLS): acceso público para la app  ───────────
--  ⚠️ Los datos no son confidenciales (nombres y horarios).
--  Se recomienda agregar un PIN de barbero en el futuro.
alter table public.clients enable row level security;
alter table public.slots enable row level security;
alter table public.appointments enable row level security;
alter table public.day_config enable row level security;
alter table public.business_settings enable row level security;

drop policy if exists "public access clients" on public.clients;
create policy "public access clients" on public.clients
  for all using (true) with check (true);

drop policy if exists "public access slots" on public.slots;
create policy "public access slots" on public.slots
  for all using (true) with check (true);

drop policy if exists "public access appointments" on public.appointments;
create policy "public access appointments" on public.appointments
  for all using (true) with check (true);

drop policy if exists "public access day_config" on public.day_config;
create policy "public access day_config" on public.day_config
  for all using (true) with check (true);

drop policy if exists "public read business_settings" on public.business_settings;
create policy "public read business_settings" on public.business_settings
  for select using (true);
drop policy if exists "public update business_settings" on public.business_settings;
create policy "public update business_settings" on public.business_settings
  for update using (true) with check (true);
drop policy if exists "public insert business_settings" on public.business_settings;
create policy "public insert business_settings" on public.business_settings
  for insert with check (true);

-- ── 7. TIEMPO REAL (Realtime) ──────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.appointments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.slots;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.day_config;
exception when duplicate_object then null;
end $$;

-- ── 8. STORAGE: fotos de referencia ────────────────────────────
insert into storage.buckets (id, name, public)
  values ('references', 'references', true)
  on conflict (id) do nothing;

drop policy if exists "public read references" on storage.objects;
create policy "public read references" on storage.objects
  for select using (bucket_id = 'references');

drop policy if exists "public upload references" on storage.objects;
create policy "public upload references" on storage.objects
  for insert with check (bucket_id = 'references');
