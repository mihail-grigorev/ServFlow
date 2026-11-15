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
  Trash2,
  X
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

  // Add Equipment Form State
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [eqFormModel, setEqFormModel] = useState<string>('C100');
  const [eqFormSerial, setEqFormSerial] = useState<string>('');
  const [eqFormAddress, setEqFormAddress] = useState<string>('');
  const [eqFormCity, setEqFormCity] = useState<string>('Москва');
  const [submittingEq, setSubmittingEq] = useState(false);
  const [addEqError, setAddEqError] = useState<string | null>(null);

  // Delete Equipment Confirmation State
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [isDeletingEq, setIsDeletingEq] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cleanComp = currentUser.full_name
    .toLowerCase()
    .replace('кафе', '')
    .replace('ооо', '')
    .replace('зао', '')
    .replace('ип', '')
    .replace('«', '')
    .replace('»', '')
    .trim();

  const compWords = cleanComp.split(/\s+/).filter((w) => w.length > 2);

  // Filter equipment belonging to this company
  const companyEquipment = allEquipment.filter((eq) => {
    const eqClient = eq.client_name.toLowerCase();
    if (compWords.some((w) => eqClient.includes(w))) return true;
    return cleanComp.includes(eqClient) || eqClient.includes(cleanComp);
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
  }, [currentUser]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadCompanyData();
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser, selectedThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThreadId, threads, clientChatTab]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

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
        content: newProblemText.trim(),
        channel: newChannel,
      });

      setNewProblemText('');
      setNewEqCode('');
      setIsNewTicketOpen(false);
      setSuccessToast(`Заявка #${created.thread_number} успешно зарегистрирована!`);
      setTimeout(() => setSuccessToast(null), 5000);

      await loadCompanyData(created.id);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Failed to create ticket:', err);
      setCreateError(err.message || 'Ошибка создания заявки');
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
        city: eqFormCity,
        installation_date: new Date().toISOString().split('T')[0],
      });

      setEqFormSerial('');
      setEqFormAddress('');
      setIsAddEquipmentOpen(false);
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
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/15 text-white border border-white/20">Готово к выезду</span>;
      case 'order_created':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/15 text-white border border-white/20">Заявка создана</span>;
      case 'needs_clarification':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FF9F0A]/20 text-[#FF9F0A] border border-[#FF9F0A]/30">Требует ответа</span>;
      case 'sales_transfer':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">Вне реестра</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-[#9CA3AF]">Решено</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white">В обработке</span>;
    }
  };

  const clientDispatcherMsgCount = (selectedThread?.messages || []).filter(
    (m) => (m.chat_type === 'client_dispatcher' || (!m.chat_type && m.sender_type !== 'engineer')) &&
           m.chat_type !== 'dispatcher_engineer' &&
           m.chat_type !== 'client_engineer'
  ).length;

  const clientEngineerMsgCount = (selectedThread?.messages || []).filter(
    (m) => m.chat_type === 'client_engineer'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-[#F3F4F6]">
      {/* Top Banner: Company Info & Action */}
      <div className="bg-[#16171B] p-5 rounded-2xl border border-white/[0.08] shadow-apple flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                {currentUser.full_name}
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                Кабинет партнёра
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5 flex items-center space-x-2">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
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
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[#9CA3AF] hover:text-white transition-all cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-white' : ''}`} />
          </button>

          <button
            onClick={() => {
              setCreateError(null);
              setIsNewTicketOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 text-black" />
            <span>Новое обращение / вызов мастера</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-white" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-neutral-400 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left (List of Chats & Equipment) / Right (Interactive Chat) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN: CHAT LIST & EQUIPMENT ================= */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Chats Card */}
          <div className="bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple overflow-hidden">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-bold text-white">
                  Ваши обращения в сервис
                </h2>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[#9CA3AF]">
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
                          ? 'bg-white/[0.08] border-l-4 border-l-white'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-semibold text-xs text-white">
                            Обращение #{th.thread_number}
                          </span>
                          {th.linked_order_number && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white font-bold border border-white/20">
                              {th.linked_order_number}
                            </span>
                          )}
                          {th.equipment_code && (
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/[0.08] text-[#9CA3AF]">
                              {th.equipment_code}
                            </span>
                          )}
                        </div>
                        {getStatusBadge(th.status)}
                      </div>

                      {th.assigned_engineer_name && (
                        <div className="text-[11px] text-neutral-300 font-medium flex items-center space-x-1 mb-1">
                          <Wrench className="w-3 h-3 flex-shrink-0" />
                          <span>Назначен мастер: {th.assigned_engineer_name}</span>
                        </div>
                      )}

                      {lastMsg && (
                        <p className="text-[11px] text-[#9CA3AF] line-clamp-2 leading-relaxed">
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

                      <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] mt-2">
                        <span>Канал: {th.channel}</span>
                        {th.is_warranty && (
                          <span className="text-neutral-300 font-medium flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Гарантийный случай</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-[#9CA3AF] text-xs">
                  <p>У вас пока нет активных обращений.</p>
                  <button
                    onClick={() => setIsNewTicketOpen(true)}
                    className="mt-3 text-white hover:underline font-medium"
                  >
                    + Создать первое обращение
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Registered Coffee Machines Card */}
          <div className="bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-bold text-white">
                  Ваши кофемашины на обслуживании
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[#9CA3AF]">
                  {companyEquipment.length} шт.
                </span>
                <button
                  onClick={() => {
                    setAddEqError(null);
                    setIsAddEquipmentOpen(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-neutral-200 text-black flex items-center space-x-1 transition-all shadow-sm cursor-pointer"
                  title="Добавить новую кофемашину в договор"
                >
                  <Plus className="w-3.5 h-3.5 text-black" />
                  <span>Добавить</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {companyEquipment.length > 0 ? (
                companyEquipment.map((eq) => (
                  <div
                    key={eq.code}
                    className="p-3 rounded-xl bg-[#1F2026] border border-white/[0.06] flex items-center justify-between text-xs hover:border-white/10 transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-mono font-bold text-white">{eq.code}</span>
                        <span className="font-semibold text-white">Модель {eq.model}</span>
                        <span className="text-[#9CA3AF] text-[11px]">s/n {eq.serial_number}</span>
                      </div>
                      <div className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">{eq.address} ({eq.city})</div>
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
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors cursor-pointer"
                        title="Удалить кофемашину из реестра"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[#9CA3AF] text-center py-5 space-y-2">
                  <p>Оборудование в договоре не найдено (вне реестра).</p>
                  <button
                    onClick={() => {
                      setAddEqError(null);
                      setIsAddEquipmentOpen(true);
                    }}
                    className="text-white hover:underline font-medium cursor-pointer"
                  >
                    + Добавить кофемашину в реестр
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: LIVE CHAT ================= */}
        <div className="lg:col-span-7 bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple flex flex-col h-[650px] overflow-hidden">
          {selectedThread ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121316]">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h2 className="font-bold text-sm text-white">
                      Обращение #{selectedThread.thread_number}
                    </h2>
                    {selectedThread.equipment_code && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-white/10 text-white font-semibold border border-white/20">
                        Кофемашина {selectedThread.equipment_code}
                      </span>
                    )}
                    {getStatusBadge(selectedThread.status)}
                  </div>

                  {/* Sub-tabs: Dispatcher vs Engineer */}
                  <div className="flex items-center space-x-1.5 mt-2 bg-black/30 p-1 rounded-xl border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setClientChatTab('dispatcher')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                        clientChatTab === 'dispatcher'
                          ? 'bg-white text-black shadow-sm font-semibold'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Чат с диспетчером</span>
                      {clientDispatcherMsgCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          clientChatTab === 'dispatcher' ? 'bg-black/15 text-black' : 'bg-white/10 text-[#9CA3AF]'
                        }`}>
                          {clientDispatcherMsgCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setClientChatTab('engineer')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                        clientChatTab === 'engineer'
                          ? 'bg-white text-black shadow-sm font-semibold'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Чат с инженером</span>
                      {clientEngineerMsgCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
                          {clientEngineerMsgCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  {selectedThread.is_warranty && (
                    <div className="text-[10px] text-white font-medium bg-white/10 px-2 py-0.5 rounded-md border border-white/20">
                      Гарантийный случай
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Messages Feed - Strictly Isolated */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#111215]">
                {(() => {
                  const visibleMessages = (selectedThread.messages || []).filter((m) => {
                    if (clientChatTab === 'dispatcher') {
                      return (
                        (m.chat_type === 'client_dispatcher' || (!m.chat_type && m.sender_type !== 'engineer')) &&
                        m.chat_type !== 'dispatcher_engineer' &&
                        m.chat_type !== 'client_engineer'
                      );
                    } else {
                      return m.chat_type === 'client_engineer';
                    }
                  });

                  if (visibleMessages.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-[#9CA3AF]">
                        <MessageSquare className="w-8 h-8 opacity-30 mb-2" />
                        <span>
                          {clientChatTab === 'dispatcher'
                            ? 'В чате с диспетчером пока нет сообщений'
                            : 'В чате с инженером пока нет сообщений'}
                        </span>
                        <span className="text-[11px] text-neutral-400 mt-1">
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
                        <div className="flex items-center space-x-1.5 mb-1 px-1 text-[11px] text-[#9CA3AF]">
                          <span>
                            {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>•</span>
                          {isClient ? (
                            <span>Вы</span>
                          ) : isEngineer ? (
                            <span className="text-white font-semibold flex items-center space-x-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
                              <Wrench className="w-2.5 h-2.5 text-white" />
                              <span>{m.sender_name || 'Сервисный инженер'}</span>
                            </span>
                          ) : (
                            <span>{m.sender_name || 'Диспетчер ServFlow'}</span>
                          )}
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                            isClient
                              ? 'bg-white/15 text-white border border-white/20 rounded-tr-none'
                              : isEngineer
                              ? 'bg-white/10 text-white border border-white/15 rounded-tl-none'
                              : 'bg-[#1F2026] text-white border border-white/[0.08] rounded-tl-none'
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
              <div className="px-4 py-2 bg-[#16171B] border-t border-white/[0.04] flex items-center space-x-2 overflow-x-auto text-[11px]">
                <span className="text-[#9CA3AF] text-[10px] flex-shrink-0">Быстрый вопрос:</span>
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
              <div className="p-3 border-t border-white/[0.08] bg-[#16171B]">
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
                    className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white placeholder-[#9CA3AF] outline-none focus:border-white/20 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={sendingMsg || !inputText.trim()}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-50 text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer text-black"
                  >
                    <span>{sendingMsg ? 'Отправка...' : 'Отправить'}</span>
                    <Send className="w-3.5 h-3.5 text-black" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#9CA3AF] text-xs">
              <MessageSquare className="w-10 h-10 text-white/10 mb-2" />
              <span>Выберите обращение слева или создайте новое</span>
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL: NEW TICKET CREATION ================= */}
      {isNewTicketOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16171B] w-full max-w-lg rounded-2xl border border-white/[0.1] shadow-2xl p-6 text-[#F3F4F6] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-white/70" />
                <h3 className="text-base font-bold text-white">
                  Новое обращение в сервис
                </h3>
              </div>
              <button
                onClick={() => setIsNewTicketOpen(false)}
                className="text-[#9CA3AF] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              {/* Equipment Selection */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Выберите кофемашину (или укажите в описании):
                </label>
                <select
                  value={newEqCode}
                  onChange={(e) => setNewEqCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                >
                  <option value="">-- Указать кофемашину вручную в тексте --</option>
                  {companyEquipment.map((eq) => (
                    <option key={eq.code} value={eq.code}>
                      {eq.code} · {eq.model} (s/n {eq.serial_number}) · {eq.address}
                    </option>
                  ))}
                </select>
                {(() => {
                  const selEq = companyEquipment.find((e) => e.code === newEqCode);
                  if (!selEq) return null;
                  const refDate = new Date('2026-11-16T11:30:00Z');
                  let is40Days = false;
                  let infoText = '';
                  if (selEq.installation_date) {
                    const d = new Date(selEq.installation_date);
                    const diff = Math.floor((refDate.getTime() - d.getTime()) / (1000 * 3600 * 24));
                    if (diff >= 0 && diff <= 40) {
                      is40Days = true;
                      infoText = `Введена в эксплуатацию ${diff} дн. назад. По правилу П-9 (до 40 дней) случай гарантийный — выезд и работы бесплатны.`;
                    }
                  }
                  if (!is40Days && selEq.last_visit_date) {
                    const d = new Date(selEq.last_visit_date);
                    const diff = Math.floor((refDate.getTime() - d.getTime()) / (1000 * 3600 * 24));
                    if (diff >= 0 && diff <= 40) {
                      is40Days = true;
                      infoText = `Предыдущий выезд был ${diff} дн. назад. В пределах 40 дней случай гарантийный — работы бесплатны.`;
                    }
                  }
                  if (is40Days) {
                    return (
                      <div className="mt-2 p-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-[11px] flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0 text-white" />
                        <span>{infoText}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Problem Description */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Что произошло с кофемашиной? *
                </label>
                <textarea
                  rows={4}
                  required
                  value={newProblemText}
                  onChange={(e) => setNewProblemText(e.target.value)}
                  placeholder="Опишите симптом: течь (откуда и когда), слабый напор, гул, код ошибки на экране (например, E07, E03)..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white placeholder-[#9CA3AF] outline-none focus:border-white/20 leading-relaxed resize-none"
                />
              </div>

              {/* Channel */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Предпочитаемый канал связи:
                </label>
                <select
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                >
                  <option value="Мессенджер">Внутренний чат ServFlow / Мессенджер</option>
                  <option value="Почта">Электронная почта</option>
                  <option value="Звонок">Телефонный звонок диспетчера</option>
                </select>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] text-xs">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsNewTicketOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket || !newProblemText.trim()}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-50 text-black text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  {creatingTicket ? 'Регистрация...' : 'Отправить в диспетчерскую'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD EQUIPMENT TO CONTRACT ================= */}
      {isAddEquipmentOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16171B] w-full max-w-md rounded-2xl border border-white/[0.1] shadow-2xl p-6 text-[#F3F4F6] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <div className="flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-neutral-400" />
                <h3 className="text-base font-bold text-white">
                  Добавление кофемашины в реестр
                </h3>
              </div>
              <button
                onClick={() => setIsAddEquipmentOpen(false)}
                className="text-[#9CA3AF] hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
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
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                >
                  <option value="C100">C100 (Базовая)</option>
                  <option value="C200">C200 (Профессиональная)</option>
                  <option value="C300">C300 (Флагманская мультибойлерная)</option>
                </select>
              </div>

              {/* Serial Number */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Серийный номер (с шильдика) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: 245, 108"
                  value={eqFormSerial}
                  onChange={(e) => setEqFormSerial(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white placeholder-[#9CA3AF] outline-none focus:border-white/20 font-mono"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Город размещения *
                </label>
                <select
                  value={eqFormCity}
                  onChange={(e) => setEqFormCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                >
                  <option value="Москва">Москва</option>
                  <option value="Тула">Тула</option>
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Фактический адрес установки *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: ул. Лесная, 12 или пр-т Ленина, 50"
                  value={eqFormAddress}
                  onChange={(e) => setEqFormAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white placeholder-[#9CA3AF] outline-none focus:border-white/20"
                />
              </div>

              {addEqError && (
                <div className="p-3 rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] text-xs">
                  {addEqError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsAddEquipmentOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-white transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submittingEq || !eqFormSerial.trim() || !eqFormAddress.trim()}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-50 text-black text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  {submittingEq ? 'Сохранение...' : 'Зарегистрировать машину'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE EQUIPMENT CONFIRMATION ================= */}
      {equipmentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16171B] w-full max-w-sm rounded-2xl border border-white/[0.1] shadow-2xl p-6 text-[#F3F4F6] animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center space-x-2.5 text-[#FF453A]">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-base font-bold text-white">Удаление из договора</h3>
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Вы уверены, что хотите снять кофемашину{' '}
              <strong className="text-white font-mono">{equipmentToDelete.code}</strong> (модель {equipmentToDelete.model}, s/n {equipmentToDelete.serial_number}) с гарантийного и сервисного обслуживания?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setEquipmentToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeletingEq}
                onClick={() => handleDeleteEquipment(equipmentToDelete)}
                className="px-4 py-2 rounded-xl bg-[#FF453A] hover:bg-[#D9382E] text-white text-xs font-semibold shadow-sm transition-all"
              >
                {isDeletingEq ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
