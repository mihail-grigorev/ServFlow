import React, { useState } from 'react';
import { User } from '../types';
import logoImg from '../assets/logo.png';
import {
  RotateCcw,
  LogOut,
  UserCheck,
  Wrench,
  ClipboardList,
  Sparkles,
  Settings,
  ChevronDown,
  Package,
  Building,
  Zap,
  BarChart3
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  activeTab: 'dispatcher' | 'orders' | 'engineer' | 'warehouse' | 'company' | 'analytics';
  setActiveTab: (tab: 'dispatcher' | 'orders' | 'engineer' | 'warehouse' | 'company' | 'analytics') => void;
  onOpenResetModal: () => void;
  onOpenProfileModal: () => void;
  autoReplyEnabled?: boolean;
  onToggleAutoReply?: () => void;
  onAutoReplyAll?: () => Promise<void>;
  isAutoReplying?: boolean;
  onSwitchUser: (user: User) => void;
  allDemoUsers: User[];
  onLogout: () => void;
  onOpenLogin?: () => void;
  demoMode?: boolean;
  onOpenDemoQrModal?: () => void;
  onResetDemoData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenResetModal,
  onOpenProfileModal,
  autoReplyEnabled = true,
  onToggleAutoReply,
  onAutoReplyAll,
  isAutoReplying = false,
  onSwitchUser,
  allDemoUsers,
  onLogout,
  onOpenLogin,
  demoMode = true,
  onOpenDemoQrModal,
  onResetDemoData,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutPin, setLogoutPin] = useState('');
  const [logoutError, setLogoutError] = useState('');

  const handleConfirmLogout = (e: React.FormEvent) => {
    e.preventDefault();
    // Verify PIN 1997 for staff or permit confirmed logout
    if (logoutPin.trim() && logoutPin.trim() !== '1997' && logoutPin.trim() !== '2026') {
      setLogoutError('Неверный пароль для выхода');
      return;
    }
    setShowLogoutModal(false);
    setLogoutPin('');
    setLogoutError('');
    onLogout();
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/[0.08] bg-[#16171B]/95 backdrop-blur-md text-[#F3F4F6]">
      <div className="max-w-[1700px] mx-auto w-full px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Left: Clean Brand logo & role badge */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          <img
            src={logoImg}
            alt="ServFlow"
            className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl shadow-md object-contain bg-black/40 border border-white/10 p-0.5"
          />
          <span className="font-bold text-sm sm:text-base tracking-tight text-white">
            ServFlow
          </span>
          {currentUser && (
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/15">
              {currentUser.role === 'dispatcher' ? 'Диспетчер' : currentUser.role === 'engineer' ? 'Инженер' : 'Кофейня'}
            </span>
          )}
        </div>

        {/* Center: Desktop-only Core Tabs */}
        {currentUser && (
          <nav className="hidden sm:flex items-center space-x-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
            {currentUser.role === 'dispatcher' ? (
              <>
                <button
                  onClick={() => setActiveTab('dispatcher')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'dispatcher'
                      ? 'bg-white text-black shadow-sm font-semibold'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Диспетчерская</span>
                </button>

                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'orders'
                      ? 'bg-white text-black shadow-sm font-semibold'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Заявки на выезд</span>
                </button>

                <button
                  onClick={() => setActiveTab('warehouse')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'warehouse'
                      ? 'bg-white text-black shadow-sm font-semibold'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Склад</span>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'analytics'
                      ? 'bg-white text-black shadow-sm font-semibold'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Аналитика</span>
                </button>
              </>
            ) : currentUser.role === 'company' ? (
              <>
                <button
                  onClick={() => setActiveTab('company')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'company'
                      ? 'bg-white text-black shadow-sm font-semibold'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Кабинет и чат</span>
                </button>

                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'orders'
                      ? 'bg-white text-black shadow-sm font-semibold'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Заявки на выезд</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveTab('engineer')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'engineer'
                    ? 'bg-white text-black shadow-sm font-semibold'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Мои выезды</span>
              </button>
            )}
          </nav>
        )}

        {/* Right: Actions & User Avatar */}
        <div className="flex items-center space-x-2">
          {/* AI Auto-Reply Switch - Desktop */}
          {currentUser?.role === 'dispatcher' && onToggleAutoReply && (
            <div className="hidden sm:flex items-center space-x-1.5 bg-[#1F2026] p-1 rounded-xl border border-white/[0.08]">
              <button
                type="button"
                onClick={onToggleAutoReply}
                title="Автоответ с ИИ: автоматически отвечает клиентам во всех входящих чатах"
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  autoReplyEnabled
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'bg-white/[0.04] text-[#9CA3AF] hover:text-white border border-transparent'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>ИИ-Автоответ:</span>
                <span className="font-bold">{autoReplyEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
              </button>
            </div>
          )}

          {/* AI Auto-Reply Toggle - Mobile Compact Icon Button */}
          {currentUser?.role === 'dispatcher' && onToggleAutoReply && (
            <button
              type="button"
              onClick={onToggleAutoReply}
              title={`ИИ-Автоответ: ${autoReplyEnabled ? 'ВКЛ' : 'ВЫКЛ'}`}
              className={`sm:hidden p-2 rounded-xl border text-xs font-semibold transition-all flex items-center space-x-1 ${
                autoReplyEnabled
                  ? 'bg-white/15 text-white border-white/30'
                  : 'bg-white/[0.04] text-neutral-400 border-white/10'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span className="text-[10px] font-mono">{autoReplyEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
            </button>
          )}

          {/* Reset / Excel Button - Visible ONLY to Dispatcher (Desktop) */}
          {currentUser?.role === 'dispatcher' && (
            <button
              onClick={onOpenResetModal}
              title="Сброс и импорт данных из Excel"
              className="hidden md:flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <span>Сброс</span>
            </button>
          )}

          {/* User Account Button & Dropdown */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center space-x-1.5 p-1 sm:p-1.5 sm:pr-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-all cursor-pointer"
              >
                <img
                  src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=Anna'}
                  alt={currentUser.full_name}
                  className="w-7 h-7 rounded-lg object-cover bg-white/10"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-medium text-white max-w-[110px] truncate leading-tight">
                    {currentUser.full_name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-[#9CA3AF] leading-tight">
                    {currentUser.role === 'dispatcher' ? 'Диспетчер' : currentUser.city}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 p-2 bg-[#1C1D22] text-[#F3F4F6] rounded-2xl shadow-modal border border-white/[0.08] z-50 animate-in fade-in zoom-in-95 duration-100">
                    {/* User Info Header */}
                    <div className="p-2.5 border-b border-white/[0.06] flex items-center space-x-3">
                      <img
                        src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=Anna'}
                        alt={currentUser.full_name}
                        className="w-10 h-10 rounded-xl object-cover bg-white/10"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-white truncate">
                          {currentUser.full_name}
                        </div>
                        <div className="text-[11px] text-[#9CA3AF] truncate">
                          {currentUser.email}
                        </div>
                      </div>
                    </div>

                    {/* Profile & Settings Action */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenProfileModal();
                        }}
                        className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <Settings className="w-4 h-4 text-neutral-400" />
                        <span>Настройки профиля и аватарка</span>
                      </button>
                    </div>

                    {/* Quick Role Switcher for Jury */}
                    <div className="border-t border-white/[0.06] pt-1.5 mt-1">
                      <div className="text-[10px] font-semibold text-[#9CA3AF] px-2.5 py-1 uppercase tracking-wider">
                        Быстрый выбор аккаунта (Жюри)
                      </div>
                      <div className="space-y-0.5 max-h-60 overflow-y-auto">
                        {allDemoUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setMenuOpen(false);
                              onSwitchUser(u);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                              currentUser.id === u.id
                                ? 'bg-white/15 text-white font-semibold'
                                : 'hover:bg-white/[0.05] text-[#F3F4F6]'
                            }`}
                          >
                            <div className="truncate">
                              <span>{u.full_name}</span>
                              <span className="text-[10px] opacity-70 ml-1.5">
                                ({u.role === 'dispatcher' ? 'Диспетчер' : u.role === 'company' ? 'Компания' : `Инженер ${u.city || ''}`})
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-white/[0.06] mt-2 pt-1.5">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setShowLogoutModal(true);
                        }}
                        className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-medium text-white hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Выйти из аккаунта</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-black" />
              <span>Войти</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      {currentUser && (
        <nav className="sm:hidden flex items-center bg-[#111215] border-t border-white/[0.06] px-2 py-1.5 gap-1.5 overflow-x-auto no-scrollbar">
          {currentUser.role === 'dispatcher' ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('dispatcher')}
                className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer whitespace-nowrap ${
                  activeTab === 'dispatcher'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Чаты</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Заявки</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('warehouse')}
                className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer whitespace-nowrap ${
                  activeTab === 'warehouse'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Склад</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Отчёты</span>
              </button>
            </>
          ) : currentUser.role === 'company' ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('company')}
                className={`flex-1 py-2 px-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  activeTab === 'company'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Кабинет и чат</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`flex-1 py-2 px-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Мои заявки</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('engineer')}
              className={`flex-1 py-2 px-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'engineer'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Мои выезды</span>
            </button>
          )}
        </nav>
      )}

      {/* Logout Password Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#16171B] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center space-x-2">
              <LogOut className="w-5 h-5 text-neutral-300" />
              <h3 className="text-base font-semibold text-white">Подтверждение выхода</h3>
            </div>
            <p className="text-xs text-neutral-400">
              Вы уверены, что хотите выйти из аккаунта <span className="text-white font-medium">{currentUser?.full_name}</span>? Для подтверждения выхода введите пароль:
            </p>

            <form onSubmit={handleConfirmLogout} className="space-y-3">
              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="Пароль для выхода"
                  value={logoutPin}
                  onChange={(e) => setLogoutPin(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-white tracking-widest text-center font-mono"
                />
              </div>

              {logoutError && (
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-white/20 text-neutral-200 text-xs text-center">
                  {logoutError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutModal(false);
                    setLogoutPin('');
                    setLogoutError('');
                  }}
                  className="flex-1 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-neutral-300 text-xs font-medium border border-white/10 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors cursor-pointer"
                >
                  Выйти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
