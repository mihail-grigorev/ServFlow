import React, { useState, useEffect } from 'react';
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
  MapPin,
  ChevronLeft,
  RefreshCw
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  demoUsers: User[];
  demoMode?: boolean;
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

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, demoUsers, demoMode = true }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<'form' | 'code'>('form');
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

  // Email verification code states
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [codeSentMsg, setCodeSentMsg] = useState<string | null>(null);

  // Staff demo PIN verification
  const [pinModalUser, setPinModalUser] = useState<User | null>(null);
  const [staffPinInput, setStaffPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  const [activeDemoUsers, setActiveDemoUsers] = useState<User[]>(demoUsers);

  useEffect(() => {
    if (demoUsers && demoUsers.length > 0) {
      setActiveDemoUsers(demoUsers);
    } else {
      api.getDemoUsers()
        .then((users) => setActiveDemoUsers(users))
        .catch((err) => console.error('Failed to load demo users in LoginView:', err));
    }
  }, [demoUsers]);

  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleModeChange = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setRegStep('form');
    setVerificationCode('');
    setCodeSentMsg(null);
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

  const handleRequestRegisterCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPwd = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Укажите корректный адрес электронной почты');
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
      const res = await api.sendRegisterCode(cleanEmail);
      setCodeSentMsg(res.message);
      setRegStep('code');
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки проверочного кода');
    } finally {
      setLoading(false);
    }
  };

  const handleResendRegisterCode = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.sendRegisterCode(email.trim().toLowerCase());
      setCodeSentMsg(res.message);
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Ошибка повторной отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPwd = password.trim();
    const cleanCode = verificationCode.trim();

    if (!cleanCode) {
      setError('Введите 6-значный проверочный код из письма');
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
        code: cleanCode,
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Ошибка проверки кода или регистрации');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoUser: User) => {
    setError(null);
    if (demoUser.role === 'dispatcher' || demoUser.role === 'engineer') {
      let isVerified = false;
      try {
        isVerified = sessionStorage.getItem('demo_staff_pin_verified') === 'true';
      } catch {}
      if (!isVerified) {
        setPinModalUser(demoUser);
        setStaffPinInput('');
        setPinError(null);
        return;
      }
    }

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

  const handleVerifyStaffPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalUser) return;
    setPinError(null);
    setPinLoading(true);
    try {
      await api.verifyStaffPin(staffPinInput.trim());
      try {
        sessionStorage.setItem('demo_staff_pin_verified', 'true');
      } catch {}
      const targetUser = pinModalUser;
      setPinModalUser(null);
      setLoading(true);
      const res = await api.switchUser(targetUser.id);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setPinError(err.message || 'Неверный PIN-код сотрудника');
    } finally {
      setPinLoading(false);
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

  const dispatchers = activeDemoUsers.filter((u) => u.role === 'dispatcher');
  const engineers = activeDemoUsers.filter((u) => u.role === 'engineer');
  const companies = activeDemoUsers.filter((u) => u.role === 'company');
  const adminUser = activeDemoUsers.find((u) => u.email === 'admin@kofeservice.ru') || dispatchers[0];
  const engineerUser = activeDemoUsers.find((u) => u.email === 'engineer@kofeservice.ru') || engineers[0];

  return (
    <div className="min-h-screen bg-[#0C0D0F] text-[#F3F4F6] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient dark glows in neutral graphite */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[120px] left-[10%] w-[580px] h-[580px] bg-gradient-to-br from-white/[0.03] via-zinc-800/10 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-[10%] -right-[100px] w-[600px] h-[600px] bg-gradient-to-bl from-zinc-800/10 via-neutral-900/15 to-transparent rounded-full blur-[150px]" />
        <div className="absolute -bottom-[150px] left-[25%] w-[680px] h-[680px] bg-gradient-to-tr from-zinc-900/20 via-zinc-900/15 to-transparent rounded-full blur-[160px]" />
      </div>

      <div className={`relative z-10 w-full ${demoMode ? 'max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6' : 'max-w-xl mx-auto flex flex-col'} items-start`}>
        {/* Left Card: Main Form */}
        <div className={`${demoMode ? 'lg:col-span-7' : 'w-full'} bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple p-7 sm:p-8`}>
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
                setPassword('');
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-black shadow-sm font-semibold'
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
                  ? 'bg-white text-black shadow-sm font-semibold'
                  : 'text-[#8E9E94] hover:text-white'
              }`}
            >
              Регистрация аккаунта
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-white/10 border border-white/20 flex items-center space-x-2 text-xs text-white">
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
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-black/40 text-white focus:border-white/30 outline-none transition-all"
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
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-black/40 text-white focus:border-white/30 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-sm font-semibold transition-colors shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <span>{loading ? 'Вход...' : 'Войти в систему'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : regStep === 'code' ? (
            <form onSubmit={handleConfirmRegister} className="space-y-4">
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-2 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">Проверка электронной почты</h3>
                <p className="text-xs text-[#9CA3AF]">
                  Код подтверждения отправлен с Яндекс Почты на адрес <span className="font-semibold text-white">{email}</span>
                </p>
              </div>

              {codeSentMsg && (
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{codeSentMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#8E9E94] mb-1.5 text-center">
                  Введите 6-значный проверочный код
                </label>
                <div className="relative max-w-xs mx-auto">
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.4em] text-2xl font-mono font-bold py-2.5 rounded-xl border border-white/[0.15] bg-black/40 text-white focus:border-white/40 outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-center text-[#8E9E94] mt-1.5">
                  Срок действия кода: 15 минут
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length < 6}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-50 text-black text-sm font-semibold transition-colors shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <span>{loading ? 'Проверка...' : 'Подтвердить и войти'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>

              <div className="pt-2 flex items-center justify-between text-xs text-[#8E9E94]">
                <button
                  type="button"
                  onClick={() => setRegStep('form')}
                  className="hover:text-white transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Назад к данным</span>
                </button>

                <button
                  type="button"
                  disabled={resendCountdown > 0 || loading}
                  onClick={handleResendRegisterCode}
                  className="hover:text-white transition-colors disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCountdown > 0
                      ? `Повтор через ${resendCountdown}с`
                      : 'Отправить код снова'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestRegisterCode} className="space-y-4">
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
                          avatarUrl === preset ? 'border-white ring-2 ring-white/30' : 'border-white/[0.1]'
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
                        ? 'border-white/30 bg-white/15 text-white font-semibold'
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
                        ? 'border-white/30 bg-white/15 text-white font-semibold'
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
                        ? 'border-white/30 bg-white/15 text-white font-semibold'
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
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-black/40 text-white focus:border-white/30 outline-none transition-all"
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
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-black/40 text-white outline-none focus:border-white/30 transition-all"
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
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-white/[0.1] bg-black/40 text-white outline-none focus:border-white/30 transition-all"
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
                      className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-black/40 text-white outline-none transition-all ${
                        confirmPassword
                          ? password === confirmPassword
                            ? 'border-white focus:border-white'
                            : 'border-white/30 focus:border-white/40'
                          : 'border-white/[0.1] focus:border-white/30'
                      }`}
                    />
                  </div>
                  {confirmPassword && (
                    <div className="mt-1 text-[11px] flex items-center space-x-1">
                      {password === confirmPassword ? (
                        <span className="text-white flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Пароли совпадают</span>
                        </span>
                      ) : (
                        <span className="text-[#8E9E94] flex items-center space-x-1">
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-black/40 text-white outline-none focus:border-white/30"
                  >
                    <option value="Москва">Москва</option>
                    <option value="Тула">Тула</option>
                  </select>
                </div>
              )}

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
                            ? 'bg-white text-black border-white font-semibold'
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
                className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-sm font-semibold transition-colors shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <span>{loading ? 'Отправка кода...' : 'Получить проверочный код'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Right Card: Quick 1-Click Jury Demo Accounts */}
        {demoMode && (
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-apple p-6 space-y-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4 text-white" />
                  <h2 className="text-sm font-semibold tracking-tight text-white">
                    Вход для клиентов и компаний
                  </h2>
                </div>
                <p className="text-xs text-[#8E9E94] mt-1">
                  Быстрый доступ к кабинету кофейни:
                </p>
              </div>

              {/* Companies / Clients */}
              <div>
                <div className="text-[10px] font-semibold text-[#8E9E94] uppercase tracking-wider mb-2 flex items-center space-x-1">
                  <Building className="w-3 h-3 text-white" />
                  <span>Компании (Клиенты и чат)</span>
                </div>
                <div className="space-y-2">
                  {companies.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleQuickLogin(u)}
                      className="w-full text-left p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.06] transition-all group flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={u.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=Kedr'}
                          alt={u.full_name}
                          className="w-8 h-8 rounded-lg object-cover bg-white/10 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white group-hover:text-white transition-colors truncate">
                            {u.full_name}
                          </div>
                          <div className="text-[10px] text-[#8E9E94] truncate">{u.email} · {u.city}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#8E9E94] group-hover:text-white" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Staff Test Users: Administrator and Engineer */}
              <div className="pt-3 border-t border-white/[0.08]">
                <div className="text-[10px] font-semibold text-[#8E9E94] uppercase tracking-wider mb-2 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Lock className="w-3 h-3 text-white" />
                    <span>Сотрудники сервиса</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10">Защищено паролем</span>
                </div>
                <div className="space-y-2">
                  {[
                    adminUser || {
                      id: 149,
                      email: 'admin@kofeservice.ru',
                      full_name: 'Администратор системы',
                      role: 'dispatcher',
                      city: 'Москва',
                      avatar_url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Admin1997',
                      is_senior: false,
                    },
                    engineerUser || {
                      id: 150,
                      email: 'engineer@kofeservice.ru',
                      full_name: 'Дежурный инженер',
                      role: 'engineer',
                      city: 'Москва',
                      avatar_url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Engineer1997',
                      is_senior: false,
                    },
                  ].map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => handleQuickLogin(u as User)}
                      className="w-full text-left p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.06] transition-all group flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={u.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=Admin1997'}
                          alt={u.full_name}
                          className="w-8 h-8 rounded-lg object-cover bg-white/10 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white group-hover:text-white transition-colors truncate flex items-center space-x-1.5">
                            <span>{u.full_name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-white/10 text-neutral-200 border border-white/20">
                              {u.role === 'dispatcher' ? 'Админ' : 'Инженер'}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#8E9E94] truncate">{u.email}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#8E9E94] group-hover:text-white" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reference Info */}
            <div className="p-3.5 rounded-xl bg-black/30 border border-white/[0.06] text-[11px] text-[#8E9E94] flex justify-between items-center">
              <span>Опорная дата: 16.11.2026 11:30</span>
              <span className="text-white font-medium">Сервис 2.0</span>
            </div>
          </div>
        )}
      </div>

      {/* Staff PIN Modal */}
      {pinModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#16171B] border border-neutral-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-white">
              <Lock className="w-5 h-5 text-neutral-300" />
              <h3 className="text-base font-semibold">Доступ сотрудника</h3>
            </div>
            <p className="text-xs text-neutral-400">
              Вход под аккаунтом <span className="text-white font-medium">{pinModalUser.full_name}</span> ({pinModalUser.role === 'dispatcher' ? 'Админ / Диспетчер' : 'Инженер'}) защищён кодом доступа.
            </p>

            <form onSubmit={handleVerifyStaffPin} className="space-y-3">
              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="Код доступа сотрудника"
                  value={staffPinInput}
                  onChange={(e) => setStaffPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-white/30 tracking-widest text-center"
                />
              </div>

              {pinError && (
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-white/20 text-neutral-200 text-xs text-center">
                  {pinError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPinModalUser(null)}
                  className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={pinLoading || !staffPinInput.trim()}
                  className="flex-1 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {pinLoading ? 'Проверка...' : 'Войти'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
