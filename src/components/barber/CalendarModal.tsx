import React, { useEffect, useState } from 'react';
import { getOpenDays, listActiveBookingsBetween, setDayOpen } from '../../lib/api';
import { getTodayDateString } from '../../data/defaultData';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

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

export const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, onChanged }) => {
  const showToast = useToast();
  const today = getTodayDateString();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [busyDay, setBusyDay] = useState<string | null>(null);

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

  const toggleDay = async (date: string, isOpenNow: boolean) => {
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
      const daysToToggle: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(today, i);
        if (openDays[d] !== open) daysToToggle.push(d);
      }
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

  return (
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
                isOpen={openDays[date] === true}
                count={counts[date] || 0}
                busy={busyDay === date}
                disabled={loading}
                onClick={() => toggleDay(date, openDays[date] === true)}
              />
            ),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => bulkToggle(true)}
            disabled={loading}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Abrir próximos 7 días
          </button>
          <button
            type="button"
            onClick={() => bulkToggle(false)}
            disabled={loading}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cerrar próximos 7 días
          </button>
        </div>

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
          Tocá un día para abrirlo o cerrarlo. Los clientes solo ven los días abiertos.
        </p>
      </div>
    </Modal>
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
  isOpen: boolean;
  count: number;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ date, isToday, isOpen, count, busy, disabled, onClick }) => {
  const day = Number(date.slice(8));
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`relative flex flex-col items-center justify-center h-12 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-60 ${
        isOpen
          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
          : 'bg-gray-50 hover:bg-gray-100 text-gray-400 border border-gray-200'
      } ${isToday ? 'ring-2 ring-blue-400' : ''}`}
      aria-label={`${date}: ${isOpen ? 'abierto' : 'cerrado'}`}
    >
      <span>{day}</span>
      <span className="flex items-center gap-1 text-[9px] font-semibold leading-none mt-0.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-gray-300'}`}
        />
        {count > 0 && <span className="text-gray-500">{count}</span>}
      </span>
    </button>
  );
};
