import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle, Save, ArrowRight, CheckCircle2, Loader2, ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';

// ─── Mock external API responses ─────────────────────────────────────────────

// Set to true to simulate API down scenario (Test Case 2D)
const SIMULATE_API_DOWN = false;

const API_TIMEOUT_MS = 5000;

interface NviYoksisData {
  name: string; surname: string; birthDate: string;
  gpa: string; institution: string; department: string;
  finishedSemester: string; finishedYear: string;
  currentCredit: string; languagePercentage: string; languageLabel: string;
}

interface MultipleEnrollment {
  programs: Array<{ id: string; label: string; data: NviYoksisData }>;
}

// TCKNs that return multiple YÖKSİS enrollment records (double major scenario)
const MOCK_MULTIPLE_ENROLLMENT: Record<string, MultipleEnrollment> = {
  '99887766554': {
    programs: [
      {
        id: 'prog-1',
        label: 'İstanbul Teknik Üniversitesi — Bilgisayar Mühendisliği',
        data: { name: 'Can', surname: 'Yıldız', birthDate: '15/03/2002', gpa: '3.72', institution: 'İstanbul Teknik Üniversitesi', department: 'Bilgisayar Mühendisliği', finishedSemester: '4', finishedYear: '2', currentCredit: '30', languagePercentage: '100', languageLabel: 'İngilizce' },
      },
      {
        id: 'prog-2',
        label: 'İstanbul Teknik Üniversitesi — Matematik Mühendisliği (Çift Anadal)',
        data: { name: 'Can', surname: 'Yıldız', birthDate: '15/03/2002', gpa: '3.72', institution: 'İstanbul Teknik Üniversitesi', department: 'Matematik Mühendisliği (Çift Anadal)', finishedSemester: '4', finishedYear: '2', currentCredit: '28', languagePercentage: '100', languageLabel: 'İngilizce' },
      },
    ],
  },
};

const MOCK_NVI_YOKSIS: Record<string, NviYoksisData> = {
  '12345678901': {
    name: 'Ahmet', surname: 'Yılmaz', birthDate: '01/01/2003',
    gpa: '3.45', institution: 'İstanbul Teknik Üniversitesi', department: 'Endüstri Mühendisliği',
    finishedSemester: '2', finishedYear: '1', currentCredit: '15',
    languagePercentage: '100', languageLabel: 'İngilizce',
  },
  '11223344556': {
    name: 'Zeynep', surname: 'Yılmaz', birthDate: '01/01/2003',
    gpa: '2.0', institution: 'İstanbul Teknik Üniversitesi', department: 'Endüstri Mühendisliği',
    finishedSemester: '2', finishedYear: '1', currentCredit: '15',
    languagePercentage: '100', languageLabel: 'İngilizce',
  },
};

const MOCK_OSYM: Record<string, Record<string, string>> = {
  '12345678901': { '2024': '485.50000', '2023': '472.30000', '2022': '468.12300' },
  '11223344556': { '2024': '485.50000' },
};

async function mockApiCall<T>(
  successValue: T,
  fastDelayMs = 1200,
): Promise<T | null> {
  const result = await Promise.race<'success' | 'timeout'>([
    new Promise(res => setTimeout(() => res('timeout'), API_TIMEOUT_MS)),
    SIMULATE_API_DOWN
      ? new Promise<never>(() => {})
      : new Promise(res => setTimeout(() => res('success'), fastDelayMs)),
  ]);
  return result === 'success' ? successValue : null;
}

// ─── Form types ───────────────────────────────────────────────────────────────

type IdentityStatus = 'idle' | 'loading' | 'verified' | 'manual';
type OsymStatus = 'idle' | 'loading' | 'fetched' | 'manual';

export interface ApplicationFormValues {
  tckn: string;
  name: string; surname: string; birthDate: string;
  gpa: string; institution: string; department: string;
  finishedSemester: string; finishedYear: string;
  currentCredit: string; languagePercentage: string; languageLabel: string;
  transferType: string; targetProgram: string; targetSemester: string;
  osymYear: string; osymScore: string;
  isDraft: boolean;
}

