import React, { useEffect, useState } from 'react';
import { HaircutRecord, ServiceItem } from '../../types';
import { updateHaircut } from '../../lib/api';
import { formatDateDisplay } from '../../data/defaultData';
import { Modal } from '../Modal';
import { useToast } from '../Toast';

interface CutEditModalProps {
  cut: HaircutRecord | null;
  services: ServiceItem[];
  onClose: () => void;
  onSaved: () => void;
}

/* Formulario para editar la ficha de una persona atendida.
 * El horario y la fecha son fijos (los eligió el cliente); aquí se editan
 * corte realizado, tiempo, precio y observaciones. */
export const CutEditModal: React.FC<CutEditModalProps> = ({
  cut,
  services,
  onClose,
  onSaved,
}) => {
  const showToast = useToast();
  const [serviceName, setServiceName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cut) {
      setServiceName(cut.service_name || '');
      setMinutes(cut.minutes !== null ? String(cut.minutes) : '');
      setPrice(cut.price || '');
      setNote(cut.note || '');
      setSaving(false);
    }
  }, [cut]);

  const handleSave = async () => {
    if (!cut) return;
    if (!serviceName.trim()) {
      showToast('Escribí qué corte se hizo.', 'error');
      return;
    }
    const minutesTrimmed = minutes.trim();
    if (minutesTrimmed) {
      const n = Number(minutesTrimmed);
      if (!Number.isFinite(n) || n < 1) {
        showToast('El tiempo de corte debe ser de al menos 1 minuto.', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      await updateHaircut(cut.id, {
        serviceName: serviceName.trim(),
        minutes: minutesTrimmed ? Math.floor(Number(minutesTrimmed)) : null,
        price: price.trim() || null,
        note: note.trim() || null,
      });
      showToast('Ficha actualizada');
      onSaved();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={cut !== null}
      onClose={onClose}
      title="Editar ficha"
      maxWidth="max-w-md"
      headerClassName="bg-gray-50/60"
    >
      {cut && (
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-600">
            <span className="font-bold text-gray-900">{cut.client_name}</span>
            {' · '}
            <span className="capitalize">{formatDateDisplay(cut.date)}</span>
            {cut.time ? ` · ${cut.time.slice(0, 5)} h` : ''}
            <span className="block text-[11px] text-gray-400 mt-0.5">
              Fecha y horario fijos (los eligió el cliente)
            </span>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Corte realizado
            </label>
            <input
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              list="cut-edit-services"
              placeholder="Ej: Corte Clásico"
              className="mt-1 w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="cut-edit-services">
              {services.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Tiempo de corte (min)
              </label>
              <input
                type="number"
                min={1}
                max={480}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="Ej: 45"
                className="mt-1 w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Precio
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="$10.00"
                className="mt-1 w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Observaciones
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: degradado alto, navaja…"
              className="mt-1 w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
