import React, { useState } from 'react';
import { api } from '../api';
import { User } from '../types';
import logoImg from '../assets/logo.png';
import {
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building,
  Wrench,
  Sparkles,
  MapPin
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  demoUsers: User[];
}

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/notionists/svg?seed=Anna',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Alex',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Dmitry',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Sergey',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Pavel',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Kedr',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Bereg',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Zerno',
];

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, demoUsers }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'dispatcher' | 'engineer' | 'company'>('dispatcher');
  const [city, setCity] = useState<'Москва' | 'Тула'>('Москва');
  const [qualifications, setQualifications] = useState<string[]>(['C100', 'C200']);
  const [avatarUrl, setAvatarUrl] = useState<string>(AVATAR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleModeChange = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim().toLowerCase(), password.trim());
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPwd = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanEmail) {
      setError('Укажите адрес электронной почты');
      return;
    }

    if (cleanPwd.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (cleanPwd !== cleanConfirm) {
      setError('Пароли не совпадают. Пожалуйста, проверьте правильность ввода обоих паролей.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        email: cleanEmail,
        password: cleanPwd,
        full_name: fullName.trim() || cleanEmail.split('@')[0],
        role,
        city: role !== 'dispatcher' ? city : undefined,
        is_senior: false,
        qualifications: role === 'engineer' ? qualifications : [],
        avatar_url: avatarUrl,
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoUser: User) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.switchUser(demoUser.id);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
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

  const dispatchers = demoUsers.filter((u) => u.role === 'dispatcher');
  const engineers = demoUsers.filter((u) => u.role === 'engineer');
  const companies = demoUsers.filter((u) => u.role === 'company');

  return (
    <div className="min-h-screen bg-[#080A09] text-[#F0F5F2] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient dark glows inspired by Web3 Dark aesthetic (Photo 1) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[120px] left-[10%] w-[580px] h-[580px] bg-gradient-to-br from-[#1C4332]/25 via-[#23533E]/15 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-[10%] -right-[100px] w-[600px] h-[600px] bg-gradient-to-bl from-[#7D4A22]/20 via-[#5E381A]/15 to-transparent rounded-full blur-[150px]" />
        <div className="absolute -bottom-[150px] left-[25%] w-[680px] h-[680px] bg-gradient-to-tr from-[#1B3545]/20 via-[#1E2E25]/15 to-transparent rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Card: Main Form */}
        <div className="lg:col-span-7 bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-apple p-7 sm:p-8">
          <div className="flex items-center space-x-3.5 mb-6">
            <img
              src={logoImg}
              alt="ServFlow"
              className="w-12 h-12 rounded-2xl object-contain shadow-md bg-black/40 border border-white/10 p-1"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                ServFlow
              </h1>
              <p className="text-xs text-[#8E9E94]">
                Сервисная платформа подготовки и учёта выездов инженеров
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-black/40 p-1 rounded-xl mb-6 border border-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setPassword('password123');
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-[#4A6751] text-white shadow-sm'
                  : 'text-[#8E9E94] hover:text-white'
              }`}
            >
              Вход в систему
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setPassword('');
                setConfirmPassword('');
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-[#4A6751] text-white shadow-sm'
                  : 'text-[#8E9E94] hover:text-white'
              }`}
            >
              Регистрация аккаунта
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#FF453A]/10 border border-[#FF453A]/20 flex items-center space-x-2 text-xs text-[#FF453A]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8E9E94] mb-1">
                  Электронная почта
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E9E94] absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ivanov@kofeservice.ru"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white focus:border-[#6E9078] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E9E94] mb-1">
                  Пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8E9E94] absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white focus:border-[#6E9078] outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#4A6751] hover:bg-[#3D5643] text-white text-sm font-semibold transition-colors shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <span>{loading ? 'Вход...' : 'Войти в систему'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Avatar Preset Picker in Register */}
              <div className="p-3 rounded-xl border border-white/[0.06] bg-black/20 flex items-center space-x-3">
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="w-12 h-12 rounded-xl object-cover bg-white/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[#8E9E94] mb-1.5">Выберите аватарку:</div>
                  <div className="flex space-x-1.5 overflow-x-auto pb-0.5">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(preset)}
                        className={`w-7 h-7 rounded-lg border p-0.5 overflow-hidden transition-all flex-shrink-0 ${
                          avatarUrl === preset ? 'border-[#4A6751] ring-2 ring-[#4A6751]/40' : 'border-white/[0.1]'
                        }`}
                      >
                        <img src={preset} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Role Selector: Dispatcher / Engineer / Company */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Тип аккаунта
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('dispatcher')}
                    className={`py-2 px-2.5 text-xs rounded-xl border font-medium text-center transition-all ${
                      role === 'dispatcher'
                        ? 'border-[#4A6751] bg-[#4A6751]/10 text-[#6E9078]'
                        : 'border-white/[0.1] text-[#8E9E94] hover:text-white'
                    }`}
                  >
                    Диспетчер
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('engineer')}
                    className={`py-2 px-2.5 text-xs rounded-xl border font-medium text-center transition-all ${
                      role === 'engineer'
                        ? 'border-[#4A6751] bg-[#4A6751]/10 text-[#6E9078]'
                        : 'border-white/[0.1] text-[#8E9E94] hover:text-white'
                    }`}
                  >
                    Инженер
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('company')}
                    className={`py-2 px-2.5 text-xs rounded-xl border font-medium text-center transition-all ${
                      role === 'company'
                        ? 'border-[#4A6751] bg-[#4A6751]/10 text-[#6E9078]'
                        : 'border-white/[0.1] text-[#8E9E94] hover:text-white'
                    }`}
                  >
                    Компания (Клиент)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E9E94] mb-1">
                  {role === 'company' ? 'Название компании / кофейни' : 'ФИО сотрудника'}
                </label>
                <div className="relative">
                  {role === 'company' ? (
                    <Building className="w-4 h-4 text-[#8E9E94] absolute left-3 top-3" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-[#8E9E94] absolute left-3 top-3" />
                  )}
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={role === 'company' ? 'Кафе «Кедр»' : 'Елена Васильева'}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white focus:border-[#6E9078] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E9E94] mb-1">
                  Электронная почта
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E9E94] absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@kofeservice.ru"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white outline-none focus:border-[#6E9078] transition-all"
                  />
                </div>
              </div>

              {/* Two Password Fields for Registration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#8E9E94] mb-1">
                    Пароль
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#8E9E94] absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Минимум 6 символов"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white outline-none focus:border-[#6E9078] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8E9E94] mb-1">
                    Повторите пароль
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#8E9E94] absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторите пароль"
                      className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-[#1D2E24] text-white outline-none transition-all ${
                        confirmPassword
                          ? password === confirmPassword
                            ? 'border-[#30D158] focus:border-[#30D158]'
                            : 'border-[#FF453A] focus:border-[#FF453A]'
                          : 'border-white/[0.1] focus:border-[#6E9078]'
                      }`}
                    />
                  </div>
                  {confirmPassword && (
                    <div className="mt-1 text-[11px] flex items-center space-x-1">
                      {password === confirmPassword ? (
                        <span className="text-[#30D158] flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Пароли совпадают</span>
                        </span>
                      ) : (
                        <span className="text-[#FF453A] flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Пароли не совпадают</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* City Selection for Engineer and Company */}
              {role !== 'dispatcher' && (
                <div>
                  <label className="block text-xs font-medium text-[#8E9E94] mb-1">
                    {role === 'company' ? 'Город расположения заведения' : 'Город базирования'}
                  </label>
                  <select
                    value={city}
                    onChange={(e: any) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1D2E24] text-white outline-none focus:border-[#6E9078]"
                  >
                    <option value="Москва">Москва</option>
                    <option value="Тула">Тула</option>
                  </select>
                </div>
              )}

              {/* Qualifications for Engineer only */}
              {role === 'engineer' && (
                <div className="space-y-2 p-3 rounded-xl bg-black/30 border border-white/[0.06]">
                  <label className="block text-xs font-medium text-[#8E9E94]">
                    Допуски к моделям кофемашин
                  </label>
                  <div className="flex space-x-2">
                    {['C100', 'C200', 'C300'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleQual(m)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
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
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#4A6751] hover:bg-[#3D5643] text-white text-sm font-semibold transition-colors shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <span>{loading ? 'Создание...' : 'Зарегистрировать'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Right Card: Quick 1-Click Jury Demo Accounts */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-[#17231D] rounded-2xl border border-white/[0.08] shadow-apple p-6 space-y-4">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#6E9078]" />
                <h2 className="text-sm font-semibold tracking-tight text-white">
                  Быстрый вход для жюри (1 клик)
                </h2>
              </div>
              <p className="text-xs text-[#8E9E94] mt-1">
                Готовые тестовые аккаунты всех типов ролей:
              </p>
            </div>

            {/* 1. Dispatchers */}
            <div>
              <div className="text-[10px] font-semibold text-[#8E9E94] uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-[#6E9078]" />
                <span>Диспетчеры</span>
              </div>
              <div className="space-y-1.5">
                {dispatchers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleQuickLogin(u)}
                    className="w-full text-left p-2.5 rounded-xl border border-white/[0.06] hover:border-[#4A6751] hover:bg-[#4A6751]/[0.05] transition-all group flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <img
                        src={u.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=Anna'}
                        alt={u.full_name}
                        className="w-7 h-7 rounded-lg object-cover bg-white/10 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white group-hover:text-[#6E9078] transition-colors truncate">
                          {u.full_name}
                        </div>
                        <div className="text-[10px] text-[#8E9E94]">Диспетчер сервиса</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#8E9E94] group-hover:text-[#6E9078]" />
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Engineers (All standard engineers, no senior) */}
            <div>
              <div className="text-[10px] font-semibold text-[#8E9E94] uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Wrench className="w-3 h-3 text-[#30D158]" />
                <span>Сервисные инженеры</span>
              </div>
              <div className="space-y-1.5">
                {engineers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleQuickLogin(u)}
                    className="w-full text-left p-2.5 rounded-xl border border-white/[0.06] hover:border-[#4A6751] hover:bg-[#4A6751]/[0.05] transition-all group flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <img
                        src={u.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=Alex'}
                        alt={u.full_name}
                        className="w-7 h-7 rounded-lg object-cover bg-white/10 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white group-hover:text-[#6E9078] transition-colors truncate">
                          {u.full_name}
                        </div>
                        <div className="text-[10px] text-[#8E9E94]">
                          Инженер · {u.city} {u.qualifications && `(${u.qualifications.join(', ')})`}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#8E9E94] group-hover:text-[#6E9078]" />
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Companies / Clients */}
            <div>
              <div className="text-[10px] font-semibold text-[#8E9E94] uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Building className="w-3 h-3 text-[#FF9F0A]" />
                <span>Компании (Клиенты и чат)</span>
              </div>
              <div className="space-y-1.5">
                {companies.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleQuickLogin(u)}
                    className="w-full text-left p-2.5 rounded-xl border border-white/[0.06] hover:border-[#4A6751] hover:bg-[#4A6751]/[0.05] transition-all group flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <img
                        src={u.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=Kedr'}
                        alt={u.full_name}
                        className="w-7 h-7 rounded-lg object-cover bg-white/10 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white group-hover:text-[#6E9078] transition-colors truncate">
                          {u.full_name}
                        </div>
                        <div className="text-[10px] text-[#8E9E94]">Клиент сервиса · {u.city}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#8E9E94] group-hover:text-[#6E9078]" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reference Info */}
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/[0.06] text-[11px] text-[#8E9E94] flex justify-between items-center">
            <span>Опорная дата: 16.11.2026 11:30</span>
            <span className="text-[#6E9078] font-medium">Сервис 2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
