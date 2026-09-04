import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppointmentRecord, ServiceItem, SlotRecord } from '../../types';
import {
  ensureDaySlots,
  getDayConfig,
  listAppointments,
  setDayOpen,
  subscribeAgendaChanges,
} from '../../lib/api';
import {
  addDaysToDateStr,
  formatDateDisplay,
  getTodayDateString,
  getUpcomingDays,
  splitSlotsByPeriod,
} from '../../data/defaultData';
import { SlotActionsModal } from './SlotActionsModal';
import { HoursEditorModal } from './HoursEditorModal';
import { ClientsPanelModal } from './ClientsPanelModal';
import { CalendarModal } from './CalendarModal';
import { CutsHistoryTable } from './CutsHistoryTable';
import { useToast } from '../Toast';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Link2,
  Scissors,
  Settings2,
  Share2,
  Users,
} from 'lucide-react';

interface BarberAgendaViewProps {
  businessName: string;
  services: ServiceItem[];
  onOpenSettings: () => void;
  onOpenReports: () => void;
}

interface SlotView {
  time: string;
  is_available: boolean;
  appointment: AppointmentRecord | null;
}

const PERIODS = [
  { key: 'morning' as const, title: 'Mañana', dot: 'bg-amber-400' },
  { key: 'afternoon' as const, title: 'Tarde', dot: 'bg-indigo-500' },
  { key: 'evening' as const, title: 'Noche', dot: 'bg-purple-500' },
];

