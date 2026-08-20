import React, { useState } from 'react';
import { TimeSlot, SlotType } from '../types';
import { 
  STANDARD_HOURS, 
  formatDateDisplay, 
  getUpcomingDays 
} from '../data/defaultData';
import { 
  Calendar, 
  Coffee, 
  Lock, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Copy, 
  Sparkles, 
  Clock,
  Ban,
  CalendarCheck,
  Check
} from 'lucide-react';

interface DaySchedulePlannerProps {
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  isWorkingDay: boolean;
  onToggleWorkingDay: (dateStr: string, isWorking: boolean) => void;
  currentSlots: TimeSlot[];
  onUpdateSlots: (dateStr: string, slots: TimeSlot[]) => void;
  onApplyToMultipleDays?: (sourceDateStr: string, targetDates: string[]) => void;
  onBackToAgenda: () => void;
}

export const DaySchedulePlanner: React.FC<DaySchedulePlannerProps> = ({
  selectedDate,
  onSelectDate,
  isWorkingDay,
  onToggleWorkingDay,
  currentSlots,
  onUpdateSlots,
  onApplyToMultipleDays,
  onBackToAgenda,
}) => {
  const upcomingDays = getUpcomingDays(7);
  const [newCustomTime, setNewCustomTime] = useState('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [showCopySelector, setShowCopySelector] = useState(false);
  const [selectedTargetDates, setSelectedTargetDates] = useState<string[]>([]);

  // Change type of a specific slot
  const handleSlotTypeChange = (time: string, newType: SlotType, customTitle?: string) => {
    const existingIndex = currentSlots.findIndex((s) => s.time === time);
    const [hour] = time.split(':').map(Number);
    const period = hour < 14 ? 'morning' : 'afternoon';

    if (existingIndex >= 0) {
      const updated = [...currentSlots];
      const prev = updated[existingIndex];

      if (newType === 'break') {
        updated[existingIndex] = {
          ...prev,
          type: 'break',
          breakTitle: customTitle || (time === '12:00' ? 'Descanso Almuerzo' : 'Descanso 5:00 PM'),
          clientName: undefined,
          service: undefined,
          status: undefined,
        };
      } else if (newType === 'blocked') {
        updated[existingIndex] = {
          ...prev,
          type: 'blocked',
          blockedReason: customTitle || 'Apartado / Ocupado',
          clientName: undefined,
          service: undefined,
          status: undefined,
        };
      } else if (newType === 'available') {
        updated[existingIndex] = {
          ...prev,
          type: 'available',
          breakTitle: undefined,
          blockedReason: undefined,
        };
      }
      onUpdateSlots(selectedDate, updated);
    } else {
      // Slot was not in list, add it
      const newSlot: TimeSlot = {
        id: `${selectedDate}-${time.replace(':', '')}`,
        time,
        period,
        date: selectedDate,
        type: newType,
        breakTitle: newType === 'break' ? (customTitle || 'Descanso') : undefined,
        blockedReason: newType === 'blocked' ? (customTitle || 'Apartado') : undefined,
      };
      const next = [...currentSlots, newSlot].sort((a, b) => a.time.localeCompare(b.time));
      onUpdateSlots(selectedDate, next);
    }
  };

  // Remove a slot entirely
  const handleRemoveSlot = (time: string) => {
    const updated = currentSlots.filter((s) => s.time !== time);
    onUpdateSlots(selectedDate, updated);
  };

  // Add custom time
  const handleAddCustomTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomTime) return;
    if (currentSlots.some((s) => s.time === newCustomTime)) {
      setNewCustomTime('');
      return;
    }
    const [hour] = newCustomTime.split(':').map(Number);
    const period = hour < 14 ? 'morning' : 'afternoon';
    const newSlot: TimeSlot = {
      id: `${selectedDate}-${newCustomTime.replace(':', '')}`,
      time: newCustomTime,
      period,
      type: 'available',
      date: selectedDate,
    };
    const next = [...currentSlots, newSlot].sort((a, b) => a.time.localeCompare(b.time));
    onUpdateSlots(selectedDate, next);
    setNewCustomTime('');
  };

  // Quick Presets
  const applyStandardBlocksPreset = () => {
    const slotsMap = new Map<string, TimeSlot>();
    
    STANDARD_HOURS.forEach((time) => {
      const [hour] = time.split(':').map(Number);
      const isLunch = time === '12:00';
      const isBreak = time === '17:00';

      slotsMap.set(time, {
        id: `${selectedDate}-${time.replace(':', '')}`,
        time,
        period: hour < 14 ? 'morning' : 'afternoon',
        date: selectedDate,
        type: isLunch || isBreak ? 'blocked' : 'available',
        blockedReason: isLunch ? 'Descanso Almuerzo' : isBreak ? 'Descanso 5:00 PM' : undefined,
      });
    });

    currentSlots.forEach((s) => {
      if (s.type === 'booked' && slotsMap.has(s.time)) {
        slotsMap.set(s.time, s);
      }
    });

    const next = Array.from(slotsMap.values()).sort((a, b) => a.time.localeCompare(b.time));
    onUpdateSlots(selectedDate, next);
  };

  const setAllAvailable = () => {
    const next = currentSlots.map((s) => ({
      ...s,
      type: s.type === 'booked' ? 'booked' : ('available' as SlotType),
      breakTitle: undefined,
      blockedReason: undefined,
    }));
    onUpdateSlots(selectedDate, next);
  };

  // Copy schedule to other days
  const handleExecuteCopy = () => {
    if (!selectedTargetDates.length || !onApplyToMultipleDays) return;
    onApplyToMultipleDays(selectedDate, selectedTargetDates);
    setCopiedSuccess(true);
    setShowCopySelector(false);
    setSelectedTargetDates([]);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-blue-100">
      {/* Sticky Header */}
      <header className="bg-white border-b border-gray-200/80 px-4 sm:px-8 py-4 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/95">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToAgenda}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200/80 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la Agenda</span>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
                Planificar Días y Horarios
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                Configura días de atención, descansos y horarios apartados
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToAgenda}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Listo · Ver Agenda</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* 1. SELECCIÓN Y HABILITACIÓN DE DÍAS */}
        <section className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  1. Días de Peluqueo
                </h2>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Selecciona un día para configurar sus horarios o marcarlo como día libre
              </p>
            </div>

            {/* Working Day Toggle */}
            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200/80 px-3.5 py-1.5 rounded-xl">
              <span className={`text-xs font-bold ${isWorkingDay ? 'text-green-700' : 'text-gray-500'}`}>
                {isWorkingDay ? '🟢 Día de trabajo (Abierto)' : '⚪ Día Libre / Cerrado'}
              </span>
              <button
                type="button"
                onClick={() => onToggleWorkingDay(selectedDate, !isWorkingDay)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isWorkingDay ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isWorkingDay ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Quick Day Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-1">
            {upcomingDays.map((d) => {
              const isSelected = d.dateStr === selectedDate;
              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => onSelectDate(d.dateStr)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-gray-900 bg-gray-900 text-white shadow-2xs'
                      : 'border-gray-200/80 hover:border-gray-300 bg-gray-50/70 hover:bg-white text-gray-800'
                  }`}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                    {d.weekday}
                  </p>
                  <p className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                    {d.label.split(' ').slice(1).join(' ')}
                  </p>
                  {d.isToday && (
                    <span className={`inline-block mt-1 text-[9px] font-bold uppercase ${isSelected ? 'text-emerald-300' : 'text-blue-600'}`}>
                      Hoy
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Date Picker fallback */}
          <div className="flex items-center gap-2 pt-2 text-xs text-gray-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>O selecciona otra fecha en el calendario:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onSelectDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 bg-white font-semibold text-gray-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </section>

        {/* 2. CONFIGURACIÓN DE HORARIOS DEL DÍA SELECCIONADO */}
        {isWorkingDay ? (
          <section className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-200/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                    2. Horarios para {formatDateDisplay(selectedDate)}
                  </h2>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  Define qué horas estarán abiertas para citas, pausas de descanso o apartados
                </p>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={applyStandardBlocksPreset}
                  className="flex items-center gap-1.5 text-xs font-bold bg-gray-50 hover:bg-gray-100 text-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 transition-colors shadow-2xs cursor-pointer"
                  title="Poner apartados de almuerzo y descanso de 12:00 y 17:00"
                >
                  <Sparkles className="w-3.5 h-3.5 text-gray-500" />
                  <span>Apartados habituales (12:00 y 17:00)</span>
                </button>

                <button
                  type="button"
                  onClick={setAllAvailable}
                  className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  Todos Libres
                </button>
              </div>
            </div>


            {/* Slots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {currentSlots.map((slot) => {
                const isAvailable = slot.type === 'available';
                const isBreak = slot.type === 'break';
                const isBlocked = slot.type === 'blocked';
                const isBooked = slot.type === 'booked';

                return (
                  <div
                    key={slot.id || slot.time}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isBlocked || isBreak
                        ? 'bg-gray-50 border-gray-200 text-gray-700 shadow-2xs'
                        : isBooked
                        ? 'bg-blue-50/40 border-blue-200/80 shadow-2xs'
                        : 'bg-white border-dashed border-gray-300 hover:border-blue-400 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100/90 px-2 py-0.5 rounded-md w-13 text-center shrink-0">
                        {slot.time}
                      </span>
                      <div className="truncate">
                        {isBooked ? (
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {slot.clientName} <span className="text-[11px] text-gray-400 font-normal">({slot.service || 'Cita'})</span>
                          </p>
                        ) : (isBlocked || isBreak) ? (
                          <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-gray-400" />
                            <span>{slot.blockedReason || slot.breakTitle || 'Apartado'}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-blue-600 font-normal italic">
                            Disponible
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Available */}
                      <button
                        type="button"
                        onClick={() => handleSlotTypeChange(slot.time, 'available')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          isAvailable
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                        }`}
                        title="Habilitar para clientes"
                      >
                        Libre
                      </button>

                      {/* Blocked / Apartado */}
                      <button
                        type="button"
                        onClick={() => handleSlotTypeChange(slot.time, 'blocked')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          isBlocked || isBreak
                            ? 'bg-gray-900 text-white shadow-2xs'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                        title="Apartar horario"
                      >
                        Apartar
                      </button>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(slot.time)}
                        className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="Quitar turno de la lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Custom Hour */}
            <form onSubmit={handleAddCustomTime} className="pt-4 border-t border-dashed border-gray-200 flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Agregar otra hora:
              </span>
              <input
                type="time"
                value={newCustomTime}
                onChange={(e) => setNewCustomTime(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 bg-white font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!newCustomTime}
                className="flex items-center gap-1 px-3 py-1 bg-gray-900 disabled:opacity-40 hover:bg-black text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </form>

            {/* Copy to other days option */}
            <div className="pt-4 border-t border-gray-200/80">
              {!showCopySelector ? (
                <button
                  type="button"
                  onClick={() => setShowCopySelector(true)}
                  className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar esta misma plantilla de horarios a otros días</span>
                </button>
              ) : (
                <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-gray-900">
                    Selecciona a qué días deseas copiar esta misma configuración:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {upcomingDays
                      .filter((d) => d.dateStr !== selectedDate)
                      .map((d) => {
                        const isChecked = selectedTargetDates.includes(d.dateStr);
                        return (
                          <button
                            key={d.dateStr}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setSelectedTargetDates(selectedTargetDates.filter((x) => x !== d.dateStr));
                              } else {
                                setSelectedTargetDates([...selectedTargetDates, d.dateStr]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleExecuteCopy}
                      disabled={!selectedTargetDates.length}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      Copiar Horarios
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCopySelector(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {copiedSuccess && (
                <p className="text-xs text-green-600 font-bold mt-2.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Configuración copiada exitosamente a los días seleccionados.</span>
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center space-y-3 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
              <Ban className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              {formatDateDisplay(selectedDate)} está marcado como día libre
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto font-medium">
              No habrá turnos abiertos para este día. Si decides abrir la peluquería, actívalo con el botón inferior.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onToggleWorkingDay(selectedDate, true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Habilitar como día de trabajo</span>
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
