import React, { useState } from 'react';
import { SlotRecord } from '../../types';
import { addCustomSlot, restoreStandardSlots, setSlotAvailability } from '../../lib/api';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { Clock, Plus, RotateCcw } from 'lucide-react';

interface HoursEditorModalProps {
  isOpen: boolean;
  date: string;
  slots: SlotRecord[];
  onClose: () => void;
  onChanged: () => void;
}

export const HoursEditorModal: React.FC<HoursEditorModalProps> = ({
  isOpen,
  date,
  slots,
  onClose,
  onChanged,
}) => {
  const showToast = useToast();
  const [newTime, setNewTime] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleToggle = async (time: string, available: boolean) => {
    setBusy(true);
    try {
      await setSlotAvailability(date, time, available);
      onChanged();
    } catch {
      showToast('No se pudo actualizar la hora', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTime) return;
    setBusy(true);
    try {
      await addCustomSlot(date, newTime);
      setNewTime('');
      onChanged();
    } catch {
      showToast('No se pudo agregar la hora', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      await restoreStandardSlots(date);
      showToast('Horario estándar restaurado');
      onChanged();
    } catch {
      showToast('No se pudo restaurar el horario', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Horarios del día"
      maxWidth="max-w-md"
      headerClassName="bg-gray-50/60"
    >
      <div className="p-5 space-y-4">
        <p className="text-xs text-gray-500">
          Las horas apagadas se ocultan para los clientes. Las citas agendadas se conservan.
        </p>

        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
          {slots.map((slot) => (
            <div
              key={slot.time}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all ${
                slot.is_available
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold font-mono text-gray-800">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {slot.time}
              </span>
              <button
                type="button"
                onClick={() => handleToggle(slot.time, !slot.is_available)}
                disabled={busy}
                className={`relative inline-flex h-5.5 w-10 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer disabled:opacity-50 ${
                  slot.is_available ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={slot.is_available}
                aria-label={`Mostrar la hora ${slot.time}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                    slot.is_available ? 'translate-x-4.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            aria-label="Nueva hora"
            className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={busy || !newTime}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
        </form>

        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleRestore}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar horario estándar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </Modal>
  );
};
