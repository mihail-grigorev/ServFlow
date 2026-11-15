import React, { useState } from 'react';
import { SparePart } from '../types';
import { Package, Truck, Search, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

interface SparePartsInventoryViewProps {
  partsList: SparePart[];
}

export const SparePartsInventoryView: React.FC<SparePartsInventoryViewProps> = ({ partsList }) => {
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = partsList.filter((p) => {
    if (modelFilter !== 'all' && !p.compatible_models.includes(modelFilter)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    }
    return true;
  });

  const totalMoscowFree = partsList.reduce((acc, p) => acc + p.moscow_free, 0);
  const totalTulaFree = partsList.reduce((acc, p) => acc + p.tula_free, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 text-[#F0F5F2]">
      {/* Top Header Card */}
      <div className="bg-[#16171B] p-5 rounded-2xl border border-white/[0.08] shadow-apple flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Складской учёт и резерв запчастей
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                  {partsList.length} номенклатурных позиций
                </span>
              </div>
              <p className="text-xs text-[#8E9E94] mt-0.5">
                Остатки на складах Москвы и Тулы, распределение резерва и логистические перемещения (П-7, П-8)
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stock Summary Pills */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.06] text-center">
            <div className="text-[10px] text-[#8E9E94] uppercase font-semibold">Москва свободно</div>
            <div className="text-sm font-bold text-white">{totalMoscowFree} шт.</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.06] text-center">
            <div className="text-[10px] text-[#8E9E94] uppercase font-semibold">Тула свободно</div>
            <div className="text-sm font-bold text-white">{totalTulaFree} шт.</div>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8E9E94] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Поиск детали по артикулу или названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white placeholder-[#8E9E94] outline-none focus:border-white/20 transition-all"
          />
        </div>

        {/* Compatible Model Tabs */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/[0.06] text-xs self-start sm:self-auto">
          {['all', 'C100', 'C200', 'C300'].map((m) => (
            <button
              key={m}
              onClick={() => setModelFilter(m)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                modelFilter === m
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-[#8E9E94] hover:text-white'
              }`}
            >
              {m === 'all' ? 'Все модели' : `Модель ${m}`}
            </button>
          ))}
        </div>
      </div>

      {/* Parts Table */}
      <div className="bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/30 text-[#8E9E94] font-semibold uppercase tracking-wider border-b border-white/[0.06]">
              <tr>
                <th className="py-3 px-4">Артикул</th>
                <th className="py-3 px-4">Наименование запчасти</th>
                <th className="py-3 px-4">Совместимость (П-7)</th>
                <th className="py-3 px-4 text-center">Москва: Склад / Резерв</th>
                <th className="py-3 px-4 text-center">Москва: Доступно</th>
                <th className="py-3 px-4 text-center">Тула: Склад / Резерв</th>
                <th className="py-3 px-4 text-center">Тула: Доступно</th>
                <th className="py-3 px-4">Логистика (П-8)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.map((p) => {
                const canTransferToMoscow = p.moscow_free === 0 && p.tula_free > 0;
                const canTransferToTula = p.tula_free === 0 && p.moscow_free > 0;

                return (
                  <tr key={p.code} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {p.code}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex space-x-1.5">
                        {p.compatible_models.map((m) => (
                          <span
                            key={m}
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/[0.08] text-[#F0F5F2]"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Moscow numbers */}
                    <td className="py-3.5 px-4 text-center text-[#8E9E94]">
                      <span className="font-medium text-white">{p.moscow_stock}</span>{' '}
                      <span className="opacity-60">/ {p.moscow_reserved}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                          p.moscow_free > 0
                            ? 'bg-white/15 text-white border border-white/20'
                            : 'bg-[#FF453A]/15 text-[#FF453A]'
                        }`}
                      >
                        {p.moscow_free} шт.
                      </span>
                    </td>

                    {/* Tula numbers */}
                    <td className="py-3.5 px-4 text-center text-[#8E9E94]">
                      <span className="font-medium text-white">{p.tula_stock}</span>{' '}
                      <span className="opacity-60">/ {p.tula_reserved}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                          p.tula_free > 0
                            ? 'bg-white/15 text-white border border-white/20'
                            : 'bg-[#FF453A]/15 text-[#FF453A]'
                        }`}
                      >
                        {p.tula_free} шт.
                      </span>
                    </td>

                    {/* Logistics rule П-8 */}
                    <td className="py-3.5 px-4">
                      {canTransferToMoscow ? (
                        <span className="flex items-center space-x-1 text-[#FF9F0A] font-medium text-[11px]">
                          <Truck className="w-3.5 h-3.5" />
                          <span>Тула → Москва (+1 день)</span>
                        </span>
                      ) : canTransferToTula ? (
                        <span className="flex items-center space-x-1 text-[#FF9F0A] font-medium text-[11px]">
                          <Truck className="w-3.5 h-3.5" />
                          <span>Москва → Тула (+1 день)</span>
                        </span>
                      ) : (
                        <span className="text-[#8E9E94] text-[11px] flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
                          <span>В наличии на месте</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8E9E94] text-xs">
                    По вашему запросу деталей на складе не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
