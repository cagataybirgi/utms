import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Hourglass,
} from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import {
  getApplication,
  type ApplicationDetailDto,
  type IntibakCourseRowDto,
} from '../../lib/api/document-upload';
import { deptLabel, applicationStatusLabel } from '../../lib/enums';

interface FinalResultProps {
  applicationId: string;
  userId: string;
  onAppeal: () => void;
  onBack: () => void;
}

type ResultStatus = 'admitted' | 'waitlisted' | 'rejected' | 'pending';

function deriveStatus(app: ApplicationDetailDto): ResultStatus {
  switch (app.rankingCategory) {
    case 'ASIL':
      return 'admitted';
    case 'YEDEK':
      return 'waitlisted';
    case 'RED':
      return 'rejected';
    default:
      return 'pending';
  }
}

function isPublished(app: ApplicationDetailDto): boolean {
  return app.currentStatus === 'RESULTS_PUBLISHED';
}

function semesterLabel(sem: number | null): string {
  if (sem === 3) return '3. Dönem (2. Sınıf Giriş)';
  if (sem === 5) return '5. Dönem (3. Sınıf Giriş)';
  return sem ? `${sem}. Dönem` : '—';
}

function publishedDate(app: ApplicationDetailDto): string {
  const log = app.stageLogs.find((l) => l.stageKey === 'RESULTS_PUBLISHED');
  const iso = log?.occurredAt ?? app.lastModifiedAt;
  return new Date(iso).toLocaleDateString('tr-TR');
}

const RESULT_CONFIG = {
  admitted: {
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    title: 'Tebrikler! Kabul Edildiniz',
    badgeColor: 'bg-green-100 text-green-800',
    badgeText: 'ASİL',
  },
  waitlisted: {
    icon: Clock,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    title: 'Yedek Listesindesiniz',
    badgeColor: 'bg-yellow-100 text-yellow-800',
    badgeText: 'YEDEK',
  },
  rejected: {
    icon: XCircle,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    title: 'Başvuru Kabul Edilmedi',
    badgeColor: 'bg-red-100 text-red-800',
    badgeText: 'RED',
  },
} as const;

function statusBadge(status: string) {
  switch (status) {
    case 'APPROVED':
    case 'SUGGESTED_MATCH':
      return <Badge className="bg-green-100 text-green-800">Tam Muaf</Badge>;
    case 'MANUAL_OVERRIDE':
      return <Badge className="bg-blue-100 text-blue-800">Manuel Eşleştirme</Badge>;
    case 'NOT_EXEMPT':
      return <Badge className="bg-red-100 text-red-800">Muaf Değil</Badge>;
    case 'NO_PREVIOUS_EQUIVALENT':
      return <Badge className="bg-gray-100 text-gray-700">Karşılığı Yok</Badge>;
    default:
      return <Badge className="bg-yellow-100 text-yellow-800">İnceleniyor</Badge>;
  }
}

