import {
  AppointmentRecord,
  BusinessSettings,
  ClientRecord,
  DayConfigRecord,
  HaircutRecord,
  SlotRecord,
  TimeSlot,
} from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { STANDARD_HOURS, addDaysToDateStr, getTodayDateString } from '../data/defaultData';

/* ─────────────────────────────────────────────
 * Utilidades
 * ───────────────────────────────────────────── */
export const normalizePhone = (phone: string): string => phone.replace(/\D/g, '');

export const daysSince = (dateStr: string): number => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const from = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = getTodayDateString().split('-').map(Number);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
};

/* ─────────────────────────────────────────────
 * Validación y saneamiento (seguridad)
 * ───────────────────────────────────────────── */
export const sanitizeText = (value: string, maxLength: number): string =>
  value.trim().replace(/\s+/g, ' ').slice(0, maxLength);

export const sanitizeNote = (value: string): string => value.trim().slice(0, 500);

/** Solo permite enlaces http/https (bloquea javascript:, datos, etc.) */
export const sanitizeReferenceUrl = (url: string): string | null => {
  const trimmed = url.trim().slice(0, 500);
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return trimmed;
  } catch {
    // URL inválida
  }
  return null;
};

/** Valida un correo simple (opcional) y lo normaliza. */
export const sanitizeEmail = (value: string): string | null => {
  const email = value.trim().slice(0, 120);
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email.toLowerCase() : null;
};

/* ─────────────────────────────────────────────
 * Slots (horarios del día)
 * ───────────────────────────────────────────── */
export const ensureDaySlots = async (date: string): Promise<SlotRecord[]> => {
  const sb = getSupabase();
  const { data } = await sb
    .from('slots')
    .select('*')
    .eq('date', date)
    .order('time', { ascending: true });

  let slots = (data ?? []) as SlotRecord[];
  if (slots.length === 0) {
    // No crear horarios para días pasados (evita filas basura en la DB)
    if (date < getTodayDateString()) return [];
    const rows = STANDARD_HOURS.map((time) => ({ date, time, is_available: true }));
    const { data: inserted, error } = await sb.from('slots').insert(rows).select('*');
    if (error) {
      // Carrera: otro dispositivo creó los slots al mismo tiempo → releer
      if (error.code === '23505') {
        const { data: retry } = await sb
          .from('slots')
          .select('*')
          .eq('date', date)
          .order('time', { ascending: true });
        return ((retry ?? []) as SlotRecord[]);
      }
      throw error;
    }
    slots = (inserted ?? []) as SlotRecord[];
  }
  return slots;
};

export const setSlotAvailability = async (date: string, time: string, available: boolean) => {
  const sb = getSupabase();
  const { error } = await sb
    .from('slots')
    .update({ is_available: available })
    .eq('date', date)
    .eq('time', time);
  if (error) throw error;
};

export const addCustomSlot = async (date: string, time: string) => {
  const sb = getSupabase();
  const { error } = await sb
    .from('slots')
    .upsert({ date, time, is_available: true }, { onConflict: 'date,time' });
  if (error) throw error;
};

export const restoreStandardSlots = async (date: string) => {
  const sb = getSupabase();
  const rows = STANDARD_HOURS.map((time) => ({ date, time, is_available: true }));
  // upsert define las horas estándar; horas extra fuera del estándar se conservan
  const { error } = await sb.from('slots').upsert(rows, { onConflict: 'date,time' });
  if (error) throw error;
};

/* ─────────────────────────────────────────────
 * Días laborables
 * ───────────────────────────────────────────── */
export const getDayConfig = async (date: string): Promise<DayConfigRecord | null> => {
  const sb = getSupabase();
  const { data } = await sb.from('day_config').select('*').eq('date', date).maybeSingle();
  return (data as DayConfigRecord | null) ?? null;
};

export const getOpenDays = async (from: string, to: string): Promise<Record<string, boolean>> => {
  const sb = getSupabase();
  const { data } = await sb
    .from('day_config')
    .select('date,is_open')
    .gte('date', from)
    .lte('date', to);
  const map: Record<string, boolean> = {};
  (data ?? []).forEach((d: { date: string; is_open: boolean }) => {
    map[d.date] = d.is_open;
  });
  return map;
};

