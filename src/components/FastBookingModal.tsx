import React, { useState, useEffect } from 'react';
import { TimeSlot } from '../types';
import { BARBER_SERVICES } from '../data/defaultData';
import { X, Check } from 'lucide-react';

interface FastBookingModalProps {
  isOpen: boolean;
  slot: TimeSlot | null;
  onClose: () => void;
  onConfirm: (clientName: string, service: string) => void;
}

export const FastBookingModal: React.FC<FastBookingModalProps> = ({
  isOpen,
  slot,
  onClose,
  onConfirm,
}) => {
  const [name, setName] = useState('');
  const [selectedService, setSelectedService] = useState('Corte Clásico');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setSelectedService('Corte Clásico');
    }
  }, [isOpen]);

  if (!isOpen || !slot) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(name.trim(), selectedService);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
      <div 
        className="bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {slot.time}
            </span>
            <span className="text-xs font-semibold text-gray-800">
              Registrar Cliente
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nombre de la persona
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ej. Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Servicio
            </label>
            <div className="flex flex-wrap gap-1.5">
              {['Corte Clásico', 'Corte + Barba', 'Fade', 'Barba'].map((srv) => (
                <button
                  key={srv}
                  type="button"
                  onClick={() => setSelectedService(srv)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                    selectedService === srv
                      ? 'bg-gray-900 text-white font-medium shadow-2xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {srv}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
