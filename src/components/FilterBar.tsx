import React from 'react';
import { Search, Filter, LayoutGrid, List } from 'lucide-react';

export type FilterType = 'all' | 'available' | 'booked' | 'break';
export type ViewMode = 'columns' | 'single-list';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  availableCount: number;
  bookedCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  availableCount,
  bookedCount,
}) => {
  return (
    <div className="bg-white px-6 py-3 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
      {/* Search Input */}
      <div className="relative w-full sm:w-72">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre o servicio..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
        <span className="text-gray-400 mr-1 hidden md:flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Filtrar:
        </span>

        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            activeFilter === 'all'
              ? 'bg-gray-900 text-white font-semibold shadow-2xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Todos
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('booked')}
          className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
            activeFilter === 'booked'
              ? 'bg-gray-900 text-white font-semibold shadow-2xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>Agendados</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeFilter === 'booked' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {bookedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('available')}
          className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
            activeFilter === 'available'
              ? 'bg-blue-600 text-white font-semibold shadow-2xs'
              : 'text-blue-700 hover:bg-blue-50'
          }`}
        >
          <span>Espacios Libres</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeFilter === 'available' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-800'
          }`}>
            {availableCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('break')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            activeFilter === 'break'
              ? 'bg-amber-600 text-white font-semibold shadow-2xs'
              : 'text-amber-700 hover:bg-amber-50'
          }`}
        >
          Descansos
        </button>
      </div>

      {/* View Toggle */}
      <div className="hidden lg:flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
        <button
          type="button"
          onClick={() => onViewModeChange('columns')}
          className={`p-1 rounded flex items-center gap-1 text-[11px] font-medium transition-all ${
            viewMode === 'columns'
              ? 'bg-white shadow-2xs text-gray-900'
              : 'text-gray-500 hover:text-gray-900'
          }`}
          title="Vista 2 Columnas (Mañana y Tarde)"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Mañana / Tarde</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('single-list')}
          className={`p-1 rounded flex items-center gap-1 text-[11px] font-medium transition-all ${
            viewMode === 'single-list'
              ? 'bg-white shadow-2xs text-gray-900'
              : 'text-gray-500 hover:text-gray-900'
          }`}
          title="Vista Lista Continua"
        >
          <List className="w-3.5 h-3.5" />
          <span>Lista corrida</span>
        </button>
      </div>
    </div>
  );
};
