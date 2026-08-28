import React, { useEffect, useState } from 'react';
import { AppointmentRecord, ClientRecord } from '../../types';
import { daysSince, getClientHistory, searchClients } from '../../lib/api';
import { formatDateShort } from '../../data/defaultData';
import { Modal } from '../Modal';
import { Link2, Phone, Search, User } from 'lucide-react';

interface ClientsPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClientsPanelModal: React.FC<ClientsPanelModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selected, setSelected] = useState<ClientRecord | null>(null);
  const [history, setHistory] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    searchClients(query)
      .then((rows) => !cancelled && setClients(rows))
      .catch(() => !cancelled && setClients([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, query]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    getClientHistory(selected.id)
      .then((rows) => !cancelled && setHistory(rows))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setSelected(null);
        onClose();
      }}
      title="Clientes"
      maxWidth="max-w-md"
      headerClassName="bg-gray-50/60"
    >
      <div className="p-5 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            aria-label="Buscar cliente"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 italic text-center py-6">Buscando…</p>
        ) : selected ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[11px] font-bold text-gray-500 hover:text-gray-800 cursor-pointer"
            >
              ← Volver a la lista
            </button>
            <div className="bg-gray-900 text-white rounded-xl px-4 py-3.5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{selected.full_name}</p>
                <p className="text-xs text-gray-300 truncate">
                  {selected.phone ? <Phone className="inline w-3 h-3 mr-1" /> : null}
                  {selected.phone || 'Sin teléfono'}
                </p>
              </div>
              {selected.last_visit && (
                <span className="shrink-0 text-[10px] font-bold bg-white/15 rounded-full px-2.5 py-1">
                  Último corte: hace {daysSince(selected.last_visit)} días
                </span>
              )}
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {history.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">
                  Sin citas registradas todavía.
                </p>
              )}
              {history.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-gray-50/80 border border-gray-200/70 rounded-lg px-3 py-2"
                >
                  <span className="text-xs font-semibold text-gray-700 capitalize">
                    {formatDateShort(a.date)} · <span className="font-mono">{a.time}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {a.reference_image_url && <span title="Foto de referencia">🖼</span>}
                    {a.reference_url && <Link2 className="w-3 h-3 text-blue-500" />}
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        a.status === 'attended'
                          ? 'bg-blue-100 text-blue-700'
                          : a.status === 'cancelled'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {a.status === 'attended'
                        ? 'Atendido'
                        : a.status === 'cancelled'
                          ? 'Cancelado'
                          : 'Confirmado'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : clients.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-6">
            No se encontraron clientes.
          </p>
        ) : (
          <div className="space-y-1.5">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className="w-full flex items-center gap-3 bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-3.5 py-2.5 text-left transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800 truncate">{c.full_name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{c.phone || 'Sin teléfono'}</p>
                </div>
                {c.last_visit && (
                  <span className="shrink-0 text-[10px] font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                    hace {daysSince(c.last_visit)} d
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