const EMPTY_FORM: ApplicationFormValues = {
  tckn: '', name: '', surname: '', birthDate: '',
  gpa: '', institution: '', department: '',
  finishedSemester: '', finishedYear: '', currentCredit: '',
  languagePercentage: '', languageLabel: '',
  transferType: '', targetProgram: '', targetSemester: '',
  osymYear: '', osymScore: '',
  isDraft: false,
};

interface ApplicationFormProps {
  onSave: (data: ApplicationFormValues) => void;
  onCancel: () => void;
  draftData?: Partial<ApplicationFormValues>;
  userTckn?: string;
}

export function ApplicationForm({ onSave, onCancel, draftData, userTckn }: ApplicationFormProps) {
  const [form, setForm] = useState<ApplicationFormValues>({
    ...EMPTY_FORM,
    ...draftData,
    // Always pre-fill TCKN from logged-in user
    tckn: draftData?.tckn ?? userTckn ?? '',
  });
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus>(
    draftData?.name ? 'verified' : 'idle',
  );
  const [identityWarning, setIdentityWarning] = useState<string | null>(null);
  const [multiplePrograms, setMultiplePrograms] = useState<MultipleEnrollment['programs'] | null>(null);
  const [osymStatus, setOsymStatus] = useState<OsymStatus>(
    draftData?.osymScore ? 'fetched' : 'idle',
  );
  const [osymWarning, setOsymWarning] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [prescreenError, setPrescreenError] = useState<string | null>(null);

  const updateField = (field: keyof ApplicationFormValues, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field as string]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[field as string]; return n; });
    }
    if (prescreenError) setPrescreenError(null);
  };

  // ─── Identity / YÖKSİS fetch ───────────────────────────────────────────────

  const handleVerifyIdentity = async () => {
    if (!form.tckn || form.tckn.length !== 11) {
      setFieldErrors(prev => ({ ...prev, tckn: 'Geçerli bir T.C. Kimlik Numarası giriniz (11 hane)' }));
      return;
    }
    setIdentityStatus('loading');
    setIdentityWarning(null);

    // Check multiple enrollment first
    const multiEnroll = MOCK_MULTIPLE_ENROLLMENT[form.tckn];
    if (multiEnroll) {
      const result = await mockApiCall(multiEnroll);
      if (result === null) {
        setIdentityStatus('manual');
        setIdentityWarning('Sistem arızası. Elle giriş yapabilirsiniz.');
      } else {
        setMultiplePrograms(result.programs);
        setIdentityStatus('idle'); // Wait for program selection
      }
      return;
    }

    const mockData = MOCK_NVI_YOKSIS[form.tckn] ?? null;
    const result = await mockApiCall(mockData);

    if (result === null || !result) {
      setIdentityStatus('manual');
      setIdentityWarning('Sistem arızası. Elle giriş yapabilirsiniz.');
    } else {
      setForm(prev => ({ ...prev, ...result }));
      setIdentityStatus('verified');
      toast.success('Kimlik ve akademik bilgiler NVI/YÖKSİS üzerinden doğrulandı');
    }
  };

  // ─── ÖSYM fetch ────────────────────────────────────────────────────────────

  const handleOsymYearChange = async (year: string) => {
    setForm(prev => ({ ...prev, osymYear: year, osymScore: '' }));
    setOsymStatus('loading');
    setOsymWarning(null);
    if (fieldErrors.osymScore) setFieldErrors(prev => { const n = { ...prev }; delete n.osymScore; return n; });

    const yearScores = MOCK_OSYM[form.tckn];
    const score = yearScores?.[year] ?? null;
    const result = await mockApiCall(score, 1000);

    if (result === null) {
      setOsymStatus('manual');
      setOsymWarning(
        'ÖSYM servisi yanıt vermedi. Sistem arızası. Elle giriş yapabilirsiniz. Manuel girilen puanlar, ÖİDB incelemesinde belge doğrulamasına tabi tutulacaktır.',
      );
    } else {
      setForm(prev => ({ ...prev, osymScore: result, osymYear: year }));
      setOsymStatus('fetched');
    }
  };

  // ─── Validation helpers ────────────────────────────────────────────────────

  const getGpaError = (): string | null => {
    if (!form.gpa) return null;
    const v = parseFloat(form.gpa);
    if (isNaN(v) || v < 0 || v > 4.0) return 'GNO 0.00 ile 4.00 arasında olmalıdır';
    if (v < 2.5) return `GNO (${v.toFixed(2)}) minimum 2.50 eşiğinin altındadır`;
    return null;
  };

  const gpaErr = getGpaError();
  const identityDone = identityStatus === 'verified' || identityStatus === 'manual';
  const fieldReadOnly = identityStatus === 'verified';
  const gpaReadOnly = identityStatus === 'verified';

  // Submit button disabled only when GPA is below threshold (hard block per Test 2C)
  const canSubmit =
    identityDone &&
    !!form.gpa &&
    !gpaErr;

  // Draft can be saved as long as TCKN is entered
  const canSaveDraft = form.tckn.length > 0;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveDraft = () => {
    onSave({ ...form, isDraft: true });
    toast.success('Taslağınız başarıyla kaydedildi');
  };

  const handleSubmit = () => {
    // Field-level validation (Test 2E: missing fields)
    const newErrors: Record<string, string> = {};
    if (!form.transferType) newErrors.transferType = 'Transfer türü seçilmedi';
    if (!form.targetProgram) newErrors.targetProgram = 'Hedef program seçilmedi';
    if (!form.targetSemester) newErrors.targetSemester = 'Hedef dönem seçilmedi';
    if (!form.osymScore) newErrors.osymScore = 'ÖSYM puanı gereklidir';

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setPrescreenError('Gerekli Formu doldurun: Lütfen tüm zorunlu alanları doldurunuz.');
      return;
    }

    // Pre-screening (SDD step 9)
    const gpa = parseFloat(form.gpa);
    if (isNaN(gpa) || gpa < 2.5) {
      setPrescreenError(
        `Ön eleme başarısız: GNO minimum 2.50 gereklidir (mevcut: ${form.gpa}).`,
      );
      return;
    }
    if (form.targetSemester !== '3' && form.targetSemester !== '5') {
      setPrescreenError('Ön eleme başarısız: Sadece 3. veya 5. dönem için başvuru yapılabilir.');
      return;
    }

    onSave({ ...form, isDraft: false });
    toast.success('Bilgiler kaydedildi, belge yükleme ekranına geçiliyor');
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gray-900 mb-2">Yeni Transfer Başvurusu Oluştur</h1>
        <p className="text-gray-600">Başvuru sürecini başlatmak için T.C. Kimlik Numaranızı doğrulayınız</p>
      </div>

      <Card className="p-6 space-y-6">

        {/* ── TCKN Verification ── */}
        <div>
          <h2 className="text-gray-900 mb-4 pb-2 border-b">Kimlik Doğrulama</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="tckn">T.C. Kimlik Numarası</Label>
              <div className="relative">
                <Input
                  id="tckn"
                  value={form.tckn.replace(/(\d{3})\d{5}(\d{3})/, '$1*****$2')}
                  readOnly
                  className="bg-gray-50"
                />
                {identityStatus === 'verified' && (
                  <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />
                )}
                {fieldErrors.tckn && (
                  <AlertCircle className="absolute right-3 top-2.5 h-4 w-4 text-red-500" />
                )}
              </div>
              {fieldErrors.tckn && <p className="text-xs text-red-600 font-medium">{fieldErrors.tckn}</p>}
              <p className="text-xs text-gray-500">Giriş yapan hesabın kimlik numarası kullanılmaktadır</p>
            </div>
            {identityStatus !== 'verified' && (
              <Button
                type="button"
                onClick={handleVerifyIdentity}
                disabled={identityStatus === 'loading'}
                style={{ backgroundColor: '#C00000' }}
              >
                {identityStatus === 'loading' ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Doğrulanıyor…</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" />Doğrula ve Veri Getir</>
                )}
              </Button>
            )}
            {identityStatus === 'verified' && (
              <div className="flex items-center text-sm text-green-600 font-medium pb-2">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Doğrulandı
              </div>
            )}
          </div>
          {identityWarning && (
            <Alert className="mt-3 border-yellow-300 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">{identityWarning}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* ── Multiple YÖKSİS Enrollment Modal ── */}
        {multiplePrograms && (
          <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-yellow-800 font-medium">
              <AlertCircle className="w-4 h-4" />
              Birden Fazla Kayıt Bulundu
            </div>
            <p className="text-sm text-yellow-700">
              YÖKSİS'te birden fazla aktif kayıt bulundu. Lütfen başvurmak istediğiniz programı seçiniz:
            </p>
            <div className="space-y-2">
              {multiplePrograms.map(prog => (
                <button
                  key={prog.id}
                  type="button"
                  onClick={() => {
                    setForm(prev => ({ ...prev, ...prog.data }));
                    setIdentityStatus('verified');
                    setMultiplePrograms(null);
                    toast.success('Program seçildi, bilgiler yüklendi');
                  }}
                  className="w-full text-left px-4 py-3 rounded-md border border-yellow-300 bg-white hover:bg-yellow-50 text-sm font-medium text-gray-800 transition-colors"
                >
                  {prog.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Personal Info ── */}
        {identityDone && (
          <div>
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h2 className="text-gray-900">Kişisel Bilgiler</h2>
              {identityStatus === 'verified' && (
                <div className="flex items-center text-xs text-green-600 font-medium">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> NVI (MERNİS) Tarafından Doğrulandı
                </div>
              )}
              {identityStatus === 'manual' && (
                <div className="flex items-center text-xs text-yellow-600 font-medium">
                  <AlertCircle className="w-3 h-3 mr-1" /> Manuel Giriş
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['name', 'surname', 'birthDate'] as const).map(field => (
                <div key={field} className="space-y-2">
                  <Label>{field === 'name' ? 'Ad' : field === 'surname' ? 'Soyad' : 'Doğum Tarihi'}</Label>
                  <div className="relative">
                    <Input
                      value={form[field]}
                      onChange={e => updateField(field, e.target.value)}
                      readOnly={fieldReadOnly}
                      placeholder={field === 'birthDate' ? 'GG/AA/YYYY' : ''}
                      className={fieldReadOnly ? 'bg-gray-50' : ''}
                    />
                    {fieldReadOnly && <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Academic Info (YÖKSİS) ── */}
        {identityDone && (
          <div>
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h2 className="text-gray-900">Mevcut Akademik Bilgiler</h2>
              {identityStatus === 'verified' && !gpaErr && (
                <div className="flex items-center text-xs text-green-600 font-medium">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> YÖKSİS Tarafından Doğrulandı
                </div>
              )}
              {identityStatus === 'verified' && gpaErr && (
                <div className="flex items-center text-xs text-red-600 font-medium">
                  <AlertCircle className="w-3 h-3 mr-1" /> Uygunluk Kontrolü Başarısız — GNO Yetersiz
                </div>
              )}
              {identityStatus === 'manual' && (
                <div className="flex items-center text-xs text-yellow-600 font-medium">
                  <AlertCircle className="w-3 h-3 mr-1" /> Manuel Giriş
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Institution */}
              <div className="space-y-2">
                <Label>Mevcut Üniversite</Label>
                <div className="relative">
                  <Input value={form.institution} onChange={e => updateField('institution', e.target.value)} readOnly={fieldReadOnly} className={fieldReadOnly ? 'bg-gray-50' : ''} />
                  {fieldReadOnly && <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                </div>
              </div>
              {/* Department */}
              <div className="space-y-2">
                <Label>Mevcut Bölüm</Label>
                <div className="relative">
                  <Input value={form.department} onChange={e => updateField('department', e.target.value)} readOnly={fieldReadOnly} className={fieldReadOnly ? 'bg-gray-50' : ''} />
                  {fieldReadOnly && <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                </div>
              </div>
              {/* GPA — read-only from YÖKSİS; editable only in manual mode */}
              <div className="space-y-2">
                <Label>GNO (GPA — 4.00 üzerinden)</Label>
                <div className="relative">
                  <Input
                    value={form.gpa}
                    onChange={e => updateField('gpa', e.target.value)}
                    readOnly={gpaReadOnly}
                    placeholder="0.00"
                    className={gpaReadOnly ? 'bg-gray-50' : ''}
                  />
                  {gpaReadOnly && !gpaErr && <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                  {gpaReadOnly && gpaErr && <AlertCircle className="absolute right-3 top-2.5 h-4 w-4 text-red-500" />}
                </div>
                {gpaErr && (
                  <p className="text-xs text-red-600 font-medium">{gpaErr}</p>
                )}
                {form.gpa && !gpaErr && (
                  <p className="text-xs text-green-600">✓ GNO minimum gereksinimi karşılıyor</p>
                )}
              </div>
              {/* Finished Semester */}
              <div className="space-y-2">
                <Label>Tamamlanan Dönem</Label>
                <div className="relative">
                  <Input value={form.finishedSemester} onChange={e => updateField('finishedSemester', e.target.value)} readOnly={fieldReadOnly} className={fieldReadOnly ? 'bg-gray-50' : ''} />
                  {fieldReadOnly && <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                </div>
              </div>
              {/* Finished Year */}
              <div className="space-y-2">
                <Label>Tamamlanan Yıl</Label>
                <div className="relative">
                  <Input value={form.finishedYear} onChange={e => updateField('finishedYear', e.target.value)} readOnly={fieldReadOnly} className={fieldReadOnly ? 'bg-gray-50' : ''} />
                  {fieldReadOnly && <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                </div>
              </div>
              {/* Current Credit */}
              <div className="space-y-2">
                <Label>Güncel Kredi</Label>
                <div className="relative">
                  <Input value={form.currentCredit} onChange={e => updateField('currentCredit', e.target.value)} readOnly={fieldReadOnly} className={fieldReadOnly ? 'bg-gray-50' : ''} />
                  {fieldReadOnly && <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                </div>
              </div>
              {/* Language */}
              <div className="space-y-2">
                <Label>Eğitim Dili</Label>
                <div className="relative">
                  <Input
                    value={form.languagePercentage ? `%${form.languagePercentage} ${form.languageLabel}` : ''}
                    readOnly
                    className="bg-gray-50"
                    onChange={() => {}}
                  />
                  {fieldReadOnly && <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                </div>
              </div>
            </div>
            {gpaErr && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {gpaErr}. Bu başvuru ön elemeyi geçemez ve gönderilemez.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* ── Transfer Details ── */}
        {identityDone && (
          <div>
            <h2 className="text-gray-900 mb-4 pb-2 border-b">Transfer Başvuru Detayları</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Transfer Type */}
              <div className="space-y-2">
                <Label>Transfer Türü *</Label>
                <Select value={form.transferType} onValueChange={v => updateField('transferType', v)}>
                  <SelectTrigger className={fieldErrors.transferType ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Transfer türü seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KURUMLAR_ARASI">Kurumlar Arası Yatay Geçiş</SelectItem>
                    <SelectItem value="KURUM_ICI">Kurum İçi Yatay Geçiş</SelectItem>
                    <SelectItem value="DGS">Dikey Geçiş (DGS)</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.transferType && <p className="text-xs text-red-600">{fieldErrors.transferType}</p>}
              </div>
              {/* Target Program */}
              <div className="space-y-2">
                <Label>Hedef Program *</Label>
                <Select value={form.targetProgram} onValueChange={v => updateField('targetProgram', v)}>
                  <SelectTrigger className={fieldErrors.targetProgram ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Program seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="computer-eng">Bilgisayar Mühendisliği</SelectItem>
                    <SelectItem value="electrical-eng">Elektrik-Elektronik Mühendisliği</SelectItem>
                    <SelectItem value="mechanical-eng">Makine Mühendisliği</SelectItem>
                    <SelectItem value="industrial-eng">Endüstri Mühendisliği</SelectItem>
                    <SelectItem value="civil-eng">İnşaat Mühendisliği</SelectItem>
                    <SelectItem value="architecture">Mimarlık</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.targetProgram && <p className="text-xs text-red-600">{fieldErrors.targetProgram}</p>}
              </div>
              {/* Target Semester */}
              <div className="space-y-2">
                <Label>Hedef Dönem *</Label>
                <Select value={form.targetSemester} onValueChange={v => updateField('targetSemester', v)}>
                  <SelectTrigger className={fieldErrors.targetSemester ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Dönem seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3. Dönem (2. Sınıf)</SelectItem>
                    <SelectItem value="5">5. Dönem (3. Sınıf)</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.targetSemester && <p className="text-xs text-red-600">{fieldErrors.targetSemester}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── ÖSYM ── */}
        {identityDone && (
          <div>
            <h2 className="text-gray-900 mb-4 pb-2 border-b">ÖSYM Sınav Bilgileri</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sınav Yılı *</Label>
                <Select
                  value={form.osymYear}
                  onValueChange={handleOsymYearChange}
                  disabled={osymStatus === 'loading'}
                >
                  <SelectTrigger>
                    {osymStatus === 'loading' ? (
                      <div className="flex items-center text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />Puan alınıyor…
                      </div>
                    ) : (
                      <SelectValue placeholder="Yıl seçiniz" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ÖSYM Yerleştirme Puanı *</Label>
                <div className="relative">
                  <Input
                    value={form.osymScore}
                    onChange={e => { if (osymStatus === 'manual') updateField('osymScore', e.target.value); }}
                    readOnly={osymStatus === 'fetched'}
                    placeholder={osymStatus === 'manual' ? 'Puanınızı giriniz' : 'Yıl seçilince otomatik yüklenecek'}
                    className={osymStatus === 'fetched' ? 'bg-gray-50' : ''}
                  />
                  {osymStatus === 'fetched' && <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                  {fieldErrors.osymScore && <AlertCircle className="absolute right-3 top-2.5 h-4 w-4 text-red-500" />}
                </div>
                {fieldErrors.osymScore && <p className="text-xs text-red-600">{fieldErrors.osymScore}</p>}
              </div>
            </div>
            {osymWarning && (
              <Alert className="mt-3 border-yellow-300 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">{osymWarning}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* ── Pre-screening / validation error ── */}
        {prescreenError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{prescreenError}</AlertDescription>
          </Alert>
        )}

        {/* ── Notice ── */}
        {identityDone && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Önemli:</strong> Transfer başvuruları için minimum 2.50 GNO gereklidir.
              Bir sonraki adımda destekleyici belgeleri yüklemeniz gerekecektir.
            </AlertDescription>
          </Alert>
        )}

        {/* ── Actions ── */}
        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            İptal
          </Button>
          <div className="space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={!canSaveDraft}
            >
              <Save className="w-4 h-4 mr-2" />
              Taslak Olarak Kaydet
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{ backgroundColor: '#C00000' }}
              className={!canSubmit ? 'opacity-50' : ''}
            >
              Kaydet ve Belge Yüklemeye Devam Et
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
