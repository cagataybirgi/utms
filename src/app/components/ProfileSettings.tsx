import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, User, Lock, Phone, Mail, Save, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { getProfile, updateProfile, changePassword, type ProfileDto } from '../lib/api/profile';
import type { User as AppUser } from '../App';

interface ProfileSettingsProps {
  user: AppUser;
  onClose: () => void;
  onProfileUpdated: (updatedName: string, updatedEmail: string) => void;
}

type Tab = 'info' | 'password';

const ROLE_LABELS: Record<string, string> = {
  Student: 'Öğrenci',
  OIDB: 'ÖİDB Personeli',
  YDYO: 'YDYO Personeli',
  YGK: 'YGK Komisyonu',
  Dean: 'Dekan',
  Board: 'Yönetim Kurulu',
  Admin: 'Sistem Yöneticisi',
};

export function ProfileSettings({ user, onClose, onProfileUpdated }: ProfileSettingsProps) {
  const [tab, setTab] = useState<Tab>('info');
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Info tab state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Password tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    getProfile(user.id)
      .then((p) => {
        setProfile(p);
        setFullName(p.fullName);
        setEmail(p.email);
        setPhone(p.phoneNum[0] ?? '');
      })
      .catch(() => toast.error('Profil bilgileri yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [user.id]);

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      const updated = await updateProfile(user.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNum: phone.trim() ? [phone.trim()] : [],
      });
      setProfile(updated);
      onProfileUpdated(updated.fullName, updated.email);
      toast.success('Profil bilgileri güncellendi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi.');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Yeni şifreler eşleşmiyor.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(user.id, currentPassword, newPassword);
      toast.success('Şifre başarıyla güncellendi.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Şifre değiştirilemedi.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-lg mx-4 p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-gray-900 font-semibold">Profil Ayarları</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Yükleniyor...
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'info'
                    ? 'border-[#C00000] text-[#C00000]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setTab('info')}
              >
                <User className="w-4 h-4" />
                Kişisel Bilgiler
              </button>
              <button
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'password'
                    ? 'border-[#C00000] text-[#C00000]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setTab('password')}
              >
                <Lock className="w-4 h-4" />
                Şifre Değiştir
              </button>
            </div>

            {/* Info Tab */}
            {tab === 'info' && (
              <div className="p-6 space-y-5">
                {/* Read-only badges */}
                <div className="flex flex-wrap gap-2">
                  {profile?.roles.map((r) => (
                    <span key={r} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">TC Kimlik No</label>
                    <Input value={profile?.tckn ?? ''} readOnly className="bg-gray-50 text-gray-500" />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Ad Soyad</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        className="pl-9"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">E-posta</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        className="pl-9"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Telefon</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        className="pl-9"
                        type="tel"
                        placeholder="+90 5XX XXX XX XX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    style={{ backgroundColor: '#C00000' }}
                    onClick={handleSaveInfo}
                    disabled={savingInfo}
                  >
                    {savingInfo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Kaydet
                  </Button>
                </div>
              </div>
            )}

            {/* Password Tab */}
            {tab === 'password' && (
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500">
                  Şifreniz en az 8 karakter, bir büyük harf, bir rakam ve bir özel karakter içermelidir.
                </p>

                {[
                  { label: 'Mevcut Şifre', value: currentPassword, set: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(v => !v) },
                  { label: 'Yeni Şifre', value: newPassword, set: setNewPassword, show: showNew, toggle: () => setShowNew(v => !v) },
                  { label: 'Yeni Şifre (Tekrar)', value: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
                ].map(({ label, value, set, show, toggle }) => (
                  <div key={label}>
                    <label className="block text-sm text-gray-600 mb-1">{label}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        className="pl-9 pr-10"
                        type={show ? 'text' : 'password'}
                        value={value}
                        onChange={(e) => set(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={toggle}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <Button
                    style={{ backgroundColor: '#C00000' }}
                    onClick={handleChangePassword}
                    disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {savingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                    Şifreyi Güncelle
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
