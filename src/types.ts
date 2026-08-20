export type SlotType = 'available' | 'booked' | 'break' | 'blocked';

export type AppointmentStatus = 'confirmed' | 'pending' | 'attended';

export interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  description?: string;
}

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

export interface DayConfig {
  date: string;
  isWorkingDay: boolean;
  slots: TimeSlot[];
}

export interface DaySummary {
  totalSlots: number;
  bookedCount: number;
  availableCount: number;
  breakCount: number;
  blockedCount: number;
}

