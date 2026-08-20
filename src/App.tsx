import React, { useState, useEffect, useMemo } from 'react';
import { TimeSlot } from './types';
import { 
  getTodayDateString, 
  getDefaultSlotsForDate, 
  generateBlankSlotsForDate,
  formatDateDisplay,
  getUpcomingDays
} from './data/defaultData';
import { CleanSlotRow } from './components/CleanSlotRow';
import { DaySchedulePlanner } from './components/DaySchedulePlanner';
import { BookingModal } from './components/BookingModal';
import { EditSlotModal } from './components/EditSlotModal';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';
import { 
  Share2, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Settings2,
  CalendarCheck,
  CalendarX,
  Plus,
  Scissors,
  Coffee,
  Lock,
  Sparkles
} from 'lucide-react';

// Helper functions for client schedule serialization
const serializeSchedule = (slots: TimeSlot[]) => {
  const items = slots.map(s => `${s.time}:${s.type === 'available' ? 'a' : 'o'}`);
  return btoa(encodeURIComponent(items.join('|')));
};

const deserializeSchedule = (encoded: string): { time: string, available: boolean }[] => {
  try {
    const decoded = decodeURIComponent(atob(encoded));
    return decoded.split('|').map(item => {
      const [time, status] = item.split(':');
      return {
        time,
        available: status === 'a'
      };
    });
  } catch (e) {
    return [];
  }
};

