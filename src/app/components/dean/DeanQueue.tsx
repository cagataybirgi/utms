import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import {
  Eye, Clock, Search, Send,
  Building2, GraduationCap, AlertTriangle, CheckCircle2, XCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface QueueApp {
  applicationId: string;
  studentFullName: string;
  studentTckn: string;
  targetDepartmentId: string;
  targetFacultyId: string;
  targetSemester: number;
  submittedGpa: number;
  submittedYksScore: number | null;
  currentStatus: string;
  submittedAt: string;
  ydyoExempt: boolean;
  currentInstitution?: string;
  currentDepartment?: string;
  preScreening: { isPassed: boolean; failedRules: string[] };
}

interface DeanQueueProps {
  userFacultyId?: string;
}

const FACULTY_NAMES: Record<string, string> = {
  'faculty-engineering': 'Mühendislik Fakültesi',
  'faculty-architecture': 'Mimarlık Fakültesi',
};

const DEPT_NAMES: Record<string, string> = {
  'dept-computer-engineering': 'Bilgisayar Mühendisliği',
  'dept-electrical-engineering': 'Elektrik Mühendisliği',
  'dept-mechanical-engineering': 'Makina Mühendisliği',
  'dept-architecture': 'Mimarlık',
  'dept-civil': 'İnşaat Mühendisliği',
};

type DetailView = null | 'detail';

export function DeanQueue({ userFacultyId }: DeanQueueProps) {
  const [applications, setApplications] = useState<QueueApp[]>([]);
  const [filtered, setFiltered] = useState<QueueApp[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<QueueApp | null>(null);

  // Return to OIDB state
  const [showReturnNote, setShowReturnNote] = useState(false);
  const [returnNote, setReturnNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const headers = () => ({
    'x-mock-user': localStorage.getItem('currentUser')
      ? JSON.parse(localStorage.getItem('currentUser')!).id
      : 'user-deans-eng',
    'Content-Type': 'application/json',
  });

  useEffect(() => { fetchQueue(); }, []);

  useEffect(() => {
    if (!search) { setFiltered(applications); return; }
    setFiltered(applications.filter(a =>
      a.studentFullName.toLowerCase().includes(search.toLowerCase()) ||
      a.applicationId.toLowerCase().includes(search.toLowerCase()) ||
      a.studentTckn.includes(search)
    ));
  }, [search, applications]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dean/queue', { headers: headers() });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setApplications(data.applications || []);
    } catch {
      toast.error('Kuyruk yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const facultyMismatch = (app: QueueApp): boolean => {
    if (!userFacultyId) return false;
    return app.targetFacultyId !== userFacultyId;
  };

  const handleForwardToYgk = async (app: QueueApp) => {
    if (facultyMismatch(app)) {
      toast.error('Fakülte uyuşmazlığı — önce ÖİDB\'ye iade edin');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dean/${app.applicationId}/forward-to-ygk`, {
        method: 'POST', headers: headers(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      toast.success('Başvuru YGK\'ya iletildi.');
      setSelectedApp(null);
      await fetchQueue();
    } catch (e: any) {
      toast.error(e.message || 'Hata');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnClick = () => {
    setShowReturnNote(true);
    setReturnNote('');
    setNoteError(false);
  };

  const handleReturnConfirm = async () => {
    if (!returnNote.trim()) { setNoteError(true); return; }
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dean/${selectedApp.applicationId}/return-to-oidb`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ note: returnNote.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      toast.success('Başvuru ÖİDB\'ye iade edildi.');
      setSelectedApp(null);
      setShowReturnNote(false);
      await fetchQueue();
    } catch (e: any) {
      toast.error(e.message || 'Hata');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Application Detail View ──────────────────────────────────────────────
  if (selectedApp) {
    const mismatch = facultyMismatch(selectedApp);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-gray-900">Başvuru Detayı</h2>
            <p className="text-sm text-gray-500 mt-0.5 font-mono">{selectedApp.applicationId}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setSelectedApp(null); setShowReturnNote(false); }}>
            ← Kuyruğa Dön
          </Button>
        </div>

        {/* Fakülte uyuşmazlık uyarısı */}
        {mismatch && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-red-800 text-sm mb-1">Fakülte Uyuşmazlığı</div>
              <div className="text-sm text-red-700">
                Hedef fakülte: <strong>{FACULTY_NAMES[selectedApp.targetFacultyId] || selectedApp.targetFacultyId}</strong>
                <br />
                Siz <strong>{FACULTY_NAMES[userFacultyId || ''] || userFacultyId}</strong>'ne atanmışsınız. Bu başvuru YGK'ya iletilemez.
              </div>
            </div>
          </div>
        )}

        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg flex items-start gap-3">
              <Building2 className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Mevcut Kurum / Bölüm</div>
                <div className="text-sm text-gray-900">{selectedApp.currentInstitution || '—'}</div>
                <div className="text-xs text-gray-600">{selectedApp.currentDepartment || '—'}</div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg flex items-start gap-3">
              <GraduationCap className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Hedef Bölüm / Fakülte</div>
                <div className="text-sm text-gray-900">{DEPT_NAMES[selectedApp.targetDepartmentId] || selectedApp.targetDepartmentId}</div>
                <div className={`text-xs font-medium ${mismatch ? 'text-red-600' : 'text-gray-600'}`}>
                  {FACULTY_NAMES[selectedApp.targetFacultyId] || selectedApp.targetFacultyId}
                  {mismatch && ' ⚠'}
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">GPA</div>
              <div className="text-2xl font-bold text-gray-900">{selectedApp.submittedGpa.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">YKS Puanı</div>
              <div className="text-2xl font-bold text-gray-900">{selectedApp.submittedYksScore || '—'}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Hedef Dönem</div>
              <div className="text-lg font-bold text-gray-900">{selectedApp.targetSemester}. Dönem</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">YDYO Kararı</div>
              <Badge className={selectedApp.ydyoExempt
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-gray-100 text-gray-700'}>
                {selectedApp.ydyoExempt ? 'Muaf' : 'Değerlendirme Gerekli'}
              </Badge>
            </div>
          </div>

          {/* Ön değerlendirme */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            {selectedApp.preScreening.isPassed
              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
              : <XCircle className="w-4 h-4 text-red-600" />}
            <span className="text-sm text-gray-700">
              Ön Değerlendirme: <strong>{selectedApp.preScreening.isPassed ? 'Geçti' : 'Başarısız'}</strong>
              {selectedApp.preScreening.failedRules.length > 0 && (
                <span className="text-gray-500 ml-2">({selectedApp.preScreening.failedRules.join(', ')})</span>
              )}
            </span>
          </div>
        </Card>

        {/* Return to OIDB note field */}
        {showReturnNote && (
          <Card className="p-4 space-y-3 bg-red-50 border-red-200">
            <div className="text-sm font-medium text-red-800">
              ÖİDB'ye iade gerekçesi <span className="text-red-600">*</span>
            </div>
            <Textarea
              autoFocus
              rows={3}
              value={returnNote}
              onChange={(e) => { setReturnNote(e.target.value); setNoteError(false); }}
              placeholder="Göndermeden önce not giriniz..."
              className={noteError ? 'border-red-500' : ''}
            />
            {noteError && (
              <p className="text-xs text-red-600">Göndermeden önce not girmelisiniz.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowReturnNote(false)}>İptal</Button>
              <Button size="sm" variant="destructive" onClick={handleReturnConfirm} disabled={actionLoading}>
                Gönder
              </Button>
            </div>
          </Card>
        )}

        {/* Action buttons */}
        {!showReturnNote && (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleReturnClick} disabled={actionLoading}>
              <XCircle className="w-4 h-4 mr-2" />
              ÖİDB'ye İade Et
            </Button>
            <Button
              onClick={() => handleForwardToYgk(selectedApp)}
              disabled={actionLoading || mismatch}
              title={mismatch ? 'Fakülte uyuşmazlığı — iletilemez' : undefined}
              style={!mismatch ? { backgroundColor: '#7A1616' } : {}}
            >
              <Send className="w-4 h-4 mr-2" />
              YGK'ya İlet
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Queue List View ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-2">Dean Ofisi İnceleme Kuyruğu</h2>
        <p className="text-gray-600">YGK'ya iletilecek başvuruları inceleyin</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Bekleyen</div>
            <div className="text-2xl font-bold text-gray-900">{applications.length}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Fakülte Uyuşmazlığı</div>
            <div className="text-2xl font-bold text-red-600">
              {applications.filter(a => facultyMismatch(a)).length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Öğrenci adı, TC veya başvuru ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Başvuru</th>
                <th className="px-4 py-3 text-left">Öğrenci</th>
                <th className="px-4 py-3 text-left">Hedef Bölüm / Fakülte</th>
                <th className="px-4 py-3 text-left">GPA</th>
                <th className="px-4 py-3 text-left">Durum</th>
                <th className="px-4 py-3 text-left">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Yükleniyor...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Kuyrukta başvuru yok</td></tr>
              ) : (
                filtered.map((app) => {
                  const mismatch = facultyMismatch(app);
                  return (
                    <tr key={app.applicationId} className={`border-b hover:bg-gray-50 transition-colors ${mismatch ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">{app.applicationId}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{app.studentFullName}</div>
                        <div className="text-xs text-gray-500">{app.studentTckn}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{DEPT_NAMES[app.targetDepartmentId] || app.targetDepartmentId}</div>
                        <div className={`text-xs ${mismatch ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {FACULTY_NAMES[app.targetFacultyId] || app.targetFacultyId}
                          {mismatch && ' ⚠ Uyuşmazlık'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{app.submittedGpa.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">YGK Bekliyor</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" onClick={() => setSelectedApp(app)}>
                          <Eye className="w-4 h-4 mr-1" />
                          Aç
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
