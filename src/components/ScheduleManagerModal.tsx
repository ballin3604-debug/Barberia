import React, { useState } from 'react';
import { TimeSlot } from '../types';
import { X, Coffee, Clock, Plus, RefreshCw, AlertCircle } from 'lucide-react';

interface ScheduleManagerModalProps {
  isOpen: boolean;
  date: string;
  slots: TimeSlot[];
  onClose: () => void;
  onToggleBreak: (slotId: string) => void;
  onAddCustomSlot: (newSlot: Omit<TimeSlot, 'id'>) => void;
  onResetDaySchedule: () => void;
}

export const ScheduleManagerModal: React.FC<ScheduleManagerModalProps> = ({
  isOpen,
  date,
  slots,
  onClose,
  onToggleBreak,
  onAddCustomSlot,
  onResetDaySchedule,
}) => {
  const [newTime, setNewTime] = useState('20:00');
  const [slotKind, setSlotKind] = useState<'available' | 'break'>('available');
  const [breakReason, setBreakReason] = useState('Descanso');

  if (!isOpen) return null;

  // Find 12:00 slot and 17:00 slot
  const slot12 = slots.find((s) => s.time === '12:00');
  const slot17 = slots.find((s) => s.time === '17:00');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTime) return;

    const [hour] = newTime.split(':').map(Number);
    const period = hour < 14 ? 'morning' : 'afternoon';

    onAddCustomSlot({
      time: newTime,
      period,
      type: slotKind,
      date,
      breakTitle: slotKind === 'break' ? breakReason : undefined,
    });

    setNewTime('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-600" />
            <h2 className="text-base font-bold text-gray-900">
              Control de Descansos y Horarios
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Quick Breaks Control */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Descansos Frecuentes del Barbero
            </h3>

            {/* 12:00 Almuerzo */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-bold text-gray-700">12:00</span>
                <div>
                  <p className="text-xs font-semibold text-gray-800">Descanso de Almuerzo</p>
                  <p className="text-[11px] text-gray-400">
                    {slot12?.type === 'break' ? '☕ Activo como Descanso' : '🟢 Activo como Turno para citas'}
                  </p>
                </div>
              </div>
              {slot12 && (
                <button
                  type="button"
                  onClick={() => onToggleBreak(slot12.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    slot12.type === 'break'
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  }`}
                >
                  {slot12.type === 'break' ? 'Desactivar Descanso' : 'Poner Descanso'}
                </button>
              )}
            </div>

            {/* 17:00 (5 PM) Break */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-bold text-gray-700">17:00</span>
                <div>
                  <p className="text-xs font-semibold text-gray-800">Break de la Tarde (5:00 PM)</p>
                  <p className="text-[11px] text-gray-400">
                    {slot17?.type === 'break' ? '☕ Activo como Descanso' : '🟢 Activo como Turno para citas'}
                  </p>
                </div>
              </div>
              {slot17 && (
                <button
                  type="button"
                  onClick={() => onToggleBreak(slot17.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    slot17.type === 'break'
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  }`}
                >
                  {slot17.type === 'break' ? 'Desactivar Descanso' : 'Poner Descanso'}
                </button>
              )}
            </div>
          </div>

          {/* Add custom slot */}
          <form onSubmit={handleAdd} className="space-y-3 pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Agregar Horario Adicional
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Hora (HH:MM)
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Tipo de Horario
                </label>
                <select
                  value={slotKind}
                  onChange={(e) => setSlotKind(e.target.value as 'available' | 'break')}
                  className="w-full py-1.5 px-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="available">🟢 Espacio Disponible</option>
                  <option value="break">☕ Horario de Descanso</option>
                </select>
              </div>
            </div>

            {slotKind === 'break' && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Motivo de Descanso
                </label>
                <input
                  type="text"
                  value={breakReason}
                  onChange={(e) => setBreakReason(e.target.value)}
                  placeholder="Ej. Descanso / Diligencia personal"
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar a la Agenda
            </button>
          </form>

          {/* Reset button */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Restablecer plantilla inicial
            </span>
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Restablecer los turnos de este día al horario sugerido?')) {
                  onResetDaySchedule();
                  onClose();
                }
              }}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded"
            >
              <RefreshCw className="w-3 h-3" />
              Restablecer
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold rounded-lg transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
