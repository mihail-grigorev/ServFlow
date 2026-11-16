import React, { useState } from 'react';
import logoImg from '../assets/logo.png';
import {
  FileText,
  Mail,
  ExternalLink,
  CheckCircle2,
  Lock,
  X
} from 'lucide-react';

export const Footer: React.FC = () => {
  const [modalType, setModalType] = useState<'rules' | 'security' | 'testing' | 'license' | null>(null);

  return (
    <footer className="w-full max-w-[1700px] mx-auto px-3 sm:px-6 py-4 mt-6 text-[#F3F4F6]">
      {/* Lightweight, Compact Cryptoverse X Card */}
      <div className="rounded-2xl bg-[#16171B]/95 border border-white/[0.08] p-4 sm:p-5 shadow-lg backdrop-blur-md">
        {/* Top compact line: Brand, Contacts & Hubs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <img
              src={logoImg}
              alt="ServFlow"
              className="w-6 h-6 rounded-lg object-contain bg-white/5 p-0.5 border border-white/10 flex-shrink-0"
            />
            <div className="flex items-center space-x-2 truncate">
              <span className="font-bold text-sm text-white tracking-wide">ServFlow</span>
              <span className="text-xs text-neutral-400 truncate hidden xs:inline">
                · Сервисный центр кофемашин
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] text-neutral-300 font-mono hidden sm:inline">
              Москва & Тула
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <a
              href="mailto:servflow@yandex.ru"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-all active:scale-95 shadow-sm"
            >
              <Mail className="w-3.5 h-3.5 text-black" />
              <span>servflow@yandex.ru</span>
            </a>
          </div>
        </div>

        {/* Bottom compact line: Interactive quick chips & copyright */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 text-[11px] text-[#8E9E94]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModalType('rules')}
              className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-neutral-300 hover:text-white border border-white/[0.08] transition-colors"
            >
              <FileText className="w-3 h-3 text-neutral-400" />
              <span>Регламенты П-1..П-10</span>
            </button>

            <button
              type="button"
              onClick={() => setModalType('security')}
              className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-neutral-300 hover:text-white border border-white/[0.08] transition-colors"
            >
              <Lock className="w-3 h-3 text-neutral-400" />
              <span>152-ФЗ / ГОСТ</span>
            </button>

            <button
              type="button"
              onClick={() => setModalType('testing')}
              className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-neutral-300 hover:text-white border border-white/[0.08] transition-colors"
            >
              <CheckCircle2 className="w-3 h-3 text-neutral-400" />
              <span>Тесты (TESTING.md)</span>
            </button>

            <button
              type="button"
              onClick={() => setModalType('license')}
              className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-neutral-300 hover:text-white border border-white/[0.08] transition-colors"
            >
              <ExternalLink className="w-3 h-3 text-neutral-400" />
              <span>Лицензия MIT</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 pt-1 sm:pt-0">
            <span>© 2026 ServFlow</span>
            <span>·</span>
            <span>24/7 Сервис</span>
          </div>
        </div>
      </div>

      {/* Info Modals */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl max-h-[85vh] bg-[#16171B] border border-white/20 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col text-white">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {modalType === 'rules' && (
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
                  <FileText className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold">Регламенты сервисного обслуживания (П-1 .. П-10)</h3>
                </div>
                <div className="space-y-2 text-xs text-neutral-300">
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-1: Авторизация и доступ</span>
                    Разделение прав между диспетчером, сертифицированным инженером и представителем кофейни.
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-2: Идентификация кофейни и оборудования</span>
                    Каждое обращение привязывается к серийному номеру и модели кофемашины из реестра.
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-3: Уточняющий диалог при неполноте данных</span>
                    Если клиент не указал симптомы или модель, диспетчер запрашивает уточнения до оформления наряда.
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-4: Разделение объективного симптома и догадки клиента</span>
                    В наряд заносится реальное проявление поломки («течет снизу»), а клиентская версия («взорвалась помпа») фиксируется отдельно.
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-5: Оборудование вне договора (Ромашка)</span>
                    Если обращение от незарегистрированного клиента, предлагается заключение сервисного договора.
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-6: Квалификация инженера</span>
                    Назначение инженера только с квалификацией под модель кофемашины (C100, C200, Mini, Pro).
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-7: Совместимость запчастей</span>
                    Строгая проверка применяемости деталей к обслуживаемой серии аппарата.
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-8: Складской резерв и перемещение</span>
                    Резервирование на центральном складе Москвы; при отсутствии деталь запрашивается из хаба в Туле (+1 рабочий день).
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-9: Гарантийный статус ремонта</span>
                    Если с момента предыдущего выезда прошло менее 30 дней и поломка аналогична, выезд помечается как гарантийный.
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-10: Оформление наряда диспетчером</span>
                    Фиксация полного наряда, уведомление клиента и передача инженеру в маршрутный лист.
                  </div>
                </div>
              </div>
            )}

            {modalType === 'security' && (
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
                  <Lock className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold">Политика безопасности (SECURITY.md)</h3>
                </div>
                <div className="space-y-2 text-xs text-neutral-300">
                  <p>Система ServFlow соблюдает требования 152-ФЗ «О персональных данных» и ГОСТ Р 58412-2019:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Хеширование паролей bcrypt с криптографической солью.</li>
                    <li>JWT-авторизация с контролем времени жизни токена.</li>
                    <li>Ролевой контроль доступа (RBAC) на всех API эндпоинтах.</li>
                    <li>Изоляция данных между кофейнями и сервисным центром.</li>
                  </ul>
                </div>
              </div>
            )}

            {modalType === 'testing' && (
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold">Протокол верификации и тестов (TESTING.md)</h3>
                </div>
                <div className="space-y-2 text-xs text-neutral-300">
                  <p>Полное покрытие автоматизированными тестами:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>12 комплексных шагов сквозного тестирования: 100% PASS.</li>
                    <li>Тесты безопасности и защиты IDOR: 100% PASS.</li>
                    <li>Тесты логики регламентов П-1..П-10: 100% PASS.</li>
                  </ul>
                </div>
              </div>
            )}

            {modalType === 'license' && (
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
                  <ExternalLink className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold">Лицензия MIT (LICENSE)</h3>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-[11px] text-neutral-300 space-y-1.5">
                  <p>MIT License · Copyright (c) 2026 ServFlow Contributors</p>
                  <p className="text-[10px] leading-relaxed text-neutral-400">
                    Permission is hereby granted, free of charge, to any person obtaining a copy
                    of this software and associated documentation files...
                  </p>
                </div>
              </div>
            )}

            <div className="pt-3 mt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
