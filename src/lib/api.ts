import {
  AppointmentRecord,
  BusinessSettings,
  ClientRecord,
  DayConfigRecord,
  SlotRecord,
  TimeSlot,
} from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { STANDARD_HOURS, getTodayDateString } from '../data/defaultData';

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
    const rows = STANDARD_HOURS.map((time) => ({ date, time, is_available: true }));
    const { data: inserted, error } = await sb.from('slots').insert(rows).select('*');
    if (error) throw error;
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
): Promise<IdentifiedClient> => {
  const sb = getSupabase();
  const cleanPhone = normalizePhone(phone) || null;
  const name = fullName.trim().replace(/\s+/g, ' ');

  let existing: ClientRecord | null = null;
  if (cleanPhone) {
    const { data } = await sb.from('clients').select('*').eq('phone', cleanPhone).maybeSingle();
    existing = (data as ClientRecord | null) ?? null;
  }

  if (existing) {
    const client = existing;
    if (client.full_name !== name) {
      await sb.from('clients').update({ full_name: name }).eq('id', client.id);
      client.full_name = name;
    }
    const days = client.last_visit ? daysSince(client.last_visit) : null;
    return { client, isNew: false, daysSinceLastCut: days };
  }

  const { data: created, error } = await sb
    .from('clients')
    .insert({ full_name: name, phone: cleanPhone })
    .select('*')
    .single();
  if (error) throw error;
  return {
    client: created as ClientRecord,
    isNew: true,
    daysSinceLastCut: null,
  };
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
  const { data } = await sb
    .from('clients')
    .select('*')
    .or(`full_name.ilike.%${q}%,phone.ilike.%${normalizePhone(q)}%`)
    .limit(50);
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

export interface BookingInput {
  clientId: string;
  date: string;
  time: string;
  referenceUrl?: string | null;
  referenceImageUrl?: string | null;
  note?: string | null;
}

export const createBooking = async (input: BookingInput): Promise<AppointmentRecord> => {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('appointments')
    .insert({
      client_id: input.clientId,
      date: input.date,
      time: input.time,
      status: 'confirmed',
      reference_url: input.referenceUrl || null,
      reference_image_url: input.referenceImageUrl || null,
      note: input.note || null,
    })
    .select('*, clients(full_name, phone, last_visit)')
    .single();
  if (error) throw error;

  // Actualiza el último corte solo si la cita es hoy o anterior
  if (daysSince(input.date) >= 0) {
    await sb.from('clients').update({ last_visit: input.date }).eq('id', input.clientId);
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
  event: 'booking.created';
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