export function FinalResult({ applicationId, userId, onAppeal, onBack }: FinalResultProps) {
  const [app, setApp] = useState<ApplicationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getApplication(applicationId, userId)
      .then((data) => {
        if (!cancelled) setApp(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Sonuç yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, userId]);

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-gray-900 mb-2">Başvuru Sonucu</h1>
        <p className="text-gray-600">Başvuru ID: {applicationId}</p>
      </div>
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Panele Geri Dön
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Sonuç yükleniyor...
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="space-y-6">
        {header}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error ?? 'Başvuru bulunamadı.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const published = isPublished(app);
  const status = deriveStatus(app);

  // Results not yet officially published by the Faculty Board / ÖİDB.
  if (!published || status === 'pending') {
    return (
      <div className="space-y-6">
        {header}
        <Card className="p-8 border-2 border-blue-200 bg-blue-50">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center border-2 border-blue-200">
                <Hourglass className="w-12 h-12 text-blue-600" />
              </div>
            </div>
            <h2 className="text-gray-900 mb-2">Sonuç Henüz İlan Edilmedi</h2>
            <p className="text-gray-700">
              Başvurunuz değerlendirme sürecindedir. Nihai sonuç Fakülte Yönetim
              Kurulu onayı sonrasında bu ekranda ilan edilecektir.
            </p>
            <div className="mt-4 inline-block px-4 py-2 bg-white rounded-lg border border-blue-200 text-sm text-gray-700">
              Güncel durum: <strong>{applicationStatusLabel(app.currentStatus)}</strong>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-gray-900 mb-4">Başvuru Bilgileri</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Detail label="Hedef Program" value={deptLabel(app.targetDepartmentId)} />
            <Detail label="Hedef Dönem" value={semesterLabel(app.targetedSemester)} />
          </div>
        </Card>
      </div>
    );
  }

  const config = RESULT_CONFIG[status];
  const Icon = config.icon;
  const showIntibak =
    (status === 'admitted' || status === 'waitlisted') &&
    app.intibak &&
    app.intibak.rows.length > 0;

  return (
    <div className="space-y-6">
      {header}

      {/* Result Card */}
      <Card className={`p-8 border-2 ${config.borderColor} ${config.bgColor}`}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div
              className={`w-20 h-20 rounded-full ${config.bgColor} flex items-center justify-center border-2 ${config.borderColor}`}
            >
              <Icon className={`w-12 h-12 ${config.iconColor}`} />
            </div>
          </div>

          <h2 className="text-gray-900 mb-2">{config.title}</h2>
          <p className="text-gray-700 mb-4">
            {status === 'admitted' &&
              `${deptLabel(app.targetDepartmentId)} programına ${semesterLabel(
                app.targetedSemester,
              )} girişi için kabul edildiniz.`}
            {status === 'waitlisted' &&
              'Sıralamaya göre yedek listesinde yer almaktasınız. Kontenjan açılması durumunda bilgilendirileceksiniz.'}
            {status === 'rejected' &&
              'Maalesef bu dönem için başvurunuz olumlu sonuçlanmamıştır.'}
          </p>

          <Badge className={config.badgeColor}>{config.badgeText}</Badge>
        </div>
      </Card>

      {/* Details Card */}
      <Card className="p-6">
        <h2 className="text-gray-900 mb-4">Karar Detayları</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Detail label="Hedef Program" value={deptLabel(app.targetDepartmentId)} />
            <Detail label="Hedef Dönem" value={semesterLabel(app.targetedSemester)} />
            <Detail label="Açıklanma Tarihi" value={publishedDate(app)} />
            <Detail
              label="Nihai Puan"
              value={
                app.transferScore != null
                  ? `${app.transferScore.toFixed(5)} / 100`
                  : '—'
              }
              mono
            />
          </div>

          {status === 'admitted' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Sonraki Adımlar:</strong> Kayıt talimatlarını içeren bir
                e-posta alacaksınız. Lütfen kayıt sürecini ilan edilen takvime göre
                tamamlayınız.
              </AlertDescription>
            </Alert>
          )}

          {status === 'waitlisted' && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Yedek Bilgilendirmesi:</strong> Asil adayların kayıt
                yaptırmaması durumunda sıra size gelecektir. Sıranız geldiğinde
                bilgilendirme yapılacaktır.
              </AlertDescription>
            </Alert>
          )}

          {status === 'rejected' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>İtiraz Süreci:</strong> Değerlendirmede bir hata olduğunu
                düşünüyorsanız, ilan tarihinden itibaren 5 iş günü içerisinde itiraz
                başvurusunda bulunabilirsiniz.
                {app.rejectionReason ? ` Gerekçe: ${app.rejectionReason}` : ''}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      {/* Course Equivalence (Intibak) */}
      {showIntibak && app.intibak && (
        <Card className="p-6">
          <h2 className="text-gray-900 mb-4">Ders Muafiyet Tablosu (İntibak)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Önceki kurumunuzdan aldığınız aşağıdaki dersler muafiyet için
            değerlendirilmiştir.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-700">Alınan Ders</th>
                  <th className="text-left py-3 px-4 text-gray-700">Kredi</th>
                  <th className="text-left py-3 px-4 text-gray-700">Eşdeğer Ders</th>
                  <th className="text-left py-3 px-4 text-gray-700">Kredi</th>
                  <th className="text-left py-3 px-4 text-gray-700">Durum</th>
                </tr>
              </thead>
              <tbody>
                {app.intibak.rows.map((row: IntibakCourseRowDto, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-900">
                      {row.sourceCourses.length > 0
                        ? row.sourceCourses.map((c) => `${c.code} - ${c.name}`).join(', ')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {row.sourceCourses.reduce((s, c) => s + c.ects, 0) || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {row.targetCourse
                        ? `${row.targetCourse.code} - ${row.targetCourse.name}`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {row.targetCourse?.ects ?? '—'}
                    </td>
                    <td className="py-3 px-4">{statusBadge(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
            <strong>Toplam Muafiyet:</strong>{' '}
            {app.intibak.totalExemptedEcts.toFixed(2)} AKTS
          </div>
        </Card>
      )}

      {/* Appeal Section */}
      {status === 'rejected' && (
        <Card className="p-6 border-l-4" style={{ borderLeftColor: '#C00000' }}>
          <h2 className="text-gray-900 mb-2">Sonuçtan Memnun Değil misiniz?</h2>
          <p className="text-sm text-gray-600 mb-4">
            Değerlendirme sürecinde bir hata olduğunu düşünüyorsanız itiraz
            başvurusunda bulunabilirsiniz. İtirazlar sonuç ilanından itibaren 5 iş
            günü içerisinde yapılmalıdır.
          </p>
          <div className="flex items-center justify-end">
            <Button onClick={onAppeal} style={{ backgroundColor: '#C00000' }}>
              İtiraz Et
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
