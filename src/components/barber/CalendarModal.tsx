import React, { useEffect, useState } from 'react';
import { getOpenDays, listActiveBookingsBetween, setDayOpen } from '../../lib/api';
import { formatDateDisplay, getTodayDateString } from '../../data/defaultData';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
  businessName?: string;
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DEFAULT_WHATSAPP_CLOSINGS = [
  '¡Gracias por caer siempre! 🙏🔥',
  '¡Te esperamos en la silla! 💈✂️',
  '¡Asegura tu lugar que vuelan! 🔥',
  '¡Caele que te dejamos fino! 😎✂️',
  '¡Nos vemos pronto por acá! 🙌💈',
];

const CLOSINGS_KEY = 'barber_whatsapp_closings_v1';

const loadClosings = (): string[] => {
  try {
    const raw = localStorage.getItem(CLOSINGS_KEY);
    if (!raw) return DEFAULT_WHATSAPP_CLOSINGS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const clean = parsed
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().slice(0, 120))
        .filter((x) => x.length > 0);
      if (clean.length > 0) return clean;
    }
  } catch {
    // storage no disponible o corrupto
  }
  return DEFAULT_WHATSAPP_CLOSINGS;
};

const toDateStr = (y: number, m: number, d: number): string =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const buildMonthCells = (year: number, month: number): (string | null)[] => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateStr(year, month, d));
  return cells;
};

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  onChanged,
  businessName = 'La Barbería',
}) => {
  const showToast = useToast();
  const today = getTodayDateString();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [busyDay, setBusyDay] = useState<string | null>(null);
  const [pendingDay, setPendingDay] = useState<{ date: string; next: boolean } | null>(null);
  const [pendingBulk, setPendingBulk] = useState<{ open: boolean; count: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const cells = buildMonthCells(year, month).filter((c): c is string => c !== null);
    const from = cells[0];
    const to = cells[cells.length - 1];
    let cancelled = false;
    setLoading(true);
    Promise.all([getOpenDays(from, to), listActiveBookingsBetween(from, to)])
      .then(([days, bookings]) => {
        if (cancelled) return;
        setOpenDays(days);
        const map: Record<string, number> = {};
        bookings.forEach((b) => {
          map[b.date] = (map[b.date] || 0) + 1;
        });
        setCounts(map);
      })
      .catch(() => {
        if (!cancelled) {
          setOpenDays({});
          setCounts({});
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, year, month]);

  const cells = buildMonthCells(year, month);

  const daysToChange = (open: boolean): string[] => {
    const list: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      if (openDays[d] !== open) list.push(d);
    }
    return list;
  };

  const askBulkToggle = (open: boolean) => {
    const list = daysToChange(open);
    if (list.length === 0) {
      showToast('No hay nada para cambiar en los próximos 7 días');
      return;
    }
    setPendingBulk({ open, count: list.length });
  };

  const toggleDay = async (date: string, isOpenNow: boolean) => {
    // Los días pasados nunca se pueden abrir: no se hacen citas en el pasado
    if (date < today) {
      showToast('No se pueden abrir días pasados', 'error');
      return;
    }
    const next = !isOpenNow;
    setBusyDay(date);
    try {
      await setDayOpen(date, next);
      setOpenDays((prev) => ({ ...prev, [date]: next }));
      onChanged();
      showToast(next ? 'Día habilitado' : 'Día cerrado');
    } catch {
      showToast('No se pudo cambiar el día', 'error');
    } finally {
      setBusyDay(null);
    }
  };

  const bulkToggle = async (open: boolean) => {
    setLoading(true);
    try {
      const daysToToggle = daysToChange(open);
      if (daysToToggle.length === 0) {
        showToast('No hay nada para cambiar en los próximos 7 días');
        setLoading(false);
        return;
      }
      for (const d of daysToToggle) {
        await setDayOpen(d, open);
      }
      const map = { ...openDays };
      daysToToggle.forEach((d) => (map[d] = open));
      setOpenDays(map);
      onChanged();
      showToast(open ? 'Próximos 7 días habilitados' : 'Próximos 7 días cerrados');
    } catch {
      showToast('No se pudo cambiar el período', 'error');
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  // Días abiertos vigentes del mes visible (para el aviso de WhatsApp)
  const openDatesForMessage = cells.filter(
    (c): c is string => c !== null && c >= today && openDays[c] === true,
  ).sort();

  const formatDayForMessage = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const weekday = dt.toLocaleDateString('es-ES', { weekday: 'long' });
    const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${cap} ${d}`;
  };

  const [closings, setClosings] = useState<string[]>(() => loadClosings());
  const [showClosingsEditor, setShowClosingsEditor] = useState(false);
  const [newClosing, setNewClosing] = useState('');

  const persistClosings = (list: string[]) => {
    setClosings(list);
    try {
      localStorage.setItem(CLOSINGS_KEY, JSON.stringify(list));
    } catch {
      // storage no disponible
    }
  };

  const addClosing = () => {
    const clean = newClosing.trim().slice(0, 120);
    if (!clean) return;
    if (closings.includes(clean)) {
      showToast('Ese final ya existe', 'error');
      return;
    }
    persistClosings([...closings, clean]);
    setNewClosing('');
    showToast('Final agregado');
  };

  const removeClosing = (index: number) => {
    if (closings.length <= 1) {
      showToast('Dejá al menos 1 final', 'error');
      return;
    }
    persistClosings(closings.filter((_, i) => i !== index));
  };

  const resetClosings = () => {
    persistClosings(DEFAULT_WHATSAPP_CLOSINGS);
    showToast('Finales restablecidos');
  };

  const buildWhatsAppMessage = (): string => {
    const link = `${window.location.origin}${window.location.pathname}?view=client`;
    const lines = openDatesForMessage.map((d) => `• ${formatDayForMessage(d)}`);
    const pool = closings.length > 0 ? closings : DEFAULT_WHATSAPP_CLOSINGS;
    const closing = pool[Math.floor(Math.random() * pool.length)];
    return `💈 *${businessName}* 💈\nHola gente 👋\nEsta semana SÍ hay atención ✂️ los esperamos estos días:\n\n${lines.join('\n')}\n\nReservá tu lugar aquí 👇\n${link}\n\n${closing}`;
  };

  const copyWhatsAppMessage = async () => {
    if (openDatesForMessage.length === 0) {
      showToast('No hay días abiertos en este mes para avisar', 'error');
      return;
    }
    const msg = buildWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(msg);
      showToast(`Aviso copiado (${openDatesForMessage.length} días)`);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = msg;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(`Aviso copiado (${openDatesForMessage.length} días)`);
      } catch {
        showToast('No se pudo copiar', 'error');
      }
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Calendario de días"
      maxWidth="max-w-md"
      headerClassName="bg-gray-50/60"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="text-sm font-bold text-gray-900">
            {MONTHS[month]} {year}
          </p>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1"
            >
              {w}
            </span>
          ))}
          {cells.map((date, i) =>
            date === null ? (
              <span key={`empty-${i}`} />
            ) : (
              <DayCell
                key={date}
                date={date}
                isToday={date === today}
                isPast={date < today}
                isOpen={openDays[date] === true}
                count={counts[date] || 0}
                busy={busyDay === date}
                disabled={loading}
                onClick={() => setPendingDay({ date, next: openDays[date] !== true })}
              />
            ),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => askBulkToggle(true)}
            disabled={loading}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Abrir próximos 7 días
          </button>
          <button
            type="button"
            onClick={() => askBulkToggle(false)}
            disabled={loading}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cerrar próximos 7 días
          </button>
          <button
            type="button"
            onClick={copyWhatsAppMessage}
            disabled={loading || openDatesForMessage.length === 0}
            className="px-3.5 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Copia el aviso con los días abiertos de este mes para tu grupo de WhatsApp"
          >
            📋 Copiar aviso WhatsApp ({openDatesForMessage.length})
          </button>
          <button
            type="button"
            onClick={() => setShowClosingsEditor((v) => !v)}
            className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            title="Agregá tus propios finales para que el mensaje no suene robotizado"
          >
            ✏️ Mis finales ({closings.length})
          </button>
        </div>

        {showClosingsEditor && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-[11px] font-bold text-gray-600">
              Finales del mensaje (se elige uno al azar cada vez que copiás)
            </p>
            <ul className="space-y-1.5 max-h-32 overflow-y-auto">
              {closings.map((c, i) => (
                <li
                  key={`${c}-${i}`}
                  className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700"
                >
                  <span className="truncate">{c}</span>
                  <button
                    type="button"
                    onClick={() => removeClosing(i)}
                    className="shrink-0 text-red-500 hover:text-red-700 text-xs font-bold px-1 cursor-pointer"
                    aria-label={`Quitar final ${c}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newClosing}
                onChange={(e) => setNewClosing(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addClosing();
                  }
                }}
                placeholder="Ej: ¡Los dejo guapos! 😎"
                maxLength={120}
                className="flex-1 min-w-0 px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={addClosing}
                disabled={!newClosing.trim()}
                className="shrink-0 px-3 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                Agregar
              </button>
            </div>
            <button
              type="button"
              onClick={resetClosings}
              className="text-[11px] font-bold text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              Restablecer originales
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-semibold text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Abierto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300" /> Cerrado
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="w-3 h-3" /> N° = citas del día
          </span>
        </div>
          <p className="text-[10px] text-gray-400">
            Tocá un día para abrirlo o cerrarlo. Los clientes solo ven los días abiertos. Los
            días pasados aparecen en gris y no se pueden abrir.
          </p>
        </div>
      </Modal>

      {/* Confirmar abrir/cerrar un día */}
      <Modal
        isOpen={pendingDay !== null}
        onClose={() => setPendingDay(null)}
        title={pendingDay?.next ? '¿Abrir el día?' : '¿Cerrar el día?'}
        maxWidth="max-w-sm"
        headerClassName="bg-gray-50/60"
      >
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-600">
            <span className="font-bold text-gray-900 capitalize">
              {pendingDay ? formatDateDisplay(pendingDay.date) : ''}
            </span>
            {pendingDay?.next
              ? ' se abrirá y los clientes podrán reservar turnos.'
              : ' se cerrará y los clientes dejarán de verlo para reservar.'}
          </p>
          {pendingDay && !pendingDay.next && (counts[pendingDay.date] || 0) > 0 && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Este día tiene {counts[pendingDay.date]} cita{(counts[pendingDay.date] || 0) === 1 ? '' : 's'} agendada{(counts[pendingDay.date] || 0) === 1 ? '' : 's'} (se conservan, no se borran).
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDay(null)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingDay) toggleDay(pendingDay.date, !pendingDay.next);
                setPendingDay(null);
              }}
              className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                pendingDay?.next ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {pendingDay?.next ? 'Sí, abrir día' : 'Sí, cerrar día'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmar abrir/cerrar varios días */}
      <Modal
        isOpen={pendingBulk !== null}
        onClose={() => setPendingBulk(null)}
        title={pendingBulk?.open ? '¿Abrir próximos 7 días?' : '¿Cerrar próximos 7 días?'}
        maxWidth="max-w-sm"
        headerClassName="bg-gray-50/60"
      >
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-600">
            Se cambiarán <span className="font-bold text-gray-900">{pendingBulk?.count ?? 0} días</span>
            {pendingBulk?.open
              ? ': los clientes podrán reservar turnos en ellos.'
              : ': los clientes dejarán de verlos para reservar.'}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingBulk(null)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingBulk) bulkToggle(pendingBulk.open);
                setPendingBulk(null);
              }}
              className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                pendingBulk?.open ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {pendingBulk?.open ? 'Sí, abrir días' : 'Sí, cerrar días'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

const addDays = (dateStr: string, offset: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + offset);
  return toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
};

