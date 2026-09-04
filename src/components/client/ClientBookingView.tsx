import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppointmentRecord } from '../../types';
import {
  buildConfirmationText,
  buildMapsLink,
  buildRulesText,
  buildWaLink,
  clearClientSession,
  createBooking,
  ensureDaySlots,
  getActiveBooking,
  getOpenDays,
  getRecentBookings,
  getOrCreateClient,
  IdentifiedClient,
  listAppointments,
  loadClientSession,
  normalizePhone,
  sanitizeEmail,
  saveClientSession,
  sendBookingWebhook,
  sanitizeNote,
  sanitizeReferenceUrl,
  setAppointmentState,
  subscribeAgendaChanges,
  updateBooking,
  uploadReferenceImage,
} from '../../lib/api';
import { subscribeClientToPush, PushResult } from '../../lib/push';
import { getTodayDateString, getUpcomingDays, formatDateDisplay } from '../../data/defaultData';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  ImagePlus,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';
interface ClientBookingViewProps {
  businessName: string;
  barberPhone: string;
  address: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  initialDate?: string;
}

type Step = 'agenda' | 'identify' | 'confirmMove' | 'reference' | 'manage' | 'done';

const ACCEPTED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

export const ClientBookingView: React.FC<ClientBookingViewProps> = ({
  businessName,
  barberPhone,
  address,
  webhookEnabled,
  webhookUrl,
  initialDate,
}) => {
  const today = getTodayDateString();
  const [step, setStep] = useState<Step>('agenda');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [identified, setIdentified] = useState<IdentifiedClient | null>(null);
  const [identifyForOther, setIdentifyForOther] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [activeBooking, setActiveBooking] = useState<AppointmentRecord | null>(null);
  const [recentBookings, setRecentBookings] = useState<AppointmentRecord[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(initialDate || '');
  const [slots, setSlots] = useState<{ time: string; is_available: boolean }[]>([]);
  const [appointments, setAppointments] = useState<{ time: string; name: string }[]>([]);
  const [pendingTime, setPendingTime] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [referenceUrl, setReferenceUrl] = useState('');
  const [note, setNote] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [doneBooking, setDoneBooking] = useState<{ date: string; time: string } | null>(null);
  const [pushStatus, setPushStatus] = useState<PushResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upcomingDays = useMemo(() => getUpcomingDays(14), []);
  const rulesText = useMemo(() => buildRulesText(businessName), [businessName]);

  // Días habilitados por el barbero (solo abiertos explícitamente)
  useEffect(() => {
    getOpenDays(today, upcomingDays[upcomingDays.length - 1].dateStr)
      .then(setOpenDays)
      .catch(() => setOpenDays({}));
  }, [today, upcomingDays]);

  // Por defecto: primer día abierto (respeta la fecha del link solo si está abierta)
  useEffect(() => {
    const open = upcomingDays.filter((d) => openDays[d.dateStr] === true);
    if (open.length === 0) return;
    if (!selectedDate || !open.some((d) => d.dateStr === selectedDate)) {
      const preferred = initialDate && open.some((d) => d.dateStr === initialDate)
        ? initialDate
        : open[0].dateStr;
      setSelectedDate(preferred);
    }
  }, [openDays, upcomingDays, selectedDate, initialDate]);

  // Cargar la agenda del día (sin necesidad de identificarse)
  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([ensureDaySlots(selectedDate), listAppointments(selectedDate)])
      .then(([slotRows, apptRows]) => {
        if (cancelled) return;
        setSlots(slotRows.map((s) => ({ time: s.time, is_available: s.is_available })));
        setAppointments(
          apptRows
            .filter((a) => a.status !== 'cancelled')
            .map((a) => ({ time: a.time, name: a.clients?.full_name || '' })),
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // Cambios en tiempo real (otras reservas, movimientos, cancelaciones)
  useEffect(() => {
    const unsubscribe = subscribeAgendaChanges(() => setRefreshKey((k) => k + 1));
    return unsubscribe;
  }, []);

  // Si este dispositivo ya identificó a un cliente, restaurar su sesión
  useEffect(() => {
    const session = loadClientSession();
    if (!session) return;
    setRestoring(true);
    (async () => {
      try {
        const result = await getOrCreateClient(
          session.fullName,
          session.phone,
          session.email,
        );
        setIdentified(result);
        const [active, recent] = await Promise.all([
          getActiveBooking(result.client.id),
          getRecentBookings(result.client.id),
        ]);
        setActiveBooking(active);
        setRecentBookings(recent);
        if (active) {
          setReferenceUrl(active.reference_url || '');
          setNote(active.note || '');
        }
      } catch {
        // Sin conexión: usar la sesión guardada tal cual
        setIdentified({
          client: {
            id: session.clientId,
            full_name: session.fullName,
            phone: session.phone,
            email: session.email || null,
            last_visit: null,
            created_at: session.savedAt,
          },
          isNew: false,
          daysSinceLastCut: null,
        });
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const openDayList = upcomingDays.filter((d) => openDays[d.dateStr] === true);

  const isPastTime = (time: string): boolean => {
    if (selectedDate !== today) return false;
    const now = new Date();
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
  };

  /* ── Elegir un horario libre ── */
  const pickTime = (time: string) => {
    setPendingTime(time);
    setError('');
    if (!identified) {
      setStep('identify');
      return;
    }
    // Ya identificado y con turno activo en otro horario → preguntar
    if (activeBooking && !(activeBooking.date === selectedDate && activeBooking.time === time)) {
      setStep('confirmMove');
      return;
    }
    if (activeBooking) {
      // Es el mismo turno → gestionar
      setStep('manage');
      return;
    }
    setIsEditing(false);
    setStep('reference');
  };

  /* ── Confirmar el traslado del turno (misma persona u otra) ── */
  const confirmMoveForSelf = () => {
    if (!activeBooking) return;
    setIsEditing(true);
    setReferenceUrl(activeBooking.reference_url || '');
    setNote(activeBooking.note || '');
    setStep('reference');
  };

  const confirmMoveForOther = () => {
    // Reservar para OTRA PERSONA: datos nuevos y limpias la identidad actual
    setIdentifyForOther(true);
    setIdentified(null);
    setActiveBooking(null);
    setRecentBookings([]);
    setIsEditing(false);
    setName('');
    setPhone('');
    setEmail('');
    setStep('identify');
  };

  const backToAgenda = () => {
    setStep('agenda');
    setPendingTime(null);
    setIdentifyForOther(false);
    setError('');
  };

  /* ── Cambiar de persona (comparten el teléfono: familiar, amigo) ── */
  const changePerson = () => {
    clearClientSession();
    setIdentified(null);
    setActiveBooking(null);
    setRecentBookings([]);
    setIsEditing(false);
    setPendingTime(null);
    setIdentifyForOther(true);
    setStep('identify');
  };

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Escribí tu nombre para identificarte.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 8) {
      setError('Revisá tu WhatsApp: deben ser al menos 8 números, ej. 525512345678.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await getOrCreateClient(name, phone, email);
      setIdentified(result);
      setIdentifyForOther(false);
      setName(result.client.full_name);
      saveClientSession({
        clientId: result.client.id,
        fullName: result.client.full_name,
        phone: normalizePhone(result.client.phone || phone),
        email: sanitizeEmail(email) || result.client.email || '',
        savedAt: new Date().toISOString(),
      });
      const [active, recent] = await Promise.all([
        getActiveBooking(result.client.id),
        getRecentBookings(result.client.id),
      ]);
      setActiveBooking(active);
      setRecentBookings(recent);

      if (active && active.date === selectedDate && active.time === pendingTime) {
        // Ya tiene justo ese turno → gestionarlo
        setReferenceUrl(active.reference_url || '');
        setNote(active.note || '');
        setStep('manage');
      } else if (active) {
        // Tiene un turno activo → editar al nuevo horario
        setIsEditing(true);
        setReferenceUrl(active.reference_url || '');
        setNote(active.note || '');
        setStep('reference');
      } else {
        setIsEditing(false);
        setReferenceUrl('');
        setNote('');
        setStep('reference');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/column|relation|42P01|PGRST204|does not exist/i.test(message)) {
        setError(
          'La base de datos está desactualizada. Avisá al administrador: hay que ejecutar supabase/schema.sql de nuevo en el SQL Editor.',
        );
      } else {
        setError(message || 'No pudimos guardar tus datos. Revisá tu conexión e intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    setLoading(true);
    try {
      await setAppointmentState(activeBooking.id, 'cancelled');
      setInfo('Turno cancelado. Podés reservar otro cuando quieras.');
      setActiveBooking(null);
      setIsEditing(false);
      setPendingTime(null);
      setRefreshKey((k) => k + 1);
      setStep('agenda');
    } catch {
      setError('No se pudo cancelar el turno. Probá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!identified || !pendingTime) return;
    setError('');
    setLoading(true);
    try {
      let referenceImageUrl: string | null = null;
      if (imageFile) {
        referenceImageUrl = await uploadReferenceImage(imageFile, identified.client.id);
      }
      const url = sanitizeReferenceUrl(referenceUrl) || null;
      const cleanNote = sanitizeNote(note) || null;

      let booking: AppointmentRecord;
      if (isEditing && activeBooking) {
        booking = await updateBooking(activeBooking.id, {
          date: selectedDate,
          time: pendingTime,
          referenceUrl: url,
          referenceImageUrl: referenceImageUrl || activeBooking.reference_image_url,
          note: cleanNote,
        });
      } else {
        booking = await createBooking({
          clientId: identified.client.id,
          date: selectedDate,
          time: pendingTime,
          referenceUrl: url,
          referenceImageUrl,
          note: cleanNote,
        });
      }

      setDoneBooking({ date: selectedDate, time: pendingTime });
      setInfo('');
      setIsEditing(false);
      setActiveBooking(booking);
      setRefreshKey((k) => k + 1);
      setStep('done');

      // Pide permiso para recordar la cita con una notificación del navegador (2 h antes)
      setPushStatus(null);
      subscribeClientToPush(identified.client.id).then(setPushStatus);

      const payload = {
        event: (isEditing ? 'booking.updated' : 'booking.created') as
          | 'booking.created'
          | 'booking.updated',
        clientName: identified.client.full_name,
        clientPhone: identified.client.phone,
        date: selectedDate,
        time: pendingTime,
        referenceUrl: url,
        referenceImageUrl,
        note: cleanNote,
        createdAt: booking.created_at,
      };
      const sent = await sendBookingWebhook({ webhookEnabled, webhookUrl }, payload);
      if (!sent && barberPhone) {
        const waText = `${buildConfirmationText(
          businessName,
          formatDateDisplay(selectedDate),
          pendingTime,
        )}`;
        window.open(
          buildWaLink(
            barberPhone,
            `👤 ${identified.client.full_name}\n🔗 ${url || 'sin referencia'}\n\n${waText}`,
          ),
          '_blank',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la cita. Probá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Volver a la agenda tras confirmar (mantiene la sesión) ── */
  const backToAgendaAfterDone = () => {
    setDoneBooking(null);
    setPendingTime(null);
    setIsEditing(false);
    setPushStatus(null);
    setInfo('');
    setRefreshKey((k) => k + 1);
    setStep('agenda');
  };

  /* ─────────────── RENDER ─────────────── */

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-gray-900 text-white px-5 py-6 pb-16">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt={businessName}
            className="w-11 h-11 rounded-xl object-cover shrink-0"
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">{businessName}</h1>
            <p className="text-xs text-gray-300 font-medium">Reservá tu turno en 1 minuto</p>
          </div>
        </div>
        <div className="max-w-md mx-auto mt-3">
          <a
            href={buildMapsLink(address, businessName)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-bold text-white transition-colors"
            title="Abrir Google Maps para llegar a la barbería"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            ¿No sabes cómo llegar? ¡Encuéntranos aquí!
          </a>
        </div>
      </header>

      <main className="flex-1 -mt-10 px-4 pb-10 w-full">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          {error && (
            <p
              role="alert"
              className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 anim-fade"
            >
              {error}
            </p>
          )}
          {info && (
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 anim-fade">
              {info}
            </p>
          )}

          {/* ═══════════ PRIMERA VISTA: LA AGENDA DEL DÍA ═══════════ */}
          {step === 'agenda' && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 anim-up">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                  Agenda del día
                </h2>
                {selectedDate && (
                  <span className="text-[11px] font-bold text-gray-500 capitalize">
                    {formatDateDisplay(selectedDate)}
                  </span>
                )}
              </div>

              {/* Sesión del cliente: no vuelve a pedir identificación */}
              {identified && (
                <div className="flex items-center justify-between mt-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 anim-fade">
                  <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{identified.client.full_name}</span>
                    {restoring && (
                      <span className="text-gray-400 font-medium shrink-0">· verificando…</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={changePerson}
                    className="shrink-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    ¿No sos vos? Cambiar
                  </button>
                </div>
              )}

              {/* Mis turnos (todas las fechas, para que nunca "desaparezcan") */}
              {identified && recentBookings.length > 0 && (
                <div className="mt-3 bg-gray-50/80 border border-gray-200 rounded-xl px-4 py-3 anim-fade">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    📋 Mis turnos
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {recentBookings.slice(0, 4).map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between text-xs text-gray-600"
                      >
                        <span className="truncate capitalize">
                          {formatDateDisplay(b.date)} ·{' '}
                          <span className="font-mono font-bold text-gray-800">{b.time}</span>
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.date >= today
                              ? 'bg-emerald-100 text-emerald-700'
                              : b.status === 'attended'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {b.date >= today
                            ? 'Próximo'
                            : b.status === 'attended'
                              ? 'Atendido'
                              : 'Pasado'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Días habilitados */}
              {openDayList.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">
                  Todavía no hay días habilitados para reservar. ¡Volvé pronto! 💈
                </p>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2 mt-3">
                    {openDayList.map((d) => (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(d.dateStr)}
                        className={`shrink-0 px-3.5 py-2 rounded-xl text-center transition-all cursor-pointer border anim-pop ${
                          selectedDate === d.dateStr
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wide opacity-70">
                          {d.weekday}
                        </span>
                        <span className="block text-sm font-bold">{d.dateStr.slice(8)}</span>
                        {recentBookings.some(
                          (b) => b.date === d.dateStr && b.status !== 'cancelled',
                        ) && (
                          <span
                            className="mt-0.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"
                            title="Tenés un turno este día"
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* La lista de turnos: quién reservó y qué queda libre */}
                  {loading ? (
                    <p className="text-xs text-gray-400 italic py-8 text-center anim-fade">
                      Cargando agenda…
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 mt-3">
                      {slots
                        .filter((s) => s.is_available || appointments.some((a) => a.time === s.time))
                        .filter((s) => !isPastTime(s.time))
                        .map((s, index) => {
                          const appt = appointments.find((a) => a.time === s.time);
                          const isMine =
                            identified &&
                            activeBooking &&
                            activeBooking.time === s.time &&
                            activeBooking.date === selectedDate;
                          if (appt) {
                            const canEdit = isMine;
                            return (
                              <div
                                key={s.time}
                                onClick={canEdit ? () => setStep('manage') : undefined}
                                style={{ animationDelay: `${index * 35}ms` }}
                                role={canEdit ? 'button' : undefined}
                                tabIndex={canEdit ? 0 : undefined}
                                onKeyDown={
                                  canEdit
                                    ? (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') setStep('manage');
                                      }
                                    : undefined
                                }
                                className={`anim-up flex items-center justify-between py-2.5 px-3.5 rounded-xl border transition-all ${
                                  isMine
                                    ? 'bg-emerald-50/70 border-emerald-200'
                                    : 'bg-gray-50/80 border-gray-200'
                                } ${canEdit ? 'cursor-pointer hover:border-emerald-400' : ''}`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="font-mono text-sm font-bold text-gray-800 shrink-0">
                                    {s.time}
                                  </span>
                                  <span
                                    className={`text-xs font-semibold truncate ${
                                      isMine ? 'text-emerald-800' : 'text-gray-600'
                                    }`}
                                  >
                                    {isMine ? '★ Tu turno · tocá para editar' : appt.name}
                                  </span>
                                </div>
                                <span
                                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isMine
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-gray-200/80 text-gray-500'
                                  }`}
                                >
                                  {isMine ? '✏️ Editar' : 'Ya reservó'}
                                </span>
                              </div>
                            );
                          }
                          return (
                            <button
                              key={s.time}
                              type="button"
                              onClick={() => pickTime(s.time)}
                              style={{ animationDelay: `${index * 35}ms` }}
                              className="anim-up pressable flex items-center justify-between py-3 px-3.5 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:border-emerald-500 hover:bg-emerald-50 text-left transition-all cursor-pointer group"
                            >
                              <span className="flex items-center gap-3">
                                <span className="font-mono text-sm font-bold text-emerald-800 shrink-0">
                                  {s.time}
                                </span>
                                <span className="text-xs font-semibold text-emerald-700">
                                  Disponible
                                </span>
                              </span>
                              <span className="text-[11px] font-bold text-white bg-emerald-600 group-hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors">
                                Reservar
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                  {!loading && slots.filter((s) => s.is_available).length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-4">
                      No hay horarios libres en este día. Elegí otro día de la lista.
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {/* ═══════════ ¿CAMBIAR TURNO O RESERVAR PARA OTRO? ═══════════ */}
          {step === 'confirmMove' && identified && activeBooking && pendingTime && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 anim-zoom">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">¿Cambiar tu turno?</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Elegiste un horario distinto al que tenés reservado.</p>
                </div>
              </div>

              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-600 space-y-1">
                <p className="flex items-center justify-between">
                  <span className="text-gray-400">Turno actual</span>
                  <span className="font-bold text-gray-800">
                    {formatDateDisplay(activeBooking.date)} · {activeBooking.time}
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-gray-400">Nuevo horario</span>
                  <span className="font-bold text-emerald-700">
                    {formatDateDisplay(selectedDate)} · {pendingTime} h
                  </span>
                </p>
              </div>

              <div className="flex flex-col gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={confirmMoveForSelf}
                  className="pressable w-full py-3.5 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl transition-all cursor-pointer"
                >
                  ✂️ Sí, soy yo — cambiar mi turno
                </button>
                <button
                  type="button"
                  onClick={confirmMoveForOther}
                  className="pressable w-full py-3.5 bg-white border-2 border-gray-200 hover:border-blue-400 text-gray-800 text-sm font-bold rounded-xl transition-all cursor-pointer"
                >
                  👤 Es para otra persona
                </button>
                <button
                  type="button"
                  onClick={backToAgenda}
                  className="py-2 text-xs font-bold text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  Volver a la agenda
                </button>
              </div>
              <p className="mt-4 text-[10px] text-gray-400 text-center">
                Si elegís "es para vos", tus datos y referencia se trasladan al nuevo horario.
              </p>
            </section>
          )}

          {/* ═══════════ IDENTIFICACIÓN (después de elegir hora) ═══════════ */}
          {step === 'identify' && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 anim-up">
              <button
                type="button"
                onClick={backToAgenda}
                className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-800 mb-3 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver a la agenda
              </button>

              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    El turno que elegiste
                  </p>
                  <p className="text-sm font-bold text-emerald-900">
                    {formatDateDisplay(selectedDate)} · {pendingTime} h
                  </p>
                </div>
                <Clock className="w-5 h-5 text-emerald-300" />
              </div>

              <h2 className="text-base font-bold">
                {identifyForOther ? '¿Quién va a venir?' : '¿Quién viene?'}
              </h2>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                {identifyForOther
                  ? 'Ingresá los datos de la persona que va a asistir. Su turno se reservará a su nombre.'
                  : 'Identificamos tu última visita para darte mejor atención.'}
              </p>
              <form onSubmit={handleIdentify} className="space-y-3">
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError('');
                    }}
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
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Tu WhatsApp (ej: 525512345678)"
                    aria-label="Tu WhatsApp"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Tu correo (opcional, para recordatorios)"
                    aria-label="Tu correo"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gray-900 hover:bg-black disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all cursor-pointer"
                >
                  {loading ? 'Un momento…' : 'Continuar →'}
                </button>
              </form>
            </section>
          )}

          {/* ═══════════ BIENVENIDA (al identificarse) ═══════════ */}
          {identified && (step === 'reference' || step === 'manage') && (
            <section className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 text-white p-5 shadow-sm anim-up">
              {identified.isNew ? (
                <>
                  <p className="text-sm font-bold">¡Hola {identified.client.full_name}! 👋</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Bienvenido/a. Contanos qué corte te gustaría y confirmá tu horario.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold">¡Hola de nuevo, {identified.client.full_name}! 👋</p>
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
          )}

          {/* ═══════════ MI TURNO (gestión) ═══════════ */}
          {step === 'manage' && activeBooking && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 anim-up">
              <button
                type="button"
                onClick={backToAgenda}
                className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-800 mb-3 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Ver agenda
              </button>
              <div className="flex items-center justify-between bg-gray-900 text-white rounded-xl px-4 py-3.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Tu turno reservado
                  </p>
                  <p className="text-sm font-bold">
                    {formatDateDisplay(activeBooking.date)} · {activeBooking.time} h
                  </p>
                </div>
                <Clock className="w-5 h-5 text-gray-400" />
              </div>

              {activeBooking.reference_image_url && (
                <img
                  src={activeBooking.reference_image_url}
                  alt="Tu referencia de corte"
                  className="w-full max-h-40 object-cover rounded-xl border border-gray-200 mt-3"
                />
              )}
              {activeBooking.reference_url && (
                <a
                  href={activeBooking.reference_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 mt-3 cursor-pointer"
                >
                  <Link2 className="w-4 h-4" />
                  Ver mi referencia (TikTok / Instagram)
                </a>
              )}
              {activeBooking.note && (
                <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-3">
                  📝 {activeBooking.note}
                </p>
              )}

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setPendingTime(null);
                    setStep('agenda');
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ✏️ Cambiar mi turno
                </button>
                <button
                  type="button"
                  onClick={handleCancelBooking}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar turno
                </button>
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-[11px] text-amber-900">
                ⚠️ Si no podés asistir, cancelá o cambiá tu turno con{' '}
                <span className="font-bold">al menos 2 horas de anticipación</span> para que el
                barbero pueda reponerlo.
              </div>

              {recentBookings.length > 0 && (
                <div className="mt-3 bg-gray-50/80 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    📋 Tus turnos
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {recentBookings.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between text-xs text-gray-600"
                      >
                        <span className="truncate capitalize">
                          {formatDateDisplay(b.date)} ·{' '}
                          <span className="font-mono font-bold text-gray-800">{b.time}</span>
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.date >= today
                              ? 'bg-emerald-100 text-emerald-700'
                              : b.status === 'attended'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {b.date >= today
                            ? 'Próximo'
                            : b.status === 'attended'
                              ? 'Atendido'
                              : 'Pasado'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* ═══════════ REFERENCIA DEL CORTE ═══════════ */}
          {step === 'reference' && identified && pendingTime && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 anim-up">
              <button
                type="button"
                onClick={() => {
                  setPendingTime(null);
                  setStep('agenda');
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-800 mb-3 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Cambiar horario
              </button>

              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                    {isEditing ? 'Nuevo turno' : 'Tu turno'}
                  </p>
                  <p className="text-sm font-bold text-blue-900">
                    {formatDateDisplay(selectedDate)} · {pendingTime} h
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
                accept={ACCEPTED_IMAGES.join(',')}
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
                className="w-full mt-4 py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                {loading
                  ? 'Guardando tu turno…'
                  : isEditing
                    ? '✓ Guardar cambios'
                    : '✓ Confirmar mi turno'}
              </button>
            </section>
          )}

          {/* ═══════════ CONFIRMADO ═══════════ */}
          {step === 'done' && identified && doneBooking && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center anim-up">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto anim-success">
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
              <div className="text-left mt-4 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-[11px] text-amber-900">
                📌 ¿No podés asistir? Editá o cancelá tu turno con{' '}
                <span className="font-bold">al menos 2 horas de anticipación</span> para que el
                barbero pueda reponerlo.
              </div>
              {pushStatus === 'granted' && (
                <p className="text-[11px] font-semibold text-emerald-700 mt-2.5">
                  🔔 Recordatorio activado: te avisamos 2 h antes de tu turno.
                </p>
              )}
              {pushStatus === 'denied' && (
                <p className="text-[11px] text-gray-400 mt-2.5">
                  Los recordatorios del navegador están desactivados. Podés recibirlos por correo
                  si dejaste tu email.
                </p>
              )}
              <div className="flex flex-col gap-2 mt-5">
                {barberPhone && (
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        buildWaLink(
                          barberPhone,
                          buildConfirmationText(
                            businessName,
                            formatDateDisplay(doneBooking.date),
                            doneBooking.time,
                          ),
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
                  onClick={backToAgendaAfterDone}
                  className="py-2.5 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  ← Volver a la agenda del día
                </button>
              </div>
            </section>
          )}

          {/* ═══════════ REGLAS ═══════════ */}
          {step !== 'reference' && step !== 'done' && (
            <details className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 anim-up">
              <summary className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                📖 ¿Cómo funciona? (reglas)
              </summary>
              <pre className="whitespace-pre-wrap font-sans text-[11px] text-gray-500 mt-2 leading-relaxed">
                {rulesText}
              </pre>
            </details>
          )}
        </div>
      </main>

      <footer className="py-5 text-center text-[11px] text-gray-400 font-medium">
        © {new Date().getFullYear()} {businessName} · Reservas por WhatsApp
      </footer>
    </div>
  );
};
