import React, { useEffect, useMemo, useState } from 'react';
import { AppointmentRecord } from '../types';
import { listAppointments } from '../lib/api';
import { addDaysToDateStr, formatDateShort, getTodayDateString } from '../data/defaultData';
import { Modal } from './Modal';
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Users,
  XCircle,
} from 'lucide-react';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose }) => {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    const today = getTodayDateString();
    const from = addDaysToDateStr(today, -(rangeDays - 1));
    const days: string[] = [];
    for (let i = 0; i < rangeDays; i++) {
      days.push(addDaysToDateStr(from, i));
    }
    Promise.all(days.map((d) => listAppointments(d)))
      .then((results) => {
        if (cancelled) return;
        setAppointments(results.flat());
      })
      .catch(() => !cancelled && setAppointments([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, rangeDays]);

  const stats = useMemo(() => {
    const active = appointments.filter((a) => a.status !== 'cancelled');
    const perDay = new Map<string, { booked: number }>();
    const clientCount = new Map<string, number>();
    let confirmed = 0;
    let attended = 0;
    let cancelled = 0;

    for (const a of appointments) {
      if (a.status === 'cancelled') {
        cancelled += 1;
      } else {
        if (a.status === 'confirmed') confirmed += 1;
        if (a.status === 'attended') attended += 1;
        const day = perDay.get(a.date) || { booked: 0 };
        day.booked += 1;
        perDay.set(a.date, day);
        const name = a.clients?.full_name || 'Cliente';
        clientCount.set(name, (clientCount.get(name) || 0) + 1);
      }
    }

    const topClients = Array.from(clientCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const days = Array.from(perDay.entries())
      .map(([date, v]) => ({ date, booked: v.booked }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    return { total: active.length, confirmed, attended, cancelled, days, topClients };
  }, [appointments]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reportes"
      maxWidth="max-w-2xl"
      headerClassName="bg-gray-50/60"
    >
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 font-medium">Período:</p>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {([7, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRangeDays(days)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  rangeDays === days
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {days} días
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 italic text-center py-8">Calculando reportes…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <StatCard icon={<CalendarCheck />} label="Citas" value={String(stats.total)} />
              <StatCard
                icon={<CheckCircle2 />}
                label="Confirmadas"
                value={String(stats.confirmed)}
              />
              <StatCard icon={<Users />} label="Atendidas" value={String(stats.attended)} />
              <StatCard
                icon={<XCircle />}
                label="Canceladas"
                value={String(stats.cancelled)}
                accent="text-red-500"
              />
            </div>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-2">
                <CalendarClock className="w-3.5 h-3.5" /> Citas por día
              </h3>
              {stats.days.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No hay citas en este período.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {stats.days.map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between bg-gray-50/80 border border-gray-200/70 rounded-lg px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-gray-700 capitalize">
                        {formatDateShort(day.date)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {day.booked} cita{day.booked === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mb-2">
                <BarChart3 className="w-3.5 h-3.5" /> Clientes más frecuentes
              </h3>
              {stats.topClients.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin datos.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {stats.topClients.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between bg-gray-50/80 border border-gray-200/70 rounded-lg px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-gray-700 truncate">{c.name}</span>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">
                        {c.count} cita{c.count === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}> = ({ icon, label, value, accent = 'text-gray-900' }) => (
  <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3.5">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
      {icon}
      {label}
    </div>
    <p className={`text-lg font-bold mt-1 ${accent}`}>{value}</p>
  </div>
);
