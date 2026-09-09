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
  email text,                          -- correo (opcional, para recordatorios)
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
  reminded_at timestamptz,             -- recordatorio por correo enviado
  is_anonymous boolean not null default false, -- el cliente oculta su nombre a otros clientes
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

-- Migración: anonimato (bases que ya tenían la tabla appointments)
alter table public.appointments
  add column if not exists is_anonymous boolean not null default false;

-- ═══════════════════════════════════════════════════════════════
--  OPERACIONES ATÓMICAS (evita carreras entre dispositivos)
--  Reservar y mover turnos en UNA transacción con bloqueo:
--  si dos personas tocan el mismo horario, la primera gana y la
--  segunda recibe un error claro (nunca se pisan los turnos).
-- ═══════════════════════════════════════════════════════════════
create or replace function public.create_appointment(
  p_client_id uuid,
  p_date date,
  p_time text,
  p_reference_url text default null,
  p_reference_image_url text default null,
  p_note text default null,
  p_is_anonymous boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  lock table public.appointments in share row exclusive mode;

  if exists (
    select 1 from public.appointments
    where date = p_date and time = p_time and status <> 'cancelled'
  ) then
    raise exception 'SLOT_TAKEN' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.appointments
    where client_id = p_client_id and status <> 'cancelled' and date >= current_date
  ) then
    raise exception 'CLIENT_HAS_BOOKING' using errcode = '23505';
  end if;

  insert into public.appointments
    (client_id, date, time, status, reference_url, reference_image_url, note, is_anonymous)
  values
    (p_client_id, p_date, p_time, 'confirmed', p_reference_url, p_reference_image_url, p_note, p_is_anonymous)
  returning id into v_id;

  if p_date <= current_date then
    update public.clients set last_visit = p_date where id = p_client_id;
  end if;

  return v_id;
end $$;

create or replace function public.move_appointment(
  p_id uuid,
  p_date date,
  p_time text,
  p_reference_url text default null,
  p_reference_image_url text default null,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  lock table public.appointments in share row exclusive mode;

  if exists (
    select 1 from public.appointments
    where date = p_date and time = p_time and status <> 'cancelled' and id <> p_id
  ) then
    raise exception 'SLOT_TAKEN' using errcode = '23505';
  end if;

  update public.appointments
  set
    date = p_date,
    time = p_time,
    status = 'confirmed',
    reference_url = coalesce(p_reference_url, reference_url),
    reference_image_url = coalesce(p_reference_image_url, reference_image_url),
    note = coalesce(p_note, note)
  where id = p_id;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  return p_id;
end $$;

-- ── 4. DÍAS LABORABLES ─────────────────────────────────────────
create table if not exists public.day_config (
  date date primary key,
  is_open boolean not null default true
);

-- ── 5. CONFIGURACIÓN PÚBLICA DEL NEGOCIO ───────────────────────
create table if not exists public.business_settings (
  id int primary key default 1,
  business_name text not null default 'THE BEST BARBERSHOP',
  phone text not null default '',      -- WhatsApp del barbero (código de país)
  webhook_url text not null default '',-- URL del workflow de Pabbly Connect
  webhook_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.business_settings (id) values (1)
  on conflict (id) do nothing;

-- Dirección / link de GPS (se sincroniza con la app para el botón del cliente)
alter table public.business_settings
  add column if not exists address text not null default '';

-- ── 5b. TOKENS DE NOTIFICACIÓN WEB PUSH ────────────────────────
create table if not exists public.push_tokens (
  id bigint generated always as identity primary key,
  client_id uuid references public.clients (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_tokens_client_idx on public.push_tokens (client_id);

-- ── 6. SEGURIDAD (RLS): acceso público para la app  ───────────
--  ⚠️ Los datos no son confidenciales (nombres y horarios).
--  Se recomienda agregar un PIN de barbero en el futuro.
alter table public.clients enable row level security;
alter table public.slots enable row level security;
alter table public.appointments enable row level security;
alter table public.day_config enable row level security;
alter table public.business_settings enable row level security;
alter table public.push_tokens enable row level security;

drop policy if exists "public access push_tokens" on public.push_tokens;
create policy "public access push_tokens" on public.push_tokens
  for all using (true) with check (true);

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

-- ── 9. HISTORIAL DE PERSONAS ATENDIDAS ─────────────
--  Tabla tipo base de datos: fecha, horario, persona, teléfono,
--  corte realizado, tiempo que tardó, precio y observaciones.
--  La ficha se crea sola al marcar el turno como atendido y el
--  barbero completa corte/tiempo/nota después.
create table if not exists public.haircuts (
  id uuid primary key default gen_random_uuid(),
  date date not null,                      -- día en que se atendió
  time text,                               -- horario de la cita 'HH:MM'
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null,               -- nombre (también para clientes sin ficha)
  service_name text,                       -- corte realizado (lo completa el barbero)
  minutes integer check (minutes is null or (minutes >= 1 and minutes <= 480)),
  price text,                              -- ej: '$10.00' (opcional)
  appointment_id uuid references public.appointments (id) on delete set null,
  note text,                               -- observaciones
  created_at timestamptz not null default now()
);

-- Migración para bases que ya tenían la tabla anterior
alter table public.haircuts add column if not exists time text;
alter table public.haircuts alter column service_name drop not null;

create index if not exists haircuts_date_idx on public.haircuts (date desc);
create index if not exists haircuts_client_idx on public.haircuts (client_id);

alter table public.haircuts enable row level security;

drop policy if exists "public access haircuts" on public.haircuts;
create policy "public access haircuts" on public.haircuts
  for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.haircuts;
exception when duplicate_object then null;
end $$;
