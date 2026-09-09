import React, { useEffect, useState } from 'react';
import { BusinessSettings } from '../types';
import { getTodayDateString } from '../data/defaultData';
import { buildMapsLink, buildRulesText } from '../lib/api';
import { hashPin, verifyPin } from '../lib/pin';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { Copy, Download, Lock, MapPin, MessageCircle, Save, Store, Upload, Zap } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  settings: BusinessSettings;
  supabaseConfigured: boolean;
  onClose: () => void;
  onSave: (settings: BusinessSettings) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  supabaseConfigured,
  onClose,
  onSave,
  onExport,
  onImport,
}) => {
  const showToast = useToast();
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBusinessName(settings.businessName);
      setPhone(settings.phone);
      setAddress(settings.address || '');
      setPin('');
      setCurrentPin('');
      setRemovePin(false);
      setSavingPin(false);
      setError('');
    }
  }, [isOpen, settings]);

  const handleSave = async () => {
    if (!businessName.trim()) {
      setError('Ingresá el nombre de la barbería.');
      return;
    }
    // ── PIN: se guarda hasheado; para cambiarlo o quitarlo hay que saber el actual ──
    const storedPin = settings.pin || '';
    let pinToSave = storedPin;
    if (storedPin) {
      if (removePin) {
        if (!currentPin) {
          setError('Para quitar el PIN ingresá el PIN actual.');
          return;
        }
        if (!(await verifyPin(currentPin, storedPin))) {
          setError('El PIN actual no coincide.');
          return;
        }
        pinToSave = '';
      } else if (pin.trim()) {
        if (!/^\d{4,6}$/.test(pin.trim())) {
          setError('El nuevo PIN debe tener de 4 a 6 dígitos.');
          return;
        }
        if (!currentPin) {
          setError('Para cambiar el PIN ingresá el PIN actual.');
          return;
        }
        if (!(await verifyPin(currentPin, storedPin))) {
          setError('El PIN actual no coincide.');
          return;
        }
        setSavingPin(true);
        try {
          pinToSave = await hashPin(pin.trim());
        } finally {
          setSavingPin(false);
        }
      }
    } else if (pin.trim()) {
      if (!/^\d{4,6}$/.test(pin.trim())) {
        setError('El PIN debe tener de 4 a 6 dígitos.');
        return;
      }
      setSavingPin(true);
      try {
        pinToSave = await hashPin(pin.trim());
      } finally {
        setSavingPin(false);
      }
    }
    onSave({
      ...settings,
      businessName: businessName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      pin: pinToSave,
    });
    onClose();
  };

  const handleCopyRules = async () => {
    try {
      await navigator.clipboard.writeText(buildRulesText(businessName.trim() || 'la barbería'));
      showToast('Mensaje copiado — pegálo en tu grupo de WhatsApp');
    } catch {
      showToast('No se pudo copiar el mensaje', 'error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajustes"
      maxWidth="max-w-lg"
      headerClassName="bg-gray-50/60"
    >
      <div className="p-6 space-y-6">
        {!supabaseConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
            ⚠️ Supabase no está conectado. La agenda no se guarda en la nube todavía — seguí los
            pasos del <span className="font-bold">README.md</span> para conectarla.
          </div>
        )}

        {error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* ── Negocio ── */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5" /> Negocio
          </h3>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Nombre de la barbería
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej. THE BEST BARBERSHOP"
              className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Tu WhatsApp{' '}
              <span className="text-gray-400 font-normal lowercase">
                (con código de país, ej: +525512345678)
              </span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: +525512345678"
              className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              El cliente usa este número para reservar y vos recibís el aviso de cada cita.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Dirección de la barbería{' '}
              <span className="text-gray-400 font-normal lowercase">
                (para el botón de GPS del cliente)
              </span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Av. Siempre Viva 123, o pegá el link de Google Maps"
              className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Podés escribir la dirección o pegar el link de tu ubicación (como los de
              maps.app.goo.gl). El cliente lo abre con el botón de GPS.
            </p>
            {address.trim() && (
              <div className="mt-2 space-y-2">
                {/^https?:\/\//i.test(address.trim()) ? (
                  <a
                    href={address.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Probar ubicación en Google Maps
                  </a>
                ) : (
                  <>
                    <iframe
                      title="Vista previa de la ubicación"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed`}
                      className="w-full h-48 rounded-xl border border-gray-200"
                      loading="lazy"
                    />
                    <a
                      href={buildMapsLink(address, businessName.trim() || 'barbería')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Abrir en Google Maps
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Mensaje de reglas para WhatsApp ── */}
        <section className="space-y-3 pt-4 border-t border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" /> Mensaje de reglas para WhatsApp
          </h3>
          <p className="text-[11px] text-gray-500">
            Copiá este mensaje y mandalo a tu grupo de WhatsApp para que los clientes sepan cómo
            reservar y las reglas (editar/cancelar 2 h antes).
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-mono text-[11px] text-gray-600 whitespace-pre-wrap max-h-44 overflow-y-auto">
            {buildRulesText(businessName.trim() || 'la barbería')}
          </div>
          <button
            type="button"
            onClick={handleCopyRules}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar mensaje
          </button>
        </section>

        {/* ── Protección ── */}
        <section className="space-y-3 pt-4 border-t border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Protección de la vista del barbero (opcional)
          </h3>
          <p className="text-[11px] text-gray-500">
            Estado:{' '}
            <span className="font-bold text-gray-700">
              {settings.pin ? 'PIN configurado' : 'Sin PIN (acceso libre)'}
            </span>
          </p>
          {settings.pin && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                PIN actual
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Necesario para cambiar o quitar"
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              {settings.pin ? 'Nuevo PIN de 4 a 6 dígitos' : 'PIN de 4 a 6 dígitos'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={settings.pin ? 'Vacío = no cambiar' : 'Sin PIN = acceso libre'}
              className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Se guarda cifrado (hash) y tras 5 intentos fallidos se bloquea 3 minutos. El link
              de clientes NO pide PIN.
            </p>
          </div>
          {settings.pin && (
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={removePin}
                onChange={(e) => setRemovePin(e.target.checked)}
                className="w-4 h-4 accent-red-600"
              />
              Quitar el PIN (pide el PIN actual al guardar)
            </label>
          )}
        </section>

        {/* ── Respaldo ── */}
        <section className="space-y-3 pt-4 border-t border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Copia de seguridad local
          </h3>
          <p className="text-[11px] text-gray-500">
            Exportá la configuración del negocio como respaldo. La agenda vive en Supabase; si
            cambiás de navegador, la nube la conserva.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar ({getTodayDateString()})
            </button>
            <label className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-gray-500" />
              Importar
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </section>

        {/* ── Supabase ── */}
        <section className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              Supabase
            </span>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                supabaseConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}
            >
              {supabaseConfigured ? 'Conectado' : 'Sin configurar'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Configurá <code className="font-mono bg-gray-100 px-1 rounded">.env.local</code> con
            VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY y ejecutá{' '}
            <code className="font-mono bg-gray-100 px-1 rounded">supabase/schema.sql</code> en el
            SQL Editor.
          </p>
        </section>
      </div>

      <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          Cancelar
        </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={savingPin}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {savingPin ? 'Guardando…' : 'Guardar'}
          </button>
      </div>
    </Modal>
  );
};