export const setDayOpen = async (date: string, isOpen: boolean) => {
  // Bloqueo de seguridad: nunca abrir días pasados (hoy = 2026-09-09, ej: 09-08 ya no se abre)
  if (isOpen && date < getTodayDateString()) {
    throw new Error('No se pueden abrir días pasados.');
  }
  const sb = getSupabase();
  const { error } = await sb
    .from('day_config')
    .upsert({ date, is_open: isOpen }, { onConflict: 'date' });
  if (error) throw error;
};

/* ─────────────────────────────────────────────
 * Clientes
 * ───────────────────────────────────────────── */
export interface IdentifiedClient {
  client: ClientRecord;
  isNew: boolean;
  daysSinceLastCut: number | null; // null = nunca vino
}

export const getOrCreateClient = async (
  fullName: string,
  phone: string,
  email?: string,
): Promise<IdentifiedClient> => {
  const sb = getSupabase();
  const cleanPhone = normalizePhone(phone) || null;
  const cleanEmail = sanitizeEmail(email || '') || null;
  const name = fullName.trim().replace(/\s+/g, ' ');

  let existing: ClientRecord | null = null;
  if (cleanPhone) {
    const { data } = await sb.from('clients').select('*').eq('phone', cleanPhone).maybeSingle();
    existing = (data as ClientRecord | null) ?? null;
  }

  if (existing) {
    const client = existing;
    // El nombre canónico (guardado) NUNCA se sobreescribe: así la vista del barbero
    // y la del cliente muestran siempre el mismo nombre para la misma cita.
    if (cleanEmail && client.email !== cleanEmail) {
      const { error: updErr } = await sb
        .from('clients')
        .update({ email: cleanEmail })
        .eq('id', client.id);
      if (updErr && !/column |PGRST204|does not exist/i.test(updErr.message)) throw updErr;
      client.email = cleanEmail;
    }
    const days = client.last_visit ? daysSince(client.last_visit) : null;
    return { client, isNew: false, daysSinceLastCut: days };
  }

  const insertRow: { full_name: string; phone: string | null; email?: string | null } =
    cleanEmail
      ? { full_name: name, phone: cleanPhone, email: cleanEmail }
      : { full_name: name, phone: cleanPhone };
  const { data: created, error } = await sb.from('clients').insert(insertRow).select('*').single();
  if (error) {
    // Compatibilidad: si la base aún no tiene la columna email, reintenta sin ella
    if (/column |PGRST204|does not exist/i.test(error.message)) {
      const { data: created2, error: error2 } = await sb
        .from('clients')
        .insert({ full_name: name, phone: cleanPhone })
        .select('*')
        .single();
      if (error2) throw error2;
      return {
        client: created2 as ClientRecord,
        isNew: true,
        daysSinceLastCut: null,
      };
    }
    throw error;
  }
  return {
    client: created as ClientRecord,
    isNew: true,
    daysSinceLastCut: null,
  };
};

/* ─────────────────────────────────────────────
 * Sesión del cliente (caché local para no volver a identificarse)
 * ───────────────────────────────────────────── */
export interface ClientSession {
  clientId: string;
  fullName: string;
  phone: string; // solo dígitos
  email: string;
  savedAt: string;
}

const CLIENT_SESSION_KEY = 'barber_client_session_v1';

export const saveClientSession = (session: ClientSession): void => {
  try {
    localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
  } catch {
    // almacenamiento no disponible
  }
};

