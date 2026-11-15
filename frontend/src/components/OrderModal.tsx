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

  const [selectedEqCode, setSelectedEqCode] = useState<string>(
    aiData?.detected_equipment_code || thread?.equipment_code || 'EQ01'
  );
  const [clientName, setClientName] = useState<string>(thread?.client_name || '');
  const [address, setAddress] = useState<string>('');
  const [model, setModel] = useState<string>('C100');
  const [serialNumber, setSerialNumber] = useState<string>('');
  const [symptom, setSymptom] = useState<string>(
    aiData?.draft_symptom || 'Требуется диагностика и осмотр кофемашины'
  );
  const [clientAssumption, setClientAssumption] = useState<string>(
    aiData?.client_assumption || ''
  );
  const [isWarranty, setIsWarranty] = useState<boolean>(
    aiData?.is_warranty || thread?.is_warranty || false
  );
  const [warrantyReason, setWarrantyReason] = useState<string>(
    aiData?.warranty_reason || thread?.warranty_reason || ''
  );
  const [isSalesTransfer, setIsSalesTransfer] = useState<boolean>(
    aiData?.is_unregistered_machine || thread?.is_unregistered || false
  );
  const [selectedEngineerId, setSelectedEngineerId] = useState<number | null>(null);
  const [selectedParts, setSelectedParts] = useState<{ [code: string]: number }>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync selected equipment
  useEffect(() => {
    const eq = allEquipment.find((e) => e.code === selectedEqCode);
    if (eq) {
      setClientName(eq.client_name);
      setAddress(eq.address);
      setModel(eq.model);
      setSerialNumber(eq.serial_number);
    }
  }, [selectedEqCode, allEquipment]);

  // Set initial equipment from thread/AI
  useEffect(() => {
    if (aiData?.detected_equipment_code) {
      setSelectedEqCode(aiData.detected_equipment_code);
    } else if (thread?.equipment_code) {
      setSelectedEqCode(thread.equipment_code);
    }
    if (aiData?.draft_symptom) {
      setSymptom(aiData.draft_symptom);
    }
    if (aiData?.client_assumption) {
      setClientAssumption(aiData.client_assumption);
    }
    if (aiData?.is_warranty !== undefined) {
      setIsWarranty(aiData.is_warranty);
      setWarrantyReason(aiData.warranty_reason || '');
    }
    if (aiData?.is_unregistered_machine !== undefined) {
      setIsSalesTransfer(aiData.is_unregistered_machine);
    }
  }, [aiData, thread]);

  // Pre-select recommended parts from AI or dispatcher selection
  useEffect(() => {
    if (aiData?.recommended_parts && aiData.recommended_parts.length > 0) {
      const initial: { [code: string]: number } = {};
      aiData.recommended_parts.forEach((p) => {
        initial[p.code] = 1;
      });
      setSelectedParts(initial);
    }
  }, [aiData]);

  // Selected equipment object
  const currentEq = allEquipment.find((e) => e.code === selectedEqCode);
  const targetCity = currentEq?.city || 'Москва';

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
        reason = `Машина установлена ${diffDays} дн. назад (норматив до 40 дней, ввод в эксплуатацию ${d.toLocaleDateString()}). Предлагается оформить по гарантии без оплаты за работы.`;
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

  const [recommendedEngineers, setRecommendedEngineers] = useState<any[]>([]);

  // Smart Engineer Ranking: Prioritize fewest active orders + journal model/symptom experience
  useEffect(() => {
    if (!model) return;
    api.getEngineerRecommendations(model, targetCity, symptom)
      .then((data) => {
        if (data && data.length > 0) {
          setRecommendedEngineers(data);
          // Auto pre-select the highest ranked engineer (fewest orders + history experience)
          setSelectedEngineerId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to get engineer recommendations:', err);
      });
  }, [model, targetCity, symptom]);

  // Pre-select fallback if recommendations not loaded
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
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

      await api.createOrder({
        thread_id: thread?.id,
        client_name: clientName,
        equipment_code: isSalesTransfer ? null : selectedEqCode,
        address,
        model,
        serial_number: serialNumber,
        symptom,
        client_assumption: clientAssumption || null,
        is_warranty: isWarranty,
        warranty_reason: warrantyReason || null,
        is_sales_transfer: isSalesTransfer,
        engineer_id: isSalesTransfer ? null : selectedEngineerId,
        reserved_parts: reservedList,
        created_at: new Date().toISOString(),
      });

      onOrderCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка оформления заявки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-[#16171B] text-[#F3F4F6] rounded-2xl border border-white/[0.08] shadow-modal max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Оформление заявки на выезд и назначение инженера
              </h2>
              <p className="text-xs text-[#8E9E94]">
                {thread ? `На основе обращения #${thread.thread_number} (${thread.client_name})` : 'Создание заявки в 1 клик'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#8E9E94] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/25 flex items-center space-x-2 text-xs text-[#FF453A]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* 1. Equipment Selection */}
          <div className="space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#8E9E94]">
              1. Данные оборудования
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#8E9E94] mb-1">
                  Машина из реестра договора
                </label>
                <select
                  disabled={isSalesTransfer}
                  value={selectedEqCode}
                  onChange={(e) => setSelectedEqCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                >
                  {allEquipment.map((eq) => (
                    <option key={eq.code} value={eq.code}>
                      {eq.code} · {eq.client_name} ({eq.model} №{eq.serial_number}) · {eq.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#8E9E94] mb-1">
                  Клиент / Заведение
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="block text-[#8E9E94] mb-1">
                  Адрес заведения
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#8E9E94] mb-1">
                    Модель
                  </label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#8E9E94] mb-1">
                    Серийный №
                  </label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Checkboxes row: Warranty & Sales transfer */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center space-x-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={isWarranty}
                  onChange={(e) => setIsWarranty(e.target.checked)}
                  className="rounded text-[#FF453A] focus:ring-[#FF453A] bg-[#1F2026]"
                />
                <span className="font-semibold text-[#FF453A]">Гарантийный визит (Правило П-9)</span>
              </label>

              <label className="flex items-center space-x-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSalesTransfer}
                  onChange={(e) => setIsSalesTransfer(e.target.checked)}
                  className="rounded text-[#FF9F0A] focus:ring-[#FF9F0A] bg-[#1F2026]"
                />
                <span className="font-semibold text-[#FF9F0A]">
                  Передать в отдел продаж (машина вне реестра П-2)
                </span>
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
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Основание гарантии (Правило П-9): </span>
                  <span className="text-neutral-300">{warrantyReason || 'Обращение в течение 40 дней после ремонта / установки'}</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Symptom and Assumption (Rule П-4) */}
          <div className="space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#8E9E94]">
              2. Описание проблемы (Правило П-4)
            </h3>

            <div>
              <label className="block text-[#8E9E94] mb-1">
                Фактический симптом (что происходит, когда и в каком месте машины)
              </label>
              <textarea
                required
                rows={2}
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                placeholder="Например: течь справа после завершения приготовления..."
                className="w-full px-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
              />
            </div>

            <div>
              <label className="block text-[#8E9E94] mb-1">
                Догадка / комментарий клиента (отдельно от симптома)
              </label>
              <input
                type="text"
                value={clientAssumption}
                onChange={(e) => setClientAssumption(e.target.value)}
                placeholder="Например: клиент просит сразу привезти новый насос..."
                className="w-full px-3 py-1.5 rounded-xl border border-white/[0.08] bg-black/30 text-white outline-none"
              />
            </div>
          </div>

          {/* 3. Spare Parts Reservation (Rules П-7 & П-8) */}
          {!isSalesTransfer && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#8E9E94]">
                  3. Резерв деталей со склада (П-7, П-8)
                </h3>
                <span className="text-[11px] text-[#8E9E94]">
                  Склад города: <strong className="text-white">{targetCity}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-white/[0.06] rounded-xl bg-black/20">
                {compatibleParts.map((p) => {
                  const isChecked = Boolean(selectedParts[p.code]);
                  const localStock = targetCity === 'Москва' ? p.moscow_stock : p.tula_stock;
                  const localRes = targetCity === 'Москва' ? p.moscow_reserved : p.tula_reserved;
                  const localFree = Math.max(0, localStock - localRes);
                  const otherFree = targetCity === 'Москва' ? p.tula_free : p.moscow_free;
                  const transferReq = localFree === 0 && otherFree > 0;

                  return (
                    <div
                      key={p.code}
                      onClick={() => togglePartSelection(p.code)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start space-x-2.5 ${
                        isChecked
                          ? 'border-white bg-white/10'
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
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white truncate">
                            {p.code} · {p.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              localFree > 0
                                ? 'bg-white/15 text-white'
                                : transferReq
                                ? 'bg-[#FF9F0A]/15 text-[#FF9F0A]'
                                : 'bg-white/[0.06] text-[#8E9E94]'
                            }`}
                          >
                            {localFree > 0 ? `Свободно: ${localFree}` : transferReq ? 'Перевозка' : '0'}
                          </span>
                        </div>

                        {transferReq && (
                          <div className="mt-1 flex items-center space-x-1 text-[10px] text-[#FF9F0A]">
                            <Truck className="w-3 h-3" />
                            <span>Доступно со склада др. города (+1 раб. день)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Engineer Assignment */}
          {!isSalesTransfer && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#8E9E94]">
                  4. Выбор сервисного инженера ({targetCity})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(recommendedEngineers.length > 0 ? recommendedEngineers : cityEngineers).map((eng) => {
                  const isSelected = selectedEngineerId === eng.id;
                  const hasModelQual = eng.qualifications.includes(model);

                  return (
                    <div
                      key={eng.id}
                      onClick={() => setSelectedEngineerId(eng.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-white bg-white/15 ring-2 ring-white/25'
                          : 'border-white/[0.08] bg-[#1F2026] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        {eng.is_recommended && (
                          <div className="text-[10px] text-white font-bold flex items-center space-x-1 mb-1">
                            <Sparkles className="w-3 h-3 text-white flex-shrink-0" />
                            <span className="truncate">{eng.recommendation_reason}</span>
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">{eng.full_name}</span>
                          {eng.active_orders !== undefined && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                eng.active_orders === 0
                                  ? 'bg-white/15 text-white'
                                  : 'bg-[#FF9F0A]/20 text-[#FF9F0A]'
                              }`}
                            >
                              {eng.active_orders === 0 ? '0 заявок' : `${eng.active_orders} заявк.`}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1 mt-1 text-[11px] text-[#8E9E94]">
                          <span>Допуски: {eng.qualifications.join(', ')}</span>
                          {hasModelQual ? (
                            <span className="text-white font-medium">(допущен)</span>
                          ) : (
                            <span className="text-[#FF453A] font-medium">(нет допуска к {model})</span>
                          )}
                          {eng.model_experience_count > 0 && (
                            <span className="text-neutral-300 font-medium">
                              • {eng.model_experience_count} рем. {model} в журнале
                            </span>
                          )}
                          {eng.symptom_match_count > 0 && (
                            <span className="text-white font-medium">
                              • опыт по симптому
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
          )}

          {/* Submit buttons */}
          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/[0.1] hover:bg-white/[0.05] text-[#F0F5F2] transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 font-bold rounded-xl bg-white hover:bg-neutral-200 text-black shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <span>{loading ? 'Сохранение...' : 'Подтвердить и назначить инженера'}</span>
              <CheckCircle2 className="w-4 h-4 text-black" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
