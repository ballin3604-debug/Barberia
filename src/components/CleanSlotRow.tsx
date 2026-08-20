import React, { useState } from 'react';
import { TimeSlot } from '../types';
import { Plus, Coffee, Lock, Check, X, Trash2, Scissors, MoreHorizontal, User, MessageSquare, Settings2 } from 'lucide-react';

interface CleanSlotRowProps {
  slot: TimeSlot;
  onBookDirect: (slotId: string, clientName: string, service?: string) => void;
  onSetBreak: (slotId: string, title?: string) => void;
  onSetBlocked: (slotId: string, reason?: string) => void;
  onSetAvailable: (slotId: string) => void;
  onEditSlot?: (slot: TimeSlot) => void;
  onOpenBookingModal?: (slot: TimeSlot) => void;
}

export const CleanSlotRow: React.FC<CleanSlotRowProps> = ({
  slot,
  onBookDirect,
  onSetBreak,
  onSetBlocked,
  onSetAvailable,
  onEditSlot,
  onOpenBookingModal,
}) => {
  const [isTypingClient, setIsTypingClient] = useState(false);
  const [clientName, setClientName] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // 1. ESPACIO DISPONIBLE
  if (slot.type === 'available') {
    if (isTypingClient) {
      return (
        <div className="p-2 bg-blue-50/80 border border-blue-300 rounded-xl flex items-center gap-2 shadow-xs animate-in fade-in duration-150">
          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/80 px-2 py-1 rounded-md shrink-0">
            {slot.time}
          </span>
          <input
            type="text"
            autoFocus
            placeholder="Nombre del cliente..."
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && clientName.trim()) {
                onBookDirect(slot.id, clientName.trim());
                setIsTypingClient(false);
                setClientName('');
              }
              if (e.key === 'Escape') {
                setIsTypingClient(false);
                setClientName('');
              }
            }}
            className="flex-1 bg-white px-2.5 py-1 text-xs border border-blue-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => {
              if (clientName.trim()) {
                onBookDirect(slot.id, clientName.trim());
                setIsTypingClient(false);
                setClientName('');
              }
            }}
            disabled={!clientName.trim()}
            className="px-2.5 py-1 bg-blue-600 disabled:opacity-40 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1 transition-colors"
            title="Guardar cliente"
          >
            <Check className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Listo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenBookingModal?.({
                ...slot,
                clientName: clientName.trim() || undefined,
              });
              setIsTypingClient(false);
              setClientName('');
            }}
            className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 rounded-lg transition-colors"
            title="Registrar con más detalles (teléfono, servicio, notas)"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsTypingClient(false);
              setClientName('');
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
            title="Cancelar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="group flex items-center justify-between py-2.5 px-3.5 bg-white hover:bg-slate-50 border border-dashed border-gray-300 hover:border-blue-400 rounded-xl transition-all shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-gray-400 group-hover:text-blue-600 w-11">
            {slot.time}
          </span>
          <span className="text-xs text-gray-400 group-hover:text-gray-600 font-normal italic">
            Disponible
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsTypingClient(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
            title="Agendar cliente"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agendar</span>
          </button>

          <button
            type="button"
            onClick={() => onSetBlocked(slot.id)}
            className="flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-200 hover:text-gray-800 px-2 py-1 rounded-lg transition-colors border border-gray-200 shadow-2xs cursor-pointer"
            title="Apartar horario como ocupado"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Apartar</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. DESCANSO (12:00, 17:00, etc.)
  if (slot.type === 'break') {
    return (
      <div className="flex items-center justify-between py-2.5 px-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl text-amber-900 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-amber-800 w-11">
            {slot.time}
          </span>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
            <Coffee className="w-3.5 h-3.5 text-amber-600" />
            <span>{slot.breakTitle || 'Descanso'}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSetAvailable(slot.id)}
          className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200/80 px-2.5 py-0.5 rounded-lg transition-colors"
          title="Habilitar como espacio disponible"
        >
          Habilitar
        </button>
      </div>
    );
  }

  // 3. APARTADO / BLOQUEADO POR EL BARBERO
  if (slot.type === 'blocked') {
    return (
      <div className="flex items-center justify-between py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-gray-500 w-11">
            {slot.time}
          </span>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Lock className="w-3.5 h-3.5 text-gray-400" />
            <span>{slot.blockedReason || 'Apartado (Ocupado)'}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSetAvailable(slot.id)}
          className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 bg-gray-200/70 hover:bg-gray-200 px-2.5 py-0.5 rounded-lg transition-colors"
          title="Desbloquear horario"
        >
          Habilitar
        </button>
      </div>
    );
  }

  // 4. PERSONA AGENDADA
  return (
    <div className="group flex items-center justify-between py-2.5 px-3.5 bg-white border border-gray-200/90 rounded-xl shadow-2xs hover:border-gray-300 hover:shadow-xs transition-all">
      <div 
        onClick={() => onEditSlot?.(slot)}
        className="flex items-center gap-3 min-w-0 flex-1 mr-2 cursor-pointer"
        title="Haga clic para editar los detalles de la cita"
      >
        <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md w-14 text-center shrink-0">
          {slot.time}
        </span>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {/* Indicador de Estado */}
          <span 
            className={`w-2 h-2 rounded-full shrink-0 ${
              slot.status === 'attended' 
                ? 'bg-blue-500 ring-2 ring-blue-100' 
                : slot.status === 'pending'
                ? 'bg-amber-500 ring-2 ring-amber-100 animate-pulse'
                : 'bg-green-500 ring-2 ring-green-100'
            }`}
            title={
              slot.status === 'attended' 
                ? 'Atendido' 
                : slot.status === 'pending'
                ? 'Pendiente de confirmación'
                : 'Confirmado'
            }
          />
          <p className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
            {slot.clientName}
          </p>
          {slot.service && (
            <span className="text-[11px] text-gray-400 truncate hidden sm:inline">
              · {slot.service}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {slot.clientPhone && (
          <a
            href={`https://wa.me/${slot.clientPhone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(slot.clientName || '')},%20tienes%20tu%20turno%20confirmado%20para%20las%20${slot.time}%20el%20día%20${slot.date}.%20%C2%A1Te%20esperamos!`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors shrink-0"
            title="Enviar recordatorio por WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </a>
        )}

        <button
          type="button"
          onClick={() => onEditSlot?.(slot)}
          className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors shrink-0"
          title="Editar cita"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>

        {showConfirmDelete ? (
          <div className="flex items-center gap-1 bg-red-50 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetAvailable(slot.id);
                setShowConfirmDelete(false);
              }}
              className="text-[10px] bg-red-600 text-white hover:bg-red-700 font-bold px-2 py-0.5 rounded transition-colors"
            >
              Liberar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirmDelete(false);
              }}
              className="text-[10px] text-gray-400 hover:text-gray-600 px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirmDelete(true);
            }}
            className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0"
            title="Liberar espacio"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