export const loadClientSession = (): ClientSession | null => {
  try {
    const raw = localStorage.getItem(CLIENT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientSession;
    return parsed && parsed.clientId ? parsed : null;
  } catch {
    return null;
  }
};

export const clearClientSession = (): void => {
  try {
    localStorage.removeItem(CLIENT_SESSION_KEY);
  } catch {
    // ignorar
  }
};

export const searchClients = async (query: string): Promise<ClientRecord[]> => {
  const sb = getSupabase();
  const q = query.trim();
  if (!q) {
    const { data } = await sb
      .from('clients')
      .select('*')
      .order('last_visit', { ascending: false, nullsFirst: false })
      .limit(50);
    return (data ?? []) as ClientRecord[];
  }
  // Sanea para el parser OR de PostgREST: coma/paréntesis rompen la query.
  // % _ \ se escapan para el LIKE.
  const safeName = q
    .replace(/[,()]/g, ' ')
    .replace(/[\\%_]/g, (m) => `\\${m}`)
    .trim();
  const digits = normalizePhone(q);
  const filters: string[] = [];
  if (safeName) filters.push(`full_name.ilike.%${safeName}%`);
  if (digits) {
    const safeDigits = digits.replace(/[\\%_]/g, (m) => `\\${m}`);
    filters.push(`phone.ilike.%${safeDigits}%`);
  }
  if (filters.length === 0) return [];
  const { data, error } = await sb.from('clients').select('*').or(filters.join(',')).limit(50);
  if (error) throw error;
  return (data ?? []) as ClientRecord[];
};

export const getClientHistory = async (clientId: string): Promise<AppointmentRecord[]> => {
  const sb = getSupabase();
  const { data } = await sb
    .from('appointments')
    .select('*, clients(full_name, phone, last_visit)')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(30);
  return (data ?? []) as AppointmentRecord[];
};

/* ─────────────────────────────────────────────
 * Citas
 * ───────────────────────────────────────────── */
export const listAppointments = async (date: string): Promise<AppointmentRecord[]> => {
  const sb = getSupabase();
  const { data } = await sb
    .from('appointments')
    .select('*, clients(full_name, phone, last_visit)')
    .eq('date', date)
    .order('time', { ascending: true });
  return (data ?? []) as AppointmentRecord[];
};

/** Reserva activa del cliente (hoy o futura, no cancelada). Máx. 1 por celular. */
export const getActiveBooking = async (
  clientId: string,
): Promise<AppointmentRecord | null> => {
  const sb = getSupabase();
  const { data } = await sb
    .from('appointments')
    .select('*, clients(full_name, phone, last_visit)')
    .eq('client_id', clientId)
    .neq('status', 'cancelled')
    .gte('date', getTodayDateString())
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as AppointmentRecord | null) ?? null;
};

/** Historial de turnos del cliente (no cancelados), del más reciente al más viejo. */
export const getRecentBookings = async (
  clientId: string,
  limit = 6,
): Promise<AppointmentRecord[]> => {
  const sb = getSupabase();
  const { data } = await sb
    .from('appointments')
    .select('*, clients(full_name, phone, last_visit)')
    .eq('client_id', clientId)
    .neq('status', 'cancelled')
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .limit(limit);
  return (data ?? []) as AppointmentRecord[];
};

export const listActiveBookingsBetween = async (
  from: string,
  to: string,
): Promise<{ date: string; time: string }[]> => {
  const sb = getSupabase();
  const { data } = await sb
    .from('appointments')
    .select('date,time')
    .gte('date', from)
    .lte('date', to)
    .neq('status', 'cancelled');
  return (data ?? []) as { date: string; time: string }[];
};

/** Turnos marcados como atendidos en los últimos días (para fichar el corte realizado). */
export const listRecentAttended = async (
  days = 30,
  limit = 100,
): Promise<AppointmentRecord[]> => {
  const sb = getSupabase();
  const from = addDaysToDateStr(getTodayDateString(), -(days - 1));
  const { data, error } = await sb
    .from('appointments')
    .select('*, clients(full_name, phone, last_visit)')
    .eq('status', 'attended')
    .gte('date', from)
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppointmentRecord[];
};

/** Cita no cancelada anterior a hoy (turno viejo sin atender). */
const getStaleBooking = async (clientId: string): Promise<AppointmentRecord | null> => {
  const sb = getSupabase();
  const { data } = await sb
    .from('appointments')
    .select('*')
    .eq('client_id', clientId)
    .neq('status', 'cancelled')
    .lt('date', getTodayDateString())
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as AppointmentRecord | null) ?? null;
};

export interface BookingInput {
  clientId: string;
  date: string;
  time: string;
  referenceUrl?: string | null;
  referenceImageUrl?: string | null;
  note?: string | null;
  isAnonymous?: boolean; // ocultar el nombre a otros clientes (el barbero lo ve igual)
}

