import { FormEvent, useEffect, useState } from 'react';
import { BusinessSettings } from './types';
import { loadSettings, saveSettings } from './data/defaultData';
import { fetchPublicBusinessData, migrateLocalAgenda, savePublicBusinessData } from './lib/api';
import {
  clearPinFailures,
  formatLockCountdown,
  getPinLockState,
  hashPin,
  isPinHash,
  MAX_PIN_FAILS,
  recordPinFailure,
  verifyPin,
} from './lib/pin';
import { isSupabaseConfigured } from './lib/supabase';
import { ClientBookingView } from './components/client/ClientBookingView';
import { BarberAgendaView } from './components/barber/BarberAgendaView';
import { SettingsModal } from './components/SettingsModal';
import { ReportsModal } from './components/ReportsModal';
import { useToast } from './components/Toast';
import { Database, Upload } from 'lucide-react';

const MIGRATED_KEY = 'barber_migrated_v1';
const LEGACY_SCHEDULE_KEY = 'barber_agenda_clean_v2';
const LEGACY_DAYS_KEY = 'barber_working_days_v2';

export default function App() {
  const showToast = useToast();
  const params = new URLSearchParams(window.location.search);
  const isClientView = params.get('view') === 'client';
  const initialDate = params.get('date') || undefined;

  const [settings, setSettings] = useState<BusinessSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [pinOk, setPinOk] = useState(() => sessionStorage.getItem('barber_pin_ok') === '1');

  const [showMigrate, setShowMigrate] = useState<boolean>(() => {
    if (!isSupabaseConfigured() || localStorage.getItem(MIGRATED_KEY)) return false;
    try {
      const raw = localStorage.getItem(LEGACY_SCHEDULE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Object.keys(parsed).length > 0;
    } catch {
      return false;
    }
  });

  const supabaseConfigured = isSupabaseConfigured();

  // Carga la configuración pública del negocio desde la nube
  useEffect(() => {
    let cancelled = false;
    if (!supabaseConfigured) return;
    fetchPublicBusinessData()
      .then((data) => {
        if (cancelled || !data) return;
        setSettings((prev) => ({
          ...prev,
          businessName: data.businessName || prev.businessName,
          phone: data.phone || prev.phone,
          address: data.address || prev.address,
          webhookUrl: data.webhookUrl || prev.webhookUrl,
          webhookEnabled: data.webhookEnabled,
        }));
      })
      .catch(() => {
        /* sin conexión o tabla aún no creada */
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Migra un PIN viejo en texto plano a su hash (una sola vez)
  useEffect(() => {
    if (settings.pin && !isPinHash(settings.pin)) {
      const plain = settings.pin;
      hashPin(plain)
        .then((h) => {
          setSettings((prev) => (prev.pin === plain ? { ...prev, pin: h } : prev));
        })
        .catch(() => {
          // sin hash no se guarda nada
        });
    }
  }, [settings.pin]);

  const handleSaveSettings = async (next: BusinessSettings) => {
    setSettings(next);
    showToast('Configuración guardada');
    if (supabaseConfigured) {
      try {
        await savePublicBusinessData({
          businessName: next.businessName,
          phone: next.phone,
          address: next.address || '',
          webhookUrl: next.webhookUrl,
          webhookEnabled: next.webhookEnabled,
        });
      } catch {
        showToast('Guardado local, pero no se pudo sincronizar con Supabase', 'error');
      }
    }
  };

  const handleExport = () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agenda-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Configuración exportada');
  };

  const handleImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<{ settings: BusinessSettings }>;
      if (!parsed.settings || typeof parsed.settings !== 'object') {
        showToast('El archivo no es una configuración válida', 'error');
        return;
      }
      setSettings({
        ...settings,
        businessName: parsed.settings.businessName || settings.businessName,
        phone: parsed.settings.phone ?? settings.phone,
        address: parsed.settings.address ?? settings.address,
        webhookUrl: parsed.settings.webhookUrl ?? settings.webhookUrl,
        webhookEnabled: parsed.settings.webhookEnabled ?? settings.webhookEnabled,
      });
      showToast('Configuración importada');
    } catch {
      showToast('No se pudo leer el archivo', 'error');
    }
  };

  const handleMigrate = async () => {
    try {
      const scheduleMap = JSON.parse(localStorage.getItem(LEGACY_SCHEDULE_KEY) || '{}');
      const workingDaysMap = JSON.parse(localStorage.getItem(LEGACY_DAYS_KEY) || '{}');
      const result = await migrateLocalAgenda(scheduleMap, workingDaysMap);
      localStorage.setItem(MIGRATED_KEY, '1');
      setShowMigrate(false);
      showToast(`Migrados ${result.appointments} turnos y ${result.clients} clientes a Supabase`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo migrar la agenda', 'error');
    }
  };

  // ── VISTA PÚBLICA DEL CLIENTE ──
  if (isClientView) {
    return (
      <ClientBookingView
        businessName={settings.businessName}
        barberPhone={settings.phone}
        address={settings.address || ''}
        webhookEnabled={settings.webhookEnabled}
        webhookUrl={settings.webhookUrl}
        initialDate={initialDate}
      />
    );
  }

  // ── PROTECCIÓN CON PIN (solo vista del barbero) ──
  if (settings.pin && !pinOk) {
    return (
      <PinGate
        pin={settings.pin}
        onOk={() => {
          sessionStorage.setItem('barber_pin_ok', '1');
          setPinOk(true);
        }}
      />
    );
  }

  // ── VISTA DEL BARBERO ──
  return (
    <>
      <BarberAgendaView
        businessName={settings.businessName}
        services={settings.services}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenReports={() => setReportsOpen(true)}
      />

      {/* Banner: Supabase sin configurar */}
      {!supabaseConfigured && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-96 bg-gray-900 text-white rounded-2xl shadow-xl z-40 p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <p className="text-xs font-bold">Conectá Supabase para guardar en la nube</p>
          </div>
          <ol className="text-[11px] text-gray-300 space-y-1 list-decimal list-inside">
            <li>
              Creá el archivo <code className="font-mono bg-white/10 px-1 rounded">.env.local</code>{' '}
              con tus claves (ver{' '}
              <code className="font-mono bg-white/10 px-1 rounded">.env.example</code>)
            </li>
            <li>
              Ejecutá{' '}
              <code className="font-mono bg-white/10 px-1 rounded">supabase/schema.sql</code> en el
              SQL Editor de Supabase
            </li>
            <li>Reiniciá el servidor y listo</li>
          </ol>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-[11px] font-bold text-blue-300 hover:text-blue-200 cursor-pointer"
          >
            Más detalles en Ajustes
          </button>
        </div>
      )}

      {/* Banner: migrar agenda local */}
      {showMigrate && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:w-96 bg-white rounded-2xl shadow-xl z-40 border border-gray-200 p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-bold text-gray-900">¿Subimos tu agenda actual a la nube?</p>
          </div>
          <p className="text-[11px] text-gray-500">
            Los turnos y clientes guardados en este navegador se copiarán a Supabase (una sola vez).
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMigrate}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Migrar ahora
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(MIGRATED_KEY, '1');
                setShowMigrate(false);
              }}
              className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 cursor-pointer"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        supabaseConfigured={supabaseConfigured}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onExport={handleExport}
        onImport={handleImport}
      />
      <ReportsModal isOpen={reportsOpen} onClose={() => setReportsOpen(false)} />
    </>
  );
}

