import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { User } from '../types';
import {
  X,
  User as UserIcon,
  Mail,
  Lock,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ShieldCheck,
  Camera,
  LogOut,
  RefreshCw,
  Sparkles,
  KeyRound
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onProfileUpdated: (updatedUser: User) => void;
  onProfileDeleted: () => void;
  onLogout?: () => void;
}

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/notionists/svg?seed=Anna',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Alex',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Dmitry',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Sergey',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Pavel',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Elena',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Mikhail',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Olga',
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
  onProfileDeleted,
  onLogout,
}) => {
  if (!isOpen) return null;

  const [fullName, setFullName] = useState(currentUser.full_name);
  const [email, setEmail] = useState(currentUser.email);
  const [city, setCity] = useState(currentUser.city || 'Москва');
  const [qualifications, setQualifications] = useState<string[]>(currentUser.qualifications || []);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || AVATAR_PRESETS[0]);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Account deletion verification code states
  const [deleteStep, setDeleteStep] = useState<'initial' | 'code'>('initial');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [sendingDeleteCode, setSendingDeleteCode] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutPinInput, setLogoutPinInput] = useState('');
  const [logoutPinError, setLogoutPinError] = useState('');

  useEffect(() => {
    let timer: any;
    if (deleteCountdown > 0) {
      timer = setInterval(() => {
        setDeleteCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [deleteCountdown]);

  const handleRequestDeleteCode = async () => {
    setErrorMsg(null);
    setSendingDeleteCode(true);
    try {
      await api.sendDeleteCode();
      setDeleteStep('code');
      setDeleteCountdown(60);
      setSuccessMsg(`Код подтверждения отправлен с Яндекс Почты на ${currentUser.email}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка отправки кода подтверждения');
    } finally {
      setSendingDeleteCode(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    const cleanCode = deleteCode.trim();
    if (!cleanCode) {
      setErrorMsg('Введите 6-значный проверочный код из письма');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await api.confirmDeleteAccount(cleanCode);
      onProfileDeleted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Неверный или просроченный проверочный код');
      setLoading(false);
    }
  };

  const toggleQual = (q: string) => {
    if (qualifications.includes(q)) {
      setQualifications(qualifications.filter((item) => item !== q));
    } else {
      setQualifications([...qualifications, q]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Размер фотографии не должен превышать 2 МБ');
      return;
    }

    setUploadingAvatar(true);
    setErrorMsg(null);
    try {
      const res = await api.uploadAvatar(file);
      setAvatarUrl(res.avatar_url);
      setSuccessMsg('Фотография успешно загружена и установлена!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка загрузки файла');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated = await api.updateProfile({
        full_name: fullName.trim(),
        email: email.trim(),
        city: currentUser.role !== 'dispatcher' ? city : undefined,
        is_senior: false,
        qualifications: currentUser.role === 'engineer' ? qualifications : [],
        avatar_url: avatarUrl,
        password: newPassword.trim() ? newPassword.trim() : undefined,
      });

      onProfileUpdated(updated);
      setSuccessMsg('Профиль успешно обновлен!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка обновления профиля');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-[#16171B] text-[#F3F4F6] rounded-2xl border border-white/[0.08] shadow-modal max-w-xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Мой профиль</h2>
              <p className="text-xs text-[#8E9E94]">
                Управление учетной записью, аватаркой и параметрами доступа
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

        {/* Notifications */}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-white/10 border border-white/20 flex items-center space-x-2 text-xs text-white font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-white/[0.06] border border-white/20 flex items-center space-x-2 text-xs text-neutral-200 font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-neutral-300" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* 1. Avatar Section */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-white uppercase tracking-wider">
                Фотография профиля
              </label>
              <span className="text-[11px] text-[#8E9E94]">PNG, JPG, WebP до 2 МБ</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative group flex-shrink-0">
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-20 h-20 rounded-2xl object-cover bg-white/10 border border-white/[0.15] shadow-md"
                />
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center space-x-2">
                  <label className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer shadow-sm">
                    {uploadingAvatar ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{uploadingAvatar ? 'Загрузка...' : 'Загрузить своё фото'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileUpload}
                      disabled={uploadingAvatar}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <div className="text-[11px] text-[#8E9E94] mb-1.5">
                    Или выберите готовую аватарку:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(preset)}
                        className={`w-8 h-8 rounded-xl border p-0.5 overflow-hidden transition-all ${
                          avatarUrl === preset
                            ? 'border-white ring-2 ring-white/50 bg-white/10'
                            : 'border-white/[0.1] hover:border-white/[0.3] bg-white/[0.03]'
                        }`}
                      >
                        <img src={preset} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Personal Information */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-white uppercase tracking-wider">
              Персональные данные
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#8E9E94] mb-1">ФИО</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#8E9E94] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#8E9E94] mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E9E94] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                  />
                </div>
              </div>
            </div>

            {currentUser.role === 'engineer' && (
              <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/20 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#8E9E94] mb-1">Город базирования</label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg border border-white/[0.1] bg-[#1F2026] text-white outline-none"
                    >
                      <option value="Москва">Москва</option>
                      <option value="Тула">Тула</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#8E9E94] mb-1">Допуски к моделям</label>
                    <div className="flex space-x-1.5">
                      {['C100', 'C200', 'C300'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleQual(m)}
                          className={`px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                            qualifications.includes(m)
                              ? 'bg-white border-white text-black font-semibold'
                              : 'bg-black/30 border-white/[0.1] text-[#8E9E94]'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentUser.role === 'company' && (
              <div className="space-y-3 p-3.5 rounded-xl bg-black/20 border border-white/[0.06]">
                <div>
                  <label className="block text-[11px] text-[#8E9E94] mb-1">
                    Город расположения заведения
                  </label>
                  <select
                    value={city}
                    onChange={(e: any) => setCity(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none"
                  >
                    <option value="Москва">Москва</option>
                    <option value="Тула">Тула</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 3. Security (New Password) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white uppercase tracking-wider">
              Безопасность
            </label>
            <div>
              <label className="block text-[11px] text-[#8E9E94] mb-1">
                Новый пароль (оставьте пустым, если не хотите менять)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8E9E94] absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 знаков"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                />
              </div>
            </div>
          </div>

          {/* 4. Danger Zone: Delete Account */}
          <div className="pt-3 border-t border-white/[0.08] space-y-2">
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Опасная зона
            </label>

            {deleteStep === 'initial' ? (
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Удаление профиля</div>
                  <div className="text-[11px] text-[#8E9E94]">
                    Для удаления потребуется подтверждение через проверочный код из Яндекс Почты
                  </div>
                </div>

                <button
                  type="button"
                  disabled={sendingDeleteCode}
                  onClick={handleRequestDeleteCode}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/20 disabled:opacity-50 text-white font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-neutral-300" />
                  <span>{sendingDeleteCode ? 'Отправка кода...' : 'Удалить аккаунт'}</span>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-white/20 bg-white/[0.05] space-y-3">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle className="w-5 h-5 text-neutral-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-white text-xs">Подтверждение удаления аккаунта</div>
                    <div className="text-[11px] text-[#D1D5DB] mt-0.5">
                      Код подтверждения отправлен с Яндекс Почты на <span className="text-white font-semibold">{currentUser.email}</span>. Введите 6 цифр для подтверждения:
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    value={deleteCode}
                    onChange={(e) => setDeleteCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-36 text-center tracking-[0.3em] font-mono font-bold text-base py-1.5 px-3 rounded-lg border border-white/[0.2] bg-black/40 text-white outline-none focus:border-white"
                  />
                  <button
                    type="button"
                    disabled={loading || deleteCode.length < 6}
                    onClick={handleConfirmDeleteAccount}
                    className="px-4 py-1.5 rounded-lg bg-white hover:bg-neutral-200 disabled:opacity-50 text-black font-semibold text-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{loading ? 'Удаление...' : 'Подтвердить удаление'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteStep('initial');
                      setDeleteCode('');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-white/[0.1] hover:bg-white/[0.05] text-[#9CA3AF] text-xs transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#8E9E94] pt-1 border-t border-white/[0.06]">
                  <span>Срок действия кода: 15 минут</span>
                  <button
                    type="button"
                    disabled={deleteCountdown > 0 || sendingDeleteCode}
                    onClick={handleRequestDeleteCode}
                    className="hover:text-white transition-colors disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${sendingDeleteCode ? 'animate-spin' : ''}`} />
                    <span>
                      {deleteCountdown > 0
                        ? `Повтор через ${deleteCountdown}с`
                        : 'Отправить код снова'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Save & Logout Buttons */}
          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
            {onLogout ? (
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/10 border border-white/20 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Выйти из аккаунта</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-white/[0.1] hover:bg-white/[0.05] text-[#F0F5F2] text-xs transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs shadow-sm transition-all flex items-center space-x-1.5"
              >
                <span>{loading ? 'Сохранение...' : 'Сохранить изменения'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-[#16171B] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4 text-white">
              <div className="flex items-center space-x-2">
                <LogOut className="w-5 h-5 text-neutral-300" />
                <h3 className="text-base font-semibold">Подтверждение выхода</h3>
              </div>
              <p className="text-xs text-neutral-400">
                Для выхода из аккаунта <span className="text-white font-medium">{currentUser.full_name}</span> введите пароль (1997):
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (logoutPinInput.trim() && logoutPinInput.trim() !== '1997' && logoutPinInput.trim() !== '2026') {
                    setLogoutPinError('Неверный пароль (1997)');
                    return;
                  }
                  setShowLogoutConfirm(false);
                  onClose();
                  onLogout?.();
                }}
                className="space-y-3"
              >
                <div>
                  <input
                    type="password"
                    autoFocus
                    placeholder="Пароль для выхода (1997)"
                    value={logoutPinInput}
                    onChange={(e) => setLogoutPinInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-white tracking-widest text-center font-mono"
                  />
                </div>

                {logoutPinError && (
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-white/20 text-neutral-200 text-xs text-center">
                    {logoutPinError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogoutConfirm(false);
                      setLogoutPinInput('');
                      setLogoutPinError('');
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
      </div>
    </div>
  );
};