export const createBooking = async (input: BookingInput): Promise<AppointmentRecord> => {
  const sb = getSupabase();
  // Bloqueo de seguridad: no se puede reservar en días pasados
  if (input.date < getTodayDateString()) {
    throw new Error('No se pueden hacer citas en días pasados.');
  }
  const referenceUrl = sanitizeReferenceUrl(input.referenceUrl || '');
  const note = sanitizeNote(input.note || '');

  // ── Camino atómico: función SQL con bloqueo (evita carreras entre dispositivos) ──
  try {
    const { data, error } = await sb.rpc('create_appointment', {
      p_client_id: input.clientId,
      p_date: input.date,
      p_time: input.time,
      p_reference_url: referenceUrl || null,
      p_reference_image_url: input.referenceImageUrl || null,
      p_note: note || null,
      p_is_anonymous: input.isAnonymous || false,
    });
    if (error) {
      if (/SLOT_TAKEN/.test(error.message)) {
        throw new Error('Ese horario acaba de ser tomado. Elegí otro.');
      }
      if (/CLIENT_HAS_BOOKING/.test(error.message)) {
        throw new Error('Ya tenés un turno activo. Podés editarlo o cancelarlo desde la app.');
      }
      // La función no existe en la base (schema viejo) → usar el camino clásico
      if (!/does not exist|42883|PGRST202/i.test(error.message)) throw error;
    } else if (data) {
      const { data: row } = await sb
        .from('appointments')
        .select('*, clients(full_name, phone, last_visit)')
        .eq('id', data as string)
        .single();
      if (row) return row as AppointmentRecord;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (/Ese horario|Ya tenés un turno/.test(message)) throw e;
    // Cualquier otro error del RPC: continuar con el camino clásico
  }

  // ── Camino clásico (compatibilidad con base sin la función SQL) ──
  const active = await getActiveBooking(input.clientId);
  if (active) {
    throw new Error('Ya tenés un turno activo. Podés editarlo o cancelarlo desde la app.');
  }

  const { data, error } = await sb
    .from('appointments')
    .insert({
      client_id: input.clientId,
      date: input.date,
      time: input.time,
      status: 'confirmed',
      reference_url: referenceUrl,
      reference_image_url: input.referenceImageUrl || null,
      note: note || null,
      is_anonymous: input.isAnonymous || false,
    })
    .select('*, clients(full_name, phone, last_visit)')
    .single();
  if (error) {
    if (error.code === '23505') {
      // Puede ser: horario tomado, o un turno viejo sin atender que bloquea al cliente.
      // En este último caso lo cancelamos automáticamente y reintentamos una vez.
      const stale = await getStaleBooking(input.clientId);
      if (stale) {
        await sb.from('appointments').update({ status: 'cancelled' }).eq('id', stale.id);
        return createBooking(input);
      }
      throw new Error('Ese horario acaba de ser tomado o ya tenés un turno agendado.');
    }
    throw error;
  }

  // Actualiza el último corte solo si la cita es hoy o anterior
  if (daysSince(input.date) >= 0) {
    await sb.from('clients').update({ last_visit: input.date }).eq('id', input.clientId);
  }

  return data as AppointmentRecord;
};

/** Edita una reserva existente (cambiar horario, referencia o notas). */
export const updateBooking = async (
  id: string,
  input: Pick<
    BookingInput,
    'date' | 'time' | 'referenceUrl' | 'referenceImageUrl' | 'note' | 'isAnonymous'
  >,
): Promise<AppointmentRecord> => {
  const sb = getSupabase();
  // Bloqueo de seguridad: no se puede mover una cita a un día pasado
  if (input.date < getTodayDateString()) {
    throw new Error('No se pueden hacer citas en días pasados.');
  }
  const referenceUrl = sanitizeReferenceUrl(input.referenceUrl || '');

  // ── Camino atómico: función SQL con bloqueo ──
  try {
    const { data, error } = await sb.rpc('move_appointment', {
      p_id: id,
      p_date: input.date,
      p_time: input.time,
      p_reference_url: referenceUrl || null,
      p_reference_image_url: input.referenceImageUrl || null,
      p_note: sanitizeNote(input.note || '') || null,
    });
    if (error) {
      if (/SLOT_TAKEN/.test(error.message)) {
        throw new Error('Ese horario acaba de ser tomado por otra persona. Elegí otro.');
      }
      if (/APPOINTMENT_NOT_FOUND/.test(error.message)) {
        throw new Error('Tu turno ya no existe. Volvé a la agenda e intentá de nuevo.');
      }
      if (!/does not exist|42883|PGRST202/i.test(error.message)) throw error;
    } else if (data) {
      // move_appointment no toca el anonimato: se aplica por separado
      if (input.isAnonymous !== undefined) {
        const { error: anonError } = await sb
          .from('appointments')
          .update({ is_anonymous: input.isAnonymous })
          .eq('id', data as string);
        if (anonError) throw anonError;
      }
      const { data: row } = await sb
        .from('appointments')
        .select('*, clients(full_name, phone, last_visit)')
        .eq('id', data as string)
        .single();
      if (row) return row as AppointmentRecord;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (/Ese horario|ya no existe/.test(message)) throw e;
  }

  // ── Camino clásico (compatibilidad) ──
  const { data: taken } = await sb
    .from('appointments')
    .select('id')
    .eq('date', input.date)
    .eq('time', input.time)
    .neq('status', 'cancelled')
    .neq('id', id)
    .maybeSingle();
  if (taken) {
    throw new Error('Ese horario acaba de ser tomado por otra persona. Elegí otro.');
  }

  const { data, error } = await sb
    .from('appointments')
    .update({
      date: input.date,
      time: input.time,
      status: 'confirmed',
      reference_url: referenceUrl,
      reference_image_url: input.referenceImageUrl || null,
      note: sanitizeNote(input.note || '') || null,
      ...(input.isAnonymous !== undefined ? { is_anonymous: input.isAnonymous } : {}),
    })
    .eq('id', id)
    .select('*, clients(full_name, phone, last_visit)')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('Ese horario acaba de ser tomado por otra persona. Elegí otro.');
    }
    throw error;
  }
  return data as AppointmentRecord;
};

