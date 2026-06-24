import { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { AppShell } from '../AppShell';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  BarChart3,
  ArrowLeft,
  RefreshCw,
  Send,
  ZoomIn,
  ZoomOut,
  Download,
} from 'lucide-react';
import type { User } from '../../App';
import { ReviewAppeals } from './ReviewAppeals';
import { PipelineView } from './PipelineView';
import {
  oidbApi,
  type OidbApplication,
  type OidbDocument,
  type DocumentSlot,
  DOCUMENT_SLOT_LABELS,
  STATUS_LABELS,
  departmentLabel,
  facultyLabel,
  maskTckn,
  formatDate,
} from '../../lib/api/oidb';

interface OIDBDashboardProps {
  user: User;
  onLogout: () => void;
  onSwitchRole?: () => void;
}

type OIDBView = 'dashboard' | 'detail' | 'appeals' | 'pipeline';
type Section = 'dashboard' | 'pipeline' | 'appeals';

function statusBadge(status: string) {
  const label = STATUS_LABELS[status] ?? status;
  if (status === 'PENDING_OIDB_VERIFICATION') return <Badge className="bg-yellow-100 text-yellow-800">{label}</Badge>;
  if (status === 'RETURNED_FOR_CORRECTION') return <Badge className="bg-orange-100 text-orange-800">{label}</Badge>;
  if (status === 'INTAKE_VERIFIED') return <Badge className="bg-green-100 text-green-800">{label}</Badge>;
  if (status === 'REJECTED_AT_INTAKE') return <Badge className="bg-red-100 text-red-800">{label}</Badge>;
  return <Badge className="bg-gray-100 text-gray-800">{label}</Badge>;
}

