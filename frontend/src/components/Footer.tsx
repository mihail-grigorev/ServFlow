import React, { useState } from 'react';
import logoImg from '../assets/logo.png';
import {
  ShieldCheck,
  FileText,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Lock,
  Layers,
  Wrench,
  Clock,
  X,
  Truck
} from 'lucide-react';

export const Footer: React.FC = () => {
  const [modalType, setModalType] = useState<'rules' | 'security' | 'testing' | 'license' | null>(null);

  return (
    <footer className="w-full max-w-[1700px] mx-auto p-4 sm:p-6 lg:p-8 mt-12 text-[#F3F4F6]">
      {/* Cryptoverse X Style Dark Card Container */}
      <div className="relative rounded-3xl bg-[#16171B]/95 border border-white/[0.08] p-6 sm:p-10 lg:p-12 shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

        {/* Top Feature Banner */}
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-10 border-b border-white/[0.08]">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs font-mono text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>ServFlow Core 2.0 · Сервисный центр</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white">
              Интеллектуальная платформа сервиса кофемашин
            </h2>
            <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
              Автоматизированная диспетчеризация обращений, соблюдение регламентов П-1..П-10, логистика запчастей Москва–Тула и телеметрия в едином контуре безопасности.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="tel:88005553535"
              className="px-5 py-3 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold flex items-center space-x-2 shadow-lg transition-all active:scale-95"
            >
              <Phone className="w-4 h-4 text-black" />
              <span>8 (800) 555-35-35</span>
            </a>
            <a
              href="mailto:support@kofeservice.ru"
              className="px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/10 text-white border border-white/[0.1] text-xs font-medium flex items-center space-x-2 transition-all active:scale-95"
            >
              <Mail className="w-4 h-4 text-white" />
              <span>support@kofeservice.ru</span>
            </a>
          </div>
        </div>

        {/* 4-Column Navigation & Info Grid */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 py-10 border-b border-white/[0.08] text-xs">
          {/* Column 1: Brand & Overview */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <img src={logoImg} alt="ServFlow Logo" className="w-8 h-8 rounded-xl object-contain bg-white/5 p-1 border border-white/10" />
              <div>
                <span className="font-bold text-base text-white tracking-wide">ServFlow</span>
                <span className="block text-[10px] text-[#8E9E94] font-mono">Service Management OS</span>
              </div>
            </div>
            <p className="text-neutral-400 text-xs leading-relaxed">
              Единая система управления выездным ремонтом кофемашин, складскими запасами в Москве и Туле и прозрачной гарантией.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-neutral-300 font-mono">
                ГОСТ Р 58412
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-neutral-300 font-mono">
                152-ФЗ ПДн
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-neutral-300 font-mono">
                MIT License
              </span>
            </div>
          </div>

          {/* Column 2: Platform Sections */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-neutral-300" />
              <span>Разделы системы</span>
            </h3>
            <ul className="space-y-2 text-neutral-400">
              <li className="hover:text-white transition-colors cursor-default">
                · Пульт диспетчера и чат с клиентом
              </li>
              <li className="hover:text-white transition-colors cursor-default">
                · Реестр сервисных заявок и нарядов
              </li>
              <li className="hover:text-white transition-colors cursor-default">
                · Складской учет запчастей (МСК / Тула)
              </li>
              <li className="hover:text-white transition-colors cursor-default">
                · Личный кабинет инженера
              </li>
              <li className="hover:text-white transition-colors cursor-default">
                · Портал клиента (кофейни)
              </li>
              <li className="hover:text-white transition-colors cursor-default">
                · Аналитика SLA и тепловая карта поломок
              </li>
            </ul>
          </div>

          {/* Column 3: Safety, Rules & Licenses */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-300" />
              <span>Регламенты & Лицензии</span>
            </h3>
            <ul className="space-y-2 text-neutral-400">
              <li>
                <button
                  type="button"
                  onClick={() => setModalType('rules')}
                  className="hover:text-white flex items-center space-x-1.5 transition-colors text-left"
                >
                  <FileText className="w-3 h-3 text-white/70" />
                  <span>Регламенты сервиса П-1 .. П-10</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setModalType('security')}
                  className="hover:text-white flex items-center space-x-1.5 transition-colors text-left"
                >
                  <Lock className="w-3 h-3 text-white/70" />
                  <span>Безопасность (SECURITY.md)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setModalType('testing')}
                  className="hover:text-white flex items-center space-x-1.5 transition-colors text-left"
                >
                  <CheckCircle2 className="w-3 h-3 text-white/70" />
                  <span>Протокол тестов (TESTING.md)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setModalType('license')}
                  className="hover:text-white flex items-center space-x-1.5 transition-colors text-left"
                >
                  <ExternalLink className="w-3 h-3 text-white/70" />
                  <span>Лицензия ПО (MIT License)</span>
                </button>
              </li>
              <li className="text-[11px] text-[#8E9E94] pt-1">
                Гарантийный выезд по регламенту П-9
              </li>
            </ul>
          </div>

          {/* Column 4: Contacts & Logistics */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-neutral-300" />
              <span>Контакты & Логистика</span>
            </h3>
            <div className="space-y-2.5 text-neutral-400">
              <div className="flex items-start space-x-2">
                <MapPin className="w-3.5 h-3.5 text-white/70 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-medium block">Москва (Центральный склад)</span>
                  <span className="text-[11px]">Варшавское шоссе, д. 42, корп. 1</span>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <Truck className="w-3.5 h-3.5 text-white/70 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-medium block">Тула (Региональный хаб)</span>
                  <span className="text-[11px]">Проспект Ленина, д. 85, офис 204</span>
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-1 text-[11px] text-neutral-300">
                <Clock className="w-3 h-3 text-white/70" />
                <span>Прием заявок: 24/7 (ИИ-Диспетчер)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & System Status */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 text-[11px] text-[#8E9E94]">
          <div className="flex items-center space-x-2">
            <span>© 2026 ServFlow Inc. Все права защищены.</span>
            <span>·</span>
            <span>Лицензия MIT</span>
            <span>·</span>
            <span>Версия 2.0.4-prod</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5 text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Система: Все узлы в норме</span>
            </span>
            <span className="text-neutral-500">|</span>
            <span>Шифрование: TLS 1.3 / AES-256</span>
          </div>
        </div>
      </div>

      {/* Info Modals */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-[#16171B] border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col text-white">
            <button
              onClick={() => setModalType(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {modalType === 'rules' && (
              <div className="space-y-4 overflow-y-auto pr-2">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-bold">Регламенты сервисного обслуживания (П-1 .. П-10)</h3>
                </div>
                <div className="space-y-2.5 text-xs text-neutral-300">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-1: Авторизация и доступ</span>
                    Разделение прав между диспетчером, сертифицированным инженером и представителем кофейни.
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-2: Идентификация кофейни и оборудования</span>
                    Каждое обращение привязывается к серийному номеру и модели кофемашины из реестра.
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-3: Уточняющий диалог при неполноте данных</span>
                    Если клиент не указал симптомы или модель, диспетчер запрашивает уточнения до оформления наряда.
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-4: Разделение объективного симптома и догадки клиента</span>
                    В наряд заносится реальное проявление поломки («течет снизу»), а клиентская версия («взорвалась помпа») фиксируется отдельно.
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-5: Оборудование вне договора (Ромашка)</span>
                    Если обращение от незарегистрированного клиента, предлагается заключение сервисного договора.
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-6: Квалификация инженера</span>
                    Назначение инженера только с квалификацией под модель кофемашины (C100, C200, Mini, Pro).
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-7: Совместимость запчастей</span>
                    Строгая проверка применяемости деталей к обслуживаемой серии аппарата.
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-8: Складской резерв и перемещение</span>
                    Резервирование на центральном складе Москвы; при отсутствии деталь запрашивается из хаба в Туле (+1 рабочий день).
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-9: Гарантийный статус ремонта</span>
                    Если с момента предыдущего выезда прошло менее 30 дней и поломка аналогична, выезд помечается как гарантийный.
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="font-bold text-white block">П-10: Оформление наряда диспетчером</span>
                    Фиксация полного наряда, уведомление клиента и передача инженеру в маршрутный лист.
                  </div>
                </div>
              </div>
            )}

            {modalType === 'security' && (
              <div className="space-y-4 overflow-y-auto pr-2">
                <div className="flex items-center space-x-2">
                  <Lock className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-bold">Политика безопасности (SECURITY.md)</h3>
                </div>
                <div className="space-y-3 text-xs text-neutral-300">
                  <p>
                    Система ServFlow разработана в соответствии с требованиями 152-ФЗ «О персональных данных» и рекомендациями ГОСТ Р 58412-2019:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Хеширование паролей с использованием bcrypt и криптографической соли.</li>
                    <li>JWT-авторизация с ограничением времени жизни сессионного токена.</li>
                    <li>Защищенные API-эндпоинты с валидацией ролей (RBAC).</li>
                    <li>Автоматический аудит изменений и блокировка несанкционированного доступа.</li>
                    <li>Полное разделение контуров данных кофеен и сервисного центра.</li>
                  </ul>
                </div>
              </div>
            )}

            {modalType === 'testing' && (
              <div className="space-y-4 overflow-y-auto pr-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-bold">Протокол верификации и тестов (TESTING.md)</h3>
                </div>
                <div className="space-y-3 text-xs text-neutral-300">
                  <p>
                    Платформа покрыта сквозными автоматизированными тестами интеграции и логики регламентов:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>12-шаговый комплексный тестовый сценарий <code className="text-white bg-white/10 px-1 py-0.5 rounded">test_suite.py</code>: 100% PASS.</li>
                    <li>Тесты безопасности и RBAC авторизации: <code className="text-white bg-white/10 px-1 py-0.5 rounded">test_security.py</code>.</li>
                    <li>Тесты расчета аналитики и метрик: <code className="text-white bg-white/10 px-1 py-0.5 rounded">test_analytics.py</code>.</li>
                    <li>Тесты базы регламентов и валидации оборудования: <code className="text-white bg-white/10 px-1 py-0.5 rounded">test_baseline.py</code>.</li>
                  </ul>
                </div>
              </div>
            )}

            {modalType === 'license' && (
              <div className="space-y-4 overflow-y-auto pr-2">
                <div className="flex items-center space-x-2">
                  <ExternalLink className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-bold">Лицензия MIT (LICENSE)</h3>
                </div>
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 font-mono text-[11px] text-neutral-300 space-y-2">
                  <p>MIT License</p>
                  <p>Copyright (c) 2026 ServFlow Contributors</p>
                  <p>
                    Permission is hereby granted, free of charge, to any person obtaining a copy
                    of this software and associated documentation files (the &quot;Software&quot;), to deal
                    in the Software without restriction, including without limitation the rights
                    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                    copies of the Software...
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors"
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