const DayCell: React.FC<{
  date: string;
  isToday: boolean;
  isPast: boolean;
  isOpen: boolean;
  count: number;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ date, isToday, isPast, isOpen, count, busy, disabled, onClick }) => {
  const day = Number(date.slice(8));
  // Días pasados: nunca en verde, siempre grises y bloqueados (no se puede hacer cita)
  const showOpen = isOpen && !isPast;
  const isDisabled = disabled || busy || isPast;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={isPast ? 'Día pasado: no se pueden hacer citas' : undefined}
      className={`relative flex flex-col items-center justify-center h-12 rounded-lg text-xs font-bold transition-all ${isPast ? 'cursor-not-allowed' : 'cursor-pointer'} disabled:opacity-60 ${
        showOpen
          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
          : 'bg-gray-50 hover:bg-gray-100 text-gray-400 border border-gray-200'
      } ${isToday ? 'ring-2 ring-blue-400' : ''} ${isPast ? 'opacity-50' : ''}`}
      aria-label={`${date}: ${isPast ? 'pasado, no disponible' : showOpen ? 'abierto' : 'cerrado'}`}
    >
      <span>{day}</span>
      <span className="flex items-center gap-1 text-[9px] font-semibold leading-none mt-0.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${showOpen ? 'bg-emerald-500' : 'bg-gray-300'}`}
        />
        {count > 0 && <span className="text-gray-500">{count}</span>}
      </span>
    </button>
  );
};