const ClientSlotRow: React.FC<{
  slot: { time: string; available: boolean };
  date: string;
  phone: string;
}> = ({ slot, date, phone }) => {
  const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=Hola!%20Quisiera%20reservar%20el%20turno%20de%20las%20${slot.time}%20para%20el%20d%C3%ADa%20${encodeURIComponent(date)}`;

  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-xl border shadow-2xs transition-all ${
      slot.available
        ? 'bg-white border-green-200 hover:border-green-400 hover:shadow-xs'
        : 'bg-gray-100/70 border-gray-200 text-gray-400'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
          slot.available ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-400'
        }`}>
          {slot.time}
        </span>
        <span className="text-xs font-semibold">
          {slot.available ? '🟢 Disponible' : '🔒 Ocupado'}
        </span>
      </div>

      {slot.available && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
        >
          <span>Reservar</span>
        </a>
      )}
    </div>
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState<'agenda' | 'planner'>('agenda');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [quickTimeInput, setQuickTimeInput] = useState('');
  
  // Modals state
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [barberPhone, setBarberPhone] = useState(() => {
    return localStorage.getItem('barber_phone') || '';
  });

  // Check if we are in Client View mode (shared link)
  const isClientView = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('d') && params.has('s');
  }, []);

  const clientDate = useMemo(() => {
    if (!isClientView) return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('d') || '';
  }, [isClientView]);

  const clientSlots = useMemo(() => {
    if (!isClientView) return [];
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('s') || '';
    return deserializeSchedule(encoded);
  }, [isClientView]);

  const clientBarberPhone = useMemo(() => {
    if (!isClientView) return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('p') || '';
  }, [isClientView]);

  // Working days map (dateStr -> boolean)
  const [workingDaysMap, setWorkingDaysMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('barber_working_days_v2');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const today = getTodayDateString();
    return {
      [today]: true,
    };
  });

  // Slots map (dateStr -> TimeSlot[])
  const [scheduleMap, setScheduleMap] = useState<Record<string, TimeSlot[]>>(() => {
    try {
      const saved = localStorage.getItem('barber_agenda_clean_v2');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const today = getTodayDateString();
    return {
      [today]: getDefaultSlotsForDate(today),
    };
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('barber_agenda_clean_v2', JSON.stringify(scheduleMap));
    } catch {
      // storage error
    }
  }, [scheduleMap]);

  useEffect(() => {
    try {
      localStorage.setItem('barber_working_days_v2', JSON.stringify(workingDaysMap));
    } catch {
      // storage error
    }
  }, [workingDaysMap]);

  // Is selected date active as a working day? (default true if not specified)
  const isWorkingDay = workingDaysMap[selectedDate] !== false;

  // Current day slots
  const currentSlots = useMemo(() => {
    if (!scheduleMap[selectedDate]) {
      return selectedDate === getTodayDateString() 
        ? getDefaultSlotsForDate(selectedDate)
        : generateBlankSlotsForDate(selectedDate);
    }
    return scheduleMap[selectedDate];
  }, [scheduleMap, selectedDate]);

  // Updater helper
  const updateCurrentDateSlots = (updater: (prev: TimeSlot[]) => TimeSlot[]) => {
    setScheduleMap((prevMap) => {
      const existing = prevMap[selectedDate] || generateBlankSlotsForDate(selectedDate);
      const updated = updater(existing);
      return {
        ...prevMap,
        [selectedDate]: updated,
      };
    });
  };

  const handleUpdateDaySlots = (dateStr: string, slots: TimeSlot[]) => {
    setScheduleMap((prev) => ({
      ...prev,
      [dateStr]: slots,
    }));
  };

  const handleToggleWorkingDay = (dateStr: string, isWorking: boolean) => {
    setWorkingDaysMap((prev) => ({
      ...prev,
      [dateStr]: isWorking,
    }));
  };

  // Copy schedule from one day to multiple target days
  const handleApplyToMultipleDays = (sourceDateStr: string, targetDates: string[]) => {
    const sourceSlots = scheduleMap[sourceDateStr] || generateBlankSlotsForDate(sourceDateStr);
    
    setScheduleMap((prev) => {
      const nextMap = { ...prev };
      targetDates.forEach((tDate) => {
        nextMap[tDate] = sourceSlots.map((s) => ({
          ...s,
          id: `${tDate}-${s.time.replace(':', '')}`,
          date: tDate,
          clientName: s.type === 'booked' ? undefined : s.clientName,
          service: s.type === 'booked' ? undefined : s.service,
          type: s.type === 'booked' ? 'available' : s.type,
        }));
      });
      return nextMap;
    });

    setWorkingDaysMap((prev) => {
      const nextWorking = { ...prev };
      targetDates.forEach((tDate) => {
        nextWorking[tDate] = true;
      });
      return nextWorking;
    });
  };

  // Modal event handlers
  const handleConfirmBooking = (data: {
    clientName: string;
    clientPhone?: string;
    service: string;
    notes?: string;
  }) => {
    if (!bookingSlot) return;
    updateCurrentDateSlots((prev) =>
      prev.map((s) =>
        s.id === bookingSlot.id
          ? {
              ...s,
              type: 'booked',
              clientName: data.clientName,
              clientPhone: data.clientPhone,
              service: data.service,
              status: 'confirmed',
              notes: data.notes,
            }
          : s
      )
    );
    setBookingSlot(null);
  };

  const handleSaveEditedSlot = (updatedSlot: TimeSlot) => {
    updateCurrentDateSlots((prev) =>
      prev.map((s) => (s.id === updatedSlot.id ? updatedSlot : s))
    );
    setEditingSlot(null);
  };

  const handleCancelBooking = (slotId: string) => {
    handleSetAvailable(slotId);
    setEditingSlot(null);
  };

  // Slot handlers
  const handleBookDirect = (slotId: string, clientName: string, service = 'Corte Clásico') => {
    updateCurrentDateSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              type: 'booked',
              clientName,
              service,
              status: 'confirmed',
            }
          : s
      )
    );
  };

  const handleSetBreak = (slotId: string, title?: string) => {
    updateCurrentDateSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              type: 'break',
              breakTitle: title || (s.time === '12:00' ? 'Descanso Almuerzo' : 'Descanso 5:00 PM'),
              clientName: undefined,
              service: undefined,
              status: undefined,
              blockedReason: undefined,
            }
          : s
      )
    );
  };

  const handleSetBlocked = (slotId: string, reason?: string) => {
    updateCurrentDateSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              type: 'blocked',
              blockedReason: reason || 'Apartado (Ocupado)',
              clientName: undefined,
              service: undefined,
              status: undefined,
              breakTitle: undefined,
            }
          : s
      )
    );
  };

  const handleSetAvailable = (slotId: string) => {
    updateCurrentDateSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              type: 'available',
              clientName: undefined,
              clientPhone: undefined,
              service: undefined,
              status: undefined,
              breakTitle: undefined,
              blockedReason: undefined,
            }
          : s
      )
    );
  };

  const handleAddQuickTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTimeInput) return;
    const [hour] = quickTimeInput.split(':').map(Number);
    const period = hour < 14 ? 'morning' : 'afternoon';
    const newSlot: TimeSlot = {
      id: `${selectedDate}-${quickTimeInput.replace(':', '')}`,
      time: quickTimeInput,
      period,
      type: 'available',
      date: selectedDate,
    };
    updateCurrentDateSlots((prev) => {
      const filtered = prev.filter((s) => s.time !== quickTimeInput);
      return [...filtered, newSlot].sort((a, b) => a.time.localeCompare(b.time));
    });
    setQuickTimeInput('');
  };

  // Metrics
  const bookedCount = useMemo(
    () => currentSlots.filter((s) => s.type === 'booked').length,
    [currentSlots]
  );
  const availableCount = useMemo(
    () => currentSlots.filter((s) => s.type === 'available').length,
    [currentSlots]
  );
  const breakCount = useMemo(
    () => currentSlots.filter((s) => s.type === 'break').length,
    [currentSlots]
  );
  const blockedCount = useMemo(
    () => currentSlots.filter((s) => s.type === 'blocked').length,
    [currentSlots]
  );

  const morningSlots = useMemo(() => 
    currentSlots.filter((s) => {
      const hour = parseInt(s.time.split(':')[0], 10);
      return hour < 12;
    }),
    [currentSlots]
  );

  const afternoonSlots = useMemo(() => 
    currentSlots.filter((s) => {
      const hour = parseInt(s.time.split(':')[0], 10);
      return hour >= 12 && hour < 18;
    }),
    [currentSlots]
  );

  const eveningSlots = useMemo(() => 
    currentSlots.filter((s) => {
      const hour = parseInt(s.time.split(':')[0], 10);
      return hour >= 18;
    }),
    [currentSlots]
  );

  // Date Navigation
  const changeDay = (offset: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + offset);
    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${ny}-${nm}-${nd}`);
  };

  const upcomingDays = useMemo(() => getUpcomingDays(7), []);

  // 1-Click WhatsApp list generation and copy
  const handleCopyWhatsAppList = async () => {
    if (!isWorkingDay) {
      const text = `💈 *AVISO — ${formatDateDisplay(selectedDate)}*

