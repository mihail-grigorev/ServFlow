import React, { useState } from 'react';
import { Equipment } from '../types';
import { Layers, MapPin, Search, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

interface EquipmentRegistryViewProps {
  equipmentList: Equipment[];
  onSelectForOrder?: (eq: Equipment) => void;
}

export const EquipmentRegistryView: React.FC<EquipmentRegistryViewProps> = ({
  equipmentList,
  onSelectForOrder,
}) => {
  const [cityFilter, setCityFilter] = useState<'all' | 'Москва' | 'Тула'>('all');
  const [search, setSearch] = useState('');

  const filtered = equipmentList.filter((eq) => {
    if (cityFilter !== 'all' && eq.city !== cityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        eq.code.toLowerCase().includes(q) ||
        eq.client_name.toLowerCase().includes(q) ||
        eq.address.toLowerCase().includes(q) ||
        eq.serial_number.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
              Реестр установленного оборудования
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#3D5643]/10 text-[#3D5643]">
              12 кофемашин
            </span>
          </div>
          <p className="text-xs text-[#86868B] mt-0.5">
            Установленные машины по договорам сервисного обслуживания (Москва · Тула)
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Поиск по клиенту или сер. №..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-black/[0.1] bg-white outline-none focus:border-[#3D5643]"
            />
          </div>

          <div className="flex bg-black/[0.04] p-1 rounded-xl text-xs">
            {['all', 'Москва', 'Тула'].map((c) => (
              <button
                key={c}
                onClick={() => setCityFilter(c as any)}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  cityFilter === c ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B]'
                }`}
              >
                {c === 'all' ? 'Все города' : c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Equipment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((eq) => {
          return (
            <div
              key={eq.code}
              className="bg-white rounded-2xl border border-black/[0.08] shadow-apple p-5 flex flex-col justify-between space-y-4 hover:shadow-apple-hover transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#3D5643]/10 text-[#3D5643]">
                    {eq.code}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/[0.05] text-[#1D1D1F]">
                    {eq.city}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-[#1D1D1F] mb-1">
                  {eq.client_name}
                </h3>

                <div className="text-xs text-[#86868B] flex items-center space-x-1 mb-3">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{eq.address}</span>
                </div>

                <div className="p-3 rounded-xl bg-[#F0F5F2] text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#86868B]">Модель:</span>
                    <span className="font-bold text-[#1D1D1F]">{eq.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868B]">Серийный номер:</span>
                    <span className="font-mono font-medium">{eq.serial_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868B]">Дата установки:</span>
                    <span>{new Date(eq.installation_date).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>

                {eq.last_visit_date && (
                  <div className="mt-3 text-[11px] text-[#86868B] space-y-0.5">
                    <div className="font-medium text-[#1D1D1F]">
                      Последний визит ({new Date(eq.last_visit_date).toLocaleDateString('ru-RU')}):
                    </div>
                    <div className="line-clamp-2 leading-relaxed">
                      {eq.last_visit_result}
                    </div>
                  </div>
                )}
              </div>

              {onSelectForOrder && (
                <button
                  onClick={() => onSelectForOrder(eq)}
                  className="w-full py-2 rounded-xl border border-[#3D5643] text-[#3D5643] hover:bg-[#3D5643] hover:text-white text-xs font-medium transition-all"
                >
                  Оформить выезд на эту машину
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

