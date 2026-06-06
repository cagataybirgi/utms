import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { forgotPassword, AuthApiError } from '../lib/api/auth';

interface ForgotPasswordScreenProps {
  onBack: () => void;
  onResetLink: (token: string) => void;
}

// Scenario 1 — Test Cases 1D / 1E / 1H / 1I. Requests a password-reset link.
export function ForgotPasswordScreen({ onBack, onResetLink }: ForgotPasswordScreenProps) {
  const [tckn, setTckn] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await forgotPassword(tckn, email);
      setResetToken(res.resetToken);
      setSuccess(true);
    } catch (err) {
      const message = err instanceof AuthApiError ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#C00000] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Şifremi Unuttum</h1>
          <p className="text-gray-500 mt-2">Sıfırlama talimatları için bilgilerinizi giriniz</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-100">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Bağlantı Gönderildi</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.
              </p>
              {resetToken && (
                <Button
                  onClick={() => onResetLink(resetToken)}
                  className="w-full"
                  style={{ backgroundColor: '#C00000' }}
                >
                  Sıfırlama Bağlantısını Aç
                </Button>
              )}
              <button
                type="button"
                onClick={onBack}
                className="w-full text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Giriş Ekranına Dön
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Giriş Ekranına Dön
              </button>

              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="tckn" className="text-xs font-bold uppercase tracking-wider text-gray-500">T.C. Kimlik Numarası</Label>
                <Input
                  id="tckn"
                  type="text"
                  placeholder="11 haneli TCKN giriniz"
                  value={tckn}
                  onChange={(e) => setTckn(e.target.value)}
                  maxLength={11}
                  required
                  className="bg-gray-50 border-gray-200 focus:bg-white transition-all h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-gray-500">E-Posta Adresi</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Kayitli e-posta adresinizi giriniz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-gray-50 border-gray-200 focus:bg-white transition-all h-11"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 font-bold shadow-lg shadow-red-100"
                  style={{ backgroundColor: '#C00000' }}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      İşleniyor...
                    </div>
                  ) : 'Sıfırlama Bağlantısı Gönder'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center mt-8">
          <p className="text-xs text-gray-400 font-medium">
            © 2025 Transfer Yönetim Sistemi • Bilgi İşlem Daire Başkanlığı
          </p>
        </div>
      </div>
    </div>
  );
}
