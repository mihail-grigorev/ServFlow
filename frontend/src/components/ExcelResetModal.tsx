import React, { useState } from 'react';
import { api } from '../api';
import {
  X,
  RotateCcw,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ExcelResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataReset: () => void;
}

export const ExcelResetModal: React.FC<ExcelResetModalProps> = ({
  isOpen,
  onClose,
  onDataReset,
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleReset = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.resetData();
      setSuccessMsg(res.message);
      onDataReset();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сброса данных');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.uploadExcel(selectedFile);
      setSuccessMsg(res.message);
      onDataReset();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка загрузки файла');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#4A6751]/15 border border-[#6E9078]/25 text-[#6E9078]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F5F2]">
                Сброс и импорт данных
              </h2>
              <p className="text-xs text-[#8E9E94]">
                Восстановление 23 обращений и остатков кейса
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#8E9E94] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {successMsg && (
            <div className="p-3 rounded-xl bg-[#30D158]/15 border border-[#30D158]/25 flex items-center space-x-2 text-[#30D158] font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/25 flex items-center space-x-2 text-[#FF453A] font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Option 1: 1-Click Reset to 23 requests */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#16221B] space-y-2">
            <h3 className="font-semibold text-sm text-[#F0F5F2] flex items-center space-x-2">
              <RotateCcw className="w-4 h-4 text-[#6E9078]" />
              <span>Сбросить данные к началу защиты</span>
            </h3>
            <p className="text-[#8E9E94] leading-relaxed">
              Мгновенно восстанавливает базу данных: 5 демо-пользователей, 12 машин из реестра, 10 деталей склада и 23 утренних обращения на 16.11.2026.
            </p>
            <button
              onClick={handleReset}
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-xl bg-[#4A6751] hover:bg-[#0077ED] text-white font-semibold transition-colors flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-40"
            >
              <span>{loading ? 'Сброс базы данных...' : 'Сбросить базу данных в 1 клик'}</span>
            </button>
          </div>

          {/* Option 2: Upload custom Excel file */}
          <form onSubmit={handleFileUpload} className="p-4 rounded-xl border border-white/[0.08] bg-[#16221B] space-y-2.5">
            <h3 className="font-semibold text-sm text-[#F0F5F2] flex items-center space-x-2">
              <Upload className="w-4 h-4 text-[#FF9F0A]" />
              <span>Загрузить свой файл Excel (.xlsx)</span>
            </h3>
            <p className="text-[#8E9E94]">
              Файл должен содержать листы: «Заявки», «Оборудование», «Запчасти», «Правила».
            </p>

            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-[#8E9E94] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/[0.08] file:text-[#F0F5F2] hover:file:bg-white/[0.12] cursor-pointer"
            />

            <button
              type="submit"
              disabled={loading || !selectedFile}
              className="w-full py-2 rounded-xl border border-white/[0.12] hover:bg-white/[0.06] disabled:opacity-40 font-medium text-[#F0F5F2] transition-colors"
            >
              Импортировать из загруженного файла
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
