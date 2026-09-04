import React, { useEffect, useState } from 'react';
import { HaircutRecord, ServiceItem } from '../../types';
import {
  deleteHaircut,
  isMissingTableError,
  listHaircuts,
  subscribeHaircutsChanges,
  updateHaircut,
} from '../../lib/api';
import { formatDateShort } from '../../data/defaultData';
import { useToast } from '../Toast';
import { Check, Pencil, Scissors, Trash2, X } from 'lucide-react';

interface CutsHistoryTableProps {
  services: ServiceItem[];
}

/* Solo la tabla del historial de personas atendidas, sin nada más. */
export const CutsHistoryTable: React.FC<CutsHistoryTableProps> = ({ services }) => {
  const showToast = useToast();
  const [haircuts, setHaircuts] = useState<HaircutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);

  // Edición inline y borrado
  const [editingMinutesId, setEditingMinutesId] = useState<string | null>(null);
  const [minutesDraft, setMinutesDraft] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceDraft, setServiceDraft] = useState('');
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await listHaircuts();
      setHaircuts(rows);
      setNeedsMigration(false);
    } catch (e) {
      if (isMissingTableError(e)) {
        setNeedsMigration(true);
      } else {
        showToast(e instanceof Error ? e.message : 'No se pudo cargar el historial', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    const unsubscribe = subscribeHaircutsChanges(() => {
      reload();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveMinutes = async (id: string) => {
    const n = Number(minutesDraft);
    if (!Number.isFinite(n) || n < 1) {
      showToast('Escribí cuántos minutos tardó (mínimo 1).', 'error');
      return;
    }
    try {
      await updateHaircut(id, { minutes: Math.floor(n) });
      setEditingMinutesId(null);
      showToast('Minutos actualizados');
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    }
  };

  const handleSaveService = async (id: string) => {
    if (!serviceDraft.trim()) {
      showToast('El corte realizado no puede quedar vacío.', 'error');
      return;
    }
    try {
      await updateHaircut(id, { serviceName: serviceDraft.trim() });
      setEditingServiceId(null);
      showToast('Corte actualizado');
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteArmedId !== id) {
      setDeleteArmedId(id);
      return;
    }
    try {
      await deleteHaircut(id);
      setDeleteArmedId(null);
      showToast('Registro eliminado');
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo eliminar', 'error');
    }
  };

  if (loading) {
    return (
      <p className="text-xs text-gray-400 italic text-center py-8">Cargando historial…</p>
    );
  }

  if (needsMigration) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        Falta crear la tabla <code className="font-mono font-bold">haircuts</code> en Supabase.
        Ejecutá <code className="font-mono font-bold">supabase/schema.sql</code> en el SQL Editor
        de Supabase y recargá la página.
      </div>
    );
  }

  if (haircuts.length === 0) {
    return (
      <div className="text-center py-10 bg-white border border-gray-200 rounded-xl">
        <Scissors className="w-6 h-6 mx-auto text-gray-300" />
        <p className="text-xs font-semibold text-gray-500 mt-2">Sin personas registradas</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead className="bg-gray-50">
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
              <th className="px-3.5 py-2.5 font-bold">Fecha</th>
              <th className="px-3 py-2.5 font-bold">Persona</th>
              <th className="px-3 py-2.5 font-bold">Teléfono</th>
              <th className="px-3 py-2.5 font-bold">Corte realizado</th>
              <th className="px-3 py-2.5 font-bold text-center">Tardó</th>
              <th className="px-3 py-2.5 font-bold text-right">Precio</th>
              <th className="px-3 py-2.5 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {haircuts.map((h) => (
              <tr key={h.id} className="hover:bg-gray-50/70">
                <td className="px-3.5 py-2.5 text-gray-500 capitalize whitespace-nowrap">
                  {formatDateShort(h.date)}
                </td>
                <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">
                  {h.client_name}
                </td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                  {h.clients?.phone || '—'}
                </td>
                <td className="px-3 py-2.5 text-gray-700">
                  {editingServiceId === h.id ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        autoFocus
                        value={serviceDraft}
                        onChange={(e) => setServiceDraft(e.target.value)}
                        list="cuts-services-list"
                        className="w-36 px-1.5 py-1 text-xs bg-white border border-blue-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                      <datalist id="cuts-services-list">
                        {services.map((s) => (
                          <option key={s.id} value={s.name} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() => handleSaveService(h.id)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer"
                        title="Guardar corte"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingServiceId(null)}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded-md cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingServiceId(h.id);
                        setServiceDraft(h.service_name);
                      }}
                      className="inline-flex items-center gap-1 hover:text-blue-700 cursor-pointer text-left"
                      title="Editar corte realizado"
                    >
                      {h.service_name}
                      <Pencil className="w-3 h-3 text-gray-400 shrink-0" />
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  {editingMinutesId === h.id ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={480}
                        autoFocus
                        value={minutesDraft}
                        onChange={(e) => setMinutesDraft(e.target.value)}
                        className="w-16 px-1.5 py-1 text-xs text-center bg-white border border-blue-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveMinutes(h.id)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer"
                        title="Guardar minutos"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMinutesId(null)}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded-md cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ) : h.minutes !== null ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMinutesId(h.id);
                        setMinutesDraft(String(h.minutes));
                      }}
                      className="inline-flex items-center gap-1 font-bold text-gray-900 hover:text-blue-700 cursor-pointer"
                      title="Editar minutos"
                    >
                      {h.minutes} min
                      <Pencil className="w-3 h-3 text-gray-400" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMinutesId(h.id);
                        setMinutesDraft('');
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 border border-dashed border-blue-300 hover:border-blue-500 rounded-lg px-2 py-0.5 cursor-pointer"
                      title="Cargar cuántos minutos tardó"
                    >
                      + min
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">
                  {h.price || '—'}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(h.id)}
                    className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                      deleteArmedId === h.id
                        ? 'bg-red-600 text-white text-[10px] font-bold px-2.5'
                        : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                    }`}
                    title={deleteArmedId === h.id ? 'Tocá de nuevo para confirmar' : 'Eliminar'}
                  >
                    {deleteArmedId === h.id ? (
                      '¿Eliminar?'
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
