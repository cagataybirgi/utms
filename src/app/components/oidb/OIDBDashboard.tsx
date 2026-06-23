import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import type { User } from '../../App';
import { ReviewAppeals } from './ReviewAppeals';
import { PipelineView } from './PipelineView';
import {
  oidbApi,
  type OidbApplication,
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

function OidbDetailPanel({ app, userId, onUpdated, onBack }: DetailPanelProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showReturn, setShowReturn] = useState(false);
  const [returnSlot, setReturnSlot] = useState<DocumentSlot>('TRANSCRIPT');
  const [returnReason, setReturnReason] = useState('');

  const [showReject, setShowReject] = useState(false);
  const [justification, setJustification] = useState('');

  const inPool =
    app.currentStatus === 'PENDING_OIDB_VERIFICATION' ||
    app.currentStatus === 'RETURNED_FOR_CORRECTION';
  const isVerified = app.currentStatus === 'INTAKE_VERIFIED';

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

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Kuyruğa Dön
      </Button>

      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-gray-900">{app.studentFullName}</h2>
            <p className="text-xs text-gray-500">
              ID: {app.applicationId} • TCKN: {maskTckn(app.studentTckn)}
            </p>
          </div>
          {statusBadge(app.currentStatus)}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Program</div>
            <div className="text-gray-900">{departmentLabel(app.targetDepartmentId)}</div>
          </div>
          <div>
            <div className="text-gray-500">Fakülte</div>
            <div className="text-gray-900">{facultyLabel(app.targetFacultyId)}</div>
          </div>
          <div>
            <div className="text-gray-500">Yarıyıl</div>
            <div className="text-gray-900">{app.targetSemester}. yarıyıl</div>
          </div>
          <div>
            <div className="text-gray-500">GNO</div>
            <div className="text-gray-900">{app.submittedGpa}</div>
          </div>
          <div>
            <div className="text-gray-500">YKS Puanı</div>
            <div className="text-gray-900">{app.submittedYksScore ?? '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Başvuru Tarihi</div>
            <div className="text-gray-900">{formatDate(app.submittedAt)}</div>
          </div>
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
          <div className="flex flex-wrap gap-3 pt-2">
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
          <div className="space-y-3 pt-2">
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
          <div className="text-sm text-gray-500 pt-2">
            Bu başvuru için ÖİDB aşamasında yapılabilecek işlem yok (durum: {STATUS_LABELS[app.currentStatus] ?? app.currentStatus}).
          </div>
        )}
      </Card>
    </div>
  );
}
