import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { User, ServiceOrder, Equipment, ClientThread } from '../types';
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

  const dispatcherMsgCount = (orderThread?.messages || []).filter(
    (m) => m.chat_type === 'dispatcher_engineer'
  ).length;

  const clientMsgCount = (orderThread?.messages || []).filter(
    (m) => m.chat_type === 'client_engineer'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-[#F3F4F6]">
      {/* Engineer Profile Banner */}
      <div className="bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#30D158]/20 border border-[#30D158]/30 text-[#30D158] flex items-center justify-center overflow-hidden flex-shrink-0">
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
              <h1 className="text-base font-bold text-white">
                {currentUser.full_name}
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30">
                Сервисный инженер
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#9CA3AF]">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-[#30D158]" />
                <span>Базирование: {currentUser.city || 'Москва'}</span>
              </span>
              <span>·</span>
              <span>
                Допуски к кофемашинам: <strong className="text-white">{currentUser.qualifications?.join(', ') || 'C100, C200'}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 border-t md:border-t-0 md:border-l border-white/[0.08] pt-3 md:pt-0 md:pl-5 text-xs">
          <div>
            <div className="text-[#9CA3AF]">Назначено выездов:</div>
            <div className="text-base font-bold text-white">
              {orders.filter((o) => o.status !== 'Выполнен').length} активных
            </div>
          </div>
          <div>
            <div className="text-[#9CA3AF]">Всего в журнале:</div>
            <div className="text-base font-bold text-white">{orders.length}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Orders List & Detailed Visit Preparation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Assigned Orders List */}
        <div className="lg:col-span-4 bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/[0.08] space-y-2">
            <h2 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
              Назначенные выезды
            </h2>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl border border-white/[0.06]">
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
                      ? 'bg-[#30D158] text-black shadow-sm font-bold'
                      : 'text-[#9CA3AF] hover:text-white'
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
                      ? 'bg-white/[0.08] border-l-4 border-[#30D158]'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">{o.client_name}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        o.status === 'Выполнен'
                          ? 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/25'
                          : o.status === 'На месте'
                          ? 'bg-[#FF9F0A]/15 text-[#FF9F0A] border-[#FF9F0A]/25'
                          : 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/25'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#9CA3AF] flex items-center space-x-1 mb-1">
                    <MapPin className="w-3 h-3 flex-shrink-0 text-[#9CA3AF]" />
                    <span className="truncate">{o.address}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-[#9CA3AF]">
                    <span className="text-white">{o.model} (№{o.serial_number})</span>
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
              <div className="p-8 text-center text-xs text-[#9CA3AF]">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#16171B] p-2.5 rounded-2xl border border-white/[0.08] gap-3">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveView('details')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-all ${
                      activeView === 'details'
                        ? 'bg-[#30D158] text-black shadow-sm font-bold'
                        : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Подготовка и диагностика</span>
                  </button>
                  <button
                    onClick={() => setActiveView('chat')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-all relative ${
                      activeView === 'chat'
                        ? 'bg-[#30D158] text-black shadow-sm font-bold'
                        : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Чат по заявке</span>
                    {orderThread && orderThread.messages.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-black/20 text-black rounded-full font-bold">
                        {orderThread.messages.length}
                      </span>
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-[#9CA3AF] pr-2 flex items-center space-x-2">
                  <span>Заявка:</span>
                  <span className="font-mono text-white font-semibold">{selectedOrder.order_number}</span>
                  <span>·</span>
                  <span className="text-white truncate max-w-[150px]">{selectedOrder.client_name}</span>
                </div>
              </div>

              {activeView === 'details' ? (
                <div className="bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple p-6 space-y-6">
                  {/* Card Top Title & Status Stepper */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-lg font-bold text-white">
                          Карточка подготовки выезда: {selectedOrder.order_number}
                        </h2>
                        {selectedOrder.is_warranty && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30">
                            Гарантия (40 дней)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#9CA3AF] mt-0.5">
                        Создана: {new Date(selectedOrder.created_at).toLocaleString('ru-RU')}
                      </div>
                    </div>

                    {/* Interactive Status Stepper */}
                    <div className="flex items-center space-x-1.5 bg-black/40 p-1 rounded-xl border border-white/[0.08]">
                      {['Назначен', 'В пути', 'На месте', 'Выполнен'].map((st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(selectedOrder.id, st)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                            selectedOrder.status === st
                              ? 'bg-[#30D158] text-black shadow-sm font-bold'
                              : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.05]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section 1: Customer & Machine Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#1F2026] p-4 rounded-xl border border-white/[0.06] space-y-2">
                      <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                        Объект и контакты
                      </div>
                      <div className="text-sm font-bold text-white">{selectedOrder.client_name}</div>
                      <div className="text-xs text-[#9CA3AF] flex items-start space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#30D158] flex-shrink-0 mt-0.5" />
                        <span>{selectedOrder.address}</span>
                      </div>
                    </div>

                    <div className="bg-[#1F2026] p-4 rounded-xl border border-white/[0.06] space-y-2">
                      <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                        Оборудование из реестра
                      </div>
                      <div className="text-sm font-bold text-white">
                        {selectedOrder.model} <span className="font-mono text-[#30D158]">№{selectedOrder.serial_number}</span>
                      </div>
                      <div className="text-xs text-[#9CA3AF]">
                        Код в реестре: <span className="text-white font-mono">{selectedOrder.equipment_code || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Technical Symptom & Client Remarks */}
                  <div className="bg-[#1F2026] p-4 rounded-xl border border-white/[0.06] space-y-3">
                    <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                      Техническое описание проблемы (Правило П-4)
                    </div>
                    <div className="text-xs text-white leading-relaxed bg-black/30 p-3 rounded-lg border border-white/[0.06]">
                      {selectedOrder.symptom}
                    </div>
                    {selectedOrder.client_assumption && (
                      <div className="text-xs text-[#9CA3AF] italic">
                        Примечание (догадка клиента): {selectedOrder.client_assumption}
                      </div>
                    )}
                    {selectedOrder.warranty_reason && (
                      <div className="p-2.5 rounded-lg bg-[#30D158]/15 border border-[#30D158]/25 text-xs text-[#30D158] flex items-start space-x-2">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Гарантийный случай:</span> {selectedOrder.warranty_reason}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Reserved Spare Parts for this visit */}
                  <div className="bg-[#1F2026] p-4 rounded-xl border border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center space-x-1.5">
                        <Package className="w-3.5 h-3.5 text-[#30D158]" />
                        <span>Зарезервированные детали для выезда со склада</span>
                      </div>
                    </div>

                    {selectedOrder.reserved_parts && selectedOrder.reserved_parts.length > 0 ? (
                      <div className="space-y-2">
                        {selectedOrder.reserved_parts.map((part, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/[0.06] text-xs"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-[#30D158]">{part.code}</span>
                              <span className="text-white font-medium">{part.name}</span>
                              <span className="text-[#9CA3AF]">x{part.quantity} шт.</span>
                              <span className="text-white font-medium">{part.name}</span>
                              <span className="text-[#9CA3AF]">x{part.quantity} шт.</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] text-[#9CA3AF]">Склад: {part.source_city}</span>
                              {part.transfer_required && (
                                <span className="text-[10px] text-[#FF9F0A] flex items-center space-x-1 font-medium bg-[#FF9F0A]/10 px-2 py-0.5 rounded">
                                  <Truck className="w-3 h-3" />
                                  <span>Межсклад +1 день</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-[#9CA3AF] italic py-2">
                        Детали под выезд не зарезервированы (диагностический осмотр)
                      </div>
                    )}
                  </div>

                  {/* Section 4: Engineer Inspection Report Form */}
                  <form onSubmit={handleSubmitReport} className="bg-[#1F2026] p-4 rounded-xl border border-white/[0.06] space-y-3">
                    <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#30D158]" />
                      <span>Итоговый отчёт инженера о выполненных работах</span>
                    </div>

                    {selectedOrder.inspection_report ? (
                      <div className="p-3 rounded-lg bg-black/40 border border-[#30D158]/30 space-y-1">
                        <div className="flex items-center space-x-1 text-[#30D158] text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Работы завершены и зафиксированы:</span>
                        </div>
                        <p className="text-xs text-white leading-relaxed">
                          {selectedOrder.inspection_report}
                        </p>
                      </div>
                    ) : (
                      <>
                        <textarea
                          rows={3}
                          value={reportText}
                          onChange={(e) => setReportText(e.target.value)}
                          placeholder="Опишите фактически выполненные работы, установленные детали, результаты пролива и пара, рекомендации..."
                          className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#16171B] text-white placeholder-[#9CA3AF] outline-none focus:border-white/20 resize-none leading-relaxed"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={submittingReport || !reportText.trim()}
                            className="px-4 py-2 rounded-xl bg-[#30D158] hover:bg-[#28B84B] disabled:opacity-40 text-black text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                            <span>{submittingReport ? 'Сохранение...' : 'Завершить выезд и сохранить отчёт'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                </div>
              ) : (
                /* Chat View: Completely isolated between Dispatcher & Client */
                <div className="bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple flex flex-col h-[650px] overflow-hidden">
                  {/* Internal Tabs for Engineer Chat */}
                  <div className="p-3 border-b border-white/[0.08] bg-[#121316] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 bg-black/30 p-1 rounded-xl border border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => setEngineerChatTab('dispatcher')}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                            engineerChatTab === 'dispatcher'
                              ? 'bg-[#30D158] text-black shadow-sm font-bold'
                              : 'text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Чат с диспетчером</span>
                          {dispatcherMsgCount > 0 && (
                            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                              engineerChatTab === 'dispatcher' ? 'bg-black/30 text-black' : 'bg-white/20 text-white'
                            }`}>
                              {dispatcherMsgCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setEngineerChatTab('client')}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                            engineerChatTab === 'client'
                              ? 'bg-[#30D158] text-black shadow-sm font-bold'
                              : 'text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          <Building className="w-3.5 h-3.5" />
                          <span>Чат с клиентом</span>
                          {clientMsgCount > 0 && (
                            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                              engineerChatTab === 'client' ? 'bg-black/30 text-black' : 'bg-white/20 text-white'
                            }`}>
                              {clientMsgCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => loadOrderThread(selectedOrder.id)}
                      disabled={threadLoading}
                      className="px-3 py-1.5 text-xs text-[#9CA3AF] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${threadLoading ? 'animate-spin' : ''}`} />
                      <span>Обновить</span>
                    </button>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#111215]">
                    {threadLoading && !orderThread && (
                      <div className="h-full flex items-center justify-center text-xs text-[#9CA3AF]">
                        Загрузка сообщений треда...
                      </div>
                    )}

                    {(() => {
                      const currentMessages = (orderThread?.messages || []).filter((m) => {
                        if (engineerChatTab === 'dispatcher') {
                          return m.chat_type === 'dispatcher_engineer';
                        } else {
                          return m.chat_type === 'client_engineer';
                        }
                      });

                      if (orderThread && currentMessages.length === 0) {
                        return (
                          <div className="h-full flex flex-col items-center justify-center text-xs text-[#9CA3AF] space-y-2">
                            <MessageSquare className="w-8 h-8 text-white/20" />
                            <p>
                              {engineerChatTab === 'dispatcher'
                                ? 'В чате с диспетчером пока нет сообщений.'
                                : 'В чате с клиентом пока нет сообщений.'}
                            </p>
                            <p className="text-[11px] text-neutral-400">
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

                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isEngineer ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center space-x-1.5 mb-1 px-1 text-[11px]">
                              {isEngineer && (
                                <>
                                  <span className="font-semibold text-[#30D158] flex items-center space-x-1 bg-[#30D158]/20 px-2 py-0.5 rounded-full border border-[#30D158]/30">
                                    <Wrench className="w-3 h-3 text-[#30D158]" />
                                    <span>{m.sender_name || `Инженер ${currentUser.full_name}`} (Вы)</span>
                                  </span>
                                  <span className="text-[#9CA3AF] text-[10px]">
                                    {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </>
                              )}
                              {isClient && (
                                <>
                                  <span className="font-semibold text-white flex items-center space-x-1 bg-white/[0.08] px-2 py-0.5 rounded-full border border-white/[0.12]">
                                    <Building className="w-3 h-3" />
                                    <span>{m.sender_name || selectedOrder.client_name} (Клиент)</span>
                                  </span>
                                  <span className="text-[#9CA3AF] text-[10px]">
                                    {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </>
                              )}
                              {isDispatcher && (
                                <>
                                  <span className="font-semibold text-indigo-400 flex items-center space-x-1 bg-indigo-600/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                    <UserCheck className="w-3 h-3" />
                                    <span>{m.sender_name || 'Диспетчер ServFlow'}</span>
                                  </span>
                                  <span className="text-[#9CA3AF] text-[10px]">
                                    {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </>
                              )}
                            </div>

                            <div
                              className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                                isEngineer
                                  ? 'bg-[#2D4536] text-white border border-[#30D158]/30 rounded-tr-sm'
                                  : isClient
                                  ? 'bg-[#1F2026] text-white border border-white/[0.08] rounded-tl-sm'
                                  : 'bg-[#1E222D] text-white border border-indigo-500/30 rounded-tl-sm'
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

                  {/* Fast Prompts & Input Area - NO EMOJIS */}
                  <div className="p-3 border-t border-white/[0.08] bg-[#16171B] space-y-2">
                    <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">
                      {engineerChatTab === 'dispatcher' ? 'Быстрые сообщения диспетчеру:' : 'Быстрые сообщения клиенту:'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(engineerChatTab === 'dispatcher'
                        ? [
                            'Диспетчер, уточните код домофона или контакт администратора на месте',
                            'Обнаружена скрытая поломка помпы, согласуйте замену детали',
                            'Клиент не открывает дверь и не берет трубку, свяжитесь с управляющим',
                            'Запчасть установлена успешно, прошу зафиксировать списание'
                          ]
                        : [
                            'Выехал по адресу заявки, расчетное время прибытия ~20 минут',
                            'Прибыл на место в заведение, начинаю визуальный осмотр',
                            'Уточните, пожалуйста, код домофона или номер управляющего',
                            'Работы завершены, выполнен тест пролива и пара, всё в норме'
                          ]
                      ).map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendEngineerMessage(prompt)}
                          disabled={sendingMessage}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#F3F4F6] border border-white/[0.08] transition-colors text-left cursor-pointer disabled:opacity-50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chat Input */}
                  <div className="p-3.5 border-t border-white/[0.08] bg-[#16171B]">
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
                        className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-white/[0.12] bg-[#1F2026] text-white placeholder-[#9CA3AF] outline-none focus:border-white/20 transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || !chatMessage.trim()}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-[#30D158] hover:bg-[#28B84B] disabled:opacity-40 transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer text-black"
                      >
                        <Send className="w-3.5 h-3.5 text-black" />
                        <span>{sendingMessage ? 'Отправка...' : 'Отправить'}</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple p-12 text-center text-xs text-[#9CA3AF]">
              <Wrench className="w-10 h-10 text-white/20 mx-auto mb-2" />
              <span>Выберите назначенный выезд из списка слева для просмотра карточки подготовки и переписки</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
