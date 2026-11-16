import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { ClientThread, AIAnalysisResult, Equipment, SparePart, User, ReservedPartItem } from '../types';
import {
  X,
  Wrench,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Package,
  Truck,
  Sparkles
} from 'lucide-react';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  thread?: ClientThread | null;
  aiData?: AIAnalysisResult | null;
  allEquipment: Equipment[];
  allParts: SparePart[];
  allUsers: User[];
  onOrderCreated: () => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  thread,
  aiData,
  allEquipment,
  allParts,
  allUsers,
  onOrderCreated,
}) => {
  if (!isOpen) return null;

  const [selectedEqCode, setSelectedEqCode] = useState<string>('EQ01');
  const [isCustomCompany, setIsCustomCompany] = useState<boolean>(false);
  const [customCity, setCustomCity] = useState<'Москва' | 'Тула'>('Москва');
  const [clientName, setClientName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [model, setModel] = useState<string>('C100');
  const [serialNumber, setSerialNumber] = useState<string>('');
  const [symptom, setSymptom] = useState<string>('Требуется диагностика и осмотр кофемашины');
  const [clientAssumption, setClientAssumption] = useState<string>('');
  const [isWarranty, setIsWarranty] = useState<boolean>(false);
  const [warrantyReason, setWarrantyReason] = useState<string>('');
  const [selectedEngineerId, setSelectedEngineerId] = useState<number | null>(null);
  const [selectedParts, setSelectedParts] = useState<{ [code: string]: number }>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<{ message: string } | null>(null);
  const [recommendedEngineers, setRecommendedEngineers] = useState<any[]>([]);
  const [aiRecommendedParts, setAiRecommendedParts] = useState<any[]>([]);
  const [isAiRecommending, setIsAiRecommending] = useState<boolean>(false);
  const [aiRecommendationSummary, setAiRecommendationSummary] = useState<string | null>(null);

  // Selected equipment object (null if custom company)
  const currentEq = (!isCustomCompany && selectedEqCode !== 'custom')
    ? (allEquipment.find((e) => e.code === selectedEqCode) || allEquipment[0] || null)
    : null;
  const targetCity = isCustomCompany ? customCity : (currentEq?.city || 'Москва');

  // Compatible parts for model (Rule П-7)
  const compatibleParts = allParts.filter((p) => {
    if (!model) return true;
    return p.compatible_models.includes(model);
  });

  // Filter engineers by city & qualification
  const cityEngineers = allUsers.filter((u) => {
    if (u.role !== 'engineer') return false;
    if (u.city && u.city !== targetCity) return false;
    return true;
  });

  const handleAddressChange = (val: string) => {
    setAddress(val);
    const lower = val.toLowerCase();
    if (lower.includes('тула')) {
      setCustomCity('Тула');
    } else if (lower.includes('москва')) {
      setCustomCity('Москва');
    }
  };

  // Re-initialize state whenever modal opens or thread/aiData changes
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setConflictError(null);

    // If opening without thread (manual button), allow choosing or default
    if (!thread) {
      // Default to registry if available, but reset custom flag
      setIsCustomCompany(false);
      const initialCode = allEquipment.length > 0 ? allEquipment[0].code : 'custom';
      setSelectedEqCode(initialCode);
      const eq = allEquipment.find((e) => e.code === initialCode);
      if (eq) {
        setClientName(eq.client_name);
        setAddress(eq.address);
        setModel(eq.model);
        setSerialNumber(eq.serial_number);
        setCustomCity(eq.city === 'Тула' ? 'Тула' : 'Москва');
      } else {
        setIsCustomCompany(true);
        setSelectedEqCode('custom');
        setClientName('');
        setAddress('');
        setModel('C100');
        setSerialNumber('');
        setCustomCity('Москва');
      }
    } else {
      setIsCustomCompany(false);
      const initialCode =
        aiData?.detected_equipment_code ||
        thread.equipment_code ||
        (allEquipment.length > 0 ? allEquipment[0].code : 'EQ01');
      setSelectedEqCode(initialCode);

      const eq = allEquipment.find((e) => e.code === initialCode) || (allEquipment.length > 0 ? allEquipment[0] : null);
      if (eq) {
        setClientName(thread.client_name || eq.client_name || '');
        setAddress(eq.address || '');
        setModel(eq.model || 'C100');
        setSerialNumber(eq.serial_number || '—');
        setCustomCity(eq.city === 'Тула' ? 'Тула' : 'Москва');
      } else {
        setClientName(thread.client_name || 'Новый клиент');
        setAddress('Адрес уточняется');
        setModel('C100');
        setSerialNumber('—');
        setCustomCity('Москва');
      }
    }

    if (aiData?.draft_symptom) {
      setSymptom(aiData.draft_symptom);
    } else if (thread?.messages && thread.messages.length > 0) {
      const clientMsg = thread.messages.find((m) => m.sender_type === 'client');
      setSymptom(clientMsg?.content || 'Требуется диагностика и осмотр кофемашины');
    } else {
      setSymptom('Требуется диагностика и осмотр кофемашины');
    }

    if (aiData?.client_assumption) {
      setClientAssumption(aiData.client_assumption);
    } else {
      setClientAssumption('');
    }

    if (aiData?.is_warranty !== undefined) {
      setIsWarranty(aiData.is_warranty);
      setWarrantyReason(aiData.warranty_reason || '');
    } else if (thread?.is_warranty !== undefined) {
      setIsWarranty(thread.is_warranty);
      setWarrantyReason(thread.warranty_reason || '');
    } else {
      setIsWarranty(false);
      setWarrantyReason('');
    }

    // Pre-select recommended parts from AI
    if (aiData?.recommended_parts && aiData.recommended_parts.length > 0) {
      const initial: { [code: string]: number } = {};
      aiData.recommended_parts.forEach((p) => {
        initial[p.code] = 1;
      });
      setSelectedParts(initial);
    } else {
      setSelectedParts({});
    }
  }, [isOpen, thread, aiData, allEquipment]);

  // Sync selected equipment when dropdown changes (only if in registry mode)
  useEffect(() => {
    if (isCustomCompany || !selectedEqCode || selectedEqCode === 'custom') return;
    const eq = allEquipment.find((e) => e.code === selectedEqCode);
    if (eq) {
      if (!thread?.client_name) {
        setClientName(eq.client_name);
      }
      setAddress(eq.address);
      setModel(eq.model);
      setSerialNumber(eq.serial_number);
      setCustomCity(eq.city === 'Тула' ? 'Тула' : 'Москва');
    }
  }, [selectedEqCode, allEquipment, thread?.client_name, isCustomCompany]);

  // 40-Day Warranty Auto-Check (Rule П-9)
  const [warrantyNotice, setWarrantyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!currentEq) {
      setWarrantyNotice(null);
      return;
    }
    const refDate = new Date('2026-11-16T11:30:00Z');
    let isW = false;
    let reason = '';

    if (currentEq.installation_date) {
      const d = new Date(currentEq.installation_date);
      const diffDays = Math.floor((refDate.getTime() - d.getTime()) / (1000 * 3600 * 24));
      if (diffDays >= 0 && diffDays <= 40) {
        isW = true;
        reason = `Машина установлена ${diffDays} дн. назад (норматив до 40 дней, ввод в эксплуатацию ${d.toLocaleDateString()}). Выезд и работы оформляются по гарантии без оплаты.`;
      }
    }

    if (!isW && currentEq.last_visit_date) {
      const d = new Date(currentEq.last_visit_date);
      const diffDays = Math.floor((refDate.getTime() - d.getTime()) / (1000 * 3600 * 24));
      if (diffDays >= 0 && diffDays <= 40) {
        isW = true;
        reason = `С момента прошлого обслуживания от ${d.toLocaleDateString()} прошло ${diffDays} дн. (норматив до 40 дней). Случай гарантийный, работы производятся бесплатно.`;
      }
    }

    if (isW) {
      setWarrantyNotice(reason);
      setIsWarranty(true);
      setWarrantyReason(reason);
    } else {
      setWarrantyNotice(null);
    }
  }, [selectedEqCode, allEquipment, currentEq]);

  // AI Recommendation for Engineers & Spare Parts
  const runAiRecommendation = async (
    overrideSymptom?: string,
    overrideModel?: string,
    autoApply = false
  ) => {
    const curModel = overrideModel || model;
    const curSymptom = overrideSymptom !== undefined ? overrideSymptom : symptom;
    if (!curModel) return;

    setIsAiRecommending(true);
    try {
      // 1. Recommend Engineers
      const engData = await api.getEngineerRecommendations(curModel, targetCity, curSymptom);
      if (engData && engData.length > 0) {
        setRecommendedEngineers(engData);
        const topEng = engData[0];
        const topId = topEng.id || topEng.engineer_id;
        if (topId && (autoApply || selectedEngineerId === null)) {
          setSelectedEngineerId(topId);
        }
      }

      // 2. Recommend Parts
      const partsData = await api.recommendParts({
        model: curModel,
        symptom: curSymptom,
        city: targetCity,
        equipment_code: selectedEqCode,
      });

      if (partsData && Array.isArray(partsData)) {
        setAiRecommendedParts(partsData);
        if (autoApply && partsData.length > 0) {
          const newParts: { [code: string]: number } = {};
          partsData.forEach((p: any) => {
            newParts[p.code] = 1;
          });
          setSelectedParts(newParts);
        }
      }

      const engName = engData?.[0]?.full_name || 'Мастер';
      const partsCount = partsData?.length || 0;
      setAiRecommendationSummary(
        `ИИ подобрал: ${partsCount > 0 ? `${partsCount} рекоменд. дет.` : 'диагностика без деталей'} и мастера ${engName}`
      );
    } catch (err) {
      console.error('Failed to run AI recommendation:', err);
    } finally {
      setIsAiRecommending(false);
    }
  };

  // Run AI recommendation on model/symptom/city change
  useEffect(() => {
    if (!model) return;
    const timer = setTimeout(() => {
      runAiRecommendation(symptom, model, false);
    }, 400);
    return () => clearTimeout(timer);
  }, [model, targetCity, symptom, selectedEqCode]);

  // Pre-select fallback engineer if recommendations empty
  useEffect(() => {
    if (recommendedEngineers.length === 0 && cityEngineers.length > 0 && selectedEngineerId === null) {
      setSelectedEngineerId(cityEngineers[0].id);
    }
  }, [cityEngineers, recommendedEngineers, selectedEngineerId]);

  const togglePartSelection = (partCode: string) => {
    setSelectedParts((prev) => {
      const copy = { ...prev };
      if (copy[partCode]) {
        delete copy[partCode];
      } else {
        copy[partCode] = 1;
      }
      return copy;
    });
  };

  // Find which selected parts are out of stock in Moscow
  const outOfStockInMoscowParts = Object.keys(selectedParts)
    .map((code) => allParts.find((p) => p.code === code))
    .filter((p): p is SparePart => Boolean(p && (p.moscow_free ?? 0) <= 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflictError(null);
    setLoading(true);

    try {
      const finalClientName = (clientName || thread?.client_name || '').trim();
      if (!finalClientName) {
        setError('Пожалуйста, укажите наименование компании или клиента');
        setLoading(false);
        return;
      }
      const finalAddress = (
        address ||
        currentEq?.address ||
        (targetCity === 'Тула' ? 'Тула, адрес уточняется' : 'Москва, адрес уточняется')
      ).trim();
      const finalModel = (model || currentEq?.model || 'C100').trim();
      const finalSerial = (serialNumber || currentEq?.serial_number || '—').trim();
      const finalSymptom = (symptom || 'Требуется диагностика и осмотр кофемашины').trim();

      // Ensure engineer assignment
      let engId = selectedEngineerId;
      if (!engId) {
        const fallbackEng = recommendedEngineers[0] || cityEngineers[0];
        if (fallbackEng) {
          engId = fallbackEng.id || fallbackEng.engineer_id;
        }
      }

      // Build reserved parts list
      const reservedList: ReservedPartItem[] = Object.entries(selectedParts).map(([code, qty]) => {
        const part = allParts.find((p) => p.code === code);
        const isLocalFree = targetCity === 'Москва' ? (part?.moscow_free || 0) > 0 : (part?.tula_free || 0) > 0;
        const sourceCity = isLocalFree ? targetCity : (targetCity === 'Москва' ? 'Тула' : 'Москва');
        const transferReq = !isLocalFree;

        return {
          code,
          name: part?.name || code,
          quantity: qty,
          source_city: sourceCity,
          transfer_required: transferReq,
        };
      });

      const eqCodePayload = isCustomCompany || selectedEqCode === 'custom' ? null : (selectedEqCode || null);

      await api.createOrder({
        thread_id: thread?.id,
        client_name: finalClientName,
        equipment_code: eqCodePayload,
        address: finalAddress,
        model: finalModel,
        serial_number: finalSerial,
        symptom: finalSymptom,
        client_assumption: clientAssumption || null,
        is_warranty: isWarranty,
        warranty_reason: warrantyReason || null,
        is_sales_transfer: false,
        engineer_id: engId || null,
        reserved_parts: reservedList,
        created_at: new Date().toISOString(),
      });

      onOrderCreated();
      onClose();
    } catch (err: any) {
      console.error('Order creation error:', err);
      const msg = err.message || 'Ошибка оформления заявки';
      if (msg.includes('уже сформирована заявка') || msg.includes('409') || msg.includes('Conflict')) {
        setConflictError({ message: msg });
        onOrderCreated();
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#16171B] text-[#F3F4F6] rounded-2xl border border-white/[0.08] shadow-2xl max-w-3xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#191A20]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white border border-white/10">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Оформление заявки на выезд и назначение инженера
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                {thread ? `На основе обращения #${thread.thread_number} (${thread.client_name})` : 'Создание сервисной заявки'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-white/[0.06] border border-white/20 flex items-center space-x-2 text-xs text-neutral-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-white" />
            <span>{error}</span>
          </div>
        )}

        {/* Conflict Error Banner */}
        {conflictError && (
          <div className="mx-5 mt-4 p-4 rounded-xl bg-white/[0.06] border border-white/20 flex flex-col space-y-2 text-xs text-white">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
              <span className="font-semibold text-white">Заявка уже зарегистрирована в системе</span>
            </div>
            <p className="text-neutral-300 text-[11px] leading-relaxed">
              {conflictError.message}
            </p>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  onOrderCreated();
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors cursor-pointer"
              >
                Перейти к заявкам на выезд
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* 1. Equipment Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#9CA3AF]">
                1. Клиент и оборудование
              </h3>
              {isCustomCompany ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                  Новая компания (вне базы)
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-neutral-400 border border-white/10">
                  Из реестра договоров
                </span>
              )}
            </div>

            {/* Mode switch tabs: Registry vs New Company */}
            <div className="flex p-1 rounded-xl bg-black/40 border border-white/[0.08] gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsCustomCompany(false);
                  const firstCode = allEquipment.length > 0 ? allEquipment[0].code : 'EQ01';
                  setSelectedEqCode(firstCode);
                  const eq = allEquipment.find((e) => e.code === firstCode);
                  if (eq) {
                    setClientName(eq.client_name);
                    setAddress(eq.address);
                    setModel(eq.model);
                    setSerialNumber(eq.serial_number);
                    setCustomCity(eq.city === 'Тула' ? 'Тула' : 'Москва');
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  !isCustomCompany
                    ? 'bg-white text-black shadow-sm font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Выбрать из реестра ({allEquipment.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCustomCompany(true);
                  setSelectedEqCode('custom');
                  if (!thread) {
                    setClientName('');
                    setAddress('');
                    setModel('C100');
                    setSerialNumber('');
                    setCustomCity('Москва');
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  isCustomCompany
                    ? 'bg-white text-black shadow-sm font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ Новая компания (ввести вручную)</span>
              </button>
            </div>

            {!isCustomCompany ? (
              /* Existing Registry Form */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[#9CA3AF] mb-1">
                    Машина из реестра договора
                  </label>
                  <select
                    value={selectedEqCode}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustomCompany(true);
                        setSelectedEqCode('custom');
                        if (!thread) {
                          setClientName('');
                          setAddress('');
                          setModel('C100');
                          setSerialNumber('');
                        }
                      } else {
                        setSelectedEqCode(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                  >
                    {allEquipment.map((eq) => (
                      <option key={eq.code} value={eq.code}>
                        {eq.code} · {eq.client_name} ({eq.model} №{eq.serial_number}) · {eq.city}
                      </option>
                    ))}
                    <option value="custom">✨ + Ввести новую компанию вручную (вне базы)...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#9CA3AF] mb-1">
                    Клиент / Заведение
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Наименование клиента"
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-[#9CA3AF] mb-1">
                    Адрес заведения
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Адрес заведения"
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <div>
                    <label className="block text-[#9CA3AF] mb-1">
                      Модель
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#9CA3AF] mb-1">
                      Серийный №
                    </label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* New Custom Company Form */
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-start space-x-2.5 text-xs">
                  <Sparkles className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <div className="font-semibold text-white">Новая компания / клиент вне базы</div>
                    <div className="text-[11px] text-neutral-400">
                      Введите название заведения, город и параметры аппарата. Заявка и профиль компании будут автоматически сохранены.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#9CA3AF] mb-1 font-medium">
                      Название компании / заведения <span className="text-white">*</span>
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Например: Кофейня «Эспрессо» или ООО «Север»"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[#1F2026] text-white placeholder:text-neutral-500 outline-none focus:border-white focus:ring-1 focus:ring-white/20 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[#9CA3AF] mb-1 font-medium">
                      Город обслуживания
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomCity('Москва')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          customCity === 'Москва'
                            ? 'bg-white text-black border-white shadow-sm'
                            : 'bg-white/[0.04] text-neutral-300 border-white/10 hover:bg-white/[0.08]'
                        }`}
                      >
                        📍 Москва
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomCity('Тула')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          customCity === 'Тула'
                            ? 'bg-white text-black border-white shadow-sm'
                            : 'bg-white/[0.04] text-neutral-300 border-white/10 hover:bg-white/[0.08]'
                        }`}
                      >
                        📍 Тула
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[#9CA3AF] mb-1 font-medium">
                      Адрес заведения
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      placeholder="Например: Москва, ул. Ленина, д. 24"
                      className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[#9CA3AF] mb-1 font-medium">
                      Модель кофемашины
                    </label>
                    <div className="flex gap-1.5 mb-1.5">
                      {['C100', 'C200', 'C300'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setModel(m)}
                          className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            model === m
                              ? 'bg-white text-black border border-white'
                              : 'bg-white/[0.04] text-neutral-400 hover:text-white border border-white/10'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Или введите другую модель"
                      className="w-full px-3 py-1.5 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[#9CA3AF] mb-1 font-medium">
                      Серийный номер аппарата
                    </label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="Например: 450 или SN-2026 (или «б/н»)"
                      className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white placeholder:text-neutral-500 outline-none focus:border-white/20 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Warranty check */}
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center space-x-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={isWarranty}
                  onChange={(e) => setIsWarranty(e.target.checked)}
                  className="rounded text-white focus:ring-white bg-[#1F2026]"
                />
                <span className="font-semibold text-white">Гарантийный визит (Правило П-9)</span>
              </label>
            </div>

            {warrantyNotice && (
              <div className="p-3 rounded-xl bg-white/10 border border-white/20 text-white flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-white" />
                <div>
                  <span className="font-bold">Рекомендация: случай гарантийный (правило 40 дней): </span>
                  <p className="text-neutral-300 mt-0.5">{warrantyNotice}</p>
                </div>
              </div>
            )}

            {isWarranty && (
              <div className="p-3 rounded-xl bg-white/10 border border-white/20 text-white flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-white" />
                <div>
                  <span className="font-bold">Основание гарантии (Правило П-9): </span>
                  <span className="text-neutral-300">{warrantyReason || 'Обращение в течение 40 дней после ремонта / установки'}</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Symptom and Assumption (Rule П-4) */}
          <div className="space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#9CA3AF]">
              2. Описание проблемы (Правило П-4)
            </h3>

            <div>
              <label className="block text-[#9CA3AF] mb-1">
                Фактический симптом (что происходит, когда и в каком узле)
              </label>
              <textarea
                rows={2}
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                placeholder="Например: протечка воды снизу, непрерывно..."
                className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
              />
            </div>

            <div>
              <label className="block text-[#9CA3AF] mb-1">
                Догадка / комментарий клиента (отдельно от симптома)
              </label>
              <input
                type="text"
                value={clientAssumption}
                onChange={(e) => setClientAssumption(e.target.value)}
                placeholder="Например: клиент предполагает поломку помпы..."
                className="w-full px-3 py-1.5 rounded-xl border border-white/[0.08] bg-black/30 text-white outline-none"
              />
            </div>
          </div>

          {/* AI Recommendation Trigger Button & Summary */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => runAiRecommendation(symptom, model, true)}
              disabled={isAiRecommending}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs sm:text-sm font-extrabold shadow-md border-2 border-white flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 text-black flex-shrink-0 ${isAiRecommending ? 'animate-spin' : ''}`} />
              <span>
                {isAiRecommending
                  ? 'ИИ подбирает детали и лучшего мастера...'
                  : '✨ Подобрать детали и мастера с помощью ИИ'}
              </span>
            </button>

            {aiRecommendationSummary && (
              <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-white flex-shrink-0" />
                  <span className="truncate">{aiRecommendationSummary}</span>
                </div>
                {aiRecommendedParts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newParts: { [code: string]: number } = {};
                      aiRecommendedParts.forEach((p: any) => {
                        newParts[p.code] = 1;
                      });
                      setSelectedParts(newParts);
                    }}
                    className="text-[11px] underline text-neutral-300 hover:text-white font-semibold cursor-pointer whitespace-nowrap ml-2"
                  >
                    Выбрать {aiRecommendedParts.length} дет.
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3. Spare Parts Reservation (Rules П-7 & П-8) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#9CA3AF]">
                3. Резерв деталей со склада (П-7, П-8)
              </h3>
              <span className="text-[11px] text-[#9CA3AF]">
                Основной склад: <strong className="text-white">{targetCity}</strong>
              </span>
            </div>

            {/* Notification Banner: Parts out of stock in Moscow */}
            {outOfStockInMoscowParts.length > 0 && (
              <div className="p-3.5 rounded-xl bg-white/[0.06] border border-white/20 text-neutral-200 text-xs flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
                <div className="space-y-1 w-full">
                  <div className="font-bold text-white">Оповещение по наличию деталей на складе:</div>
                  <div className="space-y-1 pt-0.5">
                    {outOfStockInMoscowParts.map((p) => {
                      const hasTula = (p.tula_free ?? 0) > 0;
                      return (
                        <div key={p.code} className="text-[11px] leading-relaxed p-1.5 rounded bg-black/30 border border-white/[0.06]">
                          {hasTula ? (
                            <span>
                              Детали <strong className="text-white">{p.code} ({p.name})</strong> <span className="text-neutral-300 font-semibold">нет на складе в Москве</span>. Необходимо <strong className="text-white underline">привезти из Тулы</strong> (в наличии {p.tula_free} шт., +1 раб. день на перемещение).
                            </span>
                          ) : (
                            <span>
                              Детали <strong className="text-white">{p.code} ({p.name})</strong> <span className="text-neutral-300 font-semibold">нет на складе ни в Москве, ни в Туле</span>. Необходимо <strong className="text-white underline">срочно купить у поставщика</strong>!
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1.5 border border-white/[0.06] rounded-xl bg-black/20">
              {compatibleParts.map((p) => {
                const isChecked = Boolean(selectedParts[p.code]);
                const aiRec = aiRecommendedParts.find((rp) => rp.code === p.code) ||
                  aiData?.recommended_parts?.find((rp) => rp.code === p.code);
                const isAiRecommended = Boolean(aiRec);
                const localStock = targetCity === 'Москва' ? p.moscow_stock : p.tula_stock;
                const localRes = targetCity === 'Москва' ? p.moscow_reserved : p.tula_reserved;
                const localFree = Math.max(0, localStock - localRes);
                const otherFree = targetCity === 'Москва' ? p.tula_free : p.moscow_free;
                const transferReq = localFree === 0 && otherFree > 0;
                const outOfAllStock = localFree === 0 && otherFree === 0;

                return (
                  <div
                    key={p.code}
                    onClick={() => togglePartSelection(p.code)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start space-x-2.5 ${
                      isChecked
                        ? 'border-white bg-white/10 ring-1 ring-white/20'
                        : isAiRecommended
                        ? 'border-white/40 bg-white/[0.05] hover:bg-white/[0.08]'
                        : 'border-white/[0.08] bg-[#1F2026] hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-0.5 rounded accent-white text-white focus:ring-white bg-[#16171B]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span className="font-semibold text-white truncate text-[11px]">
                            {p.code} · {p.name}
                          </span>
                          {isAiRecommended && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-white text-black flex items-center space-x-0.5 shadow-sm whitespace-nowrap flex-shrink-0">
                              <Sparkles className="w-2.5 h-2.5 text-black" />
                              <span>ИИ</span>
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${
                            localFree > 0
                              ? 'bg-white/15 text-white'
                              : transferReq
                              ? 'bg-white/10 text-neutral-200 border border-white/20'
                              : 'bg-white/[0.05] text-neutral-400 border border-white/10'
                          }`}
                        >
                          {localFree > 0
                            ? `МСК: ${localFree} шт.`
                            : transferReq
                            ? 'Везти из Тулы'
                            : 'Купить (0 шт.)'}
                        </span>
                      </div>

                      {isAiRecommended && aiRec?.diagnostic_reason && (
                        <div className="mt-1 text-[10px] text-neutral-300 leading-tight">
                          <strong className="text-white">Рекомендация ИИ:</strong> {aiRec.diagnostic_reason}
                        </div>
                      )}

                      {/* Stock alerts per part */}
                      {transferReq && (
                        <div className="mt-1 flex items-center space-x-1 text-[10px] text-neutral-300">
                          <Truck className="w-3 h-3 text-white flex-shrink-0" />
                          <span>Нет в МСК: привезти из Тулы ({otherFree} шт., +1 день)</span>
                        </div>
                      )}

                      {outOfAllStock && (
                        <div className="mt-1 flex items-center space-x-1 text-[10px] text-neutral-400">
                          <AlertCircle className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                          <span>Нет на складе: необходимо докупить у поставщика</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Engineer Assignment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#9CA3AF]">
                4. Выбор сервисного инженера ({targetCity})
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(recommendedEngineers.length > 0 ? recommendedEngineers : cityEngineers).map((eng) => {
                const engId = eng.id || eng.engineer_id;
                const isSelected = selectedEngineerId === engId;
                const quals: string[] = eng.qualifications || [];
                const hasModelQual = quals.includes(model) || eng.has_model_qualification;
                const activeOrders = eng.active_orders !== undefined ? eng.active_orders : eng.active_orders_count;
                const isAiTop = eng.is_recommended || (recommendedEngineers.length > 0 && (recommendedEngineers[0].id === engId || recommendedEngineers[0].engineer_id === engId));

                return (
                  <div
                    key={engId}
                    onClick={() => setSelectedEngineerId(engId)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-white bg-white/15 ring-2 ring-white/25'
                        : isAiTop
                        ? 'border-white/40 bg-white/[0.06] hover:bg-white/10 ring-1 ring-white/20'
                        : 'border-white/[0.08] bg-[#1F2026] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      {isAiTop && (
                        <div className="text-[10px] text-white font-bold flex items-center space-x-1 mb-1">
                          <Sparkles className="w-3 h-3 text-white flex-shrink-0" />
                          <span className="truncate">{eng.recommendation_reason || `Рекомендован ИИ (опыт по ${model}, свободный график)`}</span>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white">{eng.full_name}</span>
                        {activeOrders !== undefined && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              activeOrders === 0
                                ? 'bg-white/15 text-white'
                                : 'bg-white/10 text-neutral-300'
                            }`}
                          >
                            {activeOrders === 0 ? '0 заявок' : `${activeOrders} заявк.`}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1 mt-1 text-[11px] text-[#9CA3AF]">
                        <span>Допуски: {quals.length > 0 ? quals.join(', ') : model}</span>
                        {hasModelQual ? (
                          <span className="text-white font-medium">(допущен)</span>
                        ) : (
                          <span className="text-neutral-400 font-medium">(нет допуска к {model})</span>
                        )}
                        {eng.model_experience_count > 0 && (
                          <span className="text-neutral-300 font-medium">
                            • {eng.model_experience_count} рем. {model}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'border-white bg-white'
                          : 'border-white/[0.2]'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer: Error and Submit */}
          <div className="pt-3 border-t border-white/[0.08] space-y-2">
            {error && (
              <div className="p-2.5 rounded-xl bg-white/[0.08] border border-white/20 text-xs text-neutral-200 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {conflictError && (
              <div className="p-2.5 rounded-xl bg-white/[0.08] border border-white/20 text-xs text-neutral-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
                  <span>{conflictError.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOrderCreated();
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded bg-white text-black font-semibold text-[11px] ml-2 cursor-pointer"
                >
                  Перейти в заявки
                </button>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/[0.1] hover:bg-white/[0.05] text-[#F0F5F2] transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 font-bold rounded-xl bg-white hover:bg-neutral-200 text-black shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? 'Оформление...' : 'Подтвердить и назначить инженера'}</span>
                <CheckCircle2 className="w-4 h-4 text-black" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
