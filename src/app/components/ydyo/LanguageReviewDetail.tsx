import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import {
  ArrowLeft,
  FileText,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Calendar,
  Award,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { CommentsPanel } from '../shared/CommentsPanel';
import { toast } from 'sonner';
import {
  ydyoApi,
  YdyoApiError,
  departmentLabel,
  maskTckn,
  formatDate,
  EXAM_TYPE_LABELS,
  type YdyoDetailDto,
  type LanguageDecision,
} from '../../lib/api/ydyo';

interface LanguageReviewDetailProps {
  applicationId: string;
  userId: string;
  onBack: () => void;
}

export function LanguageReviewDetail({ applicationId, userId, onBack }: LanguageReviewDetailProps) {
  const [data, setData] = useState<YdyoDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<LanguageDecision | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    ydyoApi
      .detail(applicationId, userId)
      .then((d) => {
        setData(d);
        setDecision(d.application.ydyoDecision ?? d.evaluation.suggestedDecision);
        setNotes(d.application.ydyoReviewNotes ?? '');
      })
      .catch((e) => setError(e instanceof YdyoApiError ? e.message : 'Detay yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [applicationId, userId]);

  const handleSubmitDecision = async () => {
    if (!decision) return;
    setIsSubmitting(true);
    try {
      await ydyoApi.decide(applicationId, decision, notes, userId);
      if (decision === 'EXEMPT') {
        toast.success('Dil değerlendirmesi kaydedildi', {
          description: `${applicationId} "Muaf" (+5 bonus puan) olarak işaretlendi.`,
        });
      } else if (decision === 'SUCCESSFUL') {
        toast.success('Dil değerlendirmesi kaydedildi', {
          description: `${applicationId} "Başarılı" olarak işaretlendi.`,
        });
      } else {
        toast.warning('Dil değerlendirmesi kaydedildi', {
          description: `${applicationId} "Başarısız" olarak işaretlendi.`,
        });
      }
      onBack();
    } catch (e) {
      toast.error(e instanceof YdyoApiError ? e.message : 'Değerlendirme kaydedilemedi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-12 flex items-center justify-center text-gray-500">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Yükleniyor...
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error ?? 'Başvuru bulunamadı.'}</AlertDescription>
      </Alert>
    );
  }

  const { application, languageProof, rule, evaluation } = data;
  const examLabel = EXAM_TYPE_LABELS[languageProof.examType];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Dil Yeterlilik Doğrulama Detayı</h1>
          <p className="text-gray-600">
            {application.applicationId} - {application.studentFullName}
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kuyruğa Dön
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1">
            <div><strong>{examLabel} için Dil Gereksinim Kuralları:</strong></div>
            <div className="text-sm">
              • Minimum Geçer Puan: <strong>{rule.minScore}</strong> {evaluation.meetsMinimum ? '✓' : '✗'}
            </div>
            <div className="text-sm">
              • Muafiyet Eşiği: <strong>{rule.exemptScore}</strong> {evaluation.qualifiesForExemption ? '✓' : '✗'}
            </div>
            <div className="text-sm">• Geçerlilik Süresi: {rule.validityLabel}</div>
          </div>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-gray-900 mb-4 font-medium">Öğrenci Bilgileri</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Öğrenci Adı</div>
                <div className="text-gray-900 font-medium">{application.studentFullName}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">TCKN</div>
                <div className="text-gray-900 font-medium font-mono">{maskTckn(application.studentTckn)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Hedef Program</div>
                <div className="text-gray-900 font-medium">{departmentLabel(application.targetDepartmentId)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Eğitim Dili</div>
                <div className="text-gray-900 font-medium">{application.language ?? '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Başvuru Tarihi</div>
                <div className="text-gray-900 flex items-center font-medium">
                  <Calendar className="w-4 h-4 mr-1 text-gray-500" />
                  {formatDate(application.submittedAt)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Mevcut Durum</div>
                {application.ydyoDecision ? (
                  <Badge className="bg-green-100 text-green-800">Değerlendirildi</Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800">YDYO İncelemesi Bekliyor</Badge>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-gray-900 mb-4 font-medium">Dil Belgesi Detayları</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Sınav Türü</div>
                <div className="text-gray-900 font-bold">{examLabel}</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Beyan Edilen Puan</div>
                <div className="text-2xl text-gray-900 font-bold">{languageProof.score}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Sınav Tarihi</div>
                <div className="text-gray-900 font-medium">{formatDate(languageProof.examDate)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Geçerlilik Sonu</div>
                <div className="text-gray-900 font-medium">{formatDate(languageProof.validUntil)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Sertifika No</div>
                <div className="text-gray-900 font-medium">{languageProof.certificateNumber}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Sonuç Değerlendirmesi</div>
                <div className="space-y-1">
                  {evaluation.meetsMinimum ? (
                    <div className="flex items-center text-green-600 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Minimum gereksinimi karşılıyor
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600 text-sm font-medium">
                      <XCircle className="w-4 h-4 mr-1" />
                      Minimum gereksinimin altında
                    </div>
                  )}
                  {evaluation.qualifiesForExemption && (
                    <div className="flex items-center text-blue-600 text-sm font-medium">
                      <Award className="w-4 h-4 mr-1" />
                      Dil muafiyeti için uygun
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <div className="text-sm text-gray-900 mb-2 font-medium">Dil Yeterlilik Belgesi Dosyası</div>
              <div className="text-xs text-gray-500 mb-4">
                {data.document?.versions?.[data.document.versions.length - 1]?.standardizedFileName ??
                  'Öğrenci tarafından yüklenen resmi dil yeterlilik sertifikası'}
              </div>
              <div className="flex items-center justify-center space-x-3">
                <Button size="sm" variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  Belgeyi Görüntüle
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  PDF Olarak İndir
                </Button>
              </div>
            </div>
          </Card>

          <CommentsPanel applicationId={applicationId} currentUserRole="YDYO" />
        </div>

        <div className="space-y-6">
          <Card className="p-6 sticky top-6">
            <h2 className="text-gray-900 mb-4 font-medium">Değerlendirme Kararı</h2>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Karar Seçiniz *</Label>
                <RadioGroup value={decision} onValueChange={(value: LanguageDecision) => setDecision(value)}>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-green-50 transition cursor-pointer">
                      <RadioGroupItem value="SUCCESSFUL" id="successful" />
                      <Label htmlFor="successful" className="flex-1 cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <div>
                            <div className="text-sm text-gray-900 font-medium">Başarılı</div>
                            <div className="text-xs text-gray-500">Minimum gereksinimi karşılıyor</div>
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-red-50 transition cursor-pointer">
                      <RadioGroupItem value="UNSUCCESSFUL" id="unsuccessful" />
                      <Label htmlFor="unsuccessful" className="flex-1 cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <div>
                            <div className="text-sm text-gray-900 font-medium">Başarısız / Geçersiz</div>
                            <div className="text-xs text-gray-500">Gereksinimi karşılamıyor veya belge geçersiz</div>
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-blue-50 transition cursor-pointer">
                      <RadioGroupItem value="EXEMPT" id="exempt" />
                      <Label htmlFor="exempt" className="flex-1 cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <Award className="w-4 h-4 text-blue-600" />
                          <div>
                            <div className="text-sm text-gray-900 font-medium">Muaf</div>
                            <div className="text-xs text-gray-500">Muafiyet kriterlerini sağlıyor (+5 bonus)</div>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {decision === 'UNSUCCESSFUL' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Lütfen belgenin neden başarısız veya geçersiz olduğunu açıklayan detaylı notlar ekleyiniz.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">
                  Değerlendirme Notları {decision === 'UNSUCCESSFUL' && <span className="text-red-600">*</span>}
                </Label>
                <Textarea
                  id="notes"
                  rows={5}
                  placeholder="Dil belgesi değerlendirmesi hakkında detaylı notlar ekleyin..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={decision === 'UNSUCCESSFUL' && !notes ? 'border-red-300' : ''}
                />
                <p className="text-xs text-gray-500">
                  Bu notlar ÖİDB, YGK ve diğer incelemeciler tarafından görülebilecektir.
                </p>
              </div>

              {decision === 'EXEMPT' && (
                <Alert>
                  <Award className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Dil muafiyeti, öğrencinin transfer puanı hesaplamasına <strong>+5 bonus puan</strong> ekleyecektir.
                  </AlertDescription>
                </Alert>
              )}

              <div className="pt-4 space-y-3">
                <Button
                  onClick={handleSubmitDecision}
                  disabled={!decision || (decision === 'UNSUCCESSFUL' && !notes.trim()) || isSubmitting}
                  className="w-full"
                  style={{ backgroundColor: '#C00000' }}
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Değerlendirmeyi Gönder'}
                </Button>

                <Button variant="outline" onClick={onBack} disabled={isSubmitting} className="w-full">
                  İptal
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="text-sm text-gray-900 mb-2 font-medium">Hızlı Referans</div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>• TOEFL iBT: 79-89 Geçer, ≥90 Muaf</div>
              <div>• IELTS: 6.0-6.9 Geçer, ≥7.0 Muaf</div>
              <div>• YDS: 70-84 Geçer, ≥85 Muaf</div>
              <div>• Tüm belgeler geçerlilik süresi içinde olmalıdır</div>
              <div>• Muafiyet +5 bonus puan kazandırır</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
