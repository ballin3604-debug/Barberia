import React from 'react';
import { DaySummary } from '../types';
import { 
  Share2, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import { formatDateDisplay } from '../data/defaultData';

interface HeaderProps {
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  summary: DaySummary;
  onOpenShareModal: () => void;
  onOpenScheduleModal: () => void;
  onOpenQuickAddModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedDate,
  onDateChange,
  summary,
  onOpenShareModal,
  onOpenScheduleModal,
  onOpenQuickAddModal,
}) => {
  const handlePrevDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const prev = new Date(year, month - 1, day - 1);
    const y = prev.getFullYear();
    const m = String(prev.getMonth() + 1).padStart(2, '0');
    const d = String(prev.getDate()).padStart(2, '0');
    onDateChange(`${y}-${m}-${d}`);
  };

  const handleNextDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const next = new Date(year, month - 1, day + 1);
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    const d = String(next.getDate()).padStart(2, '0');
    onDateChange(`${y}-${m}-${d}`);
  };

  const handleToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    onDateChange(`${y}-${m}-${d}`);
  };

  return (
    <header className="p-5 sm:p-7 flex flex-col lg:flex-row justify-between items-start lg:items-end border-b border-gray-200 bg-white gap-5">
      {/* Title and Date Selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900">
            Agenda del Día
          </h1>
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
            En vivo
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 font-medium">
          <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5 border border-gray-200/60">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1 hover:bg-white hover:shadow-2xs rounded text-gray-600 transition-all"
              title="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-0.5 text-xs font-semibold text-gray-700 hover:text-blue-600"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              className="p-1 hover:bg-white hover:shadow-2xs rounded text-gray-600 transition-all"
              title="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <label className="relative flex items-center cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1 transition-colors">
            <CalendarIcon className="w-3.5 h-3.5 text-gray-400 mr-1.5" />
            <span className="text-xs sm:text-sm font-semibold text-gray-800">
              {formatDateDisplay(selectedDate)}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>

          <span className="text-gray-400 hidden sm:inline">—</span>
          <span className="text-blue-600 italic font-normal text-xs sm:text-sm">
            Barbería El Maestro
          </span>
        </div>
      </div>

      {/* Metrics and Action Bar */}
      <div className="flex flex-wrap items-center gap-6 sm:gap-8 w-full lg:w-auto justify-between lg:justify-end">
        {/* Metric 1 */}
        <div className="text-left lg:text-right">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-0.5">
            Citas Agendadas
          </p>
          <p className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {summary.bookedCount}
          </p>
        </div>

        {/* Metric 2 */}
        <div className="text-left lg:text-right">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-0.5">
            Espacios Libres
          </p>
          <p className="text-2xl sm:text-3xl font-semibold text-blue-600">
            {summary.availableCount}
          </p>
        </div>

        {/* Metric 3: Breaks */}
        <div className="text-left lg:text-right hidden sm:block">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-0.5">
            Descansos
          </p>
          <p className="text-2xl sm:text-3xl font-semibold text-amber-600/90">
            {summary.breakCount}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <button
            type="button"
            id="btn-whatsapp-share"
            onClick={onOpenShareModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            title="Generar y copiar lista para enviar al grupo de WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copiar lista para</span> WhatsApp
          </button>

          <button
            type="button"
            id="btn-schedule-settings"
            onClick={onOpenScheduleModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
            title="Configurar descansos y horarios"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden md:inline">Descansos y Horarios</span>
          </button>

          <button
            type="button"
            id="btn-quick-add-slot"
            onClick={onOpenQuickAddModal}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            title="Agregar nuevo horario a la agenda"
            aria-label="Agregar horario"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
