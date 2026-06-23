import { useCallback, useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { toast } from 'sonner';
import {
  BoardApiError,
  BoardPackageDetail,
  DEPARTMENT_LABELS,
  PERIOD_LABELS,
  approveDecision,
  confirmForPublication,
  getDetail,
  lifecycleDisplay,
  publish,
  rejectDecision,
} from '../../lib/api/board';

interface PackageReviewProps {
  packageId: string;
  onBack: () => void;
}

export function PackageReview({ packageId, onBack }: PackageReviewProps) {
  const [detail, setDetail] = useState<BoardPackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [boardNotes, setBoardNotes] = useState('');
  const [confirmedReview, setConfirmedReview] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDetail(packageId);
      setDetail(res);
    } catch (e) {
      const msg = e instanceof BoardApiError ? e.message : 'Paket detayı alınamadı.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async () => {
    if (!boardNotes.trim() || !confirmedReview) return;
    setSubmitting(true);
    try {
      await approveDecision(packageId, boardNotes.trim());
      toast.success('Paket başarıyla onaylandı. Yayın onayı için bir sonraki adıma geçebilirsiniz.');
      setShowApproveModal(false);
      setBoardNotes('');
      setConfirmedReview(false);
      await fetchDetail();
    } catch (e) {
      const msg = e instanceof BoardApiError ? e.message : 'Onay başarısız.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    setSubmitting(true);
    try {
      await rejectDecision(
        packageId,
        'Fakülte Yönetim Kurulu reddi.',
        rejectionReason.trim(),
        'ygk',
      );
      toast.success('Paket reddedildi ve YGK\'ya iade edildi.');
      setShowRejectModal(false);
      setRejectionReason('');
      await fetchDetail();
    } catch (e) {
      const msg = e instanceof BoardApiError ? e.message : 'Red işlemi başarısız.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmForPublication = async () => {
    setSubmitting(true);
    try {
      await confirmForPublication(packageId);
      toast.success('Sonuçlar ÖİDB\'ye iletildi (Yayına Hazır).');
      await fetchDetail();
    } catch (e) {
      const msg = e instanceof BoardApiError ? e.message : 'Yayın onayı başarısız.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setSubmitting(true);
    try {
      const res = await publish(packageId);
      if (res.hasNotifyErrors) {
        toast.warning(res.message);
      } else {
        toast.success(res.message);
      }
      await fetchDetail();
    } catch (e) {
      const msg = e instanceof BoardApiError ? e.message : 'Yayınlama başarısız.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Paket yükleniyor...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <Card className="p-6">
        <div className="text-red-700">
          {error ?? 'Paket bulunamadı.'} —{' '}
          <button className="underline" onClick={() => void fetchDetail()}>
            tekrar dene
          </button>
        </div>
        <div className="mt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Paketlere Dön
          </Button>
        </div>
      </Card>
    );
  }

  const { pkg, state, hashCheck } = detail;
  const display = lifecycleDisplay(state.lifecycle);
  const dept = DEPARTMENT_LABELS[pkg.departmentId] ?? pkg.departmentId;
  const period = PERIOD_LABELS[pkg.periodId] ?? pkg.periodId;

  const canApproveReject =
    state.lifecycle === 'FORWARDED_TO_BOARD' ||
    state.lifecycle === 'PENDING_BOARD_REVIEW';
  const canConfirmForPublication = state.lifecycle === 'APPROVED_BY_BOARD';
  const canPublish = state.lifecycle === 'READY_FOR_PUBLICATION';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2 font-bold">Fakülte Kurulu - Paket İncelemesi</h1>
          <p className="text-gray-600 font-medium font-mono text-sm">
            {pkg.packageId} — {dept}
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paketlere Dön
        </Button>
      </div>

      {/* Lifecycle status alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="font-medium">
          <strong>Durum:</strong> {display.label}
          {state.deanSignature && (
            <span className="ml-3 text-xs text-gray-600">
              · Dekan imzası: {new Date(state.deanSignature.issuedAt).toLocaleString('tr-TR')}
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Hash integrity panel */}
      <Card
        className={`p-4 ${
          hashCheck.isMatch
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="flex items-start gap-3">
          {hashCheck.isMatch ? (
            <ShieldCheck className="w-5 h-5 text-green-700 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-700 mt-0.5" />
          )}
          <div className="flex-1">
            <div
              className={`text-sm font-bold ${
                hashCheck.isMatch ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {hashCheck.isMatch
                ? '702-HASH bütünlük kontrolü geçti.'
                : '702-HASH ihlali — paket imza sonrası değiştirilmiş.'}
            </div>
            {state.deanSignature && (
              <div className="text-xs text-gray-700 font-mono mt-1">
                İmzalanan hash: {hashCheck.hashAtSignature.slice(0, 16)}… · Şu anki:{' '}
                {hashCheck.currentHash.slice(0, 16)}…
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Package Overview */}
      <Card className="p-6">
        <h2 className="text-gray-900 mb-4 font-bold">Paket Genel Bakış</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <OverviewCell label="Bölüm" value={dept} />
          <OverviewCell label="Dönem" value={period} />
          <OverviewCell
            label="Asil"
            value={String(pkg.asilApplicationIds.length)}
            tone="green"
          />
          <OverviewCell
            label="Yedek"
            value={String(pkg.yedekApplicationIds.length)}
            tone="yellow"
          />
        </div>

        {state.boardDecision && (
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500 mb-2 font-bold uppercase tracking-wider">
              Kurul Kararı:
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-900 leading-relaxed">
              <div className="mb-2">
                <Badge
                  className={
                    state.boardDecision.approved
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }
                >
                  {state.boardDecision.approved ? 'Onaylandı' : 'Reddedildi'}
                </Badge>
                <span className="ml-2 text-xs text-gray-500">
                  {new Date(state.boardDecision.decidedAt).toLocaleString('tr-TR')}
                </span>
              </div>
              <div className="italic">"{state.boardDecision.resolutionText}"</div>
              {state.boardDecision.rejectionReason && (
                <div className="mt-2 text-red-800">
                  <strong>Red gerekçesi:</strong> {state.boardDecision.rejectionReason}
                </div>
              )}
            </div>
          </div>
        )}

        {state.clarificationNote && (
          <div className="pt-4 border-t border-gray-200 mt-4">
            <div className="text-sm text-gray-500 mb-2 font-bold uppercase tracking-wider">
              Dekanlık Açıklama Notu:
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-sm text-gray-900 leading-relaxed italic">
              "{state.clarificationNote}"
            </div>
          </div>
        )}
      </Card>

      {/* Board Decision Actions */}
      <Card className="p-6">
        <h2 className="text-gray-900 mb-4 font-bold">Kurul Kararı</h2>

        {canApproveReject && (
          <>
            <p className="text-sm text-gray-600 mb-6 font-medium">
              Fakülte Yönetim Kurulu bu değerlendirme paketini onaylamalı veya
              reddetmelidir.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center space-y-2 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => setShowRejectModal(true)}
                disabled={submitting}
              >
                <XCircle className="w-6 h-6" />
                <div className="text-center">
                  <div className="text-sm font-bold">Paketi Reddet</div>
                  <div className="text-xs">YGK'ya iade et</div>
                </div>
              </Button>

              <Button
                className="h-auto py-4 flex flex-col items-center space-y-2 shadow-lg shadow-red-100"
                style={{ backgroundColor: '#5C1010' }}
                onClick={() => setShowApproveModal(true)}
                disabled={submitting}
              >
                <CheckCircle2 className="w-6 h-6" />
                <div className="text-center">
                  <div className="text-sm font-bold">Paketi Onayla</div>
                  <div className="text-xs opacity-80">Kararları kesinleştir</div>
                </div>
              </Button>
            </div>
          </>
        )}

        {canConfirmForPublication && (
          <>
            <p className="text-sm text-gray-600 mb-6 font-medium">
              Paket Kurul tarafından onaylandı. Sonuçların öğrencilere ilan edilmesi
              için ÖİDB'ye iletin.
            </p>
            <Button
              className="w-full h-auto py-4 flex flex-col items-center space-y-2"
              style={{ backgroundColor: '#5C1010' }}
              onClick={() => void handleConfirmForPublication()}
              disabled={submitting}
            >
              <Send className="w-6 h-6" />
              <div className="text-center">
                <div className="text-sm font-bold">Yayına Onayla (ÖİDB'ye Gönder)</div>
                <div className="text-xs opacity-80">
                  Lifecycle → READY_FOR_PUBLICATION
                </div>
              </div>
            </Button>
          </>
        )}

        {canPublish && (
          <>
            <p className="text-sm text-gray-600 mb-6 font-medium">
              Paket ÖİDB'ye iletildi. Yayınlama aşaması ÖİDB officer'ı tarafından
              yapılır (bu butonu test için kullanabilirsiniz).
            </p>
            <Button
              variant="outline"
              className="w-full h-auto py-4"
              onClick={() => void handlePublish()}
              disabled={submitting}
            >
              <Send className="w-5 h-5 mr-2" />
              Yayınla (Test İçin)
            </Button>
          </>
        )}

        {!canApproveReject && !canConfirmForPublication && !canPublish && (
          <div className="text-sm text-gray-500 italic">
            Bu paket için Kurul tarafından alınabilecek bir aksiyon kalmadı (durum:{' '}
            {display.label}).
          </div>
        )}
      </Card>

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Değerlendirme Paketini Onayla</DialogTitle>
            <DialogDescription>
              Fakülte Yönetim Kurulu onayı ile paket APPROVED_BY_BOARD durumuna geçer.
              Yayın için ÖİDB'ye iletmek üzere bir sonraki adımda "Yayına Onayla"
              butonu görünür.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm font-medium text-green-800">
                <strong>Onay Etkisi:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>{pkg.asilApplicationIds.length} Asil öğrenci kabul edilecek</li>
                  <li>{pkg.yedekApplicationIds.length} Yedek öğrenci listelenecek</li>
                  <li>Lifecycle → APPROVED_BY_BOARD</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="boardNotes">Kurul Karar Notu *</Label>
              <Textarea
                id="boardNotes"
                rows={4}
                placeholder="Fakülte Yönetim Kurulu'nun resmi karar metnini ve gerekçesini giriniz..."
                value={boardNotes}
                onChange={(e) => setBoardNotes(e.target.value)}
              />
            </div>

            <div className="flex items-start space-x-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Checkbox
                id="confirm"
                checked={confirmedReview}
                onCheckedChange={(checked) => setConfirmedReview(checked as boolean)}
              />
              <Label
                htmlFor="confirm"
                className="text-xs cursor-pointer leading-relaxed text-gray-600 italic"
              >
                Tüm belgeleri incelediğimi ve Fakülte Yönetim Kurulu'nun bu
                değerlendirme paketini nihai ilan için uygun bulduğunu onaylıyorum.
              </Label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowApproveModal(false)}
                disabled={submitting}
              >
                İptal
              </Button>
              <Button
                onClick={() => void handleApprove()}
                disabled={!boardNotes.trim() || !confirmedReview || submitting}
                style={{ backgroundColor: '#5C1010' }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Onayı Tamamla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Değerlendirme Paketini Reddet</DialogTitle>
            <DialogDescription>
              Bu işlem paketi YGK'ya iade eder ve nihai sonuçların ilanını geciktirir.
              Lütfen detaylı neden belirtiniz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-sm font-medium">
                Paket REJECTED_BY_BOARD durumuna geçer, başvuru durumları
                IN_REVIEW_YGK'ya döner ve Dekanlığa otomatik bir bildirim gönderilir.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="rejection">Red Nedeni ve Gerekli Revizyonlar *</Label>
              <Textarea
                id="rejection"
                rows={6}
                placeholder="Tespit edilen eksiklikleri ve yapılması gereken düzeltmeleri açıkça belirtiniz..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(false)}
                disabled={submitting}
              >
                İptal
              </Button>
              <Button
                onClick={() => void handleReject()}
                disabled={!rejectionReason.trim() || submitting}
                variant="destructive"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Reddi Kesinleştir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface OverviewCellProps {
  label: string;
  value: string;
  tone?: 'green' | 'yellow';
}

function OverviewCell({ label, value, tone }: OverviewCellProps) {
  const cls =
    tone === 'green'
      ? 'bg-green-50 border-green-200'
      : tone === 'yellow'
        ? 'bg-yellow-50 border-yellow-200'
        : 'bg-gray-50';
  const valueCls =
    tone === 'green'
      ? 'text-2xl text-green-600 font-bold'
      : tone === 'yellow'
        ? 'text-2xl text-yellow-600 font-bold'
        : 'text-gray-900 font-bold';
  return (
    <div className={`p-4 rounded-lg ${cls}`}>
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={valueCls}>{value}</div>
    </div>
  );
}
