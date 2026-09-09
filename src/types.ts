export type SlotType = 'available' | 'booked' | 'break' | 'blocked';

export type AppointmentStatus = 'confirmed' | 'pending' | 'attended';

export type DayPeriod = 'morning' | 'afternoon' | 'evening';

export interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  description?: string;
}

export interface BusinessSettings {
  businessName: string;
  phone: string; // WhatsApp del barbero con código de país, ej: +525512345678
  address: string; // Dirección de la barbería (para el link de GPS / Google Maps)
  webhookUrl: string; // URL del workflow de Pabbly Connect (opcional)
  webhookEnabled: boolean;
  pin: string; // PIN opcional para proteger la vista del barbero (solo local)
  services: ServiceItem[];
}

/* ── Modelos de Supabase ──────────────────────────────── */

export interface ClientRecord {
  id: string;
  full_name: string;
  phone: string; // solo dígitos
  email: string | null;
  last_visit: string | null; // YYYY-MM-DD
  created_at: string;
}

export type AppointmentState = 'confirmed' | 'attended' | 'cancelled';

export interface AppointmentRecord {
  id: string;
  client_id: string;
  date: string;
  time: string;
  status: AppointmentState;
  reference_url: string | null;
  reference_image_url: string | null;
  note: string | null;
  is_anonymous: boolean; // el cliente oculta su nombre a otros clientes
  created_at: string;
  // join con clients
  clients?: Pick<ClientRecord, 'id' | 'full_name' | 'phone' | 'last_visit'> | null;
}

export interface SlotRecord {
  id: number;
  date: string;
  time: string;
  is_available: boolean;
}

export interface DayConfigRecord {
  date: string;
  is_open: boolean;
}

/* ── Historial de personas atendidas ─────────────── */
export interface HaircutRecord {
  id: string;
  date: string; // YYYY-MM-DD (día en que se atendió)
  time: string | null; // horario de la cita 'HH:MM'
  client_id: string | null;
  client_name: string;
  service_name: string | null; // corte realizado (lo completa el barbero)
  minutes: number | null; // tiempo que tardó (lo completa el barbero)
  price: string | null;
  appointment_id: string | null;
  note: string | null; // observaciones
  created_at: string;
  // join con clients
  clients?: Pick<ClientRecord, 'id' | 'full_name' | 'phone'> | null;
}

/* ── Modelos legacy (localStorage) ─────────────────────── */

export interface TimeSlot {
  id: string;
  time: string; // HH:MM format
  period: 'morning' | 'afternoon';
  type: SlotType;
  date: string; // YYYY-MM-DD
  clientName?: string;
  clientPhone?: string;
  service?: string;
  status?: AppointmentStatus;
  breakTitle?: string;
  blockedReason?: string;
  notes?: string;
  createdAt?: string;
}

export interface BackupFile {
  version: 1;
  exportedAt: string;
  settings: BusinessSettings;
  workingDaysMap: Record<string, boolean>;
  scheduleMap: Record<string, TimeSlot[]>;
}
