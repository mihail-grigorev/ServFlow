import React, { useState } from 'react';
import { User } from '../types';
import logoImg from '../assets/logo.png';
import {
  Clock,
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
  Radio
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  activeTab: 'dispatcher' | 'orders' | 'engineer' | 'warehouse' | 'company';
  setActiveTab: (tab: 'dispatcher' | 'orders' | 'engineer' | 'warehouse' | 'company') => void;
  onOpenResetModal: () => void;
  onOpenProfileModal: () => void;
  onOpenSimulatorModal?: () => void;
  onSwitchUser: (user: User) => void;
  allDemoUsers: User[];
  onLogout: () => void;
  onOpenLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenResetModal,
  onOpenProfileModal,
  onOpenSimulatorModal,
  onSwitchUser,
  allDemoUsers,
  onLogout,
  onOpenLogin,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/[0.08] bg-[#17231D]/80 backdrop-blur-md text-[#F0F5F2]">
      <div className="w-full px-4 sm:px-8 h-16 flex items-center justify-between">
        {/* Left: Clean Brand logo & name */}
        <div className="flex items-center space-x-3">
          <img
            src={logoImg}
            alt="ServFlow"
            className="w-9 h-9 rounded-xl shadow-md object-contain bg-black/40 border border-white/10 p-0.5"
          />
          <span className="font-bold text-base tracking-tight text-white">
            ServFlow
          </span>
        </div>

        {/* Center: Clean Core Tabs */}
        {currentUser && (
          <nav className="flex items-center space-x-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
            {currentUser.role === 'dispatcher' ? (
              <>
                <button
                  onClick={() => setActiveTab('dispatcher')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'dispatcher'
                      ? 'bg-[#4A6751] text-white shadow-sm'
                      : 'text-[#8E9E94] hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Диспетчерская</span>
                </button>

                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'orders'
                      ? 'bg-[#4A6751] text-white shadow-sm'
                      : 'text-[#8E9E94] hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Заявки на выезд</span>
                </button>

                <button
                  onClick={() => setActiveTab('warehouse')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'warehouse'
                      ? 'bg-[#4A6751] text-white shadow-sm'
                      : 'text-[#8E9E94] hover:text-white'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Склад запчастей</span>
                </button>
              </>
            ) : currentUser.role === 'company' ? (
              <>
                <button
                  onClick={() => setActiveTab('company')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'company'
                      ? 'bg-[#4A6751] text-white shadow-sm'
                      : 'text-[#8E9E94] hover:text-white'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Кабинет и чат</span>
                </button>

                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'orders'
                      ? 'bg-[#4A6751] text-white shadow-sm'
                      : 'text-[#8E9E94] hover:text-white'
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
                    ? 'bg-[#4A6751] text-white shadow-sm'
                    : 'text-[#8E9E94] hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Мои выезды</span>
              </button>
            )}
          </nav>
        )}

        {/* Right: Reset & Avatar Profile */}
        <div className="flex items-center space-x-2.5">
          {/* Simulator Button - Visible ONLY to Dispatcher */}
          {currentUser?.role === 'dispatcher' && onOpenSimulatorModal && (
            <button
              onClick={onOpenSimulatorModal}
              title="Симулятор обращений клиентов (для тестирования и жюри)"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#FF9F0A]/15 hover:bg-[#FF9F0A]/25 border border-[#FF9F0A]/30 text-[#FF9F0A] transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Radio className="w-3.5 h-3.5 text-[#FF9F0A]" />
              <span className="hidden sm:inline">Симулятор</span>
            </button>
          )}

          {/* Reset / Excel Button - Visible ONLY to Dispatcher */}
          {currentUser?.role === 'dispatcher' && (
            <button
              onClick={onOpenResetModal}
              title="Сброс и импорт данных из Excel"
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#8E9E94]" />
              <span className="hidden sm:inline">Сброс / Excel</span>
            </button>
          )}

          {/* User Account Button & Dropdown */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center space-x-2 p-1.5 pr-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-all"
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
                  <div className="text-[10px] text-[#8E9E94] leading-tight">
                    {currentUser.role === 'dispatcher' ? 'Диспетчер' : currentUser.city}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#8E9E94]" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 p-2 bg-[#16221B] text-[#F0F5F2] rounded-2xl shadow-modal border border-white/[0.08] z-50 animate-in fade-in zoom-in-95 duration-100">
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
                        <div className="text-[11px] text-[#8E9E94] truncate">
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
                        <Settings className="w-4 h-4 text-[#6E9078]" />
                        <span>Настройки профиля и аватарка</span>
                      </button>
                    </div>

                    {/* Quick Role Switcher for Jury */}
                    <div className="border-t border-white/[0.06] pt-1.5 mt-1">
                      <div className="text-[10px] font-semibold text-[#8E9E94] px-2.5 py-1 uppercase tracking-wider">
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
                                ? 'bg-[#4A6751] text-white font-medium'
                                : 'hover:bg-white/[0.05] text-[#F0F5F2]'
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
                          onLogout();
                        }}
                        className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-medium text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors"
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
              className="px-3.5 py-1.5 rounded-xl bg-[#4A6751] hover:bg-[#3D5643] text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Войти</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
