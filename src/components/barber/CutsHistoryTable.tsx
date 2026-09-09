import React, { useEffect, useState } from 'react';
import { HaircutRecord, ServiceItem } from '../../types';
import {
  deleteHaircut,
  isMissingTableError,
  listHaircuts,
  subscribeHaircutsChanges,
} from '../../lib/api';
import { formatDateShort } from '../../data/defaultData';
import { useToast } from '../Toast';
import { CutEditModal } from './CutEditModal';
import { ArrowLeft, Pencil, Scissors, Trash2 } from 'lucide-react';

interface CutsHistoryTableProps {
  services: ServiceItem[];
  onBack: () => void;
}

/* Solo la tabla del historial de personas atendidas.
 * Columnas en orden: Fecha | Horario | Persona | Teléfono |
 * Corte realizado | Tiempo de corte | Precio | Observaciones | Acciones.
 * El horario es fijo (lo eligió el cliente) y la edición se hace
 * en el formulario, no directo en la tabla. */
export const CutsHistoryTable: React.FC<CutsHistoryTableProps> = ({ services, onBack }) => {
  const showToast = useToast();
  const [haircuts, setHaircuts] = useState<HaircutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [editingCut, setEditingCut] = useState<HaircutRecord | null>(null);
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

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a la Agenda
      </button>

      {loading ? (
        <p className="text-xs text-gray-400 italic text-center py-8">Cargando historial…</p>
      ) : needsMigration ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          Falta actualizar la tabla <code className="font-mono font-bold">haircuts</code> en
          Supabase. Ejecutá <code className="font-mono font-bold">supabase/schema.sql</code> en el
          SQL Editor de Supabase y recargá la página.
        </div>
      ) : haircuts.length === 0 ? (
        <div className="text-center py-10 bg-white border border-gray-200 rounded-xl">
          <Scissors className="w-6 h-6 mx-auto text-gray-300" />
          <p className="text-xs font-semibold text-gray-500 mt-2">Sin personas registradas</p>
          <p className="text-[11px] text-gray-400 mt-1">
            Marcá un turno como Atendido y aparece solo en esta tabla.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[920px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-2.5 py-2.5 font-bold">Editar</th>
                  <th className="px-3.5 py-2.5 font-bold">Fecha</th>
                  <th className="px-3 py-2.5 font-bold">Horario</th>
                  <th className="px-3 py-2.5 font-bold">Persona</th>
                  <th className="px-3 py-2.5 font-bold">Teléfono</th>
                  <th className="px-3 py-2.5 font-bold">Corte realizado</th>
                  <th className="px-3 py-2.5 font-bold text-center">Tiempo de corte</th>
                  <th className="px-3 py-2.5 font-bold text-right">Precio</th>
                  <th className="px-3 py-2.5 font-bold">Observaciones</th>
                  <th className="px-3 py-2.5 font-bold text-right">Eliminar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {haircuts.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50/70">
                    <td className="px-2.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEditingCut(h)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                        title="Editar ficha"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="px-3.5 py-2.5 text-gray-500 capitalize whitespace-nowrap">
                      {formatDateShort(h.date)}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-gray-900 whitespace-nowrap">
                      {h.time ? h.time.slice(0, 5) : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">
                      {h.client_name}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {h.clients?.phone || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{h.service_name || '—'}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-gray-900 whitespace-nowrap">
                      {h.minutes !== null ? `${h.minutes} min` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">
                      {h.price || '—'}
                    </td>
                    <td
                      className="px-3 py-2.5 text-gray-600 max-w-[220px] truncate"
                      title={h.note || undefined}
                    >
                      {h.note || '—'}
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
                        title={
                          deleteArmedId === h.id ? 'Tocá de nuevo para confirmar' : 'Eliminar'
                        }
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
      )}

      <CutEditModal
        cut={editingCut}
        services={services}
        onClose={() => setEditingCut(null)}
        onSaved={reload}
      />
    </div>
  );
};
