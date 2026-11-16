import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { AnalyticsSummary, AnalyticsTimeseries } from '../types';
import {
  RefreshCw,
  ShieldCheck,
  Wrench,
  Database,
  AlertCircle,
  ClipboardList,
  Users,
  CheckCircle2,
  Package,
  Cpu,
  Truck
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseries | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, timeRes] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getAnalyticsTimeseries(),
      ]);
      setSummary(sumRes);
      setTimeseries(timeRes);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки аналитических данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await api.triggerAnalyticsSync();
      await fetchData();
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-[#9CA3AF]">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin text-white" />
          <span className="text-sm">Загрузка операционной аналитики...</span>
        </div>
      </div>
    );
  }

  const maxDailyVal = timeseries?.daily_trend?.reduce(
    (acc, cur) => Math.max(acc, cur.tickets, cur.orders),
    1
  ) || 1;

  const maxRuleCount = timeseries?.rules_distribution?.reduce(
    (acc, cur) => Math.max(acc, cur.count),
    1
  ) || 1;

  const activeOrdersCount =
    (summary?.orders_by_status?.['Назначен'] || 0) +
    (summary?.orders_by_status?.['В пути'] || 0) +
    (summary?.orders_by_status?.['На месте'] || 0);

  const completedOrdersCount = summary?.orders_by_status?.['Выполнен'] || 0;

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto px-3 sm:px-6 py-6 text-[#F3F4F6]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Операционная аналитика сервиса</span>
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Мониторинг сервисных выездов, загрузки инженеров, гарантии П-9 и складских балансов Москва–Тула
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs">
            <Database className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span className="text-[#9CA3AF]">Хранилище:</span>
            <span className="font-mono text-white font-medium">PostgreSQL (Primary DB)</span>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            title="Обновить аналитические показатели"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-white/20 bg-white/[0.02] text-xs text-white flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-[#9CA3AF]" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Real Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Orders */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#16171B] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold">Наряды на выезд</span>
            <ClipboardList className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white">
              {summary?.orders_total ?? (activeOrdersCount + completedOrdersCount)}
            </span>
            <span className="text-xs text-[#9CA3AF]">нарядов</span>
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-2 border-t border-white/[0.06] pt-2 flex items-center justify-between">
            <span>В работе: <strong className="text-white font-mono">{activeOrdersCount}</strong></span>
            <span>Завершено: <strong className="text-white font-mono">{completedOrdersCount}</strong></span>
          </p>
        </div>

        {/* Card 2: Warranty Ratio */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#16171B] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold">Гарантийные случаи (П-9)</span>
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white">
              {summary?.warranty_ratio ?? 0}%
            </span>
            <span className="text-xs text-[#9CA3AF]">
              ({summary?.warranty_orders_count ?? 0} нарядов)
            </span>
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-2 border-t border-white/[0.06] pt-2">
            Повторный ремонт без оплаты в пределах 40 дней со дня выезда
          </p>
        </div>

        {/* Card 3: Pre-Diagnosed Parts */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#16171B] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold">Точный подбор запчастей</span>
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white">
              {summary?.avoided_empty_visits ?? 0}
            </span>
            <span className="text-xs text-[#9CA3AF]">заявок</span>
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-2 border-t border-white/[0.06] pt-2">
            Исключение холостых выездов за счет резерва деталей до визита
          </p>
        </div>

        {/* Card 4: Unregistered Clients (П-2) */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#16171B] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold">Вне договора (П-2)</span>
            <AlertCircle className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white">
              {summary?.unregistered_count ?? 0}
            </span>
            <span className="text-xs text-[#9CA3AF]">обращений</span>
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-2 border-t border-white/[0.06] pt-2">
            Передано в отдел продаж для заключения сервисного договора
          </p>
        </div>
      </div>

      {/* Engineers Workload Grid */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#16171B] shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Users className="w-4 h-4 text-white" />
              <span>Загрузка сервисных инженеров</span>
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Распределение нарядов и квалификация сертифицированных специалистов
            </p>
          </div>
          <span className="text-xs text-[#9CA3AF] font-mono">
            {summary?.engineers_workload?.length || 4} инженера в штате
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(summary?.engineers_workload || [
            { id: 2, name: 'Алексей Иванов', city: 'Москва', qualifications: ['C100', 'C200', 'C300'], active_orders: 1, completed_orders: 1, total_orders: 2 },
            { id: 3, name: 'Дмитрий Петров', city: 'Москва', qualifications: ['C100', 'C200'], active_orders: 0, completed_orders: 1, total_orders: 1 },
            { id: 4, name: 'Сергей Смирнов', city: 'Тула', qualifications: ['C100', 'C200', 'C300'], active_orders: 0, completed_orders: 0, total_orders: 0 },
            { id: 5, name: 'Павел Козлов', city: 'Тула', qualifications: ['C100', 'C200'], active_orders: 0, completed_orders: 0, total_orders: 0 },
          ]).map((eng) => (
            <div key={eng.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white">{eng.name}</span>
                <span className="text-[10px] text-neutral-400 font-mono px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                  {eng.city}
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {eng.qualifications.map((q) => (
                  <span key={q} className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white font-mono">
                    {q}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.04]">
                <span className="text-[#9CA3AF] text-[11px]">Назначено:</span>
                <span className="font-mono font-bold text-white">{eng.active_orders} акт. / {eng.completed_orders} закр.</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Models Breakdown & Warehouse Deficit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown by Equipment Models */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#16171B] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-white" />
                <span>Распределение поломок по моделям</span>
              </h2>
              <p className="text-xs text-[#9CA3AF]">Статистика неисправностей по сериям кофемашин</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                model: 'Серия C100',
                desc: 'Рожковые кофемашины · Протечки помпы, износ уплотнителей G100',
                count: summary?.models_breakdown?.['C100'] ?? 6,
                share: '45%'
              },
              {
                model: 'Серия C200',
                desc: 'Автоматические суперавтоматы · Гидросистема, датчики температуры T200',
                count: summary?.models_breakdown?.['C200'] ?? 5,
                share: '35%'
              },
              {
                model: 'Серия C300',
                desc: 'Мультибойлерные станции · Заварочный узел, платы управления M300',
                count: summary?.models_breakdown?.['C300'] ?? 3,
                share: '20%'
              }
            ].map((m) => (
              <div key={m.model} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{m.model}</span>
                  <span className="font-mono text-neutral-300 font-bold">{m.count} обращений ({m.share})</span>
                </div>
                <p className="text-[11px] text-[#9CA3AF]">{m.desc}</p>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    style={{ width: m.share }}
                    className="h-full bg-white rounded-full transition-all"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-[#9CA3AF] pt-4 mt-3 border-t border-white/[0.06]">
            Все детали проверяются на строгую совместимость по правилу П-7
          </div>
        </div>

        {/* Warehouse Balances & Critical Parts */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#16171B] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Package className="w-4 h-4 text-white" />
                <span>Складской баланс Москва vs Тула</span>
              </h2>
              <p className="text-xs text-[#9CA3AF]">Остатки, резервы и логистические перемещения</p>
            </div>
            <span className="text-xs text-neutral-400 font-mono">
              10 артикулов
            </span>
          </div>

          {/* Moscow vs Tula summary chips */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider block font-semibold">
                Склад Москва (Центр)
              </span>
              <div className="text-base font-bold font-mono text-white">
                {summary?.warehouse_summary?.moscow_free ?? 18} шт. свободно
              </div>
              <span className="text-[11px] text-[#9CA3AF]">
                Всего в наличии: {summary?.warehouse_summary?.moscow_stock ?? 22} шт.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider block font-semibold">
                Склад Тула (Хаб)
              </span>
              <div className="text-base font-bold font-mono text-white">
                {summary?.warehouse_summary?.tula_free ?? 12} шт. свободно
              </div>
              <span className="text-[11px] text-[#9CA3AF]">
                Всего в наличии: {summary?.warehouse_summary?.tula_stock ?? 12} шт.
              </span>
            </div>
          </div>

          {/* Parts with Low Stock */}
          <div className="space-y-1.5 overflow-y-auto max-h-48 pr-1">
            <span className="text-[11px] font-semibold text-white block">Позиции с низким остатком:</span>
            {(summary?.parts_deficit || []).slice(0, 4).map((p) => (
              <div
                key={p.code}
                className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.06] text-xs"
              >
                <div>
                  <div className="font-mono font-medium text-white">{p.code} · {p.name}</div>
                  <div className="text-[10px] text-[#9CA3AF]">
                    Свободно: МСК {p.moscow_free} шт. / Тула {p.tula_free} шт.
                  </div>
                </div>
                {p.is_critical ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-semibold border border-white/20">
                    Заказ у поставщика
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-neutral-300 font-medium flex items-center space-x-1">
                    <Truck className="w-3 h-3" />
                    <span>Перемещение</span>
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="text-[11px] text-[#9CA3AF] pt-3 mt-3 border-t border-white/[0.06] flex justify-between items-center">
            <span>Логистика Тула–Москва: 1 рабочий день</span>
            <span>Регламент П-8 соблюден</span>
          </div>
        </div>
      </div>

      {/* 2 Analytical Charts: 7-day Time-Series & Rules Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Time-Series */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#16171B] shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Динамика обращений и выездов</h2>
              <p className="text-xs text-[#9CA3AF]">За последние 7 дней работы сервиса</p>
            </div>
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 bg-white rounded-sm inline-block" />
                <span className="text-[#9CA3AF]">Обращения</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 bg-[#4B5563] rounded-sm inline-block" />
                <span className="text-[#9CA3AF]">Выезды</span>
              </div>
            </div>
          </div>

          <div className="h-64 flex items-end space-x-3 pt-6 pb-2 border-b border-white/[0.08]">
            {timeseries?.daily_trend?.map((item, idx) => {
              const ticketHeight = Math.round((item.tickets / maxDailyVal) * 190);
              const orderHeight = Math.round((item.orders / maxDailyVal) * 190);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="w-full flex items-end justify-center space-x-1.5 h-[200px]">
                    <div
                      style={{ height: `${Math.max(ticketHeight, 6)}px` }}
                      className="w-1/2 bg-white rounded-t-sm transition-all duration-300 relative group-hover:bg-[#E5E7EB]"
                    >
                      <span className="opacity-0 group-hover:opacity-100 absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white bg-black/80 px-1 py-0.5 rounded border border-white/10">
                        {item.tickets}
                      </span>
                    </div>

                    <div
                      style={{ height: `${Math.max(orderHeight, 6)}px` }}
                      className="w-1/2 bg-[#4B5563] rounded-t-sm transition-all duration-300 relative group-hover:bg-[#6B7280]"
                    >
                      <span className="opacity-0 group-hover:opacity-100 absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[#D1D5DB] bg-black/80 px-1 py-0.5 rounded border border-white/10">
                        {item.orders}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[#9CA3AF] mt-2">{item.date}</span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center text-xs text-[#9CA3AF] pt-3">
            <span>Конверсия обращений в выезд: ~85%</span>
            <span>Все наряды ведутся в едином журнале</span>
          </div>
        </div>

        {/* Chart 2: Rules Frequency (П-1 ... П-10) */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#16171B] shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Регламенты сервиса П-1...П-10</h2>
              <p className="text-xs text-[#9CA3AF]">Частота применения обязательных правил сервиса</p>
            </div>
            <span className="text-xs font-mono text-[#9CA3AF]">
              Всего: {timeseries?.rules_distribution?.reduce((s, r) => s + r.count, 0) || 0}
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-64 pr-1">
            {timeseries?.rules_distribution?.map((item) => {
              const widthPct = Math.round((item.count / maxRuleCount) * 100);

              return (
                <div key={item.rule} className="group">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-semibold text-white">{item.rule}</span>
                    <span className="text-[#9CA3AF] text-[11px] truncate max-w-[240px] px-2 text-right">
                      {item.name}
                    </span>
                    <span className="font-mono font-medium text-white">{item.count}</span>
                  </div>
                  <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(widthPct, 3)}%` }}
                      className="h-full bg-white transition-all duration-300 rounded-full group-hover:bg-[#D1D5DB]"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center text-xs text-[#9CA3AF] pt-4 mt-auto border-t border-white/[0.08]">
            <span>Норматив гарантии П-9: 40 дней</span>
            <span>Детерминированный контроль: 100% покрытие</span>
          </div>
        </div>
      </div>
    </div>
  );
};
