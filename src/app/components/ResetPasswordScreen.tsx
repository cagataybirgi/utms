import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { resetPassword, AuthApiError } from '../lib/api/auth';

interface ResetPasswordScreenProps {
  token: string;
  onBack: () => void;
  onResetComplete: () => void;
}

// Scenario 1 — Test Cases 1D / 1F / 1G. Sets a new password from a reset token.
export function ResetPasswordScreen({ token, onBack, onResetComplete }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await resetPassword(token, password, confirm);
      setSuccess(true);
      setTimeout(onResetComplete, 1800);
      void res;
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
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Yeni Şifre Belirle</h1>
          <p className="text-gray-500 mt-2">Hesabınız için yeni bir şifre giriniz</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-100">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Şifre Güncellendi</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz.
              </p>
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
                <Label htmlFor="new-password" className="text-xs font-bold uppercase tracking-wider text-gray-500">Yeni Şifre</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Yeni şifreniz"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-50 border-gray-200 focus:bg-white transition-all h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-wider text-gray-500">Yeni Şifre (Tekrar)</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Şifreyi tekrar giriniz"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-gray-50 border-gray-200 focus:bg-white transition-all h-11"
                />
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed">
                Şifre en az 8 karakter olmalı; en az bir büyük harf, bir rakam ve bir özel karakter içermelidir.
              </p>

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
                ) : 'Şifreyi Güncelle'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
