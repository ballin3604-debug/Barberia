import React, { useEffect, useState } from 'react';
import { BusinessSettings } from '../types';
import { getTodayDateString } from '../data/defaultData';
import { Modal } from './Modal';
import { Download, MessageCircle, Save, Store, Upload, Zap } from 'lucide-react';

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
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBusinessName(settings.businessName);
      setPhone(settings.phone);
      setWebhookUrl(settings.webhookUrl);
      setWebhookEnabled(settings.webhookEnabled);
      setError('');
    }
  }, [isOpen, settings]);

  const handleSave = () => {
    if (!businessName.trim()) {
      setError('Ingresá el nombre de la barbería.');
      return;
    }
    onSave({
      ...settings,
      businessName: businessName.trim(),
      phone: phone.trim(),
      webhookUrl: webhookUrl.trim(),
      webhookEnabled,
    });
    onClose();
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
              placeholder="Ej. Barbería El Maestro"
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
        </section>

        {/* ── Notificaciones WhatsApp ── */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" /> Notificaciones por WhatsApp (Pabbly)
          </h3>
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5">
            <span className="text-xs font-bold text-gray-700">
              Enviar aviso automático de cada cita
            </span>
            <button
              type="button"
              onClick={() => setWebhookEnabled(!webhookEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                webhookEnabled ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={webhookEnabled}
              aria-label="Activar notificaciones automáticas"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  webhookEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              URL del webhook (Pabbly Connect)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://connect.pabbly.com/workflow/sendwebhookdata/..."
              className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-xs"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Se envía un POST con la cita (cliente, fecha, hora y referencia) al workflow de
              Pabbly. Si queda apagado, se abre WhatsApp con el mensaje listo.
            </p>
          </div>
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
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Guardar
        </button>
      </div>
    </Modal>
  );
};
