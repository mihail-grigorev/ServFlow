import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { User, ClientThread, Message, Equipment, ServiceOrder } from '../types';
import {
  MessageSquare,
  Plus,
  Send,
  Building,
  RotateCcw,
  CheckCircle2,
  Clock,
  Wrench,
  UserCheck,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Calendar,
  MapPin,
  Sparkles,
  Phone,
  Mail,
  Truck,
  Trash2
} from 'lucide-react';

interface CompanyCabinetProps {
  currentUser: User;
  allEquipment: Equipment[];
  onRefreshData?: () => void;
}

export const CompanyCabinet: React.FC<CompanyCabinetProps> = ({
  currentUser,
  allEquipment,
  onRefreshData,
}) => {
  const [threads, setThreads] = useState<ClientThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [clientChatTab, setClientChatTab] = useState<'dispatcher' | 'engineer'>('dispatcher');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);

  // New Ticket Form State
  const [newEqCode, setNewEqCode] = useState<string>('');
  const [newProblemText, setNewProblemText] = useState<string>('');
  const [newChannel, setNewChannel] = useState<string>('Мессенджер');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Add & Delete Equipment State
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [eqFormModel, setEqFormModel] = useState<string>('C100');
  const [eqFormSerial, setEqFormSerial] = useState<string>('');
  const [eqFormAddress, setEqFormAddress] = useState<string>('');
  const [eqFormCity, setEqFormCity] = useState<string>(currentUser.city || 'Москва');
  const [eqFormCode, setEqFormCode] = useState<string>('');
  const [submittingEq, setSubmittingEq] = useState(false);
  const [addEqError, setAddEqError] = useState<string | null>(null);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [isDeletingEq, setIsDeletingEq] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter equipment belonging to this company with intelligent keyword matching
  const cleanComp = currentUser.full_name.replace(/[«»"']/g, '').toLowerCase();
  const compWords = cleanComp
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['кафе', 'ооо', 'зао', 'ип', 'гостиница', 'пекарня', 'ресторан'].includes(w));

  const companyEquipment = allEquipment.filter((eq) => {
    const eqClient = eq.client_name.toLowerCase();
    if (compWords.some((w) => eqClient.includes(w))) return true;
    return eqClient.includes(cleanComp) || cleanComp.includes(eqClient);
  });

  const loadCompanyData = async (targetThreadId?: number) => {
    setLoading(true);
    try {
      const [allTh, allOrd] = await Promise.all([
        api.getThreads('all', undefined, currentUser.full_name),
        api.getOrders(),
      ]);

      setThreads(allTh);

      const toSelect = targetThreadId ?? selectedThreadId;
      if (toSelect && allTh.some((t) => t.id === toSelect)) {
        setSelectedThreadId(toSelect);
      } else if (allTh.length > 0) {
        setSelectedThreadId(allTh[0].id);
      } else {
        setSelectedThreadId(null);
      }

      // Filter orders for this company
      const myOrders = allOrd.filter((o) => {
        const oClient = o.client_name.toLowerCase();
        if (compWords.some((w) => oClient.includes(w))) return true;
        return cleanComp.includes(oClient) || oClient.includes(cleanComp);
      });
      setOrders(myOrders);
    } catch (err) {
      console.error('Failed to load company cabinet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanyData();
    const interval = setInterval(() => loadCompanyData(), 4000);
    return () => clearInterval(interval);
  }, [currentUser.full_name]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || threads[0] || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThread?.messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !selectedThread) return;

    setSendingMsg(true);
    const targetChatType = clientChatTab === 'engineer' ? 'client_engineer' : 'client_dispatcher';
    try {
      await api.sendMessage(
        selectedThread.id,
        text,
        selectedThread.channel || 'Мессенджер',
        'client',
        currentUser.full_name,
        targetChatType
      );
      setInputText('');
      await loadCompanyData(selectedThread.id);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProblemText.trim()) return;

    setCreatingTicket(true);
    setCreateError(null);
    try {
      const created = await api.createThread({
        client_name: currentUser.full_name,
        equipment_code: newEqCode || undefined,
        channel: newChannel,
        content: newProblemText.trim(),
      });
      setIsNewTicketOpen(false);
      setNewProblemText('');
      setNewEqCode('');
      setSuccessToast(`Обращение #${created.thread_number} успешно зарегистрировано и отправлено диспетчеру!`);
      setTimeout(() => setSuccessToast(null), 6000);
      await loadCompanyData(created.id);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Failed to create ticket:', err);
      setCreateError(err.message || 'Ошибка отправки обращения. Пожалуйста, попробуйте еще раз.');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqFormSerial.trim() || !eqFormAddress.trim()) {
      setAddEqError('Пожалуйста, заполните серийный номер и адрес установки');
      return;
    }
    setSubmittingEq(true);
    setAddEqError(null);
    try {
      const created = await api.createEquipment({
        client_name: currentUser.full_name,
        model: eqFormModel,
        serial_number: eqFormSerial.trim(),
        address: eqFormAddress.trim(),
        city: eqFormCity || currentUser.city || 'Москва',
        code: eqFormCode.trim() || undefined,
      });
      setIsAddEquipmentOpen(false);
      setEqFormSerial('');
      setEqFormAddress('');
      setEqFormCode('');
      setSuccessToast(`Кофемашина ${created.code} (${created.model}) успешно добавлена в реестр!`);
      setTimeout(() => setSuccessToast(null), 5000);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Failed to add equipment:', err);
      setAddEqError(err.message || 'Ошибка при добавлении кофемашины');
    } finally {
      setSubmittingEq(false);
    }
  };

  const handleDeleteEquipment = async (eq: Equipment) => {
    setIsDeletingEq(true);
    try {
      await api.deleteEquipment(eq.id || eq.code);
      setEquipmentToDelete(null);
      setSuccessToast(`Кофемашина ${eq.code} успешно удалена из вашего реестра`);
      setTimeout(() => setSuccessToast(null), 5000);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Failed to delete equipment:', err);
      alert(err.message || 'Ошибка при удалении кофемашины');
    } finally {
      setIsDeletingEq(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready_for_order':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#30D158]/20 text-[#30D158]">Готово к выезду</span>;
      case 'order_created':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#4A6751]/20 text-[#6E9078]">Заявка создана</span>;
      case 'needs_clarification':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FF9F0A]/20 text-[#FF9F0A]">Требует ответа</span>;
      case 'sales_transfer':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#BF5AF2]/20 text-[#BF5AF2]">Вне реестра</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-[#8E9E94]">Решено</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white">В обработке</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-[#F0F5F2]">
      {/* Top Banner: Company Info & Action */}
      <div className="bg-[#17231D] p-5 rounded-2xl border border-white/[0.08] shadow-apple flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#4A6751]/15 border border-[#6E9078]/25 flex items-center justify-center text-[#6E9078]">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                {currentUser.full_name}
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#4A6751]/15 text-[#6E9078]">
                Кабинет партнёра
              </span>
            </div>
            <p className="text-xs text-[#8E9E94] mt-0.5 flex items-center space-x-2">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-[#6E9078]" />
                <span>{currentUser.city || 'Москва'}</span>
              </span>
              <span>•</span>
              <span>Прямой канал связи с диспетчерской службой ServFlow</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadCompanyData()}
            title="Обновить переписку"
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[#8E9E94] hover:text-white transition-all cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-[#6E9078]' : ''}`} />
          </button>

          <button
            onClick={() => {
              setCreateError(null);
              setIsNewTicketOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#4A6751] hover:bg-[#3D5643] text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Новое обращение / вызов мастера</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-[#30D158]/15 border border-[#30D158]/30 text-[#30D158] text-xs font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-[#30D158] hover:text-white px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left (List of Chats & Equipment) / Right (Interactive Chat) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN: CHAT LIST & EQUIPMENT ================= */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Chats Card */}
          <div className="bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-apple overflow-hidden">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-[#6E9078]" />
                <h2 className="text-sm font-bold text-white">
                  Ваши обращения в сервис
                </h2>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[#8E9E94]">
                {threads.length}
              </span>
            </div>

            <div className="divide-y divide-white/[0.04] max-h-[380px] overflow-y-auto">
              {threads.length > 0 ? (
                threads.map((th) => {
                  const isSelected = selectedThread?.id === th.id;
                  const lastMsg = th.messages && th.messages.length > 0
                    ? th.messages[th.messages.length - 1]
                    : null;

                  return (
                    <div
                      key={th.id}
                      onClick={() => setSelectedThreadId(th.id)}
                      className={`p-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#4A6751]/10 border-l-4 border-l-[#4A6751]'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-semibold text-xs text-white">
                            Обращение #{th.thread_number}
                          </span>
                          {th.linked_order_number && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#4A6751]/30 text-[#6E9078] font-bold border border-[#4A6751]/40">
                              {th.linked_order_number}
                            </span>
                          )}
                          {th.equipment_code && (
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/[0.08] text-[#8E9E94]">
                              {th.equipment_code}
                            </span>
                          )}
                        </div>
                        {getStatusBadge(th.status)}
                      </div>

                      {th.assigned_engineer_name && (
                        <div className="text-[11px] text-[#30D158] font-medium flex items-center space-x-1 mb-1">
                          <Wrench className="w-3 h-3 flex-shrink-0" />
                          <span>Назначен мастер: {th.assigned_engineer_name}</span>
                        </div>
                      )}

                      {lastMsg && (
                        <p className="text-[11px] text-[#8E9E94] line-clamp-2 leading-relaxed">
                          <span className="font-medium text-white/80">
                            {lastMsg.sender_type === 'client'
                              ? 'Вы: '
                              : lastMsg.sender_type === 'engineer'
                              ? 'Мастер: '
                              : 'Диспетчер: '}
                          </span>
                          {lastMsg.content}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-[#8E9E94] mt-2">
                        <span>Канал: {th.channel}</span>
                        {th.is_warranty && (
                          <span className="text-[#30D158] font-medium flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Гарантийный случай</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-[#8E9E94] text-xs">
                  <p>У вас пока нет активных обращений.</p>
                  <button
                    onClick={() => setIsNewTicketOpen(true)}
                    className="mt-3 text-[#6E9078] hover:underline font-medium"
                  >
                    + Создать первое обращение
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Registered Coffee Machines Card */}
          <div className="bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-apple p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-[#6E9078]" />
                <h2 className="text-sm font-bold text-white">
                  Ваши кофемашины на обслуживании
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[#8E9E94]">
                  {companyEquipment.length} шт.
                </span>
                <button
                  onClick={() => {
                    setAddEqError(null);
                    setIsAddEquipmentOpen(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#4A6751] hover:bg-[#3D5643] text-white flex items-center space-x-1 transition-all shadow-sm cursor-pointer"
                  title="Добавить новую кофемашину в договор"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {companyEquipment.length > 0 ? (
                companyEquipment.map((eq) => (
                  <div
                    key={eq.code}
                    className="p-3 rounded-xl bg-black/30 border border-white/[0.06] flex items-center justify-between text-xs hover:border-white/10 transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-mono font-bold text-[#6E9078]">{eq.code}</span>
                        <span className="font-semibold text-white">Модель {eq.model}</span>
                        <span className="text-[#8E9E94] text-[11px]">s/n {eq.serial_number}</span>
                      </div>
                      <div className="text-[11px] text-[#8E9E94] mt-0.5 truncate">{eq.address} ({eq.city})</div>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setNewEqCode(eq.code);
                          setIsNewTicketOpen(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white transition-colors cursor-pointer"
                        title="Создать обращение по этой кофемашине"
                      >
                        Вызвать
                      </button>
                      <button
                        onClick={() => setEquipmentToDelete(eq)}
                        className="p-1.5 rounded-lg text-[#8E9E94] hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors cursor-pointer"
                        title="Удалить кофемашину из реестра"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[#8E9E94] text-center py-5 space-y-2">
                  <p>Оборудование в договоре не найдено (вне реестра).</p>
                  <button
                    onClick={() => {
                      setAddEqError(null);
                      setIsAddEquipmentOpen(true);
                    }}
                    className="text-[#6E9078] hover:underline font-medium cursor-pointer"
                  >
                    + Добавить кофемашину в реестр
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: LIVE CHAT ================= */}
        <div className="lg:col-span-7 bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-apple flex flex-col h-[650px] overflow-hidden">
          {selectedThread ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/20">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h2 className="font-bold text-sm text-white">
                      Обращение #{selectedThread.thread_number}
                    </h2>
                    {selectedThread.equipment_code && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-[#4A6751]/20 text-[#6E9078] font-semibold">
                        Кофемашина {selectedThread.equipment_code}
                      </span>
                    )}
                    {getStatusBadge(selectedThread.status)}
                  </div>

                  {/* Sub-tabs: Dispatcher vs Engineer */}
                  <div className="flex items-center space-x-1.5 mt-2 bg-[#141B17] p-1 rounded-xl border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setClientChatTab('dispatcher')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                        clientChatTab === 'dispatcher'
                          ? 'bg-[#4A6751] text-white shadow-sm'
                          : 'text-[#8E9E94] hover:text-white'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Чат с диспетчером</span>
                      {selectedThread.messages?.filter(m => m.chat_type === 'client_dispatcher' || (!m.chat_type && m.sender_type !== 'engineer')).length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
                          {selectedThread.messages.filter(m => m.chat_type === 'client_dispatcher' || (!m.chat_type && m.sender_type !== 'engineer')).length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setClientChatTab('engineer')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                        clientChatTab === 'engineer'
                          ? 'bg-[#30D158] text-black shadow-sm font-bold'
                          : 'text-[#8E9E94] hover:text-white'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Чат с инженером</span>
                      {selectedThread.messages?.filter(m => m.chat_type === 'client_engineer' || m.sender_type === 'engineer').length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 text-black font-bold">
                          {selectedThread.messages.filter(m => m.chat_type === 'client_engineer' || m.sender_type === 'engineer').length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  {selectedThread.is_warranty && (
                    <div className="text-[10px] text-[#30D158] font-medium bg-[#30D158]/10 px-2 py-0.5 rounded-md border border-[#30D158]/20">
                      Гарантийный случай
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-black/10">
                {(() => {
                  const visibleMessages = (selectedThread.messages || []).filter((m) => {
                    if (clientChatTab === 'dispatcher') {
                      return m.chat_type === 'client_dispatcher' || (!m.chat_type && m.sender_type !== 'engineer');
                    } else {
                      return m.chat_type === 'client_engineer' || m.sender_type === 'engineer';
                    }
                  });

                  if (visibleMessages.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-[#8E9E94]">
                        <MessageSquare className="w-8 h-8 opacity-30 mb-2" />
                        <span>
                          {clientChatTab === 'dispatcher'
                            ? 'В чате с диспетчером пока нет сообщений'
                            : 'В чате с инженером пока нет сообщений'}
                        </span>
                        <span className="text-[11px] text-[#6E9078] mt-1">
                          {clientChatTab === 'dispatcher'
                            ? 'Опишите поломку или задайте вопрос диспетчеру ниже.'
                            : 'Здесь вы можете напрямую уточнить у выездного инженера время прибытия или код домофона.'}
                        </span>
                      </div>
                    );
                  }

                  return visibleMessages.map((m) => {
                    const isClient = m.sender_type === 'client';
                    const isEngineer = m.sender_type === 'engineer';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}
                      >
                        <div className="text-[10px] text-[#8E9E94] mb-1 px-1 flex items-center space-x-1">
                          {isClient ? (
                            <span>Вы</span>
                          ) : isEngineer ? (
                            <span className="text-[#30D158] font-semibold flex items-center space-x-1 bg-[#30D158]/15 px-1.5 py-0.5 rounded border border-[#30D158]/25">
                              <Wrench className="w-2.5 h-2.5 text-[#30D158]" />
                              <span>{m.sender_name || 'Сервисный инженер'}</span>
                            </span>
                          ) : (
                            <span>{m.sender_name || 'Диспетчер ServFlow'}</span>
                          )}
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                            isClient
                              ? 'bg-[#4A6751] text-white rounded-tr-none'
                              : isEngineer
                              ? 'bg-[#18392B] text-white border border-[#30D158]/35 rounded-tl-none ring-1 ring-[#30D158]/15'
                              : 'bg-[#223329] text-[#F0F5F2] border border-white/[0.08] rounded-tl-none'
                          }`}
                        >
                          <div className="whitespace-pre-line">{m.content}</div>
                        </div>
                      </div>
                    );
                  });
                })()}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Inquiry Prompts for Client */}
              <div className="px-4 py-2 bg-black/20 border-t border-white/[0.04] flex items-center space-x-2 overflow-x-auto text-[11px]">
                <span className="text-[#8E9E94] text-[10px] flex-shrink-0">Быстрый вопрос:</span>
                {(clientChatTab === 'dispatcher'
                  ? [
                      'Подскажите, когда ожидается приезд сервисного инженера?',
                      'Мы проверили бак и подачу воды, всё на месте.',
                      'Какие запасные части потребуются для ремонта?'
                    ]
                  : [
                      'Подъезд со двора, шлагбаум открыт для проезда.',
                      'Код от домофона #421, спросите администратора на баре.',
                      'Инженер, вы уже подъезжаете к нам?'
                    ]
                ).map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Message Input Box */}
              <div className="p-3 border-t border-white/[0.08] bg-[#17231D]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      clientChatTab === 'dispatcher'
                        ? 'Напишите сообщение сервисному диспетчеру...'
                        : 'Напишите напрямую выездному сервисному мастеру...'
                    }
                    className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white placeholder-[#8E9E94] outline-none focus:border-[#6E9078] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={sendingMsg || !inputText.trim()}
                    className={`px-4 py-2.5 rounded-xl disabled:opacity-50 text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer ${
                      clientChatTab === 'dispatcher'
                        ? 'bg-[#4A6751] hover:bg-[#3D5643] text-white'
                        : 'bg-[#30D158] hover:bg-[#28B84B] text-black font-bold'
                    }`}
                  >
                    <span>{sendingMsg ? 'Отправка...' : 'Отправить'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8E9E94] text-xs">
              <MessageSquare className="w-10 h-10 text-white/10 mb-2" />
              <span>Выберите обращение слева или создайте новое</span>
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL: NEW TICKET CREATION ================= */}
      {isNewTicketOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16221B] w-full max-w-lg rounded-2xl border border-white/[0.1] shadow-2xl p-6 text-[#F0F5F2] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-[#6E9078]" />
                <h3 className="text-base font-bold text-white">
                  Новое обращение в сервис
                </h3>
              </div>
              <button
                onClick={() => setIsNewTicketOpen(false)}
                className="text-[#8E9E94] hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              {/* Equipment Selection */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Выберите кофемашину
                </label>
                <select
                  value={newEqCode}
                  onChange={(e) => setNewEqCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#17231D] text-white outline-none focus:border-[#6E9078]"
                >
                  <option value="">Не уверены / Другая кофемашина</option>
                  {companyEquipment.map((eq) => (
                    <option key={eq.code} value={eq.code}>
                      {eq.code} — {eq.model} (s/n {eq.serial_number}, {eq.address})
                    </option>
                  ))}
                </select>
              </div>

              {/* Channel */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Канал обращения
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Мессенджер', 'Почта', 'Звонок'].map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setNewChannel(ch)}
                      className={`py-2 text-xs rounded-xl border font-medium transition-all ${
                        newChannel === ch
                          ? 'border-[#4A6751] bg-[#4A6751]/10 text-[#6E9078]'
                          : 'border-white/[0.08] text-[#8E9E94] hover:text-white'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Что произошло с кофемашиной?
                </label>
                <textarea
                  required
                  rows={4}
                  value={newProblemText}
                  onChange={(e) => setNewProblemText(e.target.value)}
                  placeholder="Опишите симптом неисправности: например, течёт вода из поддона, появилась ошибка E03, слабый пар или кофемашина не включается..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#17231D] text-white placeholder-[#8E9E94] outline-none focus:border-[#6E9078] leading-relaxed resize-none"
                />
              </div>

              {/* Error Message if any */}
              {createError && (
                <div className="p-3 rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewTicketOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/[0.1] hover:bg-white/[0.05] text-[#8E9E94] text-xs font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket || !newProblemText.trim()}
                  className="px-5 py-2 rounded-xl bg-[#4A6751] hover:bg-[#3D5643] disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>{creatingTicket ? 'Отправка...' : 'Отправить в сервис'}</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD NEW EQUIPMENT ================= */}
      {isAddEquipmentOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16221B] w-full max-w-lg rounded-2xl border border-white/[0.1] shadow-2xl p-6 text-[#F0F5F2] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <div className="flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-[#6E9078]" />
                <h3 className="text-base font-bold text-white">
                  Добавление кофемашины в реестр
                </h3>
              </div>
              <button
                onClick={() => setIsAddEquipmentOpen(false)}
                className="text-[#8E9E94] hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEquipment} className="space-y-4">
              {/* Model */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Модель кофемашины *
                </label>
                <select
                  value={eqFormModel}
                  onChange={(e) => setEqFormModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#17231D] text-white outline-none focus:border-[#6E9078]"
                >
                  <option value="C100">C100 — Капельная кофеварка / Офисная</option>
                  <option value="C200">C200 — Рожковая полуавтоматическая</option>
                  <option value="C300">C300 — Суперавтомат профессиональная</option>
                </select>
              </div>

              {/* Serial Number */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Серийный номер (S/N) *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Например, SN-481923"
                  value={eqFormSerial}
                  onChange={(e) => setEqFormSerial(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#17231D] text-white placeholder-[#8E9E94] outline-none focus:border-[#6E9078]"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Адрес установки оборудования *
                </label>
                <input
                  required
                  type="text"
                  placeholder="г. Москва, ул. Арбат, д. 15, стр. 2"
                  value={eqFormAddress}
                  onChange={(e) => setEqFormAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#17231D] text-white placeholder-[#8E9E94] outline-none focus:border-[#6E9078]"
                />
              </div>

              {/* City & Custom Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    Город
                  </label>
                  <select
                    value={eqFormCity}
                    onChange={(e) => setEqFormCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#17231D] text-white outline-none focus:border-[#6E9078]"
                  >
                    <option value="Москва">Москва</option>
                    <option value="Тула">Тула</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    Код кофемашины (опционально)
                  </label>
                  <input
                    type="text"
                    placeholder="Автоматически (EQ13...)"
                    value={eqFormCode}
                    onChange={(e) => setEqFormCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#17231D] text-white placeholder-[#8E9E94] outline-none focus:border-[#6E9078]"
                  />
                </div>
              </div>

              {/* Error Message if any */}
              {addEqError && (
                <div className="p-3 rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{addEqError}</span>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddEquipmentOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/[0.1] hover:bg-white/[0.05] text-[#8E9E94] text-xs font-medium cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submittingEq || !eqFormSerial.trim() || !eqFormAddress.trim()}
                  className="px-5 py-2 rounded-xl bg-[#4A6751] hover:bg-[#3D5643] disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>{submittingEq ? 'Сохранение...' : 'Зарегистрировать кофемашину'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE EQUIPMENT CONFIRMATION ================= */}
      {equipmentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16221B] w-full max-w-md rounded-2xl border border-white/[0.1] shadow-2xl p-6 text-[#F0F5F2] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-[#FF453A] mb-3">
              <div className="p-2.5 rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Удалить кофемашину?
                </h3>
                <p className="text-xs text-[#8E9E94]">
                  {equipmentToDelete.code} — {equipmentToDelete.model}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#8E9E94] leading-relaxed mb-4">
              Вы действительно хотите удалить кофемашину <strong className="text-white font-mono">{equipmentToDelete.code}</strong> (серийный номер {equipmentToDelete.serial_number}) по адресу <span className="text-white">{equipmentToDelete.address}</span> из реестра вашей компании?
            </p>

            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEquipmentToDelete(null)}
                className="px-4 py-2 rounded-xl border border-white/[0.1] hover:bg-white/[0.05] text-[#8E9E94] text-xs font-medium cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeletingEq}
                onClick={() => handleDeleteEquipment(equipmentToDelete)}
                className="px-5 py-2 rounded-xl bg-[#FF453A] hover:bg-[#D73A4A] disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <span>{isDeletingEq ? 'Удаление...' : 'Да, удалить'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
