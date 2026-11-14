import React, { useState } from 'react';
import { api } from '../api';
import { ClientThread } from '../types';
import {
  X,
  Radio,
  Send,
  AlertCircle
} from 'lucide-react';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulationSuccess: (thread: ClientThread) => void;
}

const PRESET_SCENARIOS = [
  {
    title: 'Кафе «Кедр» · Течь и слабый пар',
    client: 'Кафе «Кедр»',
    channel: 'Мессенджер',
    text: 'На шильдике 205, после приготовления справа течёт вода и пар очень слабый, молоко не взбивается.',
  },
  {
    title: 'Гостиница «Берег» · Ошибка E07',
    client: 'Гостиница «Берег»',
    channel: 'Звонок',
    text: 'После утренней промывки на дисплее горит ошибка E07, кофе не наливает.',
  },
  {
    title: 'Кафе «Лист» · Запрос разборки (П-10)',
    client: 'Кафе «Лист»',
    channel: 'Почта',
    text: 'Срочно пришлите схему и инструкцию по разборке помпы, мы сами раскрутим и починим до обеда!',
  },
  {
    title: 'Кафе «Ромашка» · Вне реестра (П-2)',
    client: 'Кафе «Ромашка»',
    channel: 'Звонок',
    text: 'Здравствуйте! Купили кофемашину C200 б/у, номер 230, капает вода. Договора с вами пока нет, почините сегодня?',
  },
  {
    title: 'Пекарня «Зерно» · Неоднозначность (П-1)',
    client: 'Пекарня «Зерно»',
    channel: 'Почта',
    text: 'Добрый день, у нас в пекарне слабый напор воды. Приезжайте скорее.',
  },
  {
    title: 'Ресторан «Пирс» · Новая машина (Гарантия П-9)',
    client: 'Ресторан «Пирс»',
    channel: 'Звонок',
    text: 'Кофемашину поставили меньше двух недель назад. Из парового крана почти нет давления, капучино не сделать.',
  },
];

export const SimulatorModal: React.FC<SimulatorModalProps> = ({
  isOpen,
  onClose,
  onSimulationSuccess,
}) => {
  if (!isOpen) return null;

  const [clientName, setClientName] = useState<string>('Кафе «Кедр»');
  const [channel, setChannel] = useState<string>('Мессенджер');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    setClientName(preset.client);
    setChannel(preset.channel);
    setContent(preset.text);
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const thread = await api.simulateMessage({
        client_name: clientName.trim(),
        channel,
        content: content.trim(),
      });

      onSimulationSuccess(thread);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка симуляции обращения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-2xl max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#FF9F0A]/15 border border-[#FF9F0A]/25 text-[#FF9F0A]">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F5F2]">
                Симулятор обращения клиента (Демо для Жюри)
              </h2>
              <p className="text-xs text-[#8E9E94]">
                Эмуляция нового входящего сообщения в реальном времени
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

        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-[#FF453A]/10 border border-[#FF453A]/25 flex items-center space-x-2 text-xs text-[#FF453A]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSimulate} className="p-5 space-y-4">
          {/* Quick Presets for Jury */}
          <div>
            <label className="block text-xs font-semibold text-[#8E9E94] uppercase tracking-wider mb-2">
              Готовые сценарии проверки правил П-1 .. П-10:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_SCENARIOS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-left p-2.5 rounded-xl border border-white/[0.08] bg-[#16221B] hover:border-[#4A6751] hover:bg-[#4A6751]/10 text-xs transition-all"
                >
                  <div className="font-semibold text-[#F0F5F2]">{p.title}</div>
                  <div className="text-[10px] text-[#8E9E94] truncate mt-0.5">{p.text}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-[#F0F5F2] mb-1">
                Клиент / Организация
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Например: Кафе «Кедр»"
                className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.12] bg-[#16221B] text-[#F0F5F2] placeholder-[#8E9E94] outline-none focus:border-[#6E9078]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#F0F5F2] mb-1">
                Канал связи
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.12] bg-[#16221B] text-[#F0F5F2] outline-none focus:border-[#6E9078]"
              >
                <option value="Мессенджер">Мессенджер</option>
                <option value="Почта">Почта</option>
                <option value="Звонок">Звонок</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#F0F5F2] mb-1">
              Текст входящего обращения клиента
            </label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Введите текст сообщения от клиента..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.12] bg-[#16221B] text-[#F0F5F2] placeholder-[#8E9E94] outline-none focus:border-[#6E9078] leading-relaxed"
            />
          </div>

          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-white/[0.12] hover:bg-white/[0.05] text-[#F0F5F2] transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#4A6751] hover:bg-[#0077ED] disabled:opacity-40 text-white shadow-sm transition-all flex items-center space-x-1.5"
            >
              <span>{loading ? 'Отправка...' : 'Отправить в систему'}</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