export const setAppointmentState = async (id: string, status: AppointmentRecord['status']) => {
  const sb = getSupabase();
  const { error } = await sb.from('appointments').update({ status }).eq('id', id);
  if (error) throw error;
};

export const deleteAppointment = async (id: string) => {
  const sb = getSupabase();
  const { error } = await sb.from('appointments').delete().eq('id', id);
  if (error) throw error;
};

export const isSlotTaken = (appointments: AppointmentRecord[], time: string): boolean =>
  appointments.some((a) => a.time === time && a.status !== 'cancelled');

/* ─────────────────────────────────────────────
 * Historial de personas atendidas
 * ───────────────────────────────────────────── */
export interface HaircutInput {
  date: string; // YYYY-MM-DD
  time?: string | null; // horario de la cita 'HH:MM'
  clientId?: string | null;
  clientName: string;
  serviceName?: string | null; // corte realizado (el barbero lo completa después)
  minutes?: number | null; // tiempo que tardó (opcional: se carga después)
  price?: string | null;
  appointmentId?: string | null;
  note?: string | null; // observaciones
}

export const isMissingTableError = (e: unknown): boolean =>
  e instanceof Error && /Could not find the table|42P01|relation .* does not exist/i.test(e.message);

const sanitizeMinutes = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 480);
};

const sanitizeTime = (value: string | null | undefined): string | null => {
  const t = (value || '').trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(t) ? t : null;
};

