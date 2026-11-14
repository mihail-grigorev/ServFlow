import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { User, ServiceOrder, Equipment, ClientThread, Message } from '../types';
import {
  Wrench,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Package,
  Truck,
  ArrowRight,
  UserCheck,
  FileText,
  MessageSquare,
  Send,
  Building,
  Sparkles,
  Phone,
  RefreshCw
} from 'lucide-react';

interface EngineerCabinetProps {
  currentUser: User;
  allEquipment: Equipment[];
}

export const EngineerCabinet: React.FC<EngineerCabinetProps> = ({
  currentUser,
  allEquipment,
}) => {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [reportText, setReportText] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
  const [activeView, setActiveView] = useState<'details' | 'chat'>('details');
  const [engineerChatTab, setEngineerChatTab] = useState<'dispatcher' | 'client'>('dispatcher');
  const [orderThread, setOrderThread] = useState<ClientThread | null>(null);
  const [threadLoading, setThreadLoading] = useState<boolean>(false);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadOrderThread = async (orderId: number) => {
    try {
      const th = await api.getOrderThread(orderId);
      setOrderThread(th);
    } catch (err) {
      console.error('Failed to load order thread:', err);
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOrder) {
      setThreadLoading(true);
      loadOrderThread(selectedOrder.id);
      const interval = setInterval(() => {
        loadOrderThread(selectedOrder.id);
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setOrderThread(null);
    }
  }, [selectedOrder?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orderThread?.messages, activeView, engineerChatTab]);

  const handleSendEngineerMessage = async (textToSend?: string) => {
    const text = (textToSend || chatMessage).trim();
    if (!text || !orderThread) return;

    setSendingMessage(true);
    const targetChatType = engineerChatTab === 'dispatcher' ? 'dispatcher_engineer' : 'client_engineer';
    try {
      await api.addMessage(orderThread.id, {
        content: text,
        sender_type: 'engineer',
        sender_name: `Инженер ${currentUser.full_name}`,
        chat_type: targetChatType,
      });
      setChatMessage('');
      await loadOrderThread(selectedOrder!.id);
    } catch (err: any) {
      alert(err.message || 'Ошибка отправки сообщения');
    } finally {
      setSendingMessage(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getOrders({ engineer_id: currentUser.id });
      setOrders(res);
      if (res.length > 0 && !selectedOrder) {
        setSelectedOrder(res[0]);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [currentUser]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      const updated = await api.updateOrderStatus(orderId, newStatus);
      setOrders(orders.map((o) => (o.id === updated.id ? updated : o)));
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка обновления статуса');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !reportText.trim()) return;

    setSubmittingReport(true);
    try {
      const updated = await api.submitOrderReport(selectedOrder.id, reportText.trim(), 'Выполнен');
      setOrders(orders.map((o) => (o.id === updated.id ? updated : o)));
      setSelectedOrder(updated);
      setReportText('');
      alert('Отчёт успешно сохранён, статус заявки переведён в «Выполнен»!');
    } catch (err: any) {
      alert(err.message || 'Ошибка сохранения отчёта');
    } finally {
      setSubmittingReport(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (activeStatusFilter === 'all') return true;
    return o.status === activeStatusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Engineer Profile Banner */}
      <div className="bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#4A6751]/15 border border-[#6E9078]/30 text-[#6E9078] flex items-center justify-center overflow-hidden flex-shrink-0">
            {currentUser.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.full_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <UserCheck className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-[#F0F5F2]">
                {currentUser.full_name}
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#4A6751]/15 text-[#6E9078] border border-[#6E9078]/20">
                Сервисный инженер
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#8E9E94]">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-[#6E9078]" />
                <span>Базирование: {currentUser.city || 'Москва'}</span>
              </span>
              <span>·</span>
              <span>
                Допуски к кофемашинам: <strong className="text-[#F0F5F2]">{currentUser.qualifications?.join(', ') || 'C100, C200'}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 border-t md:border-t-0 md:border-l border-white/[0.08] pt-3 md:pt-0 md:pl-5 text-xs">
          <div>
            <div className="text-[#8E9E94]">Назначено выездов:</div>
            <div className="text-base font-bold text-[#F0F5F2]">
              {orders.filter((o) => o.status !== 'Выполнен').length} активных
            </div>
          </div>
          <div>
            <div className="text-[#8E9E94]">Всего в журнале:</div>
            <div className="text-base font-bold text-[#F0F5F2]">{orders.length}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Orders List & Detailed Visit Preparation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Assigned Orders List */}
        <div className="lg:col-span-4 bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/[0.08] space-y-2">
            <h2 className="text-xs font-bold text-[#8E9E94] uppercase tracking-wider">
              Назначенные выезды
            </h2>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
              {[
                { id: 'all', label: 'Все' },
                { id: 'Назначен', label: 'Назначен' },
                { id: 'В пути', label: 'В пути' },
                { id: 'На месте', label: 'На месте' },
                { id: 'Выполнен', label: 'Выполнен' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveStatusFilter(f.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    activeStatusFilter === f.id
                      ? 'bg-[#4A6751] text-white shadow-sm'
                      : 'text-[#8E9E94] hover:text-[#F0F5F2]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/[0.06] max-h-[600px] overflow-y-auto">
            {filteredOrders.map((o) => {
              const isSelected = selectedOrder?.id === o.id;

              return (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className={`p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#4A6751]/15 border-l-4 border-[#4A6751]'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#F0F5F2]">{o.client_name}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        o.status === 'Выполнен'
                          ? 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/25'
                          : o.status === 'На месте'
                          ? 'bg-[#FF9F0A]/15 text-[#FF9F0A] border-[#FF9F0A]/25'
                          : 'bg-[#4A6751]/15 text-[#6E9078] border-[#6E9078]/25'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#8E9E94] flex items-center space-x-1 mb-1">
                    <MapPin className="w-3 h-3 flex-shrink-0 text-[#8E9E94]" />
                    <span className="truncate">{o.address}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-[#8E9E94]">
                    <span className="text-[#F0F5F2]">{o.model} (№{o.serial_number})</span>
                    {o.is_warranty && (
                      <span className="text-[#FF453A] font-semibold">· Гарантия (П-9)</span>
                    )}
                    {o.reserved_parts && o.reserved_parts.length > 0 && (
                      <span>· Резерв: {o.reserved_parts.length} дет.</span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div className="p-8 text-center text-xs text-[#8E9E94]">
                Нет выездов с выбранным статусом
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Complete Visit Preparation Card & Chat */}
        <div className="lg:col-span-8 space-y-4">
          {selectedOrder ? (
            <>
              {/* Sub-tabs: Details vs Chat */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#17231D] p-2.5 rounded-2xl border border-white/[0.08] gap-3">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveView('details')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-all ${
                      activeView === 'details'
                        ? 'bg-[#4A6751] text-white shadow-sm'
                        : 'text-[#8E9E94] hover:text-[#F0F5F2] hover:bg-white/[0.04]'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Подготовка и диагностика</span>
                  </button>
                  <button
                    onClick={() => setActiveView('chat')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-all relative ${
                      activeView === 'chat'
                        ? 'bg-[#4A6751] text-white shadow-sm'
                        : 'text-[#8E9E94] hover:text-[#F0F5F2] hover:bg-white/[0.04]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Чат по заявке (Диспетчер / Клиент)</span>
                    {orderThread && orderThread.messages.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-[#30D158]/20 text-[#30D158] rounded-full border border-[#30D158]/30 font-bold">
                        {orderThread.messages.length}
                      </span>
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-[#8E9E94] pr-2 flex items-center space-x-2">
                  <span>Заявка:</span>
                  <span className="font-mono text-[#F0F5F2] font-semibold">{selectedOrder.order_number}</span>
                  <span>·</span>
                  <span className="text-[#F0F5F2] truncate max-w-[150px]">{selectedOrder.client_name}</span>
                </div>
              </div>

              {activeView === 'details' ? (
                <div className="bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-2xl p-6 space-y-6">
              {/* Card Top Title & Status Stepper */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-[#F0F5F2]">
                      Карточка подготовки выезда: {selectedOrder.order_number}
                    </h2>
                    {selectedOrder.is_warranty && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FF453A]/15 text-[#FF453A] border border-[#FF453A]/20">
                        Гарантия
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8E9E94] mt-0.5">
                    Создана: {new Date(selectedOrder.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>

                {/* Status Stepper buttons */}
                <div className="flex items-center space-x-1 bg-[#16221B] border border-white/[0.08] p-1 rounded-xl">
                  {['Назначен', 'В пути', 'На месте', 'Выполнен'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(selectedOrder.id, st)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                        selectedOrder.status === st
                          ? 'bg-[#4A6751] text-white shadow-sm'
                          : 'text-[#8E9E94] hover:text-[#F0F5F2]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warranty Notice (Rule П-9) */}
              {selectedOrder.is_warranty && (
                <div className="p-4 rounded-xl bg-[#FF453A]/10 border border-[#FF453A]/25 text-xs text-[#FF453A] space-y-1">
                  <div className="font-bold flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>Внимание: Гарантийный визит (Правило П-9)</span>
                  </div>
                  <p className="leading-relaxed text-[#FF453A]/90">
                    {selectedOrder.warranty_reason ||
                      'Повторное обращение в течение 30 дней после предыдущего ремонта. Гарантийный выезд по правилу П-9.'}
                  </p>
                </div>
              )}

              {/* Equipment & Location Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-white/[0.08] bg-[#16221B] text-xs">
                <div className="space-y-1.5">
                  <div className="text-[#8E9E94]">Клиент:</div>
                  <div className="font-bold text-sm text-[#F0F5F2]">{selectedOrder.client_name}</div>
                  <div className="text-[#8E9E94] mt-2">Адрес заведения:</div>
                  <div className="font-medium text-[#F0F5F2] flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-[#6E9078] flex-shrink-0" />
                    <span>{selectedOrder.address}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#8E9E94]">Модель:</span>
                    <span className="font-bold text-[#F0F5F2]">{selectedOrder.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8E9E94]">Серийный номер:</span>
                    <span className="font-mono font-bold text-[#6E9078]">{selectedOrder.serial_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8E9E94]">Код в реестре:</span>
                    <span className="font-mono text-[#F0F5F2]">{selectedOrder.equipment_code || 'Вне реестра'}</span>
                  </div>
                </div>
              </div>

              {/* Symptom & Assumptions (Rule П-4) */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-[#8E9E94] uppercase tracking-wider">
                  Симптом и первичные данные (Правило П-4)
                </h3>
                <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#16221B] space-y-2">
                  <div>
                    <span className="font-semibold text-[#F0F5F2]">Зафиксированный симптом:</span>
                    <p className="text-xs text-[#F0F5F2] mt-1 leading-relaxed bg-[#111614] p-2.5 rounded-lg border border-white/[0.06]">
                      {selectedOrder.symptom}
                    </p>
                  </div>
                  {selectedOrder.client_assumption && (
                    <div className="text-[11px] text-[#8E9E94]">
                      <span className="font-medium text-[#F0F5F2]">Комментарий / догадка клиента:</span>{' '}
                      {selectedOrder.client_assumption}
                    </div>
                  )}
                </div>
              </div>

              {/* Reserved Spare Parts List (Rules П-7, П-8) */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#8E9E94] uppercase tracking-wider flex items-center space-x-1.5">
                    <Package className="w-3.5 h-3.5 text-[#6E9078]" />
                    <span>Взятые в резерв детали на выезд</span>
                  </h3>
                  <span className="text-[11px] text-[#8E9E94]">
                    Всего зарезервировано: {selectedOrder.reserved_parts?.length || 0}
                  </span>
                </div>

                {selectedOrder.reserved_parts && selectedOrder.reserved_parts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedOrder.reserved_parts.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-white/[0.08] bg-[#16221B] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-[#F0F5F2]">
                            {p.code} · {p.name}
                          </div>
                          <div className="text-[10px] text-[#8E9E94] mt-0.5 flex items-center space-x-1.5">
                            <span>Склад: {p.source_city}</span>
                            {p.transfer_required && (
                              <span className="flex items-center space-x-0.5 text-[#FF9F0A] font-medium">
                                <Truck className="w-3 h-3" />
                                <span>Межскладская доставка</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-white/[0.08] border border-white/[0.1] text-[#F0F5F2]">
                          {p.quantity} шт.
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#8E9E94] p-3 rounded-xl border border-white/[0.06] bg-[#16221B]">
                    Детали на выезд не бронировались (диагностический осмотр).
                  </p>
                )}
              </div>

              {/* Inspection Report Form */}
              <div className="pt-4 border-t border-white/[0.08] space-y-3">
                <h3 className="font-bold text-xs text-[#8E9E94] uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#30D158]" />
                  <span>Итоговый отчёт сервисного инженера об осмотре</span>
                </h3>

                {selectedOrder.inspection_report ? (
                  <div className="p-4 rounded-xl bg-[#30D158]/10 border border-[#30D158]/20 text-xs space-y-1">
                    <div className="font-semibold text-[#30D158]">
                      Отчёт зафиксирован инженером:
                    </div>
                    <p className="text-[#F0F5F2] leading-relaxed">
                      {selectedOrder.inspection_report}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReport} className="space-y-3">
                    <textarea
                      required
                      rows={3}
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      placeholder="Опишите результат осмотра: подтверждённая причина, установленные детали, проверка работы оборудования..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.12] bg-[#16221B] text-[#F0F5F2] placeholder-[#8E9E94] outline-none focus:border-[#6E9078]"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingReport || !reportText.trim()}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#30D158] hover:bg-[#28B84B] disabled:opacity-40 text-black transition-colors flex items-center space-x-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{submittingReport ? 'Сохранение...' : 'Завершить визит и сохранить отчёт'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* Chat view */
            <div className="bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col h-[650px] overflow-hidden">
              {/* Chat Header */}
              <div className="p-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/20">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-[#6E9078]" />
                    <h3 className="font-bold text-sm text-[#F0F5F2]">
                      Переписка по заявке {selectedOrder.order_number}
                    </h3>
                  </div>
                  {/* Chat sub-tabs for engineer */}
                  <div className="flex items-center space-x-1.5 bg-[#16221B] p-1 rounded-xl border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setEngineerChatTab('dispatcher')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                        engineerChatTab === 'dispatcher'
                          ? 'bg-[#4A6751] text-white shadow-sm'
                          : 'text-[#8E9E94] hover:text-white'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Чат с диспетчером</span>
                      {(orderThread?.messages || []).filter(m => m.chat_type === 'dispatcher_engineer').length > 0 && (
                        <span className="px-1.5 py-0.2 text-[10px] bg-white/20 text-white rounded-full font-bold">
                          {(orderThread?.messages || []).filter(m => m.chat_type === 'dispatcher_engineer').length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEngineerChatTab('client')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                        engineerChatTab === 'client'
                          ? 'bg-[#30D158] text-black shadow-sm font-bold'
                          : 'text-[#8E9E94] hover:text-white'
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Чат с клиентом</span>
                      {(orderThread?.messages || []).filter(m => m.chat_type === 'client_engineer' || (m.chat_type === 'client_dispatcher' && m.sender_type === 'client')).length > 0 && (
                        <span className="px-1.5 py-0.2 text-[10px] bg-black/30 text-black rounded-full font-bold">
                          {(orderThread?.messages || []).filter(m => m.chat_type === 'client_engineer' || (m.chat_type === 'client_dispatcher' && m.sender_type === 'client')).length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => loadOrderThread(selectedOrder.id)}
                  disabled={threadLoading}
                  className="px-3 py-1.5 text-xs text-[#8E9E94] hover:text-[#F0F5F2] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${threadLoading ? 'animate-spin' : ''}`} />
                  <span>Обновить</span>
                </button>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#111614]/40">
                {threadLoading && !orderThread && (
                  <div className="h-full flex items-center justify-center text-xs text-[#8E9E94]">
                    Загрузка сообщений треда...
                  </div>
                )}

                {(() => {
                  const currentMessages = (orderThread?.messages || []).filter((m) => {
                    if (engineerChatTab === 'dispatcher') {
                      return m.chat_type === 'dispatcher_engineer' || (m.sender_type === 'system' && !m.chat_type);
                    } else {
                      return m.chat_type === 'client_engineer' || (m.chat_type === 'client_dispatcher' && m.sender_type === 'client');
                    }
                  });

                  if (orderThread && currentMessages.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-[#8E9E94] space-y-2">
                        <MessageSquare className="w-8 h-8 text-white/20" />
                        <p>
                          {engineerChatTab === 'dispatcher'
                            ? 'В чате с диспетчером пока нет сообщений.'
                            : 'В чате с клиентом пока нет сообщений.'}
                        </p>
                        <p className="text-[11px] text-[#6E9078]">
                          {engineerChatTab === 'dispatcher'
                            ? 'Задайте служебный вопрос диспетчеру (по доступу, запчастям или согласованию).'
                            : 'Напишите клиенту о времени прибытия или уточните детали входа.'}
                        </p>
                      </div>
                    );
                  }

                  return currentMessages.map((m) => {
                    const isEngineer = m.sender_type === 'engineer';
                    const isClient = m.sender_type === 'client';
                    const isDispatcher = m.sender_type === 'dispatcher';
                    const isSystem = m.sender_type === 'system';

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isEngineer ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center space-x-1.5 mb-1 px-1 text-[11px]">
                          {isEngineer && (
                            <>
                              <span className="font-semibold text-[#30D158] flex items-center space-x-1 bg-[#30D158]/15 px-2 py-0.5 rounded-full border border-[#30D158]/30">
                                <Wrench className="w-3 h-3" />
                                <span>{m.sender_name || `Инженер ${currentUser.full_name}`} (Вы)</span>
                              </span>
                              <span className="text-[#8E9E94] text-[10px]">
                                {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </>
                          )}
                          {isClient && (
                            <>
                              <span className="font-semibold text-[#0A84FF] flex items-center space-x-1 bg-[#0A84FF]/15 px-2 py-0.5 rounded-full border border-[#0A84FF]/30">
                                <Building className="w-3 h-3" />
                                <span>{m.sender_name || selectedOrder.client_name} (Клиент)</span>
                              </span>
                              <span className="text-[#8E9E94] text-[10px]">
                                {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </>
                          )}
                          {isDispatcher && (
                            <>
                              <span className="font-semibold text-[#BF5AF2] flex items-center space-x-1 bg-[#BF5AF2]/15 px-2 py-0.5 rounded-full border border-[#BF5AF2]/30">
                                <UserCheck className="w-3 h-3" />
                                <span>{m.sender_name || 'Диспетчер ServFlow'}</span>
                              </span>
                              <span className="text-[#8E9E94] text-[10px]">
                                {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </>
                          )}
                          {isSystem && (
                            <>
                              <span className="font-semibold text-[#FF9F0A] flex items-center space-x-1 bg-[#FF9F0A]/15 px-2 py-0.5 rounded-full border border-[#FF9F0A]/30">
                                <Sparkles className="w-3 h-3" />
                                <span>AI Ассистент / Система</span>
                              </span>
                              <span className="text-[#8E9E94] text-[10px]">
                                {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </>
                          )}
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                            isEngineer
                              ? 'bg-[#18392B] text-white border border-[#30D158]/35 rounded-tr-none ring-1 ring-[#30D158]/20'
                              : isClient
                              ? 'bg-[#0A84FF]/10 border border-[#0A84FF]/25 text-[#F0F5F2] rounded-tl-none'
                              : isDispatcher
                              ? 'bg-[#BF5AF2]/10 border border-[#BF5AF2]/25 text-[#F0F5F2] rounded-tl-none'
                              : 'bg-[#223329] text-[#F0F5F2] border border-white/[0.08] rounded-tl-none'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  });
                })()}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts for Engineer */}
              <div className="p-3 border-t border-white/[0.06] bg-[#16221B]/80">
                <div className="text-[10px] text-[#8E9E94] mb-2 uppercase tracking-wider font-semibold">
                  {engineerChatTab === 'dispatcher'
                    ? 'Быстрые фразы диспетчеру:'
                    : 'Быстрые фразы клиенту:'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(engineerChatTab === 'dispatcher'
                    ? [
                        '❓ Диспетчер, уточните код домофона или контакт администратора на месте',
                        '⚠️ Обнаружена скрытая поломка помпы, согласуйте замену детали',
                        '📞 Клиент не открывает дверь и не берет трубку, свяжитесь с управляющим',
                        '📋 Запчасть установлена успешно, прошу зафиксировать списание'
                      ]
                    : [
                        '🚗 Выехал по адресу заявки, расчетное время прибытия ~20 минут',
                        '📍 Прибыл на место в заведение, начинаю визуальный осмотр',
                        '❓ Уточните, пожалуйста, код домофона или номер управляющего',
                        '✅ Работы завершены, выполнен тест пролива и пара, всё в норме'
                      ]
                  ).map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendEngineerMessage(prompt)}
                      disabled={sendingMessage}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#F0F5F2] border border-white/[0.08] transition-colors text-left cursor-pointer disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input */}
              <div className="p-3.5 border-t border-white/[0.08] bg-[#16221B]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendEngineerMessage();
                  }}
                  className="flex space-x-2"
                >
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder={
                      engineerChatTab === 'dispatcher'
                        ? 'Служебный вопрос или комментарий диспетчеру...'
                        : 'Прямое сообщение представителю клиента...'
                    }
                    disabled={sendingMessage}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-white/[0.12] bg-[#17231D] text-[#F0F5F2] placeholder-[#8E9E94] outline-none focus:border-[#6E9078] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !chatMessage.trim()}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer ${
                      engineerChatTab === 'dispatcher'
                        ? 'bg-[#4A6751] hover:bg-[#3D5643] text-white'
                        : 'bg-[#30D158] hover:bg-[#28B84B] text-black font-bold'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingMessage ? 'Отправка...' : 'Отправить'}</span>
                  </button>
                </form>
                <p className="text-[10px] text-[#8E9E94] mt-1.5">
                  {engineerChatTab === 'dispatcher'
                    ? '🔒 Сообщение видно только диспетчерской службе (скрыто от клиента).'
                    : '💬 Прямое сообщение в кабинет представителя заказчика.'}
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-2xl p-12 text-center text-xs text-[#8E9E94]">
          <Wrench className="w-10 h-10 text-white/20 mx-auto mb-2" />
          <span>Выберите назначенный выезд из списка слева для просмотра карточки подготовки и переписки</span>
        </div>
      )}
    </div>
      </div>
    </div>
  );
};
