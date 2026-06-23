import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  CheckCircle2,
  Clock,
  Circle,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { getApplication, type ApplicationDetailDto, type StageLogDto } from '../../lib/api/document-upload';
import { deptLabel, facultyLabel, transferLabel } from '../../lib/enums';

interface ApplicationTimelineProps {
  applicationId: string;
  userId: string;
  onBack: () => void;
}

// ─── Status rank ──────────────────────────────────────────────────────────────

const STATUS_RANK: Record<string, number> = {
  DRAFT: 0,
  PENDING_DOCUMENT_UPLOAD: 1,
  RETURNED_FOR_CORRECTION: 2,
  PENDING_OIDB_VERIFICATION: 3,
  INTAKE_VERIFIED: 4,
  REJECTED_AT_INTAKE: 4,
  PENDING_YGK_FORWARDING: 5,
  IN_REVIEW_YDYO: 6,
  IN_REVIEW_YGK: 7,
  RANKED_ASIL: 8,
  RANKED_YEDEK: 8,
  RANKED_RED: 8,
  RESULTS_PUBLISHED: 9,
};

function r(status: string): number {
  return STATUS_RANK[status] ?? 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'completed' | 'active' | 'pending';

interface TimelineStep {
  title: string;
  descriptions: { completed: string; active: string; pending: string };
  status: StepStatus;
  timestamp?: string;
  actor: string;
  notes?: string;
}

// ─── Step builder ─────────────────────────────────────────────────────────────

function buildSteps(app: ApplicationDetailDto): TimelineStep[] {
  const rank = r(app.currentStatus);
  const fmt = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
      : undefined;

  // Build a lookup map from the dedicated stage log table
  const logMap = new Map<string, StageLogDto>(app.stageLogs.map((l) => [l.stageKey, l]));
  const log = (key: string) => logMap.get(key);

  // Helper: actor display — prefers stage log, falls back to provided default
  const actor = (key: string, fallback: string) => {
    const entry = log(key);
    if (!entry) return fallback;
    if (entry.actorName && entry.actorRole) return `${entry.actorName} (${entry.actorRole})`;
    return entry.actorName ?? entry.actorRole ?? fallback;
  };

  const isRejected = app.currentStatus === 'REJECTED_AT_INTAKE';

  // Correction notes text
  const correctionText =
    Array.isArray(app.correctionReasons) && app.correctionReasons.length > 0
      ? `Düzeltme talepleri: ${(app.correctionReasons as string[]).join(', ')}`
      : undefined;

  // ── Step 1: Başvuru Oluşturma ──────────────────────────────────────────────
  const step1: TimelineStep = {
    title: 'Başvuru Oluşturma',
    descriptions: {
      completed: 'Transfer başvurunuz başarıyla sisteme iletildi',
      active: 'Başvurunuz oluşturuluyor',
      pending: 'Başvuru oluşturulacak',
    },
    status: 'completed',
    timestamp: fmt(log('APPLICATION_CREATED')?.occurredAt ?? app.submittedAt),
    actor: actor('APPLICATION_CREATED', app.studentFullName),
  };

  // ── Step 2: Belge Yükleme ─────────────────────────────────────────────────
  const docStatus: StepStatus =
    rank >= 3 ? 'completed' : rank >= 1 ? 'active' : 'pending';
  const step2: TimelineStep = {
    title: 'Belge Yükleme',
    descriptions: {
      completed: 'Gerekli belgeler başarıyla sisteme yüklendi',
      active: 'Belgelerinizi sisteme yüklemeniz bekleniyor',
      pending: 'Gerekli belgeler sisteme yüklenecek',
    },
    status: docStatus,
    timestamp: fmt(log('DOCUMENT_UPLOAD')?.occurredAt),
    actor: actor('DOCUMENT_UPLOAD', app.studentFullName),
    notes:
      app.currentStatus === 'RETURNED_FOR_CORRECTION'
        ? 'ÖİDB eksiklik bildirdi. Belgelerinizi düzelterek tekrar yükleyiniz.'
        : undefined,
  };

  // ── Step 3: ÖİDB Ön İnceleme ──────────────────────────────────────────────
  const oidbStatus: StepStatus = rank >= 4 ? 'completed' : rank === 3 ? 'active' : 'pending';
  let oidbNotes: string | undefined;
  if (isRejected && app.rejectionReason) {
    oidbNotes = `Red gerekçesi: ${app.rejectionReason}`;
  } else if (app.currentStatus === 'RETURNED_FOR_CORRECTION' && correctionText) {
    oidbNotes = correctionText;
  }
  if (log('OIDB_INTAKE')?.notes) oidbNotes = log('OIDB_INTAKE')!.notes!;
  const step3: TimelineStep = {
    title: 'ÖİDB Ön İnceleme',
    descriptions: {
      completed: 'Öğrenci İşleri belgelerinizi doğruladı',
      active: 'Öğrenci İşleri belgelerinizi doğruluyor',
      pending: 'Öğrenci İşleri Daire Başkanlığı belgelerinizi inceleyecek',
    },
    status: oidbStatus,
    timestamp: fmt(log('OIDB_INTAKE')?.occurredAt ?? app.intakeVerifiedAt),
    actor: actor('OIDB_INTAKE', 'ÖİDB Personeli'),
    notes: oidbNotes,
  };

  // ── Step 4: YDYO Dil Yeterlilik İncelemesi ────────────────────────────────
  let ydyoStatus: StepStatus = 'pending';
  let ydyoNotes: string | undefined;
  if (rank >= 9 || (app.ydyoExempt && rank >= 5) || rank >= 7) {
    ydyoStatus = 'completed';
  } else if (app.routedToYdyo && rank === 6) {
    ydyoStatus = 'active';
  }
  if (app.ydyoExempt) ydyoNotes = 'Dil yeterlilik muafiyeti tanındı.';
  if (log('YDYO_REVIEW')?.notes) ydyoNotes = log('YDYO_REVIEW')!.notes!;
  const step4: TimelineStep = {
    title: 'YDYO Dil Yeterlilik İncelemesi',
    descriptions: {
      completed: 'Yabancı Diller Yüksekokulu dil yeterliliğinizi değerlendirdi',
      active: 'Yabancı Diller Yüksekokulu dil muafiyetinizi değerlendiriyor',
      pending: 'Yabancı Diller Yüksekokulu dil yeterliliğinizi değerlendirecek',
    },
    status: ydyoStatus,
    timestamp: fmt(log('YDYO_REVIEW')?.occurredAt),
    actor: actor('YDYO_REVIEW', 'YDYO Komisyonu'),
    notes: ydyoNotes,
  };

  // ── Step 5: YGK Akademik Değerlendirme ────────────────────────────────────
  const ygkAcademicStatus: StepStatus =
    rank >= 8 ? 'completed' : rank >= 5 ? 'active' : 'pending';
  const step5: TimelineStep = {
    title: 'YGK Akademik Değerlendirme',
    descriptions: {
      completed: 'Bölüm komisyonu akademik uygunluğunuzu değerlendirdi',
      active: 'Bölüm komisyonu akademik uygunluğunuzu inceliyor',
      pending: 'Bölüm komisyonu akademik uygunluğunuzu inceleyecek',
    },
    status: ygkAcademicStatus,
    timestamp: fmt(log('YGK_ACADEMIC')?.occurredAt),
    actor: actor('YGK_ACADEMIC', 'YGK Komisyonu'),
    notes: log('YGK_ACADEMIC')?.notes ?? undefined,
  };

  // ── Step 6: YGK Sıralama ──────────────────────────────────────────────────
  const ygkRankStatus: StepStatus =
    rank >= 8 ? 'completed' : rank === 7 ? 'active' : 'pending';
  let rankNote: string | undefined = log('YGK_RANKING')?.notes ?? undefined;
  if (!rankNote && app.rankingCategory) {
    const cat =
      app.rankingCategory === 'ASIL'
        ? 'Asil Liste'
        : app.rankingCategory === 'YEDEK'
        ? 'Yedek Liste'
        : 'Red';
    rankNote = `Sonuç: ${cat}`;
  }
  const step6: TimelineStep = {
    title: 'YGK Sıralama',
    descriptions: {
      completed: 'Sıralama listesindeki yeriniz belirlendi',
      active: 'Diğer adaylarla birlikte puan sıralamasına alınıyorsunuz',
      pending: 'Diğer adaylarla birlikte puan sıralamasına alınacaksınız',
    },
    status: ygkRankStatus,
    timestamp: fmt(log('YGK_RANKING')?.occurredAt),
    actor: actor('YGK_RANKING', 'YGK Komisyonu'),
    notes: rankNote,
  };

  // ── Step 7: Ders Muafiyeti (İntibak) ─────────────────────────────────────
  let intibakStatus: StepStatus = 'pending';
  if (app.hasLockedIntibak || rank >= 9) {
    intibakStatus = 'completed';
  } else if (rank >= 8) {
    intibakStatus = 'active';
  }
  const step7: TimelineStep = {
    title: 'Ders Muafiyeti (İntibak)',
    descriptions: {
      completed: 'Eşdeğer sayılacak dersleriniz belirlendi',
      active: 'Eşdeğer sayılacak dersleriniz belirleniyor',
      pending: 'Eşdeğer sayılacak dersleriniz belirlenecek',
    },
    status: intibakStatus,
    timestamp: fmt(log('INTIBAK')?.occurredAt),
    actor: actor('INTIBAK', 'YGK Komisyonu'),
    notes: log('INTIBAK')?.notes ?? undefined,
  };

  // ── Step 8: Dekanlık İncelemesi ───────────────────────────────────────────
  let deanStatus: StepStatus = 'pending';
  if (rank >= 9) {
    deanStatus = 'completed';
  } else if (app.routedToDeansOffice && rank >= 8) {
    deanStatus = 'active';
  }
  const step8: TimelineStep = {
    title: 'Dekanlık İncelemesi',
    descriptions: {
      completed: 'Fakülte dekanlığı değerlendirme paketini onayladı',
      active: 'Fakülte dekanlığı değerlendirme paketini onaylıyor',
      pending: 'Fakülte dekanlığı değerlendirme paketini onaylayacak',
    },
    status: deanStatus,
    timestamp: fmt(log('DEAN_REVIEW')?.occurredAt),
    actor: actor('DEAN_REVIEW', 'Dekan'),
    notes: log('DEAN_REVIEW')?.notes ?? undefined,
  };

  // ── Step 9: Fakülte Yönetim Kurulu Onayı ─────────────────────────────────
  const boardStatus: StepStatus =
    rank >= 9 ? 'completed' : rank >= 8 ? 'active' : 'pending';
  const step9: TimelineStep = {
    title: 'Fakülte Yönetim Kurulu Onayı',
    descriptions: {
      completed: 'Yönetim kurulundan nihai onay alındı',
      active: 'Yönetim kurulu nihai onay sürecini değerlendiriyor',
      pending: 'Yönetim kurulundan nihai onay süreci gerçekleşecek',
    },
    status: boardStatus,
    timestamp: fmt(log('BOARD_APPROVAL')?.occurredAt),
    actor: actor('BOARD_APPROVAL', 'Fakülte Yönetim Kurulu'),
    notes: log('BOARD_APPROVAL')?.notes ?? undefined,
  };

  // ── Step 10: Sonuçların İlanı ─────────────────────────────────────────────
  const resultsStatus: StepStatus =
    app.currentStatus === 'RESULTS_PUBLISHED' ? 'completed' : 'pending';
  const step10: TimelineStep = {
    title: 'Sonuçların İlanı',
    descriptions: {
      completed: 'Nihai transfer kabulü sonuçları sisteme yansıtıldı',
      active: 'Nihai sonuçlar sisteme yansıtılıyor',
      pending: 'Nihai sonuçlar sisteme yansıtılacak',
    },
    status: resultsStatus,
    timestamp: fmt(log('RESULTS_PUBLISHED')?.occurredAt),
    actor: actor('RESULTS_PUBLISHED', 'ÖİDB Personeli'),
    notes: log('RESULTS_PUBLISHED')?.notes ?? undefined,
  };

  return [step1, step2, step3, step4, step5, step6, step7, step8, step9, step10];
}

// ─── Display label maps ───────────────────────────────────────────────────────


// ─── Status badge ─────────────────────────────────────────────────────────────

function statusBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    PENDING_DOCUMENT_UPLOAD: { label: 'Belge Bekleniyor', className: 'bg-blue-100 text-blue-800' },
    RETURNED_FOR_CORRECTION: { label: 'Düzeltme İstendi', className: 'bg-orange-100 text-orange-800' },
    PENDING_OIDB_VERIFICATION: { label: 'ÖİDB İncelemesinde', className: 'bg-yellow-100 text-yellow-800' },
    INTAKE_VERIFIED: { label: 'ÖİDB Onaylandı', className: 'bg-green-100 text-green-800' },
    REJECTED_AT_INTAKE: { label: 'ÖİDB Reddetti', className: 'bg-red-100 text-red-800' },
    PENDING_YGK_FORWARDING: { label: "YGK'ya İletiliyor", className: 'bg-yellow-100 text-yellow-800' },
    IN_REVIEW_YDYO: { label: 'YDYO İncelemesinde', className: 'bg-yellow-100 text-yellow-800' },
    IN_REVIEW_YGK: { label: 'YGK İncelemesinde', className: 'bg-yellow-100 text-yellow-800' },
    RANKED_ASIL: { label: 'Asil Liste', className: 'bg-green-100 text-green-800' },
    RANKED_YEDEK: { label: 'Yedek Liste', className: 'bg-teal-100 text-teal-800' },
    RANKED_RED: { label: 'Reddedildi', className: 'bg-red-100 text-red-800' },
    RESULTS_PUBLISHED: { label: 'Sonuçlandı', className: 'bg-green-100 text-green-800' },
  };
  return map[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApplicationTimeline({ applicationId, userId, onBack }: ApplicationTimelineProps) {
  const [app, setApp] = useState<ApplicationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApplication(applicationId, userId)
      .then(setApp)
      .catch((e) => setError(e instanceof Error ? e.message : 'Yüklenemedi'))
      .finally(() => setLoading(false));
  }, [applicationId, userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Başvuru bilgileri yükleniyor...
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error ?? 'Başvuru bulunamadı.'}
      </div>
    );
  }

  const steps = buildSteps(app);
  const activeStep = steps.find((s) => s.status === 'active');
  const { label, className } = statusBadge(app.currentStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Başvuru Süreç Takibi</h1>
          <p className="text-gray-600 font-mono text-sm">ID: {applicationId}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Panele Geri Dön
        </Button>
      </div>

      {/* Current Status Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 mb-1">Mevcut Aşama</div>
            <h2 className="text-gray-900">{activeStep?.title ?? label}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {activeStep ? activeStep.descriptions.active : '—'}
            </p>
          </div>
          <Badge className={className}>{label}</Badge>
        </div>
      </Card>

      {/* Timeline */}
      <Card className="p-6">
        <h2 className="text-gray-900 mb-6">Başvuru İlerleme Durumu</h2>
        <div className="space-y-0">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const desc = step.descriptions[step.status];

            return (
              <div key={step.title} className="flex">
                {/* Icon + connector */}
                <div className="flex flex-col items-center mr-4">
                  <div className="flex-shrink-0">
                    {step.status === 'completed' && (
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                    )}
                    {step.status === 'active' && (
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-yellow-600" />
                      </div>
                    )}
                    {step.status === 'pending' && (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Circle className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 mt-1 mb-1 ${
                        step.status === 'completed' ? 'bg-green-300' : 'bg-gray-200'
                      }`}
                      style={{ minHeight: '32px' }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between">
                    <h3
                      className={`font-medium ${
                        step.status === 'pending' ? 'text-gray-400' : 'text-gray-900'
                      }`}
                    >
                      {step.title}
                    </h3>
                    {step.timestamp && (
                      <span className="text-xs text-gray-400 shrink-0 ml-4">{step.timestamp}</span>
                    )}
                  </div>

                  <p
                    className={`text-sm mt-0.5 ${
                      step.status === 'pending' ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {desc}
                  </p>

                  <p
                    className={`text-xs mt-1 ${
                      step.status === 'pending' ? 'text-gray-300' : 'text-gray-500'
                    }`}
                  >
                    <span className="font-medium">İşlem Yapan:</span> {step.actor}
                  </p>

                  {step.notes && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-xs text-blue-800">{step.notes}</p>
                    </div>
                  )}

                  {step.status === 'active' && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                      <span className="text-xs text-yellow-700">Şu an işleniyor</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Application Details */}
      <Card className="p-6">
        <h2 className="text-gray-900 mb-4">Başvuru Detayları</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Hedef Program</div>
            <div className="text-gray-900 font-medium">{deptLabel(app.targetDepartmentId)}</div>
          </div>
          <div>
            <div className="text-gray-500">Hedef Fakülte</div>
            <div className="text-gray-900 font-medium">{facultyLabel(app.targetFacultyId)}</div>
          </div>
          <div>
            <div className="text-gray-500">Transfer Türü</div>
            <div className="text-gray-900 font-medium">{transferLabel(app.transferType)}</div>
          </div>
          {app.targetedSemester ? (
            <div>
              <div className="text-gray-500">Hedef Dönem</div>
              <div className="text-gray-900 font-medium">{app.targetedSemester}. Dönem</div>
            </div>
          ) : null}
          <div>
            <div className="text-gray-500">GNO (GPA)</div>
            <div className="text-gray-900 font-medium">{app.submittedGpa.toFixed(2)} / 4.00</div>
          </div>
          {app.submittedYksScore ? (
            <div>
              <div className="text-gray-500">ÖSYM Puanı</div>
              <div className="text-gray-900 font-medium">
                {app.submittedYksScore.toFixed(2)}
                {app.yksExamYear ? ` (${app.yksExamYear})` : ''}
              </div>
            </div>
          ) : null}
          {app.currentInstitution ? (
            <div>
              <div className="text-gray-500">Mevcut Kurum</div>
              <div className="text-gray-900 font-medium">{app.currentInstitution}</div>
            </div>
          ) : null}
          {app.currentDepartment ? (
            <div>
              <div className="text-gray-500">Mevcut Bölüm</div>
              <div className="text-gray-900 font-medium">{app.currentDepartment}</div>
            </div>
          ) : null}
          <div>
            <div className="text-gray-500">Başvuru Tarihi</div>
            <div className="text-gray-900 font-medium">
              {new Date(app.submittedAt).toLocaleDateString('tr-TR', { dateStyle: 'long' })}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Son Güncelleme</div>
            <div className="text-gray-900 font-medium">
              {new Date(app.lastModifiedAt).toLocaleString('tr-TR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
