import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildWaLink,
  createBooking,
  ensureDaySlots,
  getOrCreateClient,
  getOpenDays,
  IdentifiedClient,
  listAppointments,
  sendBookingWebhook,
  uploadReferenceImage,
} from '../../lib/api';
import { getTodayDateString, getUpcomingDays, formatDateDisplay } from '../../data/defaultData';
import {
  Scissors,
  Clock,
  User,
  Phone,
  Link2,
  ImagePlus,
  CheckCircle2,
  MessageCircle,
  ArrowLeft,
  Sparkles,
  CalendarDays,
} from 'lucide-react';

interface ClientBookingViewProps {
  businessName: string;
  barberPhone: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  initialDate?: string;
}

type Step = 'identify' | 'book' | 'reference' | 'done';

export const ClientBookingView: React.FC<ClientBookingViewProps> = ({
  businessName,
  barberPhone,
  webhookEnabled,
  webhookUrl,
  initialDate,
}) => {
  const today = getTodayDateString();
  const [step, setStep] = useState<Step>('identify');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [identified, setIdentified] = useState<IdentifiedClient | null>(null);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(initialDate || today);
  const [slots, setSlots] = useState<{ time: string; is_available: boolean }[]>([]);
  const [appointments, setAppointments] = useState<{ time: string }[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = useState('');
  const [note, setNote] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doneBooking, setDoneBooking] = useState<{ date: string; time: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upcomingDays = useMemo(() => getUpcomingDays(14), []);

  useEffect(() => {
    getOpenDays(today, upcomingDays[upcomingDays.length - 1].dateStr)
      .then(setOpenDays)
      .catch(() => setOpenDays({}));
  }, [today, upcomingDays]);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([ensureDaySlots(selectedDate), listAppointments(selectedDate)])
      .then(([slotRows, apptRows]) => {
        if (cancelled) return;
        setSlots(slotRows.map((s) => ({ time: s.time, is_available: s.is_available })));
        setAppointments(
          apptRows.filter((a) => a.status !== 'cancelled').map((a) => ({ time: a.time })),
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const isDayOpen = (dateStr: string) => openDays[dateStr] !== false;

  const isPastTime = (time: string): boolean => {
    if (selectedDate !== today) return false;
    const now = new Date();
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
  };

  const acceptedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.replace(/\D/g, '').length < 8) {
      setError('Ingresá tu nombre y un WhatsApp válido.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await getOrCreateClient(name, phone);
      setIdentified(result);
      setName(result.client.full_name);
      setStep('book');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos guardar tus datos. Revisá la conexión e intentá de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!identified || !selectedTime) return;
    setError('');
    setLoading(true);
    try {
      let referenceImageUrl: string | null = null;
      if (imageFile) {
        referenceImageUrl = await uploadReferenceImage(imageFile, identified.client.id);
      }
      const booking = await createBooking({
        clientId: identified.client.id,
        date: selectedDate,
        time: selectedTime,
        referenceUrl: referenceUrl.trim() || null,
        referenceImageUrl,
        note: note.trim() || null,
      });

      setDoneBooking({ date: selectedDate, time: selectedTime });
      setStep('done');

      // Notificación vía webhook (Pabbly) o plan B: abrir WhatsApp del barbero
      const payload = {
        event: 'booking.created' as const,
        clientName: identified.client.full_name,
        clientPhone: identified.client.phone,
        date: selectedDate,
        time: selectedTime,
        referenceUrl: referenceUrl.trim() || null,
        referenceImageUrl,
        note: note.trim() || null,
        createdAt: booking.created_at,
      };
      const sent = await sendBookingWebhook({ webhookEnabled, webhookUrl }, payload);
      if (!sent && barberPhone) {
        const waText = `💈 *Nueva reserva*\n👤 ${identified.client.full_name}\n📅 ${formatDateDisplay(
          selectedDate,
        )}\n⏰ ${selectedTime} h${
          referenceUrl.trim() ? `\n🔗 Referencia: ${referenceUrl.trim()}` : ''
        }${referenceImageUrl ? '\n🖼 Foto adjunta en la app' : ''}`;
        window.open(buildWaLink(barberPhone, waText), '_blank');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo confirmar la cita. Probá de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  const resetBooking = () => {
    setStep('identify');
    setIdentified(null);
    setSelectedTime(null);
    setReferenceUrl('');
    setNote('');
    setImageFile(null);
    setImagePreview(null);
    setDoneBooking(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-gray-900 text-white px-5 py-6 pb-16">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">{businessName}</h1>
            <p className="text-xs text-gray-300 font-medium">Reservá tu turno en 1 minuto</p>
          </div>
        </div>
      </header>

      <main className="flex-1 -mt-10 px-4 pb-10 w-full">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          {error && (
            <p
              role="alert"
              className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
            >
              {error}
            </p>
          )}

          {/* ── PASO 1: IDENTIFICAR ── */}
          {step === 'identify' && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-bold">¿Quién viene?</h2>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Identificamos tu última visita para darte mejor atención.
              </p>
              <form onSubmit={handleIdentify} className="space-y-3">
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    aria-label="Tu nombre"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Tu WhatsApp (ej: 525512345678)"
                    aria-label="Tu WhatsApp"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gray-900 hover:bg-black disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {loading ? 'Un momento…' : 'Continuar →'}
                </button>
              </form>
            </section>
          )}

          {/* ── BIENVENIDA + PASO 2: HORARIO ── */}
          {(step === 'book' || step === 'reference') && identified && (
            <>
              <section className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 text-white p-5 shadow-sm">
                {identified.isNew ? (
                  <>
                    <p className="text-sm font-bold">¡Hola {identified.client.full_name}! 👋</p>
                    <p className="text-xs text-gray-300 mt-1">
                      Bienvenido/a. Contanos qué corte te gustaría y elegí tu horario.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold">
                      ¡Hola de nuevo, {identified.client.full_name}! 👋
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/15 rounded-full px-3 py-1">
                        <Sparkles className="w-3 h-3" />
                        {identified.daysSinceLastCut !== null
                          ? `Tu último corte fue hace ${identified.daysSinceLastCut} día${
                              identified.daysSinceLastCut === 1 ? '' : 's'
                            }`
                          : '¡Qué gusto verte de nuevo!'}
                      </span>
                    </div>
                  </>
                )}
              </section>

              {step === 'book' && (
                <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-gray-400" />
                    Elegí el día
                  </h2>
                  <div className="flex gap-2 overflow-x-auto pb-2 mt-3">
                    {upcomingDays
                      .filter((d) => isDayOpen(d.dateStr))
                      .map((d) => (
                        <button
                          key={d.dateStr}
                          type="button"
                          onClick={() => setSelectedDate(d.dateStr)}
                          className={`shrink-0 px-3.5 py-2 rounded-xl text-center transition-all cursor-pointer border ${
                            selectedDate === d.dateStr
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <span className="block text-[10px] font-bold uppercase tracking-wide opacity-70">
                            {d.weekday}
                          </span>
                          <span className="block text-sm font-bold">{d.dateStr.slice(8)}</span>
                        </button>
                      ))}
                  </div>

                  <h3 className="text-sm font-bold flex items-center gap-2 mt-5">
                    <Clock className="w-4 h-4 text-gray-400" />
                    Horarios libres
                  </h3>
                  {loading ? (
                    <p className="text-xs text-gray-400 italic py-6 text-center">
                      Cargando horarios…
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {slots
                        .filter((s) => s.is_available)
                        .filter((s) => !isPastTime(s.time))
                        .filter((s) => !appointments.some((a) => a.time === s.time))
                        .map((s) => (
                          <button
                            key={s.time}
                            type="button"
                            onClick={() => {
                              setSelectedTime(s.time);
                              setStep('reference');
                            }}
                            className="py-2.5 text-sm font-bold font-mono rounded-xl border border-gray-200 bg-white text-gray-800 hover:border-blue-500 hover:text-blue-600 transition-all cursor-pointer"
                          >
                            {s.time}
                          </button>
                        ))}
                    </div>
                  )}
                  {!loading && slots.filter((s) => s.is_available).length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-4">
                      Este día no tiene horarios disponibles todavía.
                    </p>
                  )}
                </section>
              )}

              {step === 'reference' && (
                <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('book');
                      setSelectedTime(null);
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-800 mb-3 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Cambiar horario
                  </button>

                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                        Tu turno
                      </p>
                      <p className="text-sm font-bold text-blue-900">
                        {formatDateDisplay(selectedDate)} · {selectedTime} h
                      </p>
                    </div>
                    <Clock className="w-5 h-5 text-blue-300" />
                  </div>

                  <h2 className="text-sm font-bold">¿Qué corte te gustaría? (opcional)</h2>
                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Mandanos una foto o el video de referencia del corte que querés.
                  </p>

                  <div className="relative mb-2">
                    <Link2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={referenceUrl}
                      onChange={(e) => setReferenceUrl(e.target.value)}
                      placeholder="Pegá el link de TikTok o Instagram"
                      aria-label="Link de referencia"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <p className="text-[11px] text-gray-400 text-center py-1">o</p>

                  {imagePreview ? (
                    <div className="relative mb-2">
                      <img
                        src={imagePreview}
                        alt="Previsualización de tu referencia"
                        className="w-full h-44 object-cover rounded-xl border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute top-2 right-2 px-2.5 py-1 bg-black/70 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 bg-gray-50 border border-dashed border-gray-300 hover:border-blue-400 rounded-xl text-xs font-bold text-gray-500 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4" />
                      Subir foto del corte
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptedImages.join(',')}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 8 * 1024 * 1024) {
                        setError('La foto es muy grande (máx. 8 MB).');
                        return;
                      }
                      setError('');
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(file));
                    }}
                  />

                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Algo que debamos saber (opcional)"
                    aria-label="Nota para el barbero"
                    className="w-full px-3 py-2.5 mt-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
                  />

                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={loading}
                    className="w-full mt-4 py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    {loading ? 'Guardando tu turno…' : '✓ Confirmar mi turno'}
                  </button>
                </section>
              )}
            </>
          )}

          {step === 'done' && identified && doneBooking && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold mt-3">¡Turno confirmado! ✂️</h2>
              <p className="text-xs text-gray-500 mt-1">
                {formatDateDisplay(doneBooking.date)} ·{' '}
                <span className="font-bold text-gray-800">{doneBooking.time} h</span>
              </p>
              <p className="text-xs text-gray-500 mt-3">
                Te esperamos en {businessName}. ¡Hasta pronto!
              </p>
              <div className="flex flex-col gap-2 mt-5">
                {barberPhone && (
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        buildWaLink(
                          barberPhone,
                          `Hola 😊 soy ${identified.client.full_name}, acabo de reservar el turno de las ${doneBooking.time} para ${formatDateDisplay(doneBooking.date)}. ¡Nos vemos!`,
                        ),
                        '_blank',
                      )
                    }
                    className="flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Abrir WhatsApp
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetBooking}
                  className="py-2.5 text-xs font-bold text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  Reservar otro turno
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="py-5 text-center text-[11px] text-gray-400 font-medium">
        © {new Date().getFullYear()} {businessName} · Reservas por WhatsApp
      </footer>
    </div>
  );
};
