import React, { useState } from 'react';
import { api } from '../api';
import {
  X,
  Sparkles,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Wrench,
  ShieldAlert,
  UserCheck,
  Package,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface BatchAiOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BatchAiOrdersModal: React.FC<BatchAiOrdersModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUploadAndProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    setLoadingStep('Чтение файла Excel и разбор строк обращений...');

    try {
      setTimeout(() => setLoadingStep('ИИ сопоставляет адреса и реестр оборудования (Правила П-1, П-2)...'), 600);
      setTimeout(() => setLoadingStep('Проверка 40-дневной гарантии и подбор запчастей со складов (П-7, П-8, П-9)...'), 1300);
      setTimeout(() => setLoadingStep('Оптимальное распределение инженеров по городам и допускам...'), 2000);

      const res = await api.aiBatchCreateFromExcel(selectedFile);
      setResult(res);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка обработки Excel файла ИИ');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessExistingThreads = async () => {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    setLoadingStep('ИИ анализирует открытые обращения из кейса...');

    try {
      setTimeout(() => setLoadingStep('ИИ проверяет гарантию 40 дней и подбирает запчасти со складов...'), 800);
      setTimeout(() => setLoadingStep('Формирование номеров заявок и назначение инженеров...'), 1600);

      const res = await api.aiBatchProcessThreads();
      setResult(res);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка обработки обращений ИИ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#16171B] rounded-2xl border border-white/[0.1] shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#F3F4F6]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-white/10 border border-white/20 text-white flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
                <span>ИИ-составление заявок из Excel</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-black font-extrabold uppercase">
                  Автопилот
                </span>
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Загрузите файл Excel с обращениями клиентов — ИИ сам сформирует все сервисные заявки
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

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-white/[0.06] border border-white/20 flex items-start space-x-2.5 text-neutral-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-neutral-300 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Ошибка обработки:</div>
                <div>{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-8 px-4 rounded-2xl border border-white/20 bg-white/[0.03] flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <RefreshCw className="w-6 h-6 animate-spin text-white" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-white">ИИ составляет сервисные заявки...</div>
                <div className="text-xs text-neutral-300 font-medium animate-pulse">
                  {loadingStep || 'Обработка данных...'}
                </div>
              </div>
              <div className="w-full max-w-md bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div className="bg-white h-full w-2/3 animate-pulse rounded-full" />
              </div>
            </div>
          )}

          {/* Result view */}
          {result && !loading && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/10 border border-white/25 flex items-start space-x-3 text-white">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-white mt-0.5" />
                <div className="space-y-1">
                  <div className="font-extrabold text-sm">{result.message}</div>
                  <div className="text-neutral-300 text-[11px] flex flex-wrap gap-x-4 gap-y-1">
                    <span>Всего обращений: <strong className="text-white">{result.total_requests}</strong></span>
                    <span>Создано заявок на выезд: <strong className="text-white">{result.total_orders_created}</strong></span>
                    <span>Передано в продажи (П-2): <strong className="text-white">{result.total_sales_transfers}</strong></span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">
                  Сформированные заявки ({result.orders?.length || 0}):
                </h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {result.orders?.map((o: any, idx: number) => (
                    <div
                      key={o.order_number || idx}
                      className="p-3 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-xs">{o.order_number}</span>
                          <span className="text-[11px] font-semibold text-neutral-300">{o.client_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/15">
                            {o.model} (№{o.serial_number})
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          {o.is_warranty && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-black">
                              Гарантия (П-9)
                            </span>
                          )}
                          {o.is_sales_transfer && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/15 text-neutral-200 border border-white/20">
                              Отдел продаж (П-2)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-[#9CA3AF] line-clamp-2">
                        {o.symptom}
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 border-t border-white/[0.05] gap-2">
                        <div className="flex items-center space-x-1 text-white">
                          <UserCheck className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Мастер: <strong>{o.engineer_name || 'Не назначен'}</strong></span>
                        </div>
                        <div className="flex items-center space-x-1 text-[#9CA3AF]">
                          <Package className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="truncate max-w-xs">{o.parts_summary || 'Без деталей'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Form when not loading and no result yet */}
          {!loading && !result && (
            <div className="space-y-4">
              {/* Option 1: Upload Excel File */}
              <form onSubmit={handleUploadAndProcess} className="p-4 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-3">
                <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                  <Upload className="w-4 h-4 text-white" />
                  <span>Вариант 1: Загрузить файл Excel (.xlsx)</span>
                </div>
                <p className="text-[#9CA3AF] text-xs">
                  Подходит для файла с листом «Заявки» (колонки: №, Время, Канал, Кто обращается, Текст обращения)
                </p>

                <div className="relative border-2 border-dashed border-white/20 hover:border-white/40 rounded-xl p-4 text-center transition-all bg-black/20">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center space-y-1.5 pointer-events-none">
                    <FileSpreadsheet className="w-8 h-8 text-neutral-300" />
                    {selectedFile ? (
                      <div>
                        <div className="font-bold text-white text-xs">{selectedFile.name}</div>
                        <div className="text-[10px] text-[#9CA3AF]">
                          {(selectedFile.size / 1024).toFixed(1)} КБ · Готов к обработке ИИ
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-white text-xs">Выберите или перетащите .xlsx файл</div>
                        <div className="text-[10px] text-[#9CA3AF]">Например: Данные_к_кейсу_06.xlsx</div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedFile}
                  className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black font-extrabold text-xs shadow-md border-2 border-white flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4 text-black flex-shrink-0" />
                  <span>✨ Загрузить Excel и составить все заявки с помощью ИИ</span>
                </button>
              </form>

              {/* Option 2: Quick process loaded case threads */}
              <div className="p-4 rounded-xl border border-white/[0.08] bg-[#1F2026] space-y-3">
                <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Вариант 2: Составить заявки для всех обращений кейса</span>
                </div>
                <p className="text-[#9CA3AF] text-xs">
                  ИИ обработает все 13 веток обращений, определит модели, проверит гарантию 40 дней, зарезервирует детали и назначит свободных мастеров.
                </p>

                <button
                  type="button"
                  onClick={handleProcessExistingThreads}
                  className="w-full py-2.5 px-4 rounded-xl border border-white/20 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98] transition-all"
                >
                  <Sparkles className="w-4 h-4 text-white flex-shrink-0" />
                  <span>✨ Составить заявки для всех открытых обращений через ИИ</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-end space-x-2">
          {result ? (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all cursor-pointer shadow-sm flex items-center space-x-1.5"
            >
              <span>Готово (к заявкам)</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/[0.1] hover:bg-white/[0.05] text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
