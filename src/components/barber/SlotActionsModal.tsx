import React, { useEffect, useState } from 'react';
import { AppointmentRecord } from '../../types';
import {
  buildWaLink,
  createBooking,
  createHaircutFromAppointment,
  getOrCreateClient,
  setAppointmentState,
  setSlotAvailability,
} from '../../lib/api';
import { formatDateDisplay, getTodayDateString } from '../../data/defaultData';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { CheckCircle2, Clock, Link2, MessageCircle, User, X } from 'lucide-react';

interface SlotActionsModalProps {
  isOpen: boolean;
  date: string;
  time: string | null;
  slotAvailable: boolean;
  appointment: AppointmentRecord | null;
  onClose: () => void;
  onChanged: () => void;
}

export const SlotActionsModal: React.FC<SlotActionsModalProps> = ({
  isOpen,
  date,
  time,
  slotAvailable,
  appointment,
  onClose,
  onChanged,
}) => {
  const showToast = useToast();
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [confirmFree, setConfirmFree] = useState(false);
  const [confirmVisibility, setConfirmVisibility] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClientName('');
      setClientPhone('');
      setConfirmFree(false);
      setConfirmVisibility(false);
      setBusy(false);
    }
  }, [isOpen, time]);

  if (!isOpen || !time) return null;

  const client = appointment?.clients ?? null;
  const referenceUrl = appointment?.reference_url || null;
  const referenceImage = appointment?.reference_image_url || null;

  const handleQuickBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    if (date < getTodayDateString()) {
      showToast('No se pueden agendar citas en días pasados', 'error');
      return;
    }
    setBusy(true);
    try {
      const { client } = await getOrCreateClient(clientName, clientPhone);
      await createBooking({
        clientId: client.id,
        date,
        time,
      });
      showToast('Cita agendada');
      onChanged();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al agendar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleVisibility = async () => {
    setBusy(true);
    try {
      await setSlotAvailability(date, time, !slotAvailable);
      showToast(slotAvailable ? 'Hora ocultada para clientes' : 'Hora habilitada para clientes');
      onChanged();
      onClose();
    } catch {
      showToast('No se pudo cambiar el horario', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ── Vista de cita existente ──
  if (appointment) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Cita de las ${time}`}
        maxWidth="max-w-sm"
        headerClassName="bg-gray-50/60"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {client?.full_name || 'Cliente'}
              </p>
              {appointment.is_anonymous && (
                <span className="inline-block mt-0.5 text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  Anónimo para los clientes
                </span>
              )}
              <p className="text-xs text-gray-500">
                {formatDateDisplay(date)} · <Clock className="inline w-3 h-3" /> {time} h
              </p>
            </div>
          </div>

          {appointment.note && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              📝 {appointment.note}
            </p>
          )}

          {referenceImage && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Referencia del corte
              </p>
              <img
                src={referenceImage}
                alt={`Referencia de ${client?.full_name || 'cliente'}`}
                className="w-full max-h-56 object-cover rounded-xl border border-gray-200"
              />
            </div>
          )}

          {referenceUrl && (
            <a
              href={referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 cursor-pointer"
            >
              <Link2 className="w-4 h-4" />
              Ver referencia (TikTok / Instagram)
            </a>
          )}

          {client?.phone && (
            <a
              href={buildWaLink(
                client.phone,
                `Hola ${client.full_name} 😊 tu turno es el ${formatDateDisplay(
                  date,
                )} a las ${time}. ¡Te esperamos en la barbería!`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              Recordar por WhatsApp
            </a>
          )}

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
            {appointment.status === 'confirmed' ? (
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await setAppointmentState(appointment.id, 'attended');
                    // Crea la ficha en Personas atendidas (si la tabla existe y no hay ficha aún)
                    try {
                      await createHaircutFromAppointment({
                        id: appointment.id,
                        date,
                        time: appointment.time,
                        client_id: appointment.client_id,
                        clientName: client?.full_name || 'Cliente',
                      });
                    } catch {
                      // la tabla haircuts aún no existe: no bloquea el atendido
                    }
                    showToast('Cita marcada como atendida');
                    onChanged();
                    onClose();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Atendido
              </button>
            ) : (
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                ✓ Atendido
              </span>
            )}

            {confirmFree ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await setAppointmentState(appointment.id, 'cancelled');
                      showToast('Turno liberado');
                      onChanged();
                      onClose();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy}
                  className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Sí, liberar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFree(false)}
                  className="px-2 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmFree(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                Liberar turno
              </button>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  // ── Vista de horario libre u oculto ──
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={slotAvailable ? `Turno de las ${time}` : `Hora oculta · ${time}`}
      maxWidth="max-w-sm"
      headerClassName="bg-gray-50/60"
    >
      <div className="p-5 space-y-4">
        {slotAvailable ? (
          <form onSubmit={handleQuickBook} className="space-y-3">
            <p className="text-xs text-gray-500">
              Agendá rápido o tocá el engranaje de Ajustes para más opciones.
            </p>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nombre del cliente"
                aria-label="Nombre del cliente"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="relative">
              <button
                type="button"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-emerald-600 cursor-pointer"
                title="Se marcará como WhatsApp"
                aria-label="WhatsApp del cliente"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="WhatsApp (opcional)"
                aria-label="WhatsApp del cliente"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !clientName.trim()}
              className="w-full py-3 bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              {busy ? 'Guardando…' : 'Agendar turno'}
            </button>
          </form>
        ) : (
          <p className="text-xs text-gray-500">
            Esta hora está oculta y no aparece para los clientes. Podés habilitarla de nuevo.
          </p>
        )}

        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setConfirmVisibility(true)}
            disabled={busy}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
              slotAvailable
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {slotAvailable ? 'Ocultar esta hora' : 'Habilitar hora'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        <Modal
          isOpen={confirmVisibility}
          onClose={() => setConfirmVisibility(false)}
          title={slotAvailable ? '¿Ocultar esta hora?' : '¿Habilitar esta hora?'}
          maxWidth="max-w-sm"
          headerClassName="bg-gray-50/60"
        >
          <div className="p-5 space-y-4">
            <p className="text-xs text-gray-600">
              <span className="font-bold text-gray-900">
                {formatDateDisplay(date)} · {time} h
              </span>
              {slotAvailable
                ? ' se ocultará y los clientes dejarán de verla para reservar.'
                : ' se habilitará y los clientes podrán reservarla.'}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmVisibility(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmVisibility(false);
                  handleToggleVisibility();
                }}
                disabled={busy}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 ${
                  slotAvailable ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {slotAvailable ? 'Sí, ocultar' : 'Sí, habilitar'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </Modal>
  );
};
