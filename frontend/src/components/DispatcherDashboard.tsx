import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import {
  ClientThread,
  Equipment,
  SparePart,
  AIAnalysisResult
} from '../types';
import {
  Mail,
  Phone,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Package,
  Wrench,
  ShieldAlert,
  Send,
  RotateCcw,
  CheckCircle2,
  Plus,
  Trash2,
  Minus,
  Truck,
  HelpCircle,
  Search,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';

interface DispatcherDashboardProps {
  onOpenOrderModal: (thread?: ClientThread, aiData?: AIAnalysisResult | null) => void;
  threads: ClientThread[];
  onRefreshThreads: () => void;
  allEquipment: Equipment[];
  allParts: SparePart[];
  autoReplyEnabled?: boolean;
}

export const DispatcherDashboard: React.FC<DispatcherDashboardProps> = ({
  onOpenOrderModal,
  threads,
  onRefreshThreads,
  allEquipment,
  allParts,
}) => {
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [dispatcherChatTab, setDispatcherChatTab] = useState<'client' | 'engineer'>('client');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [sendingMsg, setSendingMsg] = useState<boolean>(false);
  const [isAiSuggestionCollapsed, setIsAiSuggestionCollapsed] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThreadId, threads]);

  // Periodic polling to receive new client messages in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      onRefreshThreads();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-select first thread if none selected
  useEffect(() => {
    if (threads.length > 0 && selectedThreadId === null) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  // Trigger AI analysis when selected thread changes
  useEffect(() => {
    if (selectedThreadId) {
      loadAiAnalysis(selectedThreadId);
    }
  }, [selectedThreadId]);

  const loadAiAnalysis = async (threadId: number) => {
    setAiLoading(true);
    try {
      const res = await api.analyzeThread(threadId);
      setAiAnalysis(res);
    } catch (err) {
      console.error('Failed to load AI analysis:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Editable parts state for dispatcher to review, modify qty, remove, or manually add parts
  const [editedParts, setEditedParts] = useState<{
    code: string;
    name: string;
    quantity: number;
    status_note?: string;
    diagnostic_reason?: string | null;
    local_free?: number;
    transfer_required?: boolean;
    is_compatible?: boolean;
  }[]>([]);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [selectedPartCodeToAdd, setSelectedPartCodeToAdd] = useState('');

  // Sync parts when AI analysis is loaded or updated
  useEffect(() => {
    if (aiAnalysis?.recommended_parts && aiAnalysis.recommended_parts.length > 0) {
      setEditedParts(
        aiAnalysis.recommended_parts.map((p) => ({
          code: p.code,
          name: p.name,
          quantity: 1,
          status_note: p.status_note,
          diagnostic_reason: p.diagnostic_reason,
          local_free: p.local_free,
          transfer_required: p.transfer_required,
          is_compatible: p.is_compatible,
        }))
      );
    } else {
      setEditedParts([]);
    }
  }, [aiAnalysis]);

  const handleUpdateQty = (code: string, delta: number) => {
    setEditedParts((prev) =>
      prev
        .map((p) => {
          if (p.code === code) {
            const newQty = Math.max(1, p.quantity + delta);
            return { ...p, quantity: newQty };
          }
          return p;
        })
        .filter((p) => p.quantity > 0)
    );
  };

  const handleRemovePart = (code: string) => {
    setEditedParts((prev) => prev.filter((p) => p.code !== code));
  };

  const handleAddManualPart = () => {
    if (!selectedPartCodeToAdd) return;
    const part = allParts.find((p) => p.code === selectedPartCodeToAdd);
    if (!part) return;

    if (editedParts.some((p) => p.code === part.code)) {
      handleUpdateQty(part.code, 1);
    } else {
      const city = selectedThread?.equipment?.city || 'Москва';
      const localStock = city === 'Тула' ? part.tula_stock : part.moscow_stock;
      const localRes = city === 'Тула' ? part.tula_reserved : part.moscow_reserved;
      const localFree = localStock - localRes;
      const otherFree = city === 'Тула' ? (part.moscow_stock - part.moscow_reserved) : (part.tula_stock - part.tula_reserved);

      setEditedParts((prev) => [
        ...prev,
        {
          code: part.code,
          name: part.name,
          quantity: 1,
          status_note: localFree > 0 ? `Свободно: ${localFree} шт.` : (otherFree > 0 ? 'Склад 0 (есть в другом городе)' : 'Нет на складах'),
          diagnostic_reason: 'Добавлено диспетчером вручную',
          local_free: localFree,
          transfer_required: localFree <= 0 && otherFree > 0,
          is_compatible: selectedThread?.equipment?.model ? part.compatible_models.includes(selectedThread.equipment.model) : true,
        },
      ]);
    }

    setSelectedPartCodeToAdd('');
    setIsManualAddOpen(false);
  };

  const handleCreateOrderWithAiParts = () => {
    if (!selectedThread) return;
    const transformedAiData: AIAnalysisResult | null = aiAnalysis
      ? {
          ...aiAnalysis,
          recommended_parts: editedParts.map((ep) => {
            const orig = aiAnalysis.recommended_parts.find((op) => op.code === ep.code);
            return {
              code: ep.code,
              name: ep.name,
              is_compatible: ep.is_compatible ?? true,
              local_stock: orig?.local_stock ?? ep.local_free ?? 1,
              local_reserved: orig?.local_reserved ?? 0,
              local_free: ep.local_free ?? 1,
              other_city_free: orig?.other_city_free ?? 0,
              transfer_required: ep.transfer_required ?? false,
              status_note: ep.status_note ?? 'В наличии',
              diagnostic_reason: ep.diagnostic_reason || null,
            };
          }),
        }
      : null;

    onOpenOrderModal(selectedThread, transformedAiData);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || !selectedThread) return;

    setSendingMsg(true);
    const targetChatType = dispatcherChatTab === 'client' ? 'client_dispatcher' : 'dispatcher_engineer';
    try {
      await api.sendMessage(
        selectedThread.id,
        textToSend.trim(),
        selectedThread.channel,
        'dispatcher',
        'Диспетчер ServFlow',
        targetChatType
      );
      setInputText('');
      await onRefreshThreads();
      if (dispatcherChatTab === 'client') {
        loadAiAnalysis(selectedThread.id);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка отправки сообщения');
    } finally {
      setSendingMsg(false);
    }
  };

  // Filter threads
  const filteredThreads = threads.filter((t) => {
    if (activeFilter === 'needs_clarification' && t.status !== 'needs_clarification') return false;
    if (activeFilter === 'ready_for_order' && t.status !== 'ready_for_order') return false;
    if (activeFilter === 'warranty' && !t.is_warranty) return false;
    if (activeFilter === 'unregistered' && !t.is_unregistered) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchClient = t.client_name.toLowerCase().includes(q);
      const matchCode = (t.equipment_code || '').toLowerCase().includes(q);
      const matchMsg = t.messages.some((m) => m.content.toLowerCase().includes(q));
      return matchClient || matchCode || matchMsg;
    }

    return true;
  });

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case 'Почта':
        return <Mail className="w-3.5 h-3.5 text-[#48BB78]" />;
      case 'Звонок':
        return <Phone className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  // Strict isolated message filters
  const clientMessagesCount = (selectedThread?.messages || []).filter(
    (m) => (m.chat_type === 'client_dispatcher' || (!m.chat_type && m.sender_type !== 'engineer')) &&
           m.chat_type !== 'dispatcher_engineer' &&
           m.chat_type !== 'client_engineer'
  ).length;

  const engineerMessagesCount = (selectedThread?.messages || []).filter(
    (m) => m.chat_type === 'dispatcher_engineer'
  ).length;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-4 sm:p-6 max-w-[1700px] mx-auto w-full text-[#F3F4F6]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
        {/* ================= COLUMN 1 (LEFT): THREADS & QUICK ORDER ================= */}
        <div className="lg:col-span-3 bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple flex flex-col min-h-0 overflow-hidden">
          <div className="p-3.5 border-b border-white/[0.06] space-y-2.5">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onOpenOrderModal()}
                className="w-full py-2.5 px-3 rounded-xl bg-[#264232] hover:bg-[#2F503D] text-[#D8F3E5] border border-[#3A6349]/50 text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 text-[#48BB78]" />
                <span>+ Новая заявка в 1 клик</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Поиск по клиенту или тексту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-white/[0.08] bg-[#1F2026] text-white placeholder-[#9CA3AF] focus:border-white/20 outline-none transition-all"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-0.5">
              {[
                { id: 'all', label: 'Все' },
                { id: 'needs_clarification', label: 'Уточнить' },
                { id: 'ready_for_order', label: 'Готовы' },
                { id: 'warranty', label: 'Гарантия' },
                { id: 'unregistered', label: 'Вне договора' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    activeFilter === f.id
                      ? 'bg-[#334A3E] text-[#D8F3E5] font-semibold border border-[#4E765D]/50 shadow-sm'
                      : 'bg-white/[0.05] text-[#9CA3AF] hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Threads Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
            {filteredThreads.map((t) => {
              const isSelected = t.id === selectedThreadId;
              const lastMsg = t.messages[t.messages.length - 1];

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedThreadId(t.id)}
                  className={`p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white/[0.08] border-l-4 border-[#2E7D47]'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1.5 min-w-0">
                      {getChannelIcon(t.channel)}
                      <span className="font-semibold text-xs text-white truncate">
                        {t.client_name}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">
                      #{t.thread_number}
                    </span>
                  </div>

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1 my-1.5">
                    {t.equipment_code && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-white/[0.08] text-white">
                        {t.equipment_code}
                      </span>
                    )}
                    {t.is_warranty && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-[#FF453A]/15 text-[#FF453A] border border-[#FF453A]/20">
                        Гарантия
                      </span>
                    )}
                    {t.is_unregistered && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-[#FF9F0A]/15 text-[#FF9F0A] border border-[#FF9F0A]/20">
                        Вне договора
                      </span>
                    )}
                    {t.status === 'order_created' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-[#2E7D47]/20 text-[#48BB78] border border-[#2E7D47]/30">
                        Заявка создана
                      </span>
                    )}
                  </div>

                  {/* Last message preview */}
                  <p className="text-[11px] text-[#9CA3AF] line-clamp-2">
                    {lastMsg ? lastMsg.content : 'Нет сообщений'}
                  </p>
                </div>
              );
            })}

            {filteredThreads.length === 0 && (
              <div className="p-8 text-center text-xs text-[#9CA3AF]">
                Обращения по выбранному фильтру не найдены
              </div>
            )}
          </div>
        </div>

        {/* ================= COLUMN 2 (CENTER): CHAT & AI ASSISTANT ================= */}
        <div className="lg:col-span-5 bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple flex flex-col min-h-0 overflow-hidden">
          {selectedThread ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="font-bold text-sm text-white">
                      {selectedThread.client_name}
                    </h2>
                    <span className="text-xs text-[#9CA3AF]">
                      (Ветка #{selectedThread.thread_number})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 mt-0.5 text-xs text-[#9CA3AF]">
                    <span>Канал: {selectedThread.channel}</span>
                    <span>·</span>
                    <span>
                      {selectedThread.equipment_code
                        ? `Оборудование: ${selectedThread.equipment_code}`
                        : selectedThread.is_unregistered
                        ? 'Вне договора'
                        : 'Оборудование не указано'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      selectedThread.status === 'ready_for_order'
                        ? 'bg-[#2E7D47]/20 text-[#48BB78] border border-[#2E7D47]/30'
                        : selectedThread.status === 'sales_transfer'
                        ? 'bg-[#FF9F0A]/15 text-[#FF9F0A] border border-[#FF9F0A]/30'
                        : selectedThread.status === 'order_created'
                        ? 'bg-[#2E7D47]/20 text-[#48BB78] border border-[#2E7D47]/30'
                        : 'bg-white/[0.06] text-[#9CA3AF]'
                    }`}
                  >
                    {selectedThread.status === 'ready_for_order'
                      ? 'Готов к выезду'
                      : selectedThread.status === 'sales_transfer'
                      ? 'Передать в продажи'
                      : selectedThread.status === 'order_created'
                      ? 'Оформлен'
                      : 'Требует уточнения'}
                  </span>
                </div>
              </div>

              {/* Sub-tabs: Client chat vs Engineer internal chat */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#121316]">
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setDispatcherChatTab('client')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                      dispatcherChatTab === 'client'
                        ? 'bg-[#2E7D47] text-white shadow-sm font-semibold'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Чат с клиентом</span>
                    {clientMessagesCount > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        dispatcherChatTab === 'client' ? 'bg-white/20 text-white' : 'bg-white/10 text-[#9CA3AF]'
                      }`}>
                        {clientMessagesCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatcherChatTab('engineer')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                      dispatcherChatTab === 'engineer'
                        ? 'bg-[#2E7D47] text-white shadow-sm font-semibold'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Чат с инженером</span>
                    {engineerMessagesCount > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        dispatcherChatTab === 'engineer' ? 'bg-white/20 text-white' : 'bg-white/10 text-[#9CA3AF]'
                      }`}>
                        {engineerMessagesCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Messages feed - Strictly isolated */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#111215]">
                {(() => {
                  const visibleMessages = (selectedThread.messages || []).filter((m) => {
                    if (dispatcherChatTab === 'client') {
                      return (
                        (m.chat_type === 'client_dispatcher' || (!m.chat_type && m.sender_type !== 'engineer')) &&
                        m.chat_type !== 'dispatcher_engineer' &&
                        m.chat_type !== 'client_engineer'
                      );
                    } else {
                      return m.chat_type === 'dispatcher_engineer';
                    }
                  });

                  if (visibleMessages.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-[#9CA3AF] space-y-1 py-12">
                        <MessageSquare className="w-8 h-8 opacity-25 mb-1" />
                        <p>
                          {dispatcherChatTab === 'client'
                            ? 'В диалоге с клиентом нет сообщений'
                            : 'В чате с инженером пока нет сообщений'}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {dispatcherChatTab === 'client'
                            ? 'Напишите клиенту или дождитесь входящего обращения.'
                            : 'Здесь вы можете передать инженеру коды доступа, согласования или служебные инструкции.'}
                        </p>
                      </div>
                    );
                  }

                  return visibleMessages.map((m) => {
                    const isDispatcher = m.sender_type === 'dispatcher';
                    const isEngineer = m.sender_type === 'engineer';

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isDispatcher ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-[#9CA3AF]">
                          <span>{m.sender_name}</span>
                          {isEngineer && (
                            <span className="px-1.5 py-0.2 rounded-full bg-[#2E7D47]/20 text-[#48BB78] border border-[#2E7D47]/30 font-semibold text-[9px] flex items-center space-x-0.5">
                              <Wrench className="w-2.5 h-2.5" />
                              <span>Инженер на выезде</span>
                            </span>
                          )}
                          {m.sender_name.includes('ИИ') && (
                            <span className="px-1.5 py-0.2 rounded-full bg-[#2E7D47]/20 text-[#48BB78] border border-[#2E7D47]/30 font-semibold text-[9px] flex items-center space-x-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Автоответ</span>
                            </span>
                          )}
                          {m.request_code && (
                            <span className="px-1.5 py-0.2 rounded bg-white/[0.08] font-mono text-[10px] text-white">
                              {m.request_code}
                            </span>
                          )}
                          <span>·</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                            isDispatcher
                              ? 'bg-[#1F3A29] text-white border border-[#2E7D47]/35 rounded-tr-sm shadow-sm'
                              : isEngineer
                              ? 'bg-[#16291E] text-white border border-[#2E7D47]/40 rounded-tl-sm shadow-sm'
                              : 'bg-[#1F2026] text-white border border-white/[0.08] rounded-tl-sm shadow-sm'
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

              {/* Chat Bottom Controls */}
              <div className="p-3 border-t border-white/[0.06] bg-[#16171B]">
                {dispatcherChatTab === 'client' ? (
                  /* Gemini AI Assistant Block above input (collapsible) */
                  <div className="rounded-xl border border-white/[0.1] bg-[#1F2026] shadow-sm overflow-hidden transition-all duration-200">
                    {/* Collapsible Header */}
                    <div
                      onClick={() => setIsAiSuggestionCollapsed(!isAiSuggestionCollapsed)}
                      className="p-2.5 sm:p-3 flex items-center justify-between gap-2 bg-[#1F2026] cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className="p-1 rounded-lg bg-[#2E7D47]/20 text-[#48BB78] flex-shrink-0">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-white">
                              ИИ-Ассистент Gemini
                            </span>
                            {isAiSuggestionCollapsed && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.08] text-[#9CA3AF] hidden sm:inline">
                                свернуто
                              </span>
                            )}
                          </div>
                          {isAiSuggestionCollapsed && aiAnalysis?.reply_to_client && (
                            <p className="text-[11px] text-[#9CA3AF] truncate max-w-sm sm:max-w-md mt-0.5">
                              {aiAnalysis.reply_to_client}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadAiAnalysis(selectedThread.id);
                          }}
                          disabled={aiLoading}
                          title="Перегенерировать анализ"
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#9CA3AF] hover:text-white transition-colors"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAiSuggestionCollapsed(!isAiSuggestionCollapsed);
                          }}
                          title={isAiSuggestionCollapsed ? "Развернуть блок предложений" : "Свернуть блок предложений"}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.1] transition-all text-xs font-medium cursor-pointer shadow-sm active:scale-95"
                        >
                          {isAiSuggestionCollapsed ? (
                            <>
                              <span>Развернуть</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              <span>Свернуть</span>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Body (visible when not collapsed) */}
                    {!isAiSuggestionCollapsed && (
                      <div className="px-3 pb-3 pt-0 space-y-2.5 border-t border-white/[0.04]">
                        {aiAnalysis ? (
                          <>
                            <div className="text-xs text-white bg-black/40 p-2.5 rounded-lg border border-white/[0.06] leading-relaxed whitespace-pre-line mt-2.5">
                              {aiAnalysis.reply_to_client}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => setInputText(aiAnalysis.reply_to_client)}
                                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white transition-colors cursor-pointer"
                                >
                                  Вставить в поле ввода
                                </button>
                                <button
                                  onClick={() => handleSendMessage(aiAnalysis.reply_to_client)}
                                  disabled={sendingMsg}
                                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#2E7D47] hover:bg-[#256B3C] text-white font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                                >
                                  <span>Отправить клиенту</span>
                                  <ArrowRight className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-[#9CA3AF] py-2 flex items-center justify-center space-x-2 mt-2">
                            <Sparkles className="w-3.5 h-3.5 animate-spin text-[#48BB78]" />
                            <span>Анализ контекста обращения...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Quick prompts for Dispatcher to Engineer - NO EMOJIS */
                  <div className="p-2.5 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-2">
                    <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">
                      Быстрые указания инженеру на выезде:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Согласовано, производите замену узла из резерва',
                        'Код от домофона: 421, спросить управляющего на баре',
                        'Выезд по гарантии (правило П-9), работы без оплаты',
                        'Связался с клиентом, вас уже встречают на месте'
                      ].map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(prompt)}
                          disabled={sendingMsg}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-[#18281F] hover:bg-[#22382B] text-[#D8F3E5] border border-[#2E7D47]/40 transition-colors text-left cursor-pointer disabled:opacity-50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual Message Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center space-x-2 mt-2.5"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      dispatcherChatTab === 'client'
                        ? 'Напишите ответ клиенту или уточнение...'
                        : 'Служебная инструкция или ответ инженеру...'
                    }
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#1F2026] text-white placeholder-[#9CA3AF] focus:border-white/20 outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={sendingMsg || !inputText.trim()}
                    className="p-2 rounded-xl bg-[#2E7D47] hover:bg-[#256B3C] text-white disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#9CA3AF] text-xs">
              <MessageSquare className="w-8 h-8 text-white/[0.1] mb-2" />
              <span>Выберите обращение из списка слева</span>
            </div>
          )}
        </div>

        {/* ================= COLUMN 3 (RIGHT): PROACTIVE AI EQUIPMENT & SPARE PARTS ================= */}
        <div className="lg:col-span-4 bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-bold text-sm text-white flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-[#48BB78]" />
              <span>Диагностика и запчасти</span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 1. Proactive AI Equipment Resolution */}
            <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Оборудование
                </span>
                {aiAnalysis?.detected_equipment_code && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#2E7D47]/20 text-[#48BB78] border border-[#2E7D47]/30">
                    {aiAnalysis.detected_equipment_code}
                  </span>
                )}
              </div>

              {aiAnalysis?.is_unregistered_machine ? (
                <div className="p-2.5 rounded-lg bg-[#FF9F0A]/15 border border-[#FF9F0A]/25 text-xs text-[#FF9F0A] space-y-1">
                  <div className="font-semibold flex items-center space-x-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Машина вне реестра договора</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {aiAnalysis.equipment_reasoning ||
                      'Выезд инженера не назначается. Обращение передаётся менеджеру по продажам с указанием модели и серийного номера.'}
                  </p>
                </div>
              ) : aiAnalysis?.is_ambiguous_machine ? (
                <div className="p-2.5 rounded-lg bg-[#FF9F0A]/15 border border-[#FF9F0A]/25 text-xs text-[#FF9F0A] space-y-1">
                  <div className="font-semibold flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Требуется уточнить кофемашину</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {aiAnalysis.ambiguity_explanation || aiAnalysis.equipment_reasoning}
                  </p>
                </div>
              ) : selectedThread?.equipment ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Модель:</span>
                    <span className="font-semibold text-white">{selectedThread.equipment.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Серийный номер:</span>
                    <span className="font-mono font-bold text-[#48BB78]">
                      {selectedThread.equipment.serial_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Адрес:</span>
                    <span className="text-white text-right max-w-[200px] truncate">
                      {selectedThread.equipment.address}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Город склада:</span>
                    <span className="text-white">{selectedThread.equipment.city}</span>
                  </div>

                  {aiAnalysis?.equipment_reasoning && (
                    <div className="mt-2 pt-2 border-t border-white/[0.06] text-[11px] text-neutral-300">
                      <span className="font-medium text-white">Вывод ИИ:</span> {aiAnalysis.equipment_reasoning}
                    </div>
                  )}

                  {selectedThread.equipment.last_visit_result && (
                    <div className="mt-1 text-[11px] text-[#9CA3AF]">
                      <span className="font-medium text-white">Прошлый визит:</span>{' '}
                      {selectedThread.equipment.last_visit_result}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF]">
                  Машина ещё не привязана.
                </p>
              )}
            </div>

            {/* 2. Warranty Status */}
            <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-1.5">
              <span className="text-xs font-semibold text-white">
                Статус гарантии
              </span>

              {aiAnalysis?.is_warranty ? (
                <div className="p-2.5 rounded-lg bg-[#FF453A]/15 border border-[#FF453A]/25 text-xs text-[#FF453A] space-y-1">
                  <div className="font-bold flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>Гарантийный случай (норматив до 40 дней)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {aiAnalysis.warranty_reason}
                  </p>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-xs text-[#48BB78]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Стандартный платный визит</span>
                </div>
              )}
            </div>

            {/* 3. Error Code Interpretation */}
            {aiAnalysis?.error_code && (
              <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Код ошибки
                  </span>
                  <span className="text-xs font-mono font-bold text-[#48BB78] px-2 py-0.5 rounded bg-[#2E7D47]/20 border border-[#2E7D47]/30">
                    {aiAnalysis.error_code}
                  </span>
                </div>
                <p className="text-xs text-white font-medium">
                  {aiAnalysis.error_explanation}
                </p>
                <p className="text-[10px] text-[#9CA3AF]">
                  Код указывает на сработавшую проверку системы, окончательную причину определяет инженер на месте.
                </p>
              </div>
            )}

            {/* 4. Missing Clarification Questions */}
            {aiAnalysis?.missing_questions && aiAnalysis.missing_questions.length > 0 && (
              <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] space-y-2">
                <span className="text-xs font-semibold text-[#FF9F0A] flex items-center space-x-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Рекомендуется уточнить у клиента</span>
                </span>
                <ul className="space-y-1">
                  {aiAnalysis.missing_questions.map((q, idx) => (
                    <li key={idx} className="text-[11px] text-[#F3F4F6] flex items-start space-x-1.5">
                      <span className="text-[#FF9F0A] font-bold">·</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 5. Recommended Spare Parts (Rule П-7 & П-8) - Interactive & Editable */}
            <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center space-x-1.5">
                  <Package className="w-3.5 h-3.5 text-[#48BB78]" />
                  <span>Рекомендуемые запчасти</span>
                </span>
                <button
                  type="button"
                  onClick={() => selectedThreadId && loadAiAnalysis(selectedThreadId)}
                  disabled={aiLoading}
                  title="Запустить повторный подбор деталей через ИИ по контексту и истории из БД"
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.1] text-[11px] font-semibold flex items-center space-x-1 transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span>{aiLoading ? 'ИИ анализ...' : 'ИИ-Подбор'}</span>
                </button>
              </div>

              {editedParts.length > 0 ? (
                <div className="space-y-2">
                  {editedParts.map((p) => (
                    <div
                      key={p.code}
                      className="p-2.5 rounded-xl bg-[#16171B] border border-white/[0.08] flex flex-col space-y-1.5 text-xs transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span className="font-semibold text-white truncate">
                            {p.code} · {p.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              (p.local_free ?? 0) > 0
                                ? 'bg-[#2E7D47]/20 text-[#48BB78]'
                                : p.transfer_required
                                ? 'bg-[#FF9F0A]/15 text-[#FF9F0A]'
                                : 'bg-white/[0.06] text-[#9CA3AF]'
                            }`}
                          >
                            {(p.local_free ?? 0) > 0
                              ? `Свободно: ${p.local_free} шт.`
                              : p.transfer_required
                              ? 'Склад 0 (есть в др. городе)'
                              : 'Нет остатка'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePart(p.code)}
                            title="Удалить деталь из заявки"
                            className="p-1 rounded-md text-[#9CA3AF] hover:text-[#FF453A] hover:bg-white/[0.05] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Diagnostic reason from AI / DB history */}
                      {p.diagnostic_reason && (
                        <div className="text-[11px] text-[#9CA3AF] leading-relaxed">
                          <span className="text-[#48BB78] font-medium">Диагностика:</span> {p.diagnostic_reason}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] text-[#9CA3AF]">Кол-во:</span>
                          <div className="flex items-center space-x-1 bg-black/40 rounded-lg p-0.5 border border-white/[0.06]">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(p.code, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-[#9CA3AF] hover:text-white hover:bg-white/10"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-white px-1 text-[11px]">
                              {p.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(p.code, 1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-[#9CA3AF] hover:text-white hover:bg-white/10"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {p.transfer_required && (
                          <span className="flex items-center space-x-1 text-[10px] text-[#FF9F0A] font-medium">
                            <Truck className="w-3 h-3" />
                            <span>+1 раб. день</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center text-xs text-[#9CA3AF]">
                  <span>Детали пока не предложены. Нажмите «ИИ-Подбор» или добавьте деталь вручную.</span>
                </div>
              )}

              {/* Manual Add Trigger */}
              <div className="pt-1">
                {isManualAddOpen ? (
                  <div className="p-2.5 rounded-xl bg-[#16171B] border border-white/[0.08] space-y-2">
                    <label className="block text-[11px] font-semibold text-white">
                      Выберите запчасть со склада:
                    </label>
                    <select
                      value={selectedPartCodeToAdd}
                      onChange={(e) => setSelectedPartCodeToAdd(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                    >
                      <option value="">-- Выберите деталь --</option>
                      {allParts.map((part) => (
                        <option key={part.code} value={part.code}>
                          {part.code} · {part.name} (для {part.compatible_models.join(', ')})
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualAddOpen(false);
                          setSelectedPartCodeToAdd('');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs text-[#9CA3AF] hover:text-white"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        disabled={!selectedPartCodeToAdd}
                        onClick={handleAddManualPart}
                        className="px-3 py-1 rounded-lg bg-[#2E7D47] hover:bg-[#256B3C] disabled:opacity-40 text-white text-xs font-semibold"
                      >
                        Добавить в заявку
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsManualAddOpen(true)}
                    className="w-full py-1.5 rounded-xl border border-dashed border-white/[0.15] hover:border-white/30 hover:bg-white/[0.02] text-[#9CA3AF] hover:text-white text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить деталь вручную</span>
                  </button>
                )}
              </div>
            </div>

            {/* 6. Technical Symptom vs Client Guess (Rule П-4) */}
            <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-1.5 text-xs">
              <span className="font-semibold text-white">
                Симптом для заявки (Правило П-4)
              </span>
              <p className="text-xs text-white bg-[#16171B] p-2.5 rounded-lg border border-white/[0.06]">
                {aiAnalysis?.draft_symptom || 'Симптом формируется...'}
              </p>
              {aiAnalysis?.client_assumption && (
                <p className="text-[11px] text-[#9CA3AF]">
                  <span className="font-medium text-white">Догадка клиента (отдельно):</span>{' '}
                  {aiAnalysis.client_assumption}
                </p>
              )}
            </div>
          </div>

          {/* Bottom Action CTA */}
          <div className="p-4 border-t border-white/[0.06] bg-[#16171B]">
            <button
              onClick={handleCreateOrderWithAiParts}
              className="w-full py-3 rounded-xl bg-[#2E7D47] hover:bg-[#256B3C] text-white border border-[#3A8F57]/50 text-xs font-semibold flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Wrench className="w-4 h-4 text-white" />
              <span>Оформить заявку на выезд с деталями ИИ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