export const listHaircuts = async (limit = 200): Promise<HaircutRecord[]> => {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('haircuts')
    .select('*, clients(full_name, phone)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as HaircutRecord[];
};

export const createHaircut = async (input: HaircutInput): Promise<HaircutRecord> => {
  const sb = getSupabase();
  const clientName = sanitizeText(input.clientName, 80);
  const serviceName = sanitizeText(input.serviceName || '', 80) || null;
  if (!clientName) throw new Error('Escribí el nombre del cliente.');
  const { data, error } = await sb
    .from('haircuts')
    .insert({
      date: input.date,
      time: sanitizeTime(input.time),
      client_id: input.clientId || null,
      client_name: clientName,
      service_name: serviceName,
      minutes: sanitizeMinutes(input.minutes),
      price: sanitizeText(input.price || '', 20) || null,
      appointment_id: input.appointmentId || null,
      note: sanitizeNote(input.note || '') || null,
    })
    .select('*, clients(full_name, phone)')
    .single();
  if (error) throw error;
  return data as HaircutRecord;
};

/** Crea la ficha de la persona atendida desde su turno (una sola vez por turno). */
export const createHaircutFromAppointment = async (appt: {
  id: string;
  date: string;
  time: string;
  client_id: string;
  clientName: string;
}): Promise<HaircutRecord | null> => {
  const sb = getSupabase();
  const { data: existing } = await sb
    .from('haircuts')
    .select('id')
    .eq('appointment_id', appt.id)
    .maybeSingle();
  if (existing) return null;
  return createHaircut({
    date: appt.date,
    time: appt.time,
    clientId: appt.client_id,
    clientName: appt.clientName,
    serviceName: null,
    minutes: null,
    price: null,
    appointmentId: appt.id,
  });
};

export const updateHaircut = async (
  id: string,
  updates: {
    serviceName?: string;
    minutes?: number | null;
    price?: string | null;
    note?: string | null;
    time?: string | null;
  },
): Promise<void> => {
  const sb = getSupabase();
  const row: Record<string, string | number | null> = {};
  if (updates.serviceName !== undefined) {
    const name = sanitizeText(updates.serviceName, 80);
    if (!name) throw new Error('El corte realizado no puede quedar vacío.');
    row.service_name = name;
  }
  if (updates.minutes !== undefined) row.minutes = sanitizeMinutes(updates.minutes);
  if (updates.price !== undefined) row.price = sanitizeText(updates.price || '', 20) || null;
  if (updates.note !== undefined) row.note = sanitizeNote(updates.note || '') || null;
  if (updates.time !== undefined) row.time = sanitizeTime(updates.time);
  const { error } = await sb.from('haircuts').update(row).eq('id', id);
  if (error) throw error;
};

export const deleteHaircut = async (id: string): Promise<void> => {
  const sb = getSupabase();
  const { error } = await sb.from('haircuts').delete().eq('id', id);
  if (error) throw error;
};

export const subscribeHaircutsChanges = (onChange: () => void): (() => void) => {
  if (!isSupabaseConfigured()) return () => {};
  const sb = getSupabase();
  const channel = sb
    .channel('cortes-cambios')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'haircuts' }, () =>
      onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
};

/* ─────────────────────────────────────────────
 * Storage (fotos de referencia)
 * ───────────────────────────────────────────── */
export const uploadReferenceImage = async (file: File, clientId: string): Promise<string> => {
  const sb = getSupabase();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('references').upload(path, file);
  if (error) throw error;
  const { data } = sb.storage.from('references').getPublicUrl(path);
  return data.publicUrl;
};

/* ─────────────────────────────────────────────
 * Configuración del negocio (pública, en la nube)
 * ───────────────────────────────────────────── */
export interface PublicBusinessData {
  businessName: string;
  phone: string;
  address: string;
  webhookUrl: string;
  webhookEnabled: boolean;
}

export const fetchPublicBusinessData = async (): Promise<PublicBusinessData | null> => {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  const { data } = await sb.from('business_settings').select('*').eq('id', 1).maybeSingle();
  if (!data) return null;
  return {
    businessName: data.business_name,
    phone: data.phone,
    address: (data.address as string) || '',
    webhookUrl: data.webhook_url,
    webhookEnabled: data.webhook_enabled,
  };
};