❌ Este día no habrá atención de peluquería (Día Libre / Descanso).

📲 ¡Escríbeme para agendar tu cita en los próximos días habilitados!`;
      try {
        await navigator.clipboard.writeText(text);
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2500);
      } catch {
        // fallback
      }
      return;
    }

    const formatLine = (slot: TimeSlot) => {
      if (slot.type === 'break') {
        return `⏰ ${slot.time} - ☕ ${slot.breakTitle || 'Descanso'}`;
      }
      if (slot.type === 'blocked') {
        return `⏰ ${slot.time} - 🔒 ${slot.blockedReason || 'Apartado'}`;
      }
      if (slot.type === 'available') {
        return `⏰ ${slot.time} - 🟢 DISPONIBLE`;
      }
      return `⏰ ${slot.time} - ✂️ ${slot.clientName || 'Ocupado'}`;
    };

    const text = `💈 *HORARIOS DISPONIBLES — ${formatDateDisplay(selectedDate)}*

☀️ *Mañana:*
${morningSlots.map(formatLine).join('\n')}

🌇 *Tarde:*
${afternoonSlots.map(formatLine).join('\n')}

📲 *Responde con tu nombre para reservar tu espacio!*`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    } catch {
      // fallback
    }
  };

  // RENDER CLIENT VIEW IF SHARED LINK
  if (isClientView) {
    const clientMorning = clientSlots.filter((s) => {
      const hour = parseInt(s.time.split(':')[0], 10);
      return hour < 12 && s.available;
    });
    const clientAfternoon = clientSlots.filter((s) => {
      const hour = parseInt(s.time.split(':')[0], 10);
      return hour >= 12 && hour < 18 && s.available;
    });
    const clientEvening = clientSlots.filter((s) => {
      const hour = parseInt(s.time.split(':')[0], 10);
      return hour >= 18 && s.available;
    });

    const formattedDate = formatDateDisplay(clientDate);

    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-blue-100">
        <header className="bg-white border-b border-gray-200/80 px-4 py-5 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/95 text-center">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center justify-center gap-2">
            💈 Barbería El Maestro
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-medium capitalize">
            Agenda del día: {formattedDate}
          </p>
          <span className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-950">
            Reserva tu turno abajo en 1 clic
          </span>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Mañana */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 pb-2 border-b border-gray-200/80 px-1">
              ☀️ Turnos Mañana
            </h2>
            <div className="flex flex-col gap-2.5">
              {clientMorning.map((slot) => (
                <ClientSlotRow key={slot.time} slot={slot} date={formattedDate} phone={clientBarberPhone} />
              ))}
              {clientMorning.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">No hay turnos disponibles.</p>
              )}
            </div>
          </div>

          {/* Tarde */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 pb-2 border-b border-gray-200/80 px-1">
              🌇 Turnos Tarde
            </h2>
            <div className="flex flex-col gap-2.5">
              {clientAfternoon.map((slot) => (
                <ClientSlotRow key={slot.time} slot={slot} date={formattedDate} phone={clientBarberPhone} />
              ))}
              {clientAfternoon.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">No hay turnos disponibles.</p>
              )}
            </div>
          </div>

          {/* Noche */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 pb-2 border-b border-gray-200/80 px-1">
              🌙 Turnos Noche
            </h2>
            <div className="flex flex-col gap-2.5">
              {clientEvening.map((slot) => (
                <ClientSlotRow key={slot.time} slot={slot} date={formattedDate} phone={clientBarberPhone} />
              ))}
              {clientEvening.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">No hay turnos disponibles.</p>
              )}
            </div>
          </div>
        </main>

        <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-400 font-medium">
          <p>© 2026 Barbería El Maestro. Reservas rápidas por WhatsApp.</p>
        </footer>
      </div>
    );
  }

  // RENDER PLANNER VIEW IF ACTIVE
  if (currentView === 'planner') {
    return (
      <DaySchedulePlanner
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        isWorkingDay={isWorkingDay}
        onToggleWorkingDay={handleToggleWorkingDay}
        currentSlots={currentSlots}
        onUpdateSlots={handleUpdateDaySlots}
        onApplyToMultipleDays={handleApplyToMultipleDays}
        onBackToAgenda={() => setCurrentView('agenda')}
      />
    );
  }

  // RENDER MAIN CLEAN AGENDA VIEW
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-blue-100">
      {/* Top Professional Bar */}
      <header className="bg-white border-b border-gray-200/80 px-4 sm:px-8 py-4 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/95">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center shadow-2xs">
                <Scissors className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">
                Agenda del Barbero
              </h1>
              
              {/* Day Nav Buttons */}
              <div className="flex items-center gap-0.5 bg-gray-100/90 rounded-lg p-0.5 ml-2 border border-gray-200/50">
                <button
                  type="button"
                  onClick={() => changeDay(-1)}
                  className="p-1 text-gray-600 hover:text-gray-900 rounded-md hover:bg-white transition-all"
                  title="Día anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayDateString())}
                  className="px-2.5 py-0.5 text-xs font-bold text-gray-700 hover:text-blue-600 rounded-md hover:bg-white transition-all"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => changeDay(1)}
                  className="p-1 text-gray-600 hover:text-gray-900 rounded-md hover:bg-white transition-all"
                  title="Día siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1 pl-10.5">
              <p className="text-xs text-gray-500 font-medium capitalize">
                {formatDateDisplay(selectedDate)}
              </p>
              {!isWorkingDay && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  Día no laboral (Cerrado)
                </span>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            {isWorkingDay && (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200/80 px-3 py-1.5 rounded-xl text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span className="text-gray-500">Libres:</span>
                  <span className="font-bold text-gray-900">{availableCount}</span>
                </div>
                <div className="w-px h-3.5 bg-gray-200"></div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-900"></span>
                  <span className="text-gray-500">Agendados:</span>
                  <span className="font-bold text-gray-900">{bookedCount}</span>
                </div>
              </div>
            )}

            {/* Configurator button */}
            <button
              type="button"
              onClick={() => setCurrentView('planner')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200/80 shadow-2xs hover:border-gray-300 transition-all cursor-pointer"
              title="Elegir días de trabajo, descansos y apartar turnos"
            >
              <Settings2 className="w-3.5 h-3.5 text-gray-500" />
              <span>Días y Descansos</span>
            </button>

            {/* Share Client Link */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200/80 shadow-2xs hover:border-gray-300 transition-all cursor-pointer"
              title="Obtener enlace de reserva rápida para tus clientes de WhatsApp"
            >
              <span>Generar Link de Clientes</span>
            </button>

            {/* WhatsApp Copy */}
            <button
              type="button"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer bg-gray-900 hover:bg-black text-white hover:shadow-xs"
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span>Copiar para WhatsApp</span>
            </button>
          </div>
        </div>
      </header>

      {/* Week Quick Chips Navigation */}
      <div className="bg-white border-b border-gray-200/70 py-2.5 px-4 sm:px-8 overflow-x-auto shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mr-1 shrink-0">
            Semana:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {upcomingDays.map((d) => {
              const isSelected = d.dateStr === selectedDate;
              const isWorking = workingDaysMap[d.dateStr] !== false;

              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-gray-900 text-white shadow-2xs'
                      : isWorking
                      ? 'bg-gray-50/80 text-gray-700 hover:bg-gray-100 border border-gray-200/60'
                      : 'bg-gray-100/70 text-gray-400 line-through border border-transparent'
                  }`}
                >
                  <span>{d.label}</span>
                  {d.isToday && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isWorkingDay ? (
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Turnos Mañana */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200/80 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Turnos Mañana
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {morningSlots.filter((s) => s.type === 'available').length} libres
              </span>
            </div>

             <div className="flex flex-col gap-2.5">
              {morningSlots.map((slot) => (
                <CleanSlotRow
                  key={slot.id}
                  slot={slot}
                  onBookDirect={handleBookDirect}
                  onSetBreak={handleSetBreak}
                  onSetBlocked={handleSetBlocked}
                  onSetAvailable={handleSetAvailable}
                  onEditSlot={(s) => setEditingSlot(s)}
                  onOpenBookingModal={(s) => setBookingSlot(s)}
                />
              ))}
            </div>
          </div>

          {/* Turnos Tarde */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200/80 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Turnos Tarde
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {afternoonSlots.filter((s) => s.type === 'available').length} libres
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {afternoonSlots.map((slot) => (
                <CleanSlotRow
                  key={slot.id}
                  slot={slot}
                  onBookDirect={handleBookDirect}
                  onSetBreak={handleSetBreak}
                  onSetBlocked={handleSetBlocked}
                  onSetAvailable={handleSetAvailable}
                  onEditSlot={(s) => setEditingSlot(s)}
                  onOpenBookingModal={(s) => setBookingSlot(s)}
                />
              ))}
            </div>
          </div>

          {/* Turnos Noche */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200/80 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Turnos Noche
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {eveningSlots.filter((s) => s.type === 'available').length} libres
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {eveningSlots.map((slot) => (
                <CleanSlotRow
                  key={slot.id}
                  slot={slot}
                  onBookDirect={handleBookDirect}
                  onSetBreak={handleSetBreak}
                  onSetBlocked={handleSetBlocked}
                  onSetAvailable={handleSetAvailable}
                  onEditSlot={(s) => setEditingSlot(s)}
                  onOpenBookingModal={(s) => setBookingSlot(s)}
                />
              ))}

              {/* Add Custom Hour Shortcut */}
              <form onSubmit={handleAddQuickTime} className="mt-3 pt-3 border-t border-dashed border-gray-200 flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">+ Agregar hora:</span>
                <input
                  type="time"
                  value={quickTimeInput}
                  onChange={(e) => setQuickTimeInput(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 bg-white font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!quickTimeInput}
                  className="px-3 py-1 bg-gray-900 disabled:opacity-30 hover:bg-black text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Agregar
                </button>
              </form>
            </div>
          </div>
        </main>
      ) : (
        /* Non-Working Day State */
        <main className="flex-1 max-w-md w-full mx-auto p-6 flex flex-col items-center justify-center text-center space-y-4 my-auto">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-2xs">
            <CalendarX className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Día No Laborable
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              {formatDateDisplay(selectedDate)} está marcado como día de descanso. No hay turnos abiertos para clientes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => handleToggleWorkingDay(selectedDate, true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Habilitar para atender hoy</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('planner')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Configurar horarios</span>
            </button>
          </div>
        </main>
      )}
      {/* Modales */}
      <BookingModal
        isOpen={bookingSlot !== null}
        slot={bookingSlot}
        onClose={() => setBookingSlot(null)}
        onConfirmBooking={handleConfirmBooking}
      />

      <EditSlotModal
        isOpen={editingSlot !== null}
        slot={editingSlot}
        onClose={() => setEditingSlot(null)}
        onSave={handleSaveEditedSlot}
        onCancelBooking={handleCancelBooking}
      />

      <WhatsAppShareModal
        isOpen={isWhatsAppModalOpen}
        date={selectedDate}
        slots={currentSlots}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />

      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Enlace de Reserva para Clientes</h2>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Tu número de WhatsApp <span className="text-gray-400 font-normal lowercase">(con código de país, ej: +525512345678)</span>
              </label>
              <input
                type="tel"
                placeholder="Ej: +525512345678"
                value={barberPhone}
                onChange={(e) => {
                  setBarberPhone(e.target.value);
                  localStorage.setItem('barber_phone', e.target.value);
                }}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">El cliente te enviará un WhatsApp directo al hacer clic en un turno libre.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Enlace generado para el día:
              </label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-xs select-all overflow-x-auto max-h-24">
                {window.location.origin + window.location.pathname}?d={selectedDate}&s={serializeSchedule(currentSlots)}&p={barberPhone.replace(/\D/g, '')}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const link = `${window.location.origin}${window.location.pathname}?d=${selectedDate}&s=${serializeSchedule(currentSlots)}&p=${barberPhone.replace(/\D/g, '')}`;
                  try {
                    await navigator.clipboard.writeText(link);
                    alert("¡Enlace copiado al portapapeles!");
                    setIsShareModalOpen(false);
                  } catch (e) {
                    // ignore
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Copiar Enlace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
