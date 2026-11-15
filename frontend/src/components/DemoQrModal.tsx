import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { DemoCompanyItem } from '../types';

interface DemoQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DemoQrModal({ isOpen, onClose }: DemoQrModalProps) {
  const [companies, setCompanies] = useState<DemoCompanyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDemoCompanies();
      setCompanies(data);
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки QR-кодов');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCompanies();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (comp: DemoCompanyItem) => {
    navigator.clipboard.writeText(comp.url);
    setCopiedToken(comp.token);
    setTimeout(() => {
      setCopiedToken((prev) => (prev === comp.token ? null : prev));
    }, 2000);
  };

  const handleReissueAll = async () => {
    if (!confirm('Вы уверены? Старые QR-коды перестанут действовать, будут выпущены новые.')) {
      return;
    }
    setActionLoading(true);
    try {
      await api.issueAllDemoQr();
      await loadCompanies();
    } catch (err: any) {
      alert(err.message || 'Ошибка перевыпуска QR-кодов');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Вы уверены, что хотите отозвать все активные QR-коды для зрителей?')) {
      return;
    }
    setActionLoading(true);
    try {
      await api.revokeAllDemoQr();
      await loadCompanies();
    } catch (err: any) {
      alert(err.message || 'Ошибка отзыва QR-кодов');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #demo-qr-print-area, #demo-qr-print-area * {
            visibility: visible !important;
          }
          #demo-qr-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 16px !important;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px dashed #777 !important;
            padding: 12px !important;
            page-break-inside: avoid !important;
            color: black !important;
            background: white !important;
            text-align: center !important;
          }
          .print-card svg {
            width: 140px !important;
            height: 140px !important;
            margin: 0 auto !important;
          }
          .print-card .print-text {
            color: black !important;
            font-size: 11px !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#111215] border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/60 no-print">
          <div>
            <h2 className="text-lg font-medium text-neutral-100">
              QR-коды для зрителей
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Вход без пароля от имени клиентов. До 30 параллельных сессий на каждую компанию.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoading || actionLoading || companies.length === 0}
              className="px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              Печать (А4)
            </button>
            <button
              onClick={handleReissueAll}
              disabled={isLoading || actionLoading}
              className="px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg transition-colors"
            >
              Выпустить заново
            </button>
            <button
              onClick={handleRevokeAll}
              disabled={isLoading || actionLoading}
              className="px-3 py-1.5 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 hover:text-neutral-200 rounded-lg transition-colors"
            >
              Отозвать все
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 rounded-lg transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#0E0F12]">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-neutral-400">
              Загрузка карточек компаний...
            </div>
          ) : companies.length === 0 ? (
            <div className="py-16 text-center text-sm text-neutral-400">
              Нет доступных компаний в реестре
            </div>
          ) : (
            <div id="demo-qr-print-area" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {companies.map((comp) => {
                const isCopied = copiedToken === comp.token;
                return (
                  <div
                    key={comp.company_id}
                    className="print-card bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-between text-center transition-colors hover:border-neutral-700"
                  >
                    <div className="w-full mb-3">
                      <div className="font-medium text-sm text-neutral-100 print-text">
                        {comp.company_name}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5 print-text">
                        {comp.city || 'Регион'} · сессий: {comp.uses}/{comp.max_uses}
                      </div>
                    </div>

                    {/* QR Code SVG */}
                    <div
                      className="w-36 h-36 bg-white p-2 rounded-lg flex items-center justify-center border border-neutral-700 shadow-sm [&_svg]:w-full [&_svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: comp.qr_svg }}
                    />

                    <div className="w-full mt-3 flex flex-col gap-1.5 no-print">
                      <div className="text-[11px] text-neutral-500 font-mono truncate px-1">
                        /demo/enter?t={comp.token.substring(0, 10)}...
                      </div>
                      <button
                        onClick={() => handleCopy(comp)}
                        className={`w-full py-1.5 px-3 text-xs rounded-lg border transition-colors ${
                          isCopied
                            ? 'bg-neutral-800 border-neutral-600 text-neutral-100 font-medium'
                            : 'bg-neutral-800/80 hover:bg-neutral-700/80 border-neutral-700 text-neutral-300'
                        }`}
                      >
                        {isCopied ? 'Ссылка скопирована' : 'Копировать ссылку'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-900/40 text-xs text-neutral-400 flex items-center justify-between no-print">
          <div>
            Срок действия выданных QR-кодов: 6 часов. Зрители открывают обращение своей компании.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
