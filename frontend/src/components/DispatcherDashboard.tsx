import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import {
  ClientThread,
  Equipment,
  SparePart,
  AIAnalysisResult,
  ServiceOrder
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
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
  UserCheck,
  Bell,
  BellOff,
  FileSpreadsheet
} from 'lucide-react';
import { BatchAiOrdersModal } from './BatchAiOrdersModal';

interface DispatcherDashboardProps {
  onOpenOrderModal: (thread?: ClientThread, aiData?: AIAnalysisResult | null) => void;
  threads: ClientThread[];
  onRefreshThreads: () => void;
  allEquipment: Equipment[];
  allParts: SparePart[];
  autoReplyEnabled?: boolean;
  onNavigateToOrders?: (orderId?: number) => void;
}

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Pleasant two-tone chime (D5 587.33Hz -> A5 880Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.debug('Audio chime skipped:', e);
  }
};

export const DispatcherDashboard: React.FC<DispatcherDashboardProps> = ({
  onOpenOrderModal,
  threads,
  onRefreshThreads,
  allEquipment,
  allParts,
  onNavigateToOrders,
}) => {
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [dispatcherChatTab, setDispatcherChatTab] = useState<'client' | 'engineer' | 'all'>('client');
  const [mobileTab, setMobileTab] = useState<'threads' | 'chat' | 'ai'>('threads');
  const [sortOrder, setSortOrder] = useState<'activity' | 'num_asc' | 'num_desc'>('activity');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isBatchAiModalOpen, setIsBatchAiModalOpen] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [sendingMsg, setSendingMsg] = useState<boolean>(false);
  const [isAiSuggestionCollapsed, setIsAiSuggestionCollapsed] = useState<boolean>(true);
  const [unreadThreadIds, setUnreadThreadIds] = useState<Set<number>>(new Set());
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const lastKnownCountsRef = useRef<Record<number, number>>({});
  const initialThreadIdsRef = useRef<Set<number> | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const prevThreadIdRef = useRef<number | null>(null);
  const prevMsgCountRef = useRef<number>(0);

  const loadOrders = async () => {
    try {
      const ords = await api.getOrders();
      setOrders(ords);
    } catch (err) {
      console.error('Failed to load orders in DispatcherDashboard:', err);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [threads]);

  // Track newly arrived threads and incoming messages in real-time
  useEffect(() => {
    if (!threads || threads.length === 0) return;

    // First load: initialize known thread IDs and message counts
    if (!initialThreadIdsRef.current) {
      initialThreadIdsRef.current = new Set(threads.map((t) => t.id));
      threads.forEach((t) => {
        lastKnownCountsRef.current[t.id] = t.messages?.length || 0;
      });
      return;
    }

    let hasIncoming = false;
    const newIncomingIds: number[] = [];

    // Check for brand new threads
    const brandNew = threads.filter((t) => !initialThreadIdsRef.current!.has(t.id));
    if (brandNew.length > 0) {
      brandNew.forEach((t) => {
        initialThreadIdsRef.current!.add(t.id);
        lastKnownCountsRef.current[t.id] = t.messages?.length || 0;
        newIncomingIds.push(t.id);
        hasIncoming = true;
      });
    }

    // Check for new messages in existing threads
    threads.forEach((t) => {
      const prevCount = lastKnownCountsRef.current[t.id];
      const currentCount = t.messages?.length || 0;

      if (prevCount !== undefined && currentCount > prevCount) {
        lastKnownCountsRef.current[t.id] = currentCount;
        
        // Check if latest message is from an outside sender (client, engineer, or system)
        const lastMsg = t.messages?.[t.messages.length - 1];
        if (!lastMsg || lastMsg.sender_type !== 'dispatcher') {
          hasIncoming = true;
          newIncomingIds.push(t.id);
        }
      } else if (prevCount === undefined) {
        lastKnownCountsRef.current[t.id] = currentCount;
      }
    });

    if (hasIncoming) {
      if (isSoundEnabled) {
        playNotificationSound();
      }
      setUnreadThreadIds((prev) => {
        const next = new Set(prev);
        newIncomingIds.forEach((id) => next.add(id));
        return next;
      });

      // If the currently selected thread got a new message, refresh AI analysis
      if (selectedThreadId && newIncomingIds.includes(selectedThreadId)) {
        loadAiAnalysis(selectedThreadId);
      }
    }
  }, [threads, isSoundEnabled, selectedThreadId]);

  // Auto-clear unread badge if dispatcher is viewing this thread
  useEffect(() => {
    if (selectedThreadId && unreadThreadIds.has(selectedThreadId)) {
      const timer = setTimeout(() => {
        setUnreadThreadIds((prev) => {
          if (!prev.has(selectedThreadId)) return prev;
          const next = new Set(prev);
          next.delete(selectedThreadId);
          return next;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedThreadId, unreadThreadIds, threads]);

  // Auto-scroll chat to bottom ONLY inside the internal chat feed (NEVER touching window scroll)
  useEffect(() => {
    const thread = threads.find((t) => t.id === selectedThreadId);
    const msgCount = thread?.messages?.length || 0;

    if (selectedThreadId !== prevThreadIdRef.current) {
      prevThreadIdRef.current = selectedThreadId;
      prevMsgCountRef.current = msgCount;
      if (chatScrollContainerRef.current) {
        chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
      }
    } else if (msgCount > prevMsgCountRef.current) {
      prevMsgCountRef.current = msgCount;
      if (chatScrollContainerRef.current) {
        chatScrollContainerRef.current.scrollTo({
          top: chatScrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [selectedThreadId, threads, dispatcherChatTab]);

  // Periodic polling every 2 seconds to receive new messages in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      onRefreshThreads();
    }, 2000);
    return () => clearInterval(interval);
  }, [onRefreshThreads]);

  // Auto-select first thread if none selected
  useEffect(() => {
    if (threads.length > 0 && selectedThreadId === null) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const handleSelectThread = (threadId: number) => {
    setSelectedThreadId(threadId);
    setMobileTab('chat');
    setUnreadThreadIds((prev) => {
      if (!prev.has(threadId)) return prev;
      const next = new Set(prev);
      next.delete(threadId);
      return next;
    });
  };

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  const activeOrderForThread = orders.find(
    (o) => o.thread_id === selectedThreadId && o.status !== 'Отменен' && o.status !== 'Отменён'
  );

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
    other_city_free?: number;
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
          other_city_free: p.other_city_free,
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
          other_city_free: otherFree,
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
    const textToSend = (customText || inputText).trim();
    if (!textToSend || !selectedThread) return;

    if (!customText) {
      setInputText('');
    }
    setSendingMsg(true);
    const targetChatType = dispatcherChatTab === 'client' ? 'client_dispatcher' : 'dispatcher_engineer';

    // Optimistic UI message append
    const tempId = Date.now();
    const tempMessage = {
      id: tempId,
      thread_id: selectedThread.id,
      channel: selectedThread.channel,
      sender_type: 'dispatcher' as const,
      sender_name: 'Диспетчер ServFlow',
      content: textToSend,
      chat_type: targetChatType,
      created_at: new Date().toISOString(),
    };
    selectedThread.messages.push(tempMessage);

    if (chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTo({
        top: chatScrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }

    try {
      await api.sendMessage(
        selectedThread.id,
        textToSend,
        selectedThread.channel,
        'dispatcher',
        'Диспетчер ServFlow',
        targetChatType
      );
      await onRefreshThreads();
      if (chatScrollContainerRef.current) {
        chatScrollContainerRef.current.scrollTo({
          top: chatScrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
      if (dispatcherChatTab === 'client') {
        loadAiAnalysis(selectedThread.id);
      }
    } catch (err: any) {
      selectedThread.messages = selectedThread.messages.filter((m) => m.id !== tempId);
      alert(err.message || 'Ошибка отправки сообщения');
    } finally {
      setSendingMsg(false);
    }
  };

  // Filter threads
  const filteredThreads = threads.filter((t) => {
    if (activeFilter === 'unread' && !unreadThreadIds.has(t.id)) return false;
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

  const sortedThreads = [...filteredThreads].sort((a, b) => {
    // Threads with unread/new messages ALWAYS on top
    const aUnread = unreadThreadIds.has(a.id);
    const bUnread = unreadThreadIds.has(b.id);
    if (aUnread && !bUnread) return -1;
    if (!aUnread && bUnread) return 1;

    if (sortOrder === 'num_asc') {
      return a.thread_number - b.thread_number;
    }
    if (sortOrder === 'num_desc') {
      return b.thread_number - a.thread_number;
    }
    // Default 'activity': latest activity on top
    const timeA = new Date(a.last_activity || a.created_at).getTime();
    const timeB = new Date(b.last_activity || b.created_at).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.thread_number - a.thread_number;
  });

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case 'Почта':
        return <Mail className="w-3.5 h-3.5 text-white" />;
      case 'Звонок':
        return <Phone className="w-3.5 h-3.5 text-white" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-white" />;
    }
  };

  // Robust transparent message filters
  const allMessages = selectedThread?.messages || [];
  const clientMessages = allMessages.filter((m) => m.chat_type !== 'dispatcher_engineer');
  const engineerMessages = allMessages.filter(
    (m) => m.chat_type === 'dispatcher_engineer' || m.chat_type === 'client_engineer' || m.sender_type === 'engineer'
  );

  const clientMessagesCount = clientMessages.length;
  const engineerMessagesCount = engineerMessages.length;
  const allMessagesCount = allMessages.length;

  return (
    <div className="min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] flex flex-col p-3 sm:p-6 max-w-[1700px] mx-auto w-full text-[#F3F4F6]">
      {/* Mobile Top Navigation Segmented Tabs */}
      <div className="sticky top-16 z-30 lg:hidden flex items-center bg-[#16171B]/95 backdrop-blur-md p-1 rounded-2xl border border-white/[0.08] mb-3 gap-1 shadow-lg">
        <button
          type="button"
          onClick={() => setMobileTab('threads')}
          className={`flex-1 py-2 px-1 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            mobileTab === 'threads' ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <span>Обращения ({sortedThreads.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 px-1 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            mobileTab === 'chat' ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <span>Чат {selectedThread ? `(#${selectedThread.thread_number})` : ''}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('ai')}
          className={`flex-1 py-2 px-1 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            mobileTab === 'ai' ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <span>Заявка & ИИ</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
        {/* ================= COLUMN 1 (LEFT): THREADS & QUICK ORDER ================= */}
        <div className={`${mobileTab === 'threads' ? 'flex' : 'hidden'} lg:flex h-[calc(100dvh-10.5rem)] min-h-[500px] lg:h-auto lg:col-span-3 bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple flex-col min-h-0 overflow-hidden`}>
          <div className="p-3.5 border-b border-white/[0.06] space-y-2.5">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onOpenOrderModal()}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs sm:text-sm font-extrabold shadow-md border-2 border-white flex items-center justify-center space-x-2 cursor-pointer active:scale-95 transition-all ring-2 ring-white/10"
              >
                <Plus className="w-4.5 h-4.5 text-black stroke-[3] flex-shrink-0" />
                <span className="tracking-wide">Создать заявку в 1 клик</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBatchAiModalOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-98 shadow-sm"
                title="Загрузить Excel файл с обращениями или составить все заявки с помощью ИИ"
              >
                <Sparkles className="w-3.5 h-3.5 text-white flex-shrink-0" />
                <span>✨ ИИ: Составить заявки из Excel</span>
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

            {/* Sort order toggle and filters */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center space-x-1.5 text-[11px] text-[#8E9E94]">
                <button
                  type="button"
                  onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                  className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-lg border transition-all cursor-pointer ${
                    isSoundEnabled
                      ? 'bg-white/10 text-white border-white/20'
                      : 'bg-transparent text-neutral-500 border-transparent hover:text-white'
                  }`}
                  title={isSoundEnabled ? 'Звуковое оповещение включено' : 'Звук выключен'}
                >
                  {isSoundEnabled ? (
                    <Bell className="w-3 h-3 text-white" />
                  ) : (
                    <BellOff className="w-3 h-3 text-neutral-500" />
                  )}
                  <span className="text-[10px]">{isSoundEnabled ? 'Звук' : 'Без звука'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSortOrder((prev) => (prev === 'activity' ? 'num_asc' : prev === 'num_asc' ? 'num_desc' : 'activity'));
                }}
                className="flex items-center space-x-1.5 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white/[0.06] hover:bg-white/10 text-white border border-white/[0.08] transition-all cursor-pointer active:scale-95"
                title="Переключить порядок отображения обращений"
              >
                <ArrowUpDown className="w-3 h-3 text-neutral-300" />
                {sortOrder === 'activity' && <span>Свежие сверху</span>}
                {sortOrder === 'num_asc' && <span>№ 1 → 14 (Возр.)</span>}
                {sortOrder === 'num_desc' && <span>№ 14 → 1 (Убыв.)</span>}
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap whitespace-nowrap">
              {[
                { id: 'all', label: 'Все' },
                ...(unreadThreadIds.size > 0 ? [{ id: 'unread', label: `Новые (${unreadThreadIds.size})` }] : []),
                { id: 'needs_clarification', label: 'Уточнить' },
                { id: 'ready_for_order', label: 'Готовы' },
                { id: 'warranty', label: 'Гарантия' },
                { id: 'unregistered', label: 'Вне договора' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap flex-shrink-0 cursor-pointer ${
                    activeFilter === f.id
                      ? f.id === 'unread'
                        ? 'bg-white text-black font-extrabold shadow-sm ring-1 ring-white'
                        : 'bg-white text-black font-semibold shadow-sm'
                      : f.id === 'unread'
                      ? 'bg-white/15 text-white font-bold border border-white/30 animate-pulse'
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
            {sortedThreads.map((t) => {
              const isSelected = t.id === selectedThreadId;
              const hasNew = unreadThreadIds.has(t.id);
              const lastMsg = t.messages[t.messages.length - 1];

              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectThread(t.id)}
                  className={`p-3.5 cursor-pointer transition-all active:scale-[0.99] select-none ${
                    hasNew
                      ? 'bg-white/[0.12] ring-1 ring-white/40 border-l-4 border-white'
                      : isSelected
                      ? 'bg-white/[0.08] border-l-4 border-white'
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
                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      {hasNew && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white text-black flex items-center space-x-1 shadow-sm animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                          <span>Новая</span>
                        </span>
                      )}
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/10 text-white border border-white/20">
                        #{t.thread_number}
                      </span>
                    </div>
                  </div>

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1 my-1.5">
                    {t.equipment_code && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-white/[0.08] text-white">
                        {t.equipment_code}
                      </span>
                    )}
                    {t.is_warranty && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/10 text-white border border-white/20">
                        Гарантия (П-9)
                      </span>
                    )}
                    {t.is_unregistered && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/[0.04] text-neutral-400 border border-white/10">
                        Вне договора
                      </span>
                    )}
                    {t.status === 'order_created' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-white/10 text-white border border-white/20">
                        Заявка создана
                      </span>
                    )}
                  </div>

                  {/* Last message preview and mobile chevron */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[11px] text-[#9CA3AF] line-clamp-2 flex-1">
                      {lastMsg ? lastMsg.content : 'Нет сообщений'}
                    </p>
                    <ChevronRight className="w-4 h-4 text-neutral-500 lg:hidden flex-shrink-0" />
                  </div>
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
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex h-[calc(100dvh-10.5rem)] min-h-[500px] lg:h-auto lg:col-span-5 bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple flex-col min-h-0 overflow-hidden`}>
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
                  {/* Mobile back / forward controls */}
                  <div className="flex items-center space-x-1 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setMobileTab('threads')}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      title="К списку обращений"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Список</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileTab('ai')}
                      className="px-2 py-1 rounded-lg bg-white text-black text-xs font-semibold flex items-center space-x-1 shadow-sm cursor-pointer"
                      title="К ИИ-анализу и деталям"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      <span>ИИ</span>
                    </button>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      selectedThread.status === 'ready_for_order'
                        ? 'bg-white/15 text-white border border-white/20'
                        : selectedThread.status === 'sales_transfer'
                        ? 'bg-neutral-800 text-neutral-300 border border-white/10'
                        : selectedThread.status === 'order_created'
                        ? 'bg-white/15 text-white border border-white/20'
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

              {/* Sub-tabs: Client chat vs Engineer internal chat vs All */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#121316]">
                <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setDispatcherChatTab('client')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      dispatcherChatTab === 'client'
                        ? 'bg-white text-black shadow-sm font-semibold'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Чат с клиентом</span>
                    {clientMessagesCount > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        dispatcherChatTab === 'client' ? 'bg-black/15 text-black' : 'bg-white/10 text-[#9CA3AF]'
                      }`}>
                        {clientMessagesCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispatcherChatTab('engineer')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      dispatcherChatTab === 'engineer'
                        ? 'bg-white text-black shadow-sm font-semibold'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Чат с инженером</span>
                    {engineerMessagesCount > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        dispatcherChatTab === 'engineer' ? 'bg-black/15 text-black' : 'bg-white/10 text-[#9CA3AF]'
                      }`}>
                        {engineerMessagesCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispatcherChatTab('all')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      dispatcherChatTab === 'all'
                        ? 'bg-white text-black shadow-sm font-semibold'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Все ({allMessagesCount})</span>
                  </button>
                </div>
              </div>

              {/* Messages feed */}
              <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#111215]">
                {(() => {
                  const visibleMessages = (() => {
                    if (dispatcherChatTab === 'all') return allMessages;
                    if (dispatcherChatTab === 'engineer') return engineerMessages;
                    return clientMessages;
                  })();

                  if (visibleMessages.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-[#9CA3AF] space-y-2 py-12">
                        <MessageSquare className="w-8 h-8 opacity-25 mb-1" />
                        <p>
                          {dispatcherChatTab === 'client'
                            ? 'В диалоге с клиентом пока нет сообщений'
                            : dispatcherChatTab === 'engineer'
                            ? 'В чате с инженером пока нет сообщений'
                            : 'В этом обращении пока нет сообщений'}
                        </p>
                        {allMessagesCount > 0 && dispatcherChatTab !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setDispatcherChatTab('all')}
                            className="px-3 py-1.5 rounded-xl bg-white text-black text-xs font-semibold shadow-sm hover:bg-neutral-200 transition-all cursor-pointer"
                          >
                            Показать все сообщения обращения ({allMessagesCount})
                          </button>
                        )}
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
                            <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-white border border-white/20 font-semibold text-[9px] flex items-center space-x-0.5">
                              <Wrench className="w-2.5 h-2.5" />
                              <span>Инженер на выезде</span>
                            </span>
                          )}
                          {m.sender_name.includes('ИИ') && (
                            <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-white border border-white/20 font-semibold text-[9px] flex items-center space-x-0.5">
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
                              ? 'bg-white/15 text-white border border-white/10 rounded-tr-sm shadow-sm'
                              : isEngineer
                              ? 'bg-white/10 text-white border border-white/10 rounded-tl-sm shadow-sm'
                              : 'bg-[#1F2026] text-white border border-white/[0.08] rounded-tl-sm shadow-sm'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  });
                })()}
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
                        <div className="p-1 rounded-lg bg-white/10 text-white flex-shrink-0">
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
                                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white hover:bg-neutral-200 text-black transition-colors flex items-center space-x-1 cursor-pointer"
                                >
                                  <span>Отправить клиенту</span>
                                  <ArrowRight className="w-3 h-3 text-black" />
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-[#9CA3AF] py-2 flex items-center justify-center space-x-2 mt-2">
                            <Sparkles className="w-3.5 h-3.5 animate-spin text-white/60" />
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
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 transition-colors text-left cursor-pointer disabled:opacity-50"
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
                    className="p-2 rounded-xl bg-white hover:bg-neutral-200 text-black disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-black" />
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

        {/* ================= COLUMN 3 (RIGHT): PROACTIVE AI EQUIPMENT & SPARE PARTS OR ACTIVE ORDER ================= */}
        <div className={`${mobileTab === 'ai' ? 'flex' : 'hidden'} lg:flex h-[calc(100dvh-10.5rem)] min-h-[500px] lg:h-auto lg:col-span-4 bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple flex-col min-h-0 overflow-hidden`}>
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className="lg:hidden px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                title="Вернуться в чат"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>В чат</span>
              </button>
              <h2 className="font-bold text-sm text-white flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-white/70" />
                <span>{activeOrderForThread ? 'Сформированная заявка' : 'Диагностика и запчасти'}</span>
              </h2>
            </div>
            {activeOrderForThread && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/20">
                Заявка активна
              </span>
            )}
          </div>

          {activeOrderForThread ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-white/15 bg-white/[0.04] space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span className="text-xs font-bold text-white tracking-wide uppercase">
                      Заявка сформирована · Инженер отправлен
                    </span>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/[0.08] text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#9CA3AF]">Номер заявки:</span>
                      <span className="font-mono font-bold text-white">
                        {activeOrderForThread.order_number}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[#9CA3AF]">Статус выезда:</span>
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium border border-white/20">
                        {activeOrderForThread.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[#9CA3AF]">Назначенный инженер:</span>
                      <span className="font-semibold text-white">
                        {activeOrderForThread.engineer?.full_name || 'Инженер назначен'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[#9CA3AF]">Адрес клиента:</span>
                      <span className="text-white text-right max-w-[200px] truncate" title={activeOrderForThread.address}>
                        {activeOrderForThread.address}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[#9CA3AF]">Оборудование:</span>
                      <span className="text-white font-mono">
                        {activeOrderForThread.model} ({activeOrderForThread.serial_number})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reserved Parts Summary */}
                <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-2 text-xs">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span>Зарезервированные детали:</span>
                    <span className="text-[11px] text-[#9CA3AF] font-mono">
                      {activeOrderForThread.reserved_parts?.length || 0} поз.
                    </span>
                  </div>

                  {activeOrderForThread.reserved_parts && activeOrderForThread.reserved_parts.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {activeOrderForThread.reserved_parts.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.06] text-xs"
                        >
                          <div>
                            <div className="font-medium text-white">{p.name || p.code}</div>
                            <div className="text-[10px] text-[#9CA3AF]">
                              {p.code} · Склад: {p.source_city}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-white">
                            {p.quantity} шт.
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#9CA3AF] italic py-1">
                      Детали не резервировались
                    </div>
                  )}
                </div>

                {/* Diagnostic symptom recorded */}
                <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-1 text-xs">
                  <span className="font-semibold text-white">Зафиксированный симптом:</span>
                  <p className="text-xs text-neutral-300 bg-[#16171B] p-2 rounded-lg border border-white/[0.06]">
                    {activeOrderForThread.symptom}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateToOrders && onNavigateToOrders(activeOrderForThread.id)}
                  className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
                >
                  <span>Перейти к заявке</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 1. Proactive AI Equipment Resolution */}
            <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Оборудование
                </span>
                {aiAnalysis?.detected_equipment_code && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white border border-white/20">
                    {aiAnalysis.detected_equipment_code}
                  </span>
                )}
              </div>

              {aiAnalysis?.is_unregistered_machine ? (
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/15 text-xs text-neutral-300 space-y-1">
                  <div className="font-semibold text-white flex items-center space-x-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Машина вне реестра договора</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-neutral-400">
                    {aiAnalysis.equipment_reasoning ||
                      'Выезд инженера не назначается. Обращение передаётся менеджеру по продажам с указанием модели и серийного номера.'}
                  </p>
                </div>
              ) : aiAnalysis?.is_ambiguous_machine ? (
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/15 text-xs text-neutral-300 space-y-1">
                  <div className="font-semibold text-white flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Требуется уточнить кофемашину</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-neutral-400">
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
                    <span className="font-mono font-bold text-white">
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
                <div className="p-2.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white space-y-1">
                  <div className="font-bold flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>Гарантийный случай (норматив до 40 дней)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-neutral-300">
                    {aiAnalysis.warranty_reason}
                  </p>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-xs text-neutral-300">
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
                  <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded bg-white/10 border border-white/20">
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
              <div className="p-3.5 rounded-xl border border-white/15 bg-white/[0.03] space-y-2">
                <span className="text-xs font-semibold text-white flex items-center space-x-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Рекомендуется уточнить у клиента</span>
                </span>
                <ul className="space-y-1">
                  {aiAnalysis.missing_questions.map((q, idx) => (
                    <li key={idx} className="text-[11px] text-[#F3F4F6] flex items-start space-x-1.5">
                      <span className="text-neutral-400 font-bold">·</span>
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
                  <Package className="w-3.5 h-3.5 text-white/70" />
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
                                ? 'bg-white/10 text-white border border-white/10'
                                : p.transfer_required
                                ? 'bg-white/[0.06] text-neutral-300 border border-white/10'
                                : 'bg-white/[0.04] text-[#9CA3AF]'
                            }`}
                          >
                            {(p.local_free ?? 0) > 0
                              ? `Свободно: ${p.local_free} шт.`
                              : p.transfer_required || (p.other_city_free ?? 0) > 0
                              ? 'Везти из Тулы'
                              : 'Нет на складе (купить)'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePart(p.code)}
                            title="Удалить деталь из заявки"
                            className="p-1 rounded-md text-[#9CA3AF] hover:text-white hover:bg-white/[0.05] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Diagnostic reason from AI / DB history */}
                      {p.diagnostic_reason && (
                        <div className="text-[11px] text-[#9CA3AF] leading-relaxed">
                          <span className="text-neutral-300 font-medium">Диагностика:</span> {p.diagnostic_reason}
                        </div>
                      )}

                      {/* Out of stock alert */}
                      {(p.local_free ?? 0) <= 0 && (
                        <div className="p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[10px] text-neutral-300 flex items-center space-x-1.5">
                          {p.transfer_required || (p.other_city_free ?? 0) > 0 ? (
                            <>
                              <Truck className="w-3.5 h-3.5 text-white flex-shrink-0" />
                              <span>Нет на складе в МСК: привезти из Тулы (+1 раб. день)</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />
                              <span>Нет на складе в МСК и Туле: необходимо купить у поставщика</span>
                            </>
                          )}
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
                          <span className="flex items-center space-x-1 text-[10px] text-neutral-300 font-medium">
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
                        className="px-3 py-1 rounded-lg bg-white hover:bg-neutral-200 disabled:opacity-40 text-black text-xs font-semibold"
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
              className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 text-black border border-white/20 text-xs font-semibold flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Wrench className="w-4 h-4 text-black" />
              <span>Оформить заявку на выезд с деталями ИИ</span>
            </button>
          </div>
        </>
      )}
    </div>
      </div>

      {/* Batch AI Orders Modal */}
      <BatchAiOrdersModal
        isOpen={isBatchAiModalOpen}
        onClose={() => setIsBatchAiModalOpen(false)}
        onSuccess={() => {
          onRefreshThreads();
          if (onNavigateToOrders) {
            onNavigateToOrders();
          }
        }}
      />
    </div>
  );
};
