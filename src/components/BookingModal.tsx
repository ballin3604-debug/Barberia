import React, { useState } from 'react';
import { TimeSlot, ServiceItem } from '../types';
import { BARBER_SERVICES, formatDateDisplay } from '../data/defaultData';
import { X, Calendar, Clock, Scissors, User, Phone, FileText, CheckCircle } from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  slot: TimeSlot | null;
  onClose: () => void;
  onConfirmBooking: (data: {
    clientName: string;
    clientPhone?: string;
    service: string;
    notes?: string;
  }) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  slot,
  onClose,
  onConfirmBooking,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedService, setSelectedService] = useState<ServiceItem>(BARBER_SERVICES[0]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ clientName?: string }>({});

  if (!isOpen || !slot) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setErrors({ clientName: 'Por favor ingresa el nombre del cliente' });
      return;
    }

    onConfirmBooking({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      service: selectedService.name,
      notes: notes.trim() || undefined,
    });

    // Reset fields
    setClientName('');
    setClientPhone('');
    setNotes('');
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Registrar Cita
            </h2>
            <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 font-mono font-bold text-blue-600">
                <Clock className="w-3.5 h-3.5" />
                {slot.time}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {formatDateDisplay(slot.date)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Client Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Nombre del Cliente <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="booking-client-name"
                required
                placeholder="Ej. Carlos Mendoza"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  if (errors.clientName) setErrors({});
                }}
                className={`w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all ${
                  errors.clientName ? 'border-red-400' : 'border-gray-200'
                }`}
                autoFocus
              />
            </div>
            {errors.clientName && (
              <p className="text-xs text-red-500 mt-1">{errors.clientName}</p>
            )}
          </div>

          {/* Client Phone / WhatsApp */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Teléfono / WhatsApp <span className="text-gray-400 text-[10px] font-normal lowercase">(opcional para recordatorios)</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                id="booking-client-phone"
                placeholder="Ej. +52 55 1234 5678"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Service Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center justify-between">
              <span>Servicio Solicitado</span>
              <span className="text-blue-600 font-semibold">{selectedService.price}</span>
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-gray-50/50 rounded-lg border border-gray-100">
              {BARBER_SERVICES.map((srv) => {
                const isSelected = selectedService.id === srv.id;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setSelectedService(srv)}
                    className={`text-left p-2 rounded-md text-xs transition-all flex flex-col justify-between border ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="truncate">{srv.name}</span>
                    <span className="text-[10px] text-gray-400 font-normal mt-1 flex justify-between">
                      <span>{srv.durationMinutes} min</span>
                      <span className="font-semibold text-gray-600">{srv.price}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Notas o detalles especiales
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <textarea
                rows={2}
                id="booking-notes"
                placeholder="Ej. Viene acompañado, prefiere tijera, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-confirm-appointment"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Confirmar Cita ({slot.time})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