export function OIDBDashboard({ user, onLogout, onSwitchRole }: OIDBDashboardProps) {
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [currentView, setCurrentView] = useState<OIDBView>('dashboard');
  const [selected, setSelected] = useState<OidbApplication | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [items, setItems] = useState<OidbApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(() => {
    setLoading(true);
    setError(null);
    oidbApi
      .queue(user.id)
      .then((res) => setItems(res.items))
      .catch((e) => setError(e.message ?? 'Kuyruk yüklenemedi'))
      .finally(() => setLoading(false));
  }, [user.id]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const openDetail = (app: OidbApplication) => {
    setSelected(app);
    setCurrentView('detail');
  };

  const backToDashboard = () => {
    setSelected(null);
    setCurrentView('dashboard');
    setCurrentSection('dashboard');
    loadQueue();
  };

  const renderContent = () => {
    if (currentView === 'detail' && selected) {
      return (
        <OidbDetailPanel
          app={selected}
          userId={user.id}
          onUpdated={(updated) => setSelected(updated)}
          onBack={backToDashboard}
        />
      );
    }

    if (currentView === 'appeals' || currentSection === 'appeals') {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={backToDashboard} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <ReviewAppeals onBack={backToDashboard} />
        </div>
      );
    }

    if (currentView === 'pipeline' || currentSection === 'pipeline') {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={backToDashboard} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <PipelineView onBack={backToDashboard} onViewApplication={() => {}} />
        </div>
      );
    }

    const filteredApps = items.filter((app) => {
      const matchesStatus = filterStatus === 'all' || app.currentStatus === filterStatus;
      const matchesSearch =
        searchQuery === '' ||
        app.applicationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.studentFullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.studentTckn ?? '').includes(searchQuery);
      return matchesStatus && matchesSearch;
    });

    const pendingCount = items.filter((a) => a.currentStatus === 'PENDING_OIDB_VERIFICATION').length;
    const returnedCount = items.filter((a) => a.currentStatus === 'RETURNED_FOR_CORRECTION').length;

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-gray-900 mb-2">ÖİDB Memur Paneli</h1>
            <p className="text-gray-600">Öğrenci İşleri Daire Başkanlığı - Başvuru Yönetimi</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadQueue} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
        </div>

        {error && (
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Onay Bekleyen</div>
                <div className="text-2xl text-gray-900">{pendingCount}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Düzeltme İçin İade</div>
                <div className="text-2xl text-gray-900">{returnedCount}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Kuyruktaki Toplam</div>
                <div className="text-2xl text-gray-900">{items.length}</div>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#C00000' }}>
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button variant="outline" className="h-auto py-4 justify-start" onClick={() => setFilterStatus('PENDING_OIDB_VERIFICATION')}>
            <Clock className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="text-sm">Bekleyenleri İncele</div>
              <div className="text-xs text-gray-500 mt-1">{pendingCount} başvuru onay bekliyor</div>
            </div>
          </Button>

          <Button variant="outline" className="h-auto py-4 justify-start" onClick={() => setCurrentView('appeals')}>
            <AlertTriangle className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="text-sm">İtirazları İncele</div>
              <div className="text-xs text-gray-500 mt-1">İtiraz inceleme</div>
            </div>
          </Button>

          <Button variant="outline" className="h-auto py-4 justify-start" onClick={() => setCurrentView('pipeline')}>
            <BarChart3 className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="text-sm">Süreç Takibi</div>
              <div className="text-xs text-gray-500 mt-1">Tüm aşamalardaki başvuruları gör</div>
            </div>
          </Button>
        </div>

        {/* Search and Filter */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Başvuru ID, İsim veya TCKN ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="md:w-64">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Duruma göre filtrele" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Başvurular</SelectItem>
                  <SelectItem value="PENDING_OIDB_VERIFICATION">Onay Bekleyen</SelectItem>
                  <SelectItem value="RETURNED_FOR_CORRECTION">Düzeltme İçin İade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Applications Table */}
        <Card className="p-6">
          <h2 className="text-gray-900 mb-4">Başvuru Kuyruğu</h2>
          {loading ? (
            <div className="py-12 text-center text-gray-500">Yükleniyor…</div>
          ) : filteredApps.length === 0 ? (
            <div className="py-12 text-center text-gray-500">Kuyrukta başvuru yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Başvuru ID</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Öğrenci</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Program</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Fakülte</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Başvuru Tarihi</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Durum</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((app) => (
                    <tr key={app.applicationId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{app.applicationId}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-900">{app.studentFullName}</div>
                        <div className="text-xs text-gray-500">{maskTckn(app.studentTckn)}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{departmentLabel(app.targetDepartmentId)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{facultyLabel(app.targetFacultyId)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatDate(app.submittedAt)}</td>
                      <td className="py-3 px-4">{statusBadge(app.currentStatus)}</td>
                      <td className="py-3 px-4">
                        <Button size="sm" variant="outline" onClick={() => openDetail(app)}>
                          <Eye className="w-4 h-4 mr-1" />
                          İncele
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };

  return (
    <AppShell
      user={user}
      currentRole="OIDB"
      onLogout={onLogout}
      onSwitchRole={onSwitchRole}
      currentSection={currentSection}
      onNavigate={(section) => {
        setCurrentSection(section as Section);
        setSelected(null);
        if (section === 'dashboard') {
          setCurrentView('dashboard');
          loadQueue();
        } else if (section === 'pipeline') {
          setCurrentView('pipeline');
        } else if (section === 'appeals') {
          setCurrentView('appeals');
        }
      }}
    >
      {renderContent()}
    </AppShell>
  );
}

// ─── Detail / action panel ────────────────────────────────────────────────────

interface DetailPanelProps {
  app: OidbApplication;
  userId: string;
  onUpdated: (app: OidbApplication) => void;
  onBack: () => void;
}

// The checklist shows the standard required slots, annotated with whether the
// student actually uploaded a file for each (from the live detail endpoint).
// e-Devlet verification itself stays mocked: an uploaded document is shown as
// "Doğrulandı". The document *preview*, however, is the real uploaded file.
interface ChecklistEntry {
  slot: DocumentSlot;
  uploaded: boolean;
  fileName?: string;
  uploadedAt?: string;
}

function requiredSlotsFor(app: OidbApplication): DocumentSlot[] {
  const base: DocumentSlot[] = [
    'TRANSCRIPT',
    'YKS_RESULT',
    'STUDENT_CERTIFICATE',
    'LANGUAGE_PROOF',
    'CURRICULUM',
    'COURSE_CONTENTS',
  ];
  if ((app.targetDepartmentId ?? '').toLowerCase().includes('arch')) {
    base.push('PORTFOLIO');
  }
  return base;
}

function buildChecklist(app: OidbApplication, documents: OidbDocument[]): ChecklistEntry[] {
  const byType = new Map(documents.map((d) => [d.documentType, d]));
  const slots = requiredSlotsFor(app);
  // Surface any uploaded document whose slot isn't in the required set too.
  for (const d of documents) {
    if (!slots.includes(d.documentType)) slots.push(d.documentType);
  }
  return slots.map((slot) => {
    const doc = byType.get(slot);
    const version = doc?.versions[doc.versions.length - 1];
    return {
      slot,
      uploaded: version != null,
      fileName: version?.standardizedFileName,
      uploadedAt: version?.uploadedAt,
    };
  });
}

type PreviewKind = 'pdf' | 'image' | 'other';

function previewKind(mime: string): PreviewKind {
  if (mime.includes('pdf')) return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return 'other';
}

function OidbDetailPanel({ app, userId, onUpdated, onBack }: DetailPanelProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showReturn, setShowReturn] = useState(false);
  const [returnSlot, setReturnSlot] = useState<DocumentSlot>('TRANSCRIPT');
  const [returnReason, setReturnReason] = useState('');

  const [showReject, setShowReject] = useState(false);
  const [justification, setJustification] = useState('');

  // Live application detail (real uploaded documents).
  const [documents, setDocuments] = useState<OidbDocument[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<DocumentSlot | null>(null);

  // Preview of the actual file behind the selected slot.
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<PreviewKind | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const checklist = buildChecklist(app, documents);
  const selectedEntry = checklist.find((c) => c.slot === selectedSlot) ?? null;

  const inPool =
    app.currentStatus === 'PENDING_OIDB_VERIFICATION' ||
    app.currentStatus === 'RETURNED_FOR_CORRECTION';
  const isVerified = app.currentStatus === 'INTAKE_VERIFIED';

  // Load the real documents for this application.
  useEffect(() => {
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    oidbApi
      .detail(app.applicationId, userId)
      .then((d) => {
        if (cancelled) return;
        setDocuments(d.documents);
        const entries = buildChecklist(d.application, d.documents);
        const firstUploaded = entries.find((e) => e.uploaded) ?? entries[0] ?? null;
        setSelectedSlot(firstUploaded ? firstUploaded.slot : null);
      })
      .catch((e) => {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : 'Belgeler yüklenemedi');
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [app.applicationId, userId]);

  // Fetch + preview the actual file for the selected slot. The previous object
  // URL is revoked on every change so blobs don't leak.
  useEffect(() => {
    setScale(1);
    if (!selectedSlot || !selectedEntry?.uploaded) {
      setFileUrl(null);
      setFileKind(null);
      setFileError(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setFileLoading(true);
    setFileError(null);
    setFileUrl(null);
    oidbApi
      .documentFile(app.applicationId, selectedSlot, userId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
        setFileKind(previewKind(blob.type));
      })
      .catch((e) => {
        if (!cancelled) setFileError(e instanceof Error ? e.message : 'Belge görüntülenemedi');
      })
      .finally(() => {
        if (!cancelled) setFileLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedSlot, selectedEntry?.uploaded, app.applicationId, userId]);

  const run = async (fn: () => Promise<{ application: OidbApplication; message: string }>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fn();
      onUpdated(res.application);
      setMessage(res.message);
      setShowReturn(false);
      setShowReject(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  // Clicking a document in the checklist previews it and pre-selects its slot in
  // the return form.
  const selectDocument = (slot: DocumentSlot) => {
    setSelectedSlot(slot);
    setReturnSlot(slot);
  };

  const [downloadingAll, setDownloadingAll] = useState(false);
  const uploadedCount = checklist.filter((c) => c.uploaded).length;

  // Download every uploaded document for this student as a single zip. Each file
  // is fetched through the private-blob proxy, bundled client-side with JSZip,
  // and saved as one archive named after the application.
  const downloadAllDocuments = async () => {
    const uploaded = checklist.filter((c) => c.uploaded);
    if (uploaded.length === 0 || downloadingAll) return;
    setDownloadingAll(true);
    setError(null);
    setMessage(null);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const entry of uploaded) {
        const blob = await oidbApi.documentFile(app.applicationId, entry.slot, userId);
        // Guard against duplicate file names within the archive.
        let name = entry.fileName ?? `${entry.slot}`;
        if (usedNames.has(name)) name = `${entry.slot}_${name}`;
        usedNames.add(name);
        zip.file(name, blob);
      }
      const archive = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(archive);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.applicationId}_belgeler.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage(`${uploaded.length} belge indirildi (zip).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Belgeler indirilemedi');
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Kuyruğa Dön
      </Button>

      {/* Header + actions */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-gray-900">Başvuru Ön İnceleme ve Doğrulama</h1>
            <p className="text-xs text-gray-500">
              ID: {app.applicationId} • Öğrenci: {app.studentFullName} • TCKN: {maskTckn(app.studentTckn)}
            </p>
          </div>
          {statusBadge(app.currentStatus)}
        </div>

        {app.rejectionReason && (
          <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
            <span className="font-medium">Not / İade gerekçesi:</span> {app.rejectionReason}
          </div>
        )}

        {message && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{message}</div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
        )}

        {/* Actions for pool applications */}
        {inPool && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => run(() => oidbApi.verify(app.applicationId, userId))} disabled={busy}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Doğrula (Onayla)
            </Button>
            <Button variant="outline" onClick={() => { setShowReturn((v) => !v); setShowReject(false); }} disabled={busy}>
              <XCircle className="w-4 h-4 mr-2" />
              Düzeltme İçin İade Et
            </Button>
            <Button variant="outline" className="text-red-600 border-red-300" onClick={() => { setShowReject((v) => !v); setShowReturn(false); }} disabled={busy}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Reddet
            </Button>
          </div>
        )}

        {showReturn && (
          <div className="rounded-md border border-gray-200 p-4 space-y-3">
            <div className="text-sm text-gray-700">Düzeltme istenen belge ve gerekçe:</div>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="md:w-64">
                <Select value={returnSlot} onValueChange={(v) => setReturnSlot(v as DocumentSlot)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_SLOT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="flex-1"
                placeholder="Gerekçe (zorunlu)"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={busy || returnReason.trim() === ''}
              onClick={() => run(() => oidbApi.returnForCorrection(app.applicationId, [{ slot: returnSlot, reason: returnReason.trim() }], userId))}
            >
              İade Et
            </Button>
          </div>
        )}

        {showReject && (
          <div className="rounded-md border border-gray-200 p-4 space-y-3">
            <div className="text-sm text-gray-700">Ret gerekçesi (zorunlu):</div>
            <Input placeholder="Gerekçe" value={justification} onChange={(e) => setJustification(e.target.value)} />
            <Button
              size="sm"
              className="text-red-600 border-red-300"
              variant="outline"
              disabled={busy || justification.trim() === ''}
              onClick={() => run(() => oidbApi.reject(app.applicationId, justification.trim(), userId))}
            >
              Başvuruyu Reddet
            </Button>
          </div>
        )}

        {/* Forward actions once verified */}
        {isVerified && (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">Başvuru onaylandı. Yönlendirme seçin:</div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => run(() => oidbApi.forward(app.applicationId, false, userId))} disabled={busy}>
                <Send className="w-4 h-4 mr-2" />
                YDYO'ya Gönder (dil incelemesi)
              </Button>
              <Button variant="outline" onClick={() => run(() => oidbApi.forward(app.applicationId, true, userId))} disabled={busy}>
                <Send className="w-4 h-4 mr-2" />
                Dil Muafiyeti — Doğrudan İlet
              </Button>
            </div>
          </div>
        )}

        {!inPool && !isVerified && (
          <div className="text-sm text-gray-500">
            Bu başvuru için ÖİDB aşamasında yapılabilecek işlem yok (durum: {STATUS_LABELS[app.currentStatus] ?? app.currentStatus}).
          </div>
        )}
      </Card>

      {/* Side-by-side: form data + document viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: application data + document checklist */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-bold mb-3 border-b pb-2">Öğrenci Bilgileri</h3>
            <div className="grid grid-cols-2 gap-y-3 text-xs">
              <div>
                <div className="text-gray-500">Ad Soyad</div>
                <div className="font-medium">{app.studentFullName}</div>
              </div>
              <div>
                <div className="text-gray-500">TCKN</div>
                <div className="font-medium text-[#C00000]">{maskTckn(app.studentTckn)}</div>
              </div>
              <div>
                <div className="text-gray-500">GNO (GPA)</div>
                <div className="font-medium">{app.submittedGpa}</div>
              </div>
              <div>
                <div className="text-gray-500">Başvuru Tarihi</div>
                <div className="font-medium">{formatDate(app.submittedAt)}</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-bold mb-3 border-b pb-2">Akademik Detaylar</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Mevcut Üniversite</span>
                <span className="font-medium">{app.currentInstitution ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mevcut Program</span>
                <span className="font-medium">{app.currentDepartment ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hedef Program</span>
                <span className="font-bold text-blue-700">{departmentLabel(app.targetDepartmentId)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hedef Fakülte</span>
                <span className="font-medium">{facultyLabel(app.targetFacultyId)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Yarıyıl</span>
                <span className="font-medium">{app.targetSemester}. yarıyıl</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-500">YKS Puanı{app.yksExamYear ? ` (${app.yksExamYear})` : ''}</span>
                <span className="font-bold">{app.submittedYksScore ?? '—'}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <h3 className="text-sm font-bold">Belge Kontrol Listesi</h3>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2"
                disabled={loadingDetail || uploadedCount === 0 || downloadingAll}
                onClick={downloadAllDocuments}
              >
                {downloadingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                    İndiriliyor…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Tüm Belgeleri İndir{uploadedCount > 0 ? ` (${uploadedCount})` : ''}
                  </>
                )}
              </Button>
            </div>
            {loadingDetail ? (
              <div className="py-6 text-center text-xs text-gray-500">Belgeler yükleniyor…</div>
            ) : detailError ? (
              <div className="py-3 text-xs text-red-700">{detailError}</div>
            ) : checklist.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500">Belge bulunamadı.</div>
            ) : (
              <div className="space-y-2">
                {checklist.map((doc) => {
                  const active = selectedSlot === doc.slot;
                  return (
                    <div
                      key={doc.slot}
                      className={`p-2 rounded-lg border cursor-pointer transition-colors ${active ? 'border-[#C00000] bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      onClick={() => selectDocument(doc.slot)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <FileText className={`w-4 h-4 ${active ? 'text-[#C00000]' : 'text-gray-400'}`} />
                          <span className="text-[11px] font-medium">{DOCUMENT_SLOT_LABELS[doc.slot]}</span>
                        </div>
                        {doc.uploaded ? (
                          <Badge className="bg-green-600 hover:bg-green-700 text-white border-none text-[10px]">
                            e-Devlet: Doğrulandı
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-200 text-gray-600 border-none text-[10px]">Yüklenmedi</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className="truncate max-w-[60%]">{doc.fileName ?? 'Belge yüklenmedi'}</span>
                        {doc.uploaded ? (
                          <span className="flex items-center italic">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" />
                            Doğrulandı
                          </span>
                        ) : (
                          <span className="flex items-center italic text-gray-400">
                            <AlertTriangle className="w-3 h-3 mr-1 text-gray-400" />
                            Eksik
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: document viewer — the real uploaded file */}
        <Card className="flex flex-col overflow-hidden p-0 min-h-[480px]">
          <div className="bg-gray-800 text-white p-2 text-xs flex justify-between items-center shrink-0">
            <span className="truncate">
              Görüntülenen: {selectedSlot ? DOCUMENT_SLOT_LABELS[selectedSlot] : 'Belge seçilmedi'}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-6 text-[10px] py-0 px-2"
                disabled={!fileUrl}
                onClick={() => setScale((s) => Math.min(2.5, s + 0.25))}
              >
                <ZoomIn className="w-3 h-3 mr-1" />Yakınlaştır
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-6 text-[10px] py-0 px-2"
                disabled={!fileUrl}
                onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              >
                <ZoomOut className="w-3 h-3 mr-1" />Uzaklaştır
              </Button>
              {fileUrl ? (
                <a href={fileUrl} download={selectedEntry?.fileName ?? 'belge'}>
                  <Button variant="secondary" size="sm" className="h-6 text-[10px] py-0 px-2">
                    <Download className="w-3 h-3 mr-1" />İndir
                  </Button>
                </a>
              ) : (
                <Button variant="secondary" size="sm" className="h-6 text-[10px] py-0 px-2" disabled>
                  <Download className="w-3 h-3 mr-1" />İndir
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 bg-gray-200 overflow-auto">
            {!selectedSlot || !selectedEntry?.uploaded ? (
              <div className="text-center text-gray-500 text-sm px-6">
                <FileText className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                Bu belge öğrenci tarafından yüklenmemiş.
              </div>
            ) : fileLoading ? (
              <div className="text-sm text-gray-500">Belge yükleniyor…</div>
            ) : fileError ? (
              <div className="text-center text-sm text-red-700 px-6">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                {fileError}
              </div>
            ) : fileUrl && fileKind === 'pdf' ? (
              <iframe
                title={selectedEntry.fileName ?? 'Belge'}
                src={fileUrl}
                className="w-full h-full min-h-[460px] bg-white shadow-lg border-0"
                style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
              />
            ) : fileUrl && fileKind === 'image' ? (
              <img
                alt={selectedEntry.fileName ?? 'Belge'}
                src={fileUrl}
                className="max-w-full max-h-full object-contain bg-white shadow-lg"
                style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
              />
            ) : fileUrl ? (
              <div className="text-center text-sm text-gray-600 px-6">
                Bu belge tarayıcıda önizlenemiyor.
                <a href={fileUrl} download={selectedEntry.fileName ?? 'belge'} className="block mt-2 text-blue-700 underline">
                  Belgeyi indir
                </a>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