export const savePublicBusinessData = async (data: PublicBusinessData) => {
  const sb = getSupabase();
  const { error } = await sb.from('business_settings').upsert({
    id: 1,
    business_name: data.businessName,
    phone: data.phone,
    address: data.address,
    webhook_url: data.webhookUrl,
    webhook_enabled: data.webhookEnabled,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

/* ─────────────────────────────────────────────
 * Tiempo real (Supabase Realtime)
 * ───────────────────────────────────────────── */
export const subscribeAgendaChanges = (onChange: () => void): (() => void) => {
  if (!isSupabaseConfigured()) return () => {};
  const sb = getSupabase();
  const channel = sb
    .channel('agenda-cambios')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () =>
      onChange(),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'day_config' }, () => onChange())
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
};

/* ─────────────────────────────────────────────
 * Webhook → Pabbly Connect (WhatsApp)
 * ───────────────────────────────────────────── */
export interface BookingWebhookPayload {
  event: 'booking.created' | 'booking.updated';
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  referenceUrl: string | null;
  referenceImageUrl: string | null;
  note: string | null;
  createdAt: string;
}

export const sendBookingWebhook = async (
  settings: Pick<BusinessSettings, 'webhookEnabled' | 'webhookUrl'>,
  payload: BookingWebhookPayload,
): Promise<boolean> => {
  if (!settings.webhookEnabled || !settings.webhookUrl.trim()) return false;
  try {
    await fetch(settings.webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
};

export const buildWaLink = (phone: string, text: string): string =>
  `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;

/** Link de GPS (Google Maps) para que el cliente llegue a la barbería. */
export const buildMapsLink = (address: string, fallbackName: string): string => {
  const trimmed = address.trim();
  // Si es un link directo de Google Maps (ej: https://maps.app.goo.gl/...) se usa tal cual
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const query = trimmed || fallbackName.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

/* ─────────────────────────────────────────────
 * Migración desde localStorage (una sola vez)
 * ───────────────────────────────────────────── */
export const migrateLocalAgenda = async (
  scheduleMap: Record<string, TimeSlot[]>,
  workingDaysMap: Record<string, boolean>,
): Promise<{ clients: number; appointments: number; days: number }> => {
  const sb = getSupabase();
  let clients = 0;
  let appointments = 0;
  let days = 0;

  for (const [date, slots] of Object.entries(scheduleMap)) {
    if (!slots.length) continue;
    days += 1;

    // Horarios
    const slotRows = slots.map((s) => ({
      date,
      time: s.time,
      is_available: s.type === 'available' ? true : false,
    }));
    await sb.from('slots').upsert(slotRows, { onConflict: 'date,time' });

    // Día laborable
    if (workingDaysMap[date] === false) {
      await sb.from('day_config').upsert({ date, is_open: false }, { onConflict: 'date' });
    }

    // Citas
    const booked = slots.filter((s) => s.type === 'booked' && s.clientName);
    for (const slot of booked) {
      const phone = normalizePhone(slot.clientPhone || '');
      let clientId: string | null = null;

      if (phone) {
        const { data: found } = await sb
          .from('clients')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();
        if (found) {
          clientId = (found as { id: string }).id;
        } else {
          const { data: inserted, error } = await sb
            .from('clients')
            .insert({ full_name: slot.clientName!, phone })
            .select('id')
            .single();
          if (!error && inserted) {
            clientId = (inserted as { id: string }).id;
            clients += 1;
          }
        }
      } else {
        const { data: inserted, error } = await sb
          .from('clients')
          .insert({ full_name: slot.clientName! })
          .select('id')
          .single();
        if (!error && inserted) {
          clientId = (inserted as { id: string }).id;
          clients += 1;
        }
      }
      if (!clientId) continue;

      const { data: taken } = await sb
        .from('appointments')
        .select('id')
        .eq('date', date)
        .eq('time', slot.time)
        .neq('status', 'cancelled')
        .maybeSingle();
      if (taken) continue;

      const { error: insError } = await sb.from('appointments').insert({
        client_id: clientId,
        date,
        time: slot.time,
        status: 'confirmed',
      });
      if (!insError) appointments += 1;
    }
  }

  return { clients, appointments, days };
};

/* ─────────────────────────────────────────────
 * Mensajes de WhatsApp (reglas y avisos)
 * ───────────────────────────────────────────── */
export const buildRulesText = (businessName: string): string => `💈 *${businessName} — Reservas online* 📲

¡Hola! Te contamos cómo funciona la reserva de turnos:

1️⃣ *Elegí el día y el horario* que te quede cómodo.
2️⃣ *Mandá una foto o el video* (TikTok) del corte que te gustaría hacerte para preparar todo.
3️⃣ *Confirmá* y te queda tu turno reservado.

📌 *Reglas importantes:*
• Una persona puede tener *un solo turno activo* a la vez.
• Si querés cambiar el horario, podés *editar* tu turno desde el mismo link (*no hace falta avisar*).
• Si no podés asistir, *editá o cancelá tu turno con al menos 2 horas de anticipación* para que el barbero pueda reponerlo y nadie se quede sin su turno.
• Llegá 5 minutos antes. 🙏

¡Te esperamos! ✂️`;

export const buildConfirmationText = (
  businessName: string,
  date: string,
  time: string,
): string => `💈 *${businessName}*
✅ *Turno confirmado*
📅 ${date} · ⏰ ${time} h

¿No podés asistir? Editá o cancelá tu turno con *al menos 2 horas de anticipación* para que el barbero pueda reponerlo. ¡Te esperamos! ✂️`;
