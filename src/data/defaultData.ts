import { ServiceItem, TimeSlot } from '../types';

export const BARBER_SERVICES: ServiceItem[] = [
  { id: 'corte-clasico', name: 'Corte Clásico', durationMinutes: 40, price: '$10.00' },
  { id: 'corte-barba', name: 'Corte + Barba', durationMinutes: 50, price: '$15.00' },
  { id: 'corte-fade', name: 'Corte Desvanecido (Fade)', durationMinutes: 45, price: '$12.00' },
  { id: 'perfilado-barba', name: 'Perfilado de Barba', durationMinutes: 30, price: '$8.00' },
  { id: 'limpieza-cejas', name: 'Limpieza de Cejas', durationMinutes: 20, price: '$5.00' },
  { id: 'coloracion', name: 'Coloración / Tinte', durationMinutes: 60, price: '$20.00' },
  { id: 'combo-vip', name: 'Combo VIP Completo', durationMinutes: 60, price: '$22.00' },
];

export const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const STANDARD_HOURS = [
  '09:00',
  '09:45',
  '10:30',
  '11:15',
  '12:00',
  '13:00',
  '15:00',
  '15:45',
  '16:30',
  '17:00',
  '18:00',
  '18:45',
  '19:30',
  '20:15',
  '21:00',
  '21:15',
];

export const generateBlankSlotsForDate = (dateStr: string): TimeSlot[] => {
  return STANDARD_HOURS.map((time) => {
    const [hour] = time.split(':').map(Number);
    const period = hour < 14 ? 'morning' : 'afternoon';
    const isLunch = time === '12:00';
    const isBreak = time === '17:00';

    if (isLunch) {
      return {
        id: `${dateStr}-${time.replace(':', '')}`,
        time,
        period,
        type: 'blocked',
        date: dateStr,
        blockedReason: 'Descanso Almuerzo',
      };
    }

    if (isBreak) {
      return {
        id: `${dateStr}-${time.replace(':', '')}`,
        time,
        period,
        type: 'blocked',
        date: dateStr,
        blockedReason: 'Descanso 5:00 PM',
      };
    }

    return {
      id: `${dateStr}-${time.replace(':', '')}`,
      time,
      period,
      type: 'available',
      date: dateStr,
    };
  });
};

export const getUpcomingDays = (daysCount = 7): { dateStr: string; label: string; isToday: boolean; weekday: string }[] => {
  const list = [];
  const now = new Date();
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    
    const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const formattedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', '');
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');

    list.push({
      dateStr,
      label: `${formattedWeekday} ${dayNum} ${monthName}`,
      weekday: formattedWeekday,
      isToday: i === 0,
    });
  }
  return list;
};


export const formatDateDisplay = (dateStr: string): string => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const formatted = date.toLocaleDateString('es-ES', options);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return dateStr;
  }
};

export const getDefaultSlotsForDate = (dateStr: string): TimeSlot[] => [
  // Turnos Mañana
  {
    id: `${dateStr}-0900`,
    time: '09:00',
    period: 'morning',
    type: 'booked',
    date: dateStr,
    clientName: 'Carlos Rodríguez',
    clientPhone: '+52 55 1234 5678',
    service: 'Corte + Barba',
    status: 'confirmed',
    notes: 'Cliente frecuente, prefiere tijera arriba.',
  },
  {
    id: `${dateStr}-0945`,
    time: '09:45',
    period: 'morning',
    type: 'booked',
    date: dateStr,
    clientName: 'Andrés Villa',
    clientPhone: '+52 55 9876 5432',
    service: 'Corte Clásico',
    status: 'confirmed',
  },
  {
    id: `${dateStr}-1030`,
    time: '10:30',
    period: 'morning',
    type: 'available',
    date: dateStr,
  },
  {
    id: `${dateStr}-1115`,
    time: '11:15',
    period: 'morning',
    type: 'booked',
    date: dateStr,
    clientName: 'Mateo Sánchez',
    clientPhone: '+52 55 4567 8901',
    service: 'Limpieza de Cejas',
    status: 'confirmed',
  },
  {
    id: `${dateStr}-1200`,
    time: '12:00',
    period: 'morning',
    type: 'blocked',
    date: dateStr,
    blockedReason: 'Descanso Almuerzo',
  },
  {
    id: `${dateStr}-1300`,
    time: '13:00',
    period: 'morning',
    type: 'booked',
    date: dateStr,
    clientName: 'Javier López',
    clientPhone: '+52 55 3456 7890',
    service: 'Corte Desvanecido',
    status: 'pending',
  },

  // Turnos Tarde
  {
    id: `${dateStr}-1500`,
    time: '15:00',
    period: 'afternoon',
    type: 'booked',
    date: dateStr,
    clientName: 'Hugo Torres',
    clientPhone: '+52 55 6789 0123',
    service: 'Coloración',
    status: 'confirmed',
  },
  {
    id: `${dateStr}-1545`,
    time: '15:45',
    period: 'afternoon',
    type: 'booked',
    date: dateStr,
    clientName: 'Oscar Mendieta',
    clientPhone: '+52 55 2345 6789',
    service: 'Corte + Barba',
    status: 'confirmed',
  },
  {
    id: `${dateStr}-1630`,
    time: '16:30',
    period: 'afternoon',
    type: 'available',
    date: dateStr,
  },
  {
    id: `${dateStr}-1700`,
    time: '17:00',
    period: 'afternoon',
    type: 'blocked',
    date: dateStr,
    blockedReason: 'Pequeño Break',
  },
  {
    id: `${dateStr}-1800`,
    time: '18:00',
    period: 'afternoon',
    type: 'booked',
    date: dateStr,
    clientName: 'Luis Fernández',
    clientPhone: '+52 55 8765 4321',
    service: 'Corte Clásico',
    status: 'confirmed',
  },
  {
    id: `${dateStr}-1845`,
    time: '18:45',
    period: 'afternoon',
    type: 'booked',
    date: dateStr,
    clientName: 'Enrique Sosa',
    clientPhone: '+52 55 7654 3210',
    service: 'Perfilado Barba',
    status: 'confirmed',
  },
  {
    id: `${dateStr}-1930`,
    time: '19:30',
    period: 'afternoon',
    type: 'available',
    date: dateStr,
  },
  {
    id: `${dateStr}-2015`,
    time: '20:15',
    period: 'afternoon',
    type: 'available',
    date: dateStr,
  },
  {
    id: `${dateStr}-2100`,
    time: '21:00',
    period: 'afternoon',
    type: 'available',
    date: dateStr,
  },
  {
    id: `${dateStr}-2115`,
    time: '21:15',
    period: 'afternoon',
    type: 'available',
    date: dateStr,
  }
];
