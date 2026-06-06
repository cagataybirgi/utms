import { Button } from './ui/button';
import { ArrowLeft, Info, UserPlus } from 'lucide-react';

interface RegisterScreenProps {
  onBack: () => void;
}

// Scenario 1 — the login screen exposes a 'Kayıt Ol' link (Test Case 1A). Student
// accounts are provisioned centrally by ÖİDB, so registration is informational.
export function RegisterScreen({ onBack }: RegisterScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#C00000] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Kayıt Ol</h1>
          <p className="text-gray-500 mt-2">Yeni hesap oluşturma bilgileri</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5">
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg p-4">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-900 leading-relaxed">
              Öğrenci ve personel hesapları Öğrenci İşleri Daire Başkanlığı (ÖİDB) tarafından
              merkezi olarak tanımlanır. Hesabınız bulunmuyorsa lütfen ÖİDB ile iletişime geçiniz
              veya kurumsal e-posta adresinizi kullanarak başvurunuzu iletiniz.
            </p>
          </div>

          <Button
            onClick={onBack}
            className="w-full h-11 font-bold"
            style={{ backgroundColor: '#C00000' }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Giriş Ekranına Dön
          </Button>
        </div>
      </div>
    </div>
  );
}
