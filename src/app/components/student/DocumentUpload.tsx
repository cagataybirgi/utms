import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Upload,
  File as FileIcon,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Send,
  History,
  Loader2,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import {
  getChecklist,
  uploadDocument,
  submitApplication,
  type ChecklistDto,
  type DocumentSlotDto,
} from '../../lib/api/document-upload';

interface DocumentUploadProps {
  applicationId: string;
  userId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function DocumentUpload({ applicationId, userId, onComplete, onBack }: DocumentUploadProps) {
  const [checklist, setChecklist] = useState<ChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadChecklist();
  }, [applicationId]);

  async function loadChecklist() {
    setLoading(true);
    setError(null);
    try {
      const data = await getChecklist(applicationId, userId);
      setChecklist(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kontrol listesi yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(slot: DocumentSlotDto, file: File) {
    setUploading(slot.documentType);
    try {
      const updated = await uploadDocument(applicationId, slot.documentType, file, userId);
      setChecklist(prev => {
        if (!prev) return prev;
        const slots = prev.slots.map(s => s.documentType === updated.documentType ? updated : s);
        const mandatory = slots.filter(s => s.required);
        const uploadedCount = mandatory.filter(s => s.activeVersion !== null).length;
        return {
          ...prev,
          slots,
          uploadedMandatoryCount: uploadedCount,
          canSubmit:
            uploadedCount === mandatory.length &&
            (prev.applicationStatus === 'PENDING_DOCUMENT_UPLOAD' ||
              prev.applicationStatus === 'RETURNED_FOR_CORRECTION'),
        };
      });
      toast.success(
        `${updated.name} başarıyla yüklendi${updated.versionCount > 1 ? ` (Sürüm ${updated.versionCount})` : ''}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yükleme başarısız');
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitApplication(applicationId, userId);
      toast.success('Başvurunuz başarıyla gönderildi!');
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderme başarısız');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-500">Belge listesi yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Geri Dön
        </Button>
      </div>
    );
  }

  if (!checklist) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Gerekli Belgeleri Yükleyin</h1>
          <p className="text-gray-600">Başvuru ID: {applicationId}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Forma Geri Dön
        </Button>
      </div>

      {/* Instructions */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Yükleme Kılavuzu:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Başvurunuzu tamamlamak için tüm zorunlu belgeler yüklenmelidir</li>
            <li>Dosyalar PDF, JPG veya PNG formatında olmalıdır</li>
            <li>Maksimum dosya boyutu: Her belge için 10 MB</li>
            <li>Dosyalar sistem standartlarına göre otomatik olarak yeniden adlandırılacaktır</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Document Slot Cards */}
      <div className="grid grid-cols-1 gap-4">
        {checklist.slots.map((slot) => {
          const isUploaded = slot.activeVersion !== null;
          const isUploadingThis = uploading === slot.documentType;

          return (
            <Card key={slot.documentType} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-gray-900">{slot.name}</h3>
                    {slot.required && <span className="text-xs text-red-600">*Zorunlu</span>}
                    {isUploaded && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{slot.description}</p>
                  <p className="text-xs text-gray-500">
                    Kabul edilen formatlar: {slot.acceptedFormats.join(', ')} • Maks boyut: {slot.maxSizeMb}MB
                  </p>

                  {isUploaded && slot.activeVersion && (
                    <div className="mt-4 space-y-2">
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileIcon className="w-5 h-5 text-[#C00000]" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">
                                {slot.activeVersion.standardizedFileName}
                              </span>
                              <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] h-4">
                                Aktif
                              </Badge>
                              {slot.activeVersion.versionNumber > 1 && (
                                <Badge variant="outline" className="text-[10px] h-4">
                                  v{slot.activeVersion.versionNumber}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              Yüklenme: {new Date(slot.activeVersion.uploadedAt).toLocaleString('tr-TR')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {slot.versionCount > 1 && (
                        <div className="pl-4 border-l-2 border-gray-100">
                          <p className="text-[10px] font-medium text-gray-500 flex items-center uppercase tracking-wider">
                            <History className="w-3 h-3 mr-1" />
                            {slot.versionCount - 1} önceki sürüm arşivlendi
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="ml-4">
                  <Button
                    type="button"
                    variant={isUploaded ? 'outline' : 'default'}
                    style={!isUploaded ? { backgroundColor: '#C00000' } : undefined}
                    disabled={isUploadingThis}
                    onClick={() => document.getElementById(`upload-${slot.documentType}`)?.click()}
                  >
                    {isUploadingThis ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {isUploadingThis ? 'Yükleniyor...' : isUploaded ? 'Değiştir' : 'Yükle'}
                  </Button>
                  <input
                    id={`upload-${slot.documentType}`}
                    type="file"
                    className="hidden"
                    accept={slot.acceptedFormats.map(f => `.${f.toLowerCase()}`).join(',')}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(slot, file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Progress Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gray-900 mb-1">Yükleme Durumu</h3>
            <p className="text-sm text-gray-600">
              {checklist.mandatoryCount} zorunlu belgeden {checklist.uploadedMandatoryCount} tanesi yüklendi
            </p>
          </div>
          <div className="text-right">
            {checklist.canSubmit ? (
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            ) : (
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            )}
          </div>
        </div>
      </Card>

      {/* Submit */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Forma Geri Dön
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!checklist.canSubmit || submitting}
          style={{ backgroundColor: '#C00000' }}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          {submitting ? 'Gönderiliyor...' : 'Başvuruyu Tamamla ve Gönder'}
        </Button>
      </div>

      {!checklist.canSubmit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Lütfen başvuruyu göndermeden önce tüm zorunlu belgeleri yükleyiniz.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