export const BarberAgendaView: React.FC<BarberAgendaViewProps> = ({
  businessName,
  services,
  onOpenSettings,
  onOpenReports,
}) => {
  const showToast = useToast();
  const today = getTodayDateString();
  const [agendaView, setAgendaView] = useState<'agenda' | 'cuts'>('agenda');
  const [selectedDate, setSelectedDate] = useState(today);
  const [slots, setSlots] = useState<SlotRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal actions
  const [actionSlot, setActionSlot] = useState<{ time: string; available: boolean } | null>(null);
  const [showHoursEditor, setShowHoursEditor] = useState(false);
  const [showClients, setShowClients] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const upcomingDays = useMemo(() => getUpcomingDays(7), []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [dayConfig, slotRows, apptRows] = await Promise.all([
        getDayConfig(selectedDate),
        ensureDaySlots(selectedDate),
        listAppointments(selectedDate),
      ]);
      setIsOpen(dayConfig ? dayConfig.is_open : false);
      setSlots(slotRows);
      setAppointments(apptRows);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar la agenda');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const unsubscribe = subscribeAgendaChanges(() => {
      reload();
    });
    return unsubscribe;
  }, [reload]);

  const viewSlots = useMemo<SlotView[]>(
    () =>
      slots.map((slot) => ({
        time: slot.time,
        is_available: slot.is_available,
        appointment:
          appointments.find((a) => a.time === slot.time && a.status !== 'cancelled') ?? null,
      })),
    [slots, appointments],
  );

  const grouped = useMemo(() => splitSlotsByPeriod(viewSlots), [viewSlots]);

  const freeCount = viewSlots.filter((s) => s.is_available && !s.appointment).length;
  const bookedCount = viewSlots.filter((s) => s.appointment).length;

  const handleToggleDay = async () => {
    const next = !isOpen;
    setIsOpen(next);
    try {
      await setDayOpen(selectedDate, next);
      showToast(next ? 'Día habilitado para atender' : 'Día marcado como cerrado');
    } catch {
      setIsOpen(!next);
      showToast('No se pudo cambiar el día', 'error');
    }
  };

  const handleShare = async () => {
    const link = `${window.location.origin}${window.location.pathname}?view=client&date=${selectedDate}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Link de reserva copiado');
    } catch {
      showToast('No se pudo copiar el link', 'error');
    }
  };

  const activeAppointment = actionSlot
    ? (appointments.find((a) => a.time === actionSlot.time && a.status !== 'cancelled') ?? null)
    : null;
  const actionSlotAvailable = actionSlot
    ? (slots.find((s) => s.time === actionSlot.time)?.is_available ?? false)
    : false;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200/80 px-4 sm:px-8 py-3.5 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.jpg"
              alt={businessName}
              className="w-9 h-9 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-gray-900 truncate">
                {businessName}
              </h1>
              <p className="text-[11px] text-gray-500 font-medium capitalize truncate">
                {formatDateDisplay(selectedDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, -1))}
              className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
              aria-label="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100 cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, 1))}
              className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
              aria-label="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="ml-1 flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white shadow-sm transition-colors cursor-pointer"
              title="Copiar el link de reserva para tus clientes"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Compartir</span>
            </button>

            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowCalendar(true)}
                className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
                title="Calendario de días (abrir/cerrar fechas)"
                aria-label="Calendario de días"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowClients(true)}
                className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
                title="Clientes"
                aria-label="Ver clientes"
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenReports}
                className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
                title="Reportes"
                aria-label="Ver reportes"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setAgendaView(agendaView === 'cuts' ? 'agenda' : 'cuts')}
                className={`p-2 rounded-lg cursor-pointer ${
                  agendaView === 'cuts'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="Personas atendidas (tabla)"
                aria-label="Ver personas atendidas"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
                title="Ajustes"
                aria-label="Ajustes"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Week chips */}
        <div className="max-w-6xl mx-auto flex items-center gap-1.5 mt-3 overflow-x-auto">
          {upcomingDays.map((d) => {
            const isSelected = d.dateStr === selectedDate;
            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => setSelectedDate(d.dateStr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="capitalize">{d.label}</span>
                {d.isToday && !isSelected && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-600 align-middle" />
                )}
              </button>
            );
          })}
        </div>

        {/* Day strip: estado + stats + acciones móviles */}
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mt-2.5">
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleDay}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
              title={isOpen ? 'Cerrar el día' : 'Abrir el día'}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-bold text-gray-700">
                {isOpen ? 'Atendiendo' : 'Cerrado'}
              </span>
            </button>
            <span className="text-[11px] font-semibold text-gray-500">
              {freeCount} libres · {bookedCount} agendados
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHoursEditor(true)}
              className="text-[10px] sm:text-[11px] font-bold text-gray-600 hover:text-gray-900 px-2 sm:px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              ✎ Horarios
            </button>
            <button
              type="button"
              onClick={() => setShowCalendar(true)}
              className="md:hidden text-[10px] sm:text-[11px] font-bold text-gray-600 hover:text-gray-900 px-2 sm:px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              📅 Días
            </button>
            <button
              type="button"
              onClick={() => setShowClients(true)}
              className="md:hidden text-[10px] sm:text-[11px] font-bold text-gray-600 hover:text-gray-900 px-2 sm:px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              Clientes
            </button>
            <button
              type="button"
              onClick={onOpenReports}
              className="md:hidden text-[10px] sm:text-[11px] font-bold text-gray-600 hover:text-gray-900 px-2 sm:px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              Reportes
            </button>
            <button
              type="button"
              onClick={() => setAgendaView(agendaView === 'cuts' ? 'agenda' : 'cuts')}
              className="md:hidden text-[10px] sm:text-[11px] font-bold text-gray-600 hover:text-gray-900 px-2 sm:px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              {agendaView === 'cuts' ? 'Agenda' : 'Cortes'}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="md:hidden text-[10px] sm:text-[11px] font-bold text-gray-600 hover:text-gray-900 px-2 sm:px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              Ajustes
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {agendaView === 'cuts' ? (
          <CutsHistoryTable services={services} />
        ) : (
          <>
        {error && (
          <p
            role="alert"
            className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"
          >
            {error}
          </p>
        )}

        {!isOpen ? (
          <div className="flex flex-col items-center justify-center text-center py-16 space-y-4 anim-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <Scissors className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Día cerrado</h2>
            <p className="text-xs text-gray-500 max-w-xs">
              Los clientes no pueden reservar este día. Abrilo cuando quieras recibir turnos.
            </p>
            <button
              type="button"
              onClick={handleToggleDay}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Abrir este día
            </button>
          </div>
        ) : loading ? (
          <p className="text-xs text-gray-400 italic text-center py-16 anim-fade">
            Cargando agenda…
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 anim-up">
            {PERIODS.map((period) => (
              <div key={period.key} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/80">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${period.dot}`} />
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      Turnos {period.title}
                    </h2>
                  </div>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    {grouped[period.key].filter((s) => s.is_available && !s.appointment).length}{' '}
                    libres
                  </span>
                </div>

                {grouped[period.key].map((slot) => (
                  <SlotCard
                    key={slot.time}
                    slot={slot}
                    onOpen={() => setActionSlot({ time: slot.time, available: slot.is_available })}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </main>

      {/* Modales */}
      <SlotActionsModal
        isOpen={actionSlot !== null}
        date={selectedDate}
        time={actionSlot?.time ?? null}
        slotAvailable={actionSlotAvailable}
        appointment={activeAppointment}
        onClose={() => setActionSlot(null)}
        onChanged={reload}
      />
      <HoursEditorModal
        isOpen={showHoursEditor}
        date={selectedDate}
        slots={slots}
        onClose={() => setShowHoursEditor(false)}
        onChanged={reload}
      />
      <ClientsPanelModal isOpen={showClients} onClose={() => setShowClients(false)} />
      <CalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        onChanged={reload}
      />
    </div>
  );
};

const SlotCard: React.FC<{
  slot: SlotView;
  onOpen: () => void;
}> = ({ slot, onOpen }) => {
  const { appointment } = slot;

  if (appointment) {
    const attended = appointment.status === 'attended';
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`w-full text-left flex items-center justify-between py-2.5 px-3.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
          attended
            ? 'bg-blue-50/60 border-blue-200'
            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs font-bold text-gray-900 shrink-0">{slot.time}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">
              {appointment.clients?.full_name || 'Cliente'}
            </p>
            <p className="text-[10px] text-gray-400 truncate">
              {attended ? 'Atendido ✓' : 'Agendado'} · hizo clic en el link
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {appointment.reference_image_url && (
            <span className="text-xs" title="Foto de referencia">
              🖼
            </span>
          )}
          {appointment.reference_url && (
            <Link2 className="w-3.5 h-3.5 text-blue-500" aria-label="Referencia externa" />
          )}
          <span className={`w-2 h-2 rounded-full ${attended ? 'bg-blue-500' : 'bg-emerald-500'}`} />
        </div>
      </button>
    );
  }

  if (!slot.is_available) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left flex items-center justify-between py-2.5 px-3.5 rounded-xl border border-gray-200/70 bg-gray-50/60 text-gray-400 cursor-pointer"
      >
        <span className="font-mono text-xs font-semibold">{slot.time}</span>
        <span className="text-[10px] font-semibold">oculta</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-center justify-between py-2.5 px-3.5 rounded-xl border border-dashed border-gray-300 hover:border-blue-400 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
    >
      <span className="font-mono text-xs font-semibold text-gray-500">{slot.time}</span>
      <span className="text-[10px] font-semibold text-blue-600">Libre</span>
    </button>
  );
};
