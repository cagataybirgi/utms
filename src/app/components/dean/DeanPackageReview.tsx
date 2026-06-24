import { useCallback, useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PenLine,
  Undo2,
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
  IntibakCompletenessResult,
  getDetail,
  intibakCheck,
  lifecycleDisplay,
  returnToYgk,
  signPackage,
} from '../../lib/api/board';

interface DeanPackageReviewProps {
  packageId: string;
  userId: string;
  onBack: () => void;
}

export function DeanPackageReview({ packageId, userId, onBack }: DeanPackageReviewProps) {
  const [detail, setDetail] = useState<BoardPackageDetail | null>(null);
  const [intibak, setIntibak] = useState<IntibakCompletenessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, ic] = await Promise.all([getDetail(packageId), intibakCheck(packageId)]);
      setDetail(d);
      setIntibak(ic);
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

  const handleSign = async () => {
    setSubmitting(true);
    try {
      await signPackage(packageId, userId);
      toast.success('Paket imzalandı ve Fakülte Kurulu incelemesine gönderildi.');
      await fetchDetail();
    } catch (e) {
      // 7B intibak gate / 7C token / 702-HASH all surface their Turkish message here.
      const msg = e instanceof BoardApiError ? e.message : 'İmzalama başarısız.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await returnToYgk(packageId, note.trim());
      toast.success("Paket açıklama notuyla Değerlendirme Komisyonuna (YGK) iade edildi.");
      setShowReturnModal(false);
      setNote('');
      await fetchDetail();
    } catch (e) {
      const msg = e instanceof BoardApiError ? e.message : 'İade başarısız.';
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

  const { pkg, state } = detail;
  const display = lifecycleDisplay(state.lifecycle);
  const dept = DEPARTMENT_LABELS[pkg.departmentId] ?? pkg.departmentId;
  const period = PERIOD_LABELS[pkg.periodId] ?? pkg.periodId;
  const canSign = state.lifecycle === 'PENDING_BOARD_REVIEW';
  const intibakComplete = intibak?.isComplete ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2 font-bold">Dekanlık - Paket İmza Onayı</h1>
          <p className="text-gray-600 font-medium font-mono text-sm">
            {pkg.packageId} — {dept}
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paketlere Dön
        </Button>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="font-medium">
          <strong>Durum:</strong> {display.label}
        </AlertDescription>
      </Alert>

      {/* Intibak completeness (TC-7B) */}
      <Card
        className={`p-4 ${
          intibakComplete ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="flex items-start gap-3">
          {intibakComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-700 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-red-700 mt-0.5" />
          )}
          <div className="flex-1">
            <div
              className={`text-sm font-bold ${
                intibakComplete ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {intibakComplete
                ? 'Tüm Asil adayların intibak tabloları tamam.'
                : 'Eksik intibak tablosu var — imza engelli.'}
            </div>
            {!intibakComplete && intibak && intibak.missingStudentNames.length > 0 && (
              <div className="text-xs text-red-800 mt-1">
                Eksik öğrenci(ler): {intibak.missingStudentNames.join(', ')}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Package overview */}
      <Card className="p-6">
        <h2 className="text-gray-900 mb-4 font-bold">Paket Genel Bakış</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Cell label="Bölüm" value={dept} />
          <Cell label="Dönem" value={period} />
          <Cell label="Asil" value={String(pkg.asilApplicationIds.length)} tone="green" />
          <Cell label="Yedek" value={String(pkg.yedekApplicationIds.length)} tone="yellow" />
        </div>
        {state.clarificationNote && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
            <strong>Önceki açıklama notu:</strong> {state.clarificationNote}
          </div>
        )}
      </Card>

      {/* Actions */}
      <Card className="p-6">
        <h2 className="text-gray-900 mb-4 font-bold">İşlem</h2>
        {canSign ? (
          <>
            <p className="text-sm text-gray-600 mb-6 font-medium">
              Paketi dijital imza ile onaylayıp Fakülte Yönetim Kurulu'na gönderin veya
              eksik varsa açıklama notuyla Değerlendirme Komisyonuna (YGK) iade edin.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center space-y-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={() => setShowReturnModal(true)}
                disabled={submitting}
              >
                <Undo2 className="w-6 h-6" />
                <div className="text-center">
                  <div className="text-sm font-bold">YGK'ya İade Et</div>
                  <div className="text-xs">Açıklama notu iste</div>
                </div>
              </Button>

              <Button
                className="h-auto py-4 flex flex-col items-center space-y-2 shadow-lg shadow-red-100"
                style={{ backgroundColor: '#5C1010' }}
                onClick={() => void handleSign()}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <PenLine className="w-6 h-6" />
                )}
                <div className="text-center">
                  <div className="text-sm font-bold">İmzala ve Kurula Gönder</div>
                  <div className="text-xs opacity-80">Dijital imza (TC-7C)</div>
                </div>
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500 italic">
            Bu paket imza aşamasında değil (durum: {display.label}).
          </div>
        )}
      </Card>

      {/* Return modal */}
      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paketi YGK'ya İade Et</DialogTitle>
            <DialogDescription>
              Paket "Değerlendirme Komisyonundan Açıklama Bekleniyor" durumuna geçer ve
              YGK'ya bir bildirim gönderilir. Lütfen iade gerekçesini yazın.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note">Açıklama Notu *</Label>
              <Textarea
                id="note"
                rows={5}
                placeholder="Örn. Ahmet Kaya için intibak tablosu eksik, tamamlanması gerekiyor..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <Button variant="outline" onClick={() => setShowReturnModal(false)} disabled={submitting}>
                İptal
              </Button>
              <Button
                onClick={() => void handleReturn()}
                disabled={!note.trim() || submitting}
                style={{ backgroundColor: '#C00000' }}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo2 className="w-4 h-4 mr-2" />}
                İade Et
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'yellow' }) {
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