/* ── Pantalla de PIN (protección opcional de la vista del barbero) ── */
const PinGate: React.FC<{ pin: string; onOk: () => void }> = ({ pin, onOk }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockLeft, setLockLeft] = useState(() => getPinLockState().lockedSecondsLeft);
  const [failsLeft, setFailsLeft] = useState(MAX_PIN_FAILS);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const timer = setInterval(() => {
      const left = getPinLockState().lockedSecondsLeft;
      setLockLeft(left);
      if (left <= 0) {
        clearInterval(timer);
        setFailsLeft(MAX_PIN_FAILS);
        setError('');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockLeft]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || lockLeft > 0 || value.length === 0) return;
    setBusy(true);
    try {
      // Compatibilidad: un PIN viejo en texto plano se acepta una vez (luego se migra a hash)
      const ok = isPinHash(pin) ? await verifyPin(value, pin) : value === pin;
      if (ok) {
        clearPinFailures();
        onOk();
      } else {
        const result = recordPinFailure();
        setValue('');
        if (result.locked) {
          setLockLeft(result.secondsLeft);
          setError(
            `Demasiados intentos. Esperá ${formatLockCountdown(result.secondsLeft)} para reintentar.`,
          );
        } else {
          setFailsLeft(result.failsLeft);
          setError(`PIN incorrecto. Te quedan ${result.failsLeft} intentos.`);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const locked = lockLeft > 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-xs text-center anim-pop">
        <div className="w-12 h-12 rounded-xl overflow-hidden mx-auto">
          <img src="/logo.jpg" alt="Logo" className="w-12 h-12 object-cover" />
        </div>
        <h1 className="text-base font-bold text-gray-900 mt-4">Agenda protegida</h1>
        <p className="text-xs text-gray-500 mt-1 mb-5">Ingresá el PIN para ver la agenda.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus={!locked}
            disabled={locked || busy}
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            aria-label="PIN"
            placeholder={locked ? formatLockCountdown(lockLeft) : undefined}
            className="w-full text-center py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono tracking-widest disabled:opacity-50"
          />
          {error && <p className="text-xs font-bold text-red-600">{error}</p>}
          {failsLeft < MAX_PIN_FAILS && !locked && !error && (
            <p className="text-[11px] text-gray-400">Te quedan {failsLeft} intentos.</p>
          )}
          <button
            type="submit"
            disabled={value.length === 0 || locked || busy}
            className="w-full py-2.5 bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {locked ? `Bloqueado ${formatLockCountdown(lockLeft)}` : busy ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
