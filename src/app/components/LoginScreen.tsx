import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, Lock, User as UserIcon } from 'lucide-react';
import type { User } from '../App';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';
import { RegisterScreen } from './RegisterScreen';
import { login as apiLogin, AuthApiError } from '../lib/api/auth';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  initialResetToken?: string | null;
}

type Screen = 'login' | 'forgot' | 'reset' | 'register';

export function LoginScreen({ onLogin, initialResetToken }: LoginScreenProps) {
  const [tckn, setTckn] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [screen, setScreen] = useState<Screen>(initialResetToken ? 'reset' : 'login');
  const [resetToken, setResetToken] = useState<string>(initialResetToken ?? '');

  useEffect(() => {
    const savedLockout = localStorage.getItem('lockoutUntil');
    if (savedLockout) {
      const until = parseInt(savedLockout, 10);
      if (until > Date.now()) {
        setLockoutUntil(until);
      } else {
        localStorage.removeItem('lockoutUntil');
      }
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (lockoutUntil) {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
        setRemainingTime(remaining);
        if (remaining === 0) {
          setLockoutUntil(null);
          localStorage.removeItem('lockoutUntil');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLocked = !!lockoutUntil && Date.now() < lockoutUntil;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLocked) return;

    if (!tckn || !password) {
      setError('Lütfen tüm alanları doldurunuz.');
      return;
    }
    if (tckn.length !== 11 || !/^\d+$/.test(tckn)) {
      setError('T.C. Kimlik Numarası 11 haneli olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const user = await apiLogin(tckn, password);
      onLogin(user);
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 423) {
        // Account locked — start the 15-minute countdown and disable the button.
        const until = Date.now() + 15 * 60 * 1000;
        setLockoutUntil(until);
        localStorage.setItem('lockoutUntil', until.toString());
        setError(err.message);
      } else if (err instanceof AuthApiError) {
        // Invalid credentials / rate limit — clear the password, keep the TCKN.
        setError(err.message);
        setPassword('');
      } else {
        setError('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (screen === 'forgot') {
    return (
      <ForgotPasswordScreen
        onBack={() => setScreen('login')}
        onResetLink={(token) => {
          setResetToken(token);
          setScreen('reset');
        }}
      />
    );
  }

  if (screen === 'reset') {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onBack={() => setScreen('login')}
        onResetComplete={() => setScreen('login')}
      />
    );
  }

  if (screen === 'register') {
    return <RegisterScreen onBack={() => setScreen('login')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-2xl transform -rotate-6 transition-transform hover:rotate-0"
            style={{ backgroundColor: '#C00000' }}
          >
            <div className="text-white">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Transfer Yönetim Sistemi</h1>
          <p className="text-gray-500 mt-2 font-medium">Lütfen devam etmek için giriş yapınız</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-bold">{error}</AlertDescription>
              </Alert>
            )}

            {isLocked && (
              <Alert variant="destructive" className="bg-orange-50 border-orange-100 text-orange-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-bold">
                  Hesap kilitlendi. Kalan süre: {Math.floor(remainingTime / 60)}dk {remainingTime % 60}sn.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="tckn" className="text-xs font-bold uppercase tracking-wider text-gray-500">T.C. Kimlik Numarası</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="tckn"
                  type="text"
                  placeholder="11 haneli TCKN"
                  value={tckn}
                  onChange={(e) => setTckn(e.target.value)}
                  maxLength={11}
                  disabled={isLocked}
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-all h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-gray-500">Şifre</Label>
                <button
                  type="button"
                  onClick={() => setScreen('forgot')}
                  className="text-xs font-bold hover:text-[#900000] transition-colors"
                  style={{ color: '#C00000' }}
                >
                  Şifremi Unuttum?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Şifreniz"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLocked}
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-all h-11"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-11 font-bold shadow-lg shadow-red-100"
                style={{ backgroundColor: '#C00000' }}
                disabled={isLocked || loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Giriş yapılıyor...
                  </div>
                ) : 'Giriş Yap'}
              </Button>
            </div>

            <p className="text-center text-xs text-gray-500 pt-1">
              Hesabınız yok mu?{' '}
              <button
                type="button"
                onClick={() => setScreen('register')}
                className="font-bold hover:text-[#900000] transition-colors"
                style={{ color: '#C00000' }}
              >
                Kayıt Ol
              </button>
            </p>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">Demo Giriş Bilgileri</p>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-gray-500">
              <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col"><span>Öğrenci: <span className="text-gray-900">12345678901</span></span><span>Şifre: <span className="text-gray-900">ValidPass1!</span></span></div>
              <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col"><span>ÖİDB: <span className="text-gray-900">11111111111</span></span><span>Şifre: <span className="text-gray-900">oidb123</span></span></div>
              <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col"><span>YDYO: <span className="text-gray-900">55555555555</span></span><span>Şifre: <span className="text-gray-900">ydyo123</span></span></div>
              <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col"><span>YGK: <span className="text-gray-900">22222222222</span></span><span>Şifre: <span className="text-gray-900">ygk123</span></span></div>
              <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col"><span>YGK Başkanı: <span className="text-gray-900">33333333333</span></span><span>Şifre: <span className="text-gray-900">ygkchair123</span></span></div>
              <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col"><span>Dekanlık: <span className="text-gray-900">44444444444</span></span><span>Şifre: <span className="text-gray-900">dean123</span></span></div>
              <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col"><span>Admin: <span className="text-gray-900">99999999999</span></span><span>Şifre: <span className="text-gray-900">admin123</span></span></div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-xs text-gray-400 font-medium">
            © 2025 Üniversite Transfer Yönetim Sistemi v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
