import React from 'react';
import { TimeSlot, AppointmentStatus } from '../types';
import { 
  Plus, 
  Coffee, 
  CheckCircle2, 
  Clock, 
  Scissors, 
  Phone, 
  MoreVertical,
  UserCheck,
  Trash2,
  Edit2,
  MessageSquare
} from 'lucide-react';

interface SlotCardProps {
  slot: TimeSlot;
  onBook: (slot: TimeSlot) => void;
  onEdit: (slot: TimeSlot) => void;
  onStatusChange: (slotId: string, newStatus: AppointmentStatus) => void;
  onCancelBooking: (slotId: string) => void;
  onToggleBreak: (slotId: string) => void;
}

export const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  onBook,
  onEdit,
  onStatusChange,
  onCancelBooking,
  onToggleBreak
}) => {
  const [showMenu, setShowMenu] = React.useState(false);

  // Available Slot Card
  if (slot.type === 'available') {
    return (
      <div
        id={`slot-${slot.id}`}
        onClick={() => onBook(slot)}
        className="flex items-center justify-between p-3.5 border-2 border-dashed border-gray-200 rounded-lg group cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all duration-150"
      >
        <div className="flex items-center">
          <span className="w-14 font-mono text-sm font-medium text-gray-400 group-hover:text-blue-600 transition-colors">
            {slot.time}
          </span>
          <div className="ml-3">
            <p className="text-gray-400 group-hover:text-blue-700 italic text-sm font-normal">
              Espacio Disponible
            </p>
            <p className="text-[11px] text-gray-300 group-hover:text-blue-500/80">
              Toca para agendar cliente
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Registrarse aquí"
            aria-label="Registrarse aquí"
            className="w-8 h-8 flex items-center justify-center bg-blue-50 group-hover:bg-blue-600 rounded-full transition-colors"
          >
            <Plus className="w-4 h-4 text-blue-600 group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>
    );
  }

  // Break Slot Card (e.g., 12:00 Almuerzo o 17:00 Break)
  if (slot.type === 'break') {
    return (
      <div
        id={`slot-${slot.id}`}
        className="flex items-center justify-between p-3.5 bg-gray-100 border border-gray-200 rounded-lg opacity-85 hover:opacity-100 transition-opacity"
      >
        <div className="flex items-center">
          <span className="w-14 font-mono text-sm text-gray-500 font-medium">
            {slot.time}
          </span>
          <div className="ml-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
              <Coffee className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-gray-600 uppercase tracking-wider text-xs">
                {slot.breakTitle || 'Descanso programado'}
              </p>
              <p className="text-[11px] text-gray-400">
                Horario no disponible para citas
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBreak(slot.id);
          }}
          className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors font-medium"
          title="Convertir a espacio libre"
        >
          Habilitar turno
        </button>
      </div>
    );
  }

  // Booked Slot Card
  const getStatusBadge = (status?: AppointmentStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded font-bold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Confirmado
          </span>
        );
      case 'attended':
        return (
          <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold uppercase tracking-wider flex items-center gap-1">
            <UserCheck className="w-3 h-3" />
            Atendido
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="text-[10px] px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded font-bold uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        );
    }
  };

  const whatsappUrl = slot.clientPhone
    ? `https://wa.me/${slot.clientPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        `Hola ${slot.clientName || ''}, te recordamos tu cita de barbería hoy a las ${slot.time}. Te esperamos puntualmente!`
      )}`
    : null;

  return (
    <div
      id={`slot-${slot.id}`}
      className="relative flex items-center justify-between p-3.5 bg-gray-50/90 hover:bg-white border border-gray-200/80 hover:border-gray-300 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-150"
    >
      <div className="flex items-center min-w-0 flex-1 mr-2">
        <span className="w-14 font-mono text-sm font-semibold text-gray-700 shrink-0">
          {slot.time}
        </span>
        
        <div className="ml-3 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {slot.clientName}
            </p>
            {getStatusBadge(slot.status)}
          </div>

          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-1 font-medium text-gray-600">
              <Scissors className="w-3 h-3 text-gray-400" />
              {slot.service || 'Corte'}
            </span>
            {slot.clientPhone && (
              <span className="hidden sm:inline-flex items-center gap-1 text-gray-400">
                <Phone className="w-3 h-3" />
                {slot.clientPhone}
              </span>
            )}
            {slot.notes && (
              <span className="hidden md:inline text-gray-400 truncate max-w-[140px]" title={slot.notes}>
                • {slot.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Enviar mensaje de WhatsApp"
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
          </a>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-md transition-colors"
            title="Opciones de cita"
            aria-label="Opciones"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setShowMenu(false)} 
              />
              <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-40 text-xs">
                <div className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400 border-b border-gray-100">
                  Estado de Cita
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onStatusChange(slot.id, 'confirmed');
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 text-green-700"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Marcar Confirmado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStatusChange(slot.id, 'attended');
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 text-blue-700"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Marcar Atendido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStatusChange(slot.id, 'pending');
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 text-yellow-700"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Marcar Pendiente
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                <button
                  type="button"
                  onClick={() => {
                    onEdit(slot);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                >
                  <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                  Editar Datos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCancelBooking(slot.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 flex items-center gap-2 text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Liberar Horario
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
