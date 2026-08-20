import React, { useState } from 'react';
import { TimeSlot } from '../types';
import { formatDateDisplay } from '../data/defaultData';
import { X, Copy, Check, MessageSquare, Sparkles } from 'lucide-react';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  date: string;
  slots: TimeSlot[];
  onClose: () => void;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  date,
  slots,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build the formatted text for WhatsApp
  const morningSlots = slots.filter((s) => s.period === 'morning');
  const afternoonSlots = slots.filter((s) => s.period === 'afternoon');

  const formatSlotLine = (slot: TimeSlot) => {
    if (slot.type === 'blocked' || slot.type === 'break') {
      return `⏰ ${slot.time} - 🔒 ${slot.blockedReason || slot.breakTitle || 'Apartado (Ocupado)'}`;
    }
    if (slot.type === 'available') {
      return `⏰ ${slot.time} - 🟢 DISPONIBLE (Libre)`;
    }
    return `⏰ ${slot.time} - ✂️ ${slot.clientName || 'Ocupado'} (${slot.service || 'Corte'})`;
  };

  const freeCount = slots.filter((s) => s.type === 'available').length;
  const bookedCount = slots.filter((s) => s.type === 'booked').length;

  const messageText = `💈 *BARBERÍA EL MAESTRO* 💈
📅 *Horarios y Citas para ${formatDateDisplay(date)}*

☀️ *TURNOS MAÑANA:*
${morningSlots.map(formatSlotLine).join('\n')}

🌇 *TURNOS TARDE:*
${afternoonSlots.map(formatSlotLine).join('\n')}

━━━━━━━━━━━━━━━━━━━━━
📊 *Resumen:* ${freeCount} espacios libres | ${bookedCount} agendados
📲 *Para reservar tu turno, responde a este mensaje con tu nombre y la hora elegida!*`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleOpenWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-green-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Lista para Grupo de WhatsApp
              </h2>
              <p className="text-xs text-gray-500">
                Texto listo con espacios libres, ocupados y descansos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-gray-50">
          <div className="bg-white border border-gray-200 rounded-lg p-4 font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed shadow-2xs select-all">
            {messageText}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-gray-400" />
              Incluye apartados de 12:00 y 17:00 automáticamente
            </span>
            <span className="font-semibold text-gray-700">
              {slots.length} turnos configurados
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cerrar
          </button>
          
          <button
            type="button"
            onClick={handleCopy}
            id="btn-copy-whatsapp-text"
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                ¡Copiado al Portapapeles!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar Texto
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Abrir WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};
