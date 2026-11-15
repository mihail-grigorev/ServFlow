import React, { useState } from 'react';
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
  LogOut
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    setUploadingAvatar(true);
    setErrorMsg(null);
    try {
      const res = await api.uploadAvatar(file);
      setAvatarUrl(res.avatar_url);
      setSuccessMsg('Аватарка успешно загружена');
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

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setLoading(true);
    try {
      await api.deleteProfile();
      onProfileDeleted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка удаления аккаунта');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-[#16171B] text-[#F3F4F6] rounded-2xl border border-white/[0.08] shadow-modal max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A6751]/10 text-[#6E9078] flex items-center justify-center font-bold">
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
          <div className="mx-5 mt-4 p-3 rounded-xl bg-[#2E7D47]/10 border border-[#2E7D47]/20 flex items-center space-x-2 text-xs text-[#48BB78] font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-[#FF453A]/10 border border-[#FF453A]/20 flex items-center space-x-2 text-xs text-[#FF453A] font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* 1. Avatar Section */}
          <div className="p-4 rounded-xl border border-white/[0.06] bg-black/20 space-y-3">
            <label className="block text-xs font-semibold text-white uppercase tracking-wider">
              Аватарка пользователя
            </label>

            <div className="flex items-center space-x-4">
              <div className="relative group">
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-16 h-16 rounded-2xl object-cover bg-white/10 border border-white/[0.1] shadow-sm"
                />
                <label className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-5 h-5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1">
                <div className="text-[11px] text-[#8E9E94] mb-2">
                  Выберите готовую аватарку или загрузите своё фото:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`w-8 h-8 rounded-xl border p-0.5 overflow-hidden transition-all ${
                        avatarUrl === preset
                          ? 'border-[#4A6751] ring-2 ring-[#4A6751]/40'
                          : 'border-white/[0.1] hover:border-white/[0.3]'
                      }`}
                    >
                      <img src={preset} alt="preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
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
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white outline-none focus:border-[#6E9078]"
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
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white outline-none focus:border-[#6E9078]"
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
                      className="w-full px-3 py-1.5 rounded-lg border border-white/[0.1] bg-[#1D2E24] text-white outline-none"
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
                              ? 'bg-[#4A6751] border-[#4A6751] text-white'
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
                    className="w-full px-3 py-1.5 rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white outline-none"
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
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white outline-none focus:border-[#6E9078]"
                />
              </div>
            </div>
          </div>

          {/* 4. Danger Zone: Delete Account */}
          <div className="pt-3 border-t border-white/[0.08] space-y-2">
            <label className="block text-xs font-semibold text-[#FF453A] uppercase tracking-wider">
              Опасная зона
            </label>
            <div className="p-3.5 rounded-xl border border-[#FF453A]/20 bg-[#FF453A]/[0.06] flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Удаление профиля</div>
                <div className="text-[11px] text-[#8E9E94]">
                  Безвозвратное удаление аккаунта из базы данных
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeleteAccount}
                className="px-3 py-1.5 rounded-xl bg-[#FF453A] hover:bg-[#FF453A]/90 text-white font-semibold transition-all flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmDelete ? 'Подтвердить удаление' : 'Удалить аккаунт'}</span>
              </button>
            </div>
          </div>

          {/* Footer Save & Logout Buttons */}
          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
            {onLogout ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="px-3 py-2 rounded-xl text-xs font-medium text-[#FF453A] hover:bg-[#FF453A]/10 border border-[#FF453A]/25 transition-colors flex items-center space-x-1.5 cursor-pointer"
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
                className="px-5 py-2 rounded-xl bg-[#4A6751] hover:bg-[#3D5643] text-white font-semibold text-xs shadow-sm transition-all flex items-center space-x-1.5"
              >
                <span>{loading ? 'Сохранение...' : 'Сохранить изменения'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

