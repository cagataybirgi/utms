import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../AppShell';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Building2, Send, Eye, FileText, ArrowLeft, RefreshCw, PenLine } from 'lucide-react';
import type { User } from '../../App';
import { DeanPackageReview } from './DeanPackageReview';
import { DeanQueue } from './DeanQueue';
import {
  BoardApiError,
  BoardQueueItem,
  DEPARTMENT_LABELS,
  PERIOD_LABELS,
  listQueue,
  lifecycleDisplay,
} from '../../lib/api/board';
import { toast } from 'sonner';

interface DeanDashboardProps {
  user: User;
  onLogout: () => void;
  onSwitchRole?: () => void;
}

type DeanView = 'dashboard' | 'package-detail' | 'queue';
type Section = 'dashboard' | 'queue';

export function DeanDashboard({ user, onLogout, onSwitchRole }: DeanDashboardProps) {
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [currentView, setCurrentView] = useState<DeanView>('dashboard');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const [items, setItems] = useState<BoardQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listQueue();
      setItems(res.items);
    } catch (e) {
      const msg = e instanceof BoardApiError ? e.message : 'Paket listesi alınamadı.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentView === 'dashboard' && currentSection === 'dashboard') void fetchQueue();
  }, [currentView, currentSection, fetchQueue]);

  const handleViewPackage = (packageId: string) => {
    setSelectedPackage(packageId);
    setCurrentView('package-detail');
  };

  const renderDashboardContent = () => {
    if (currentSection === 'queue') {
      return (
        <DeanQueue userFacultyId={user.id === 'user-deans-eng' ? 'faculty-engineering' : undefined} />
      );
    }

    if (currentView === 'package-detail' && selectedPackage) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setCurrentView('dashboard')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <DeanPackageReview
            packageId={selectedPackage}
            userId={user.id}
            onBack={() => setCurrentView('dashboard')}
          />
        </div>
      );
    }

    const pendingSignature = items.filter((i) => i.state.lifecycle === 'PENDING_BOARD_REVIEW').length;
    const signed = items.filter((i) => i.state.lifecycle === 'FORWARDED_TO_BOARD').length;
    const returned = items.filter((i) => i.state.lifecycle === 'WAITING_FOR_CLARIFICATION_YGK').length;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-gray-900 mb-2">Dekanlık Paneli</h1>
            <p className="text-gray-600">Değerlendirme Paketleri — İmza ve Kurula Sevk</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchQueue()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Stat label="İmza Bekleyen" value={pendingSignature} icon={<PenLine className="w-6 h-6 text-yellow-600" />} bg="bg-yellow-100" />
          <Stat label="Kurula Gönderilen" value={signed} icon={<Send className="w-6 h-6 text-green-600" />} bg="bg-green-100" />
          <Stat label="YGK'ya İade" value={returned} icon={<FileText className="w-6 h-6 text-amber-600" />} bg="bg-amber-100" />
          <Stat label="Toplam Paket" value={items.length} icon={<Building2 className="w-6 h-6 text-white" />} bg="" accent />
        </div>

        {/* Packages */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-gray-900">Değerlendirme Paketleri</h2>
            <Badge className="bg-gray-100 text-gray-700 border-gray-300">Toplam: {items.length}</Badge>
          </div>

          {loading && items.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">Yükleniyor...</div>
          ) : error ? (
            <div className="text-sm text-red-600 py-8 text-center">
              {error} — <button className="underline" onClick={() => void fetchQueue()}>tekrar dene</button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">
              Şu anda dekanlık kuyruğunda paket bulunmuyor.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const display = lifecycleDisplay(item.state.lifecycle);
                const dept = DEPARTMENT_LABELS[item.pkg.departmentId] ?? item.pkg.departmentId;
                const period = PERIOD_LABELS[item.pkg.periodId] ?? item.pkg.periodId;
                return (
                  <div key={item.pkg.packageId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-gray-900">{dept}</h3>
                          <StatusBadge group={display.group} label={display.label} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">Paket ID</div>
                            <div className="text-gray-900 font-mono text-xs">{item.pkg.packageId.slice(0, 8)}…</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Dönem</div>
                            <div className="text-gray-900">{period}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Asil / Yedek</div>
                            <div className="text-gray-900">
                              {item.pkg.asilApplicationIds.length} / {item.pkg.yedekApplicationIds.length}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">İmza</div>
                            <div className="text-gray-900">{item.state.deanSignature ? 'İmzalı' : 'Bekliyor'}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button size="sm" variant="outline" onClick={() => handleViewPackage(item.pkg.packageId)}>
                          <Eye className="w-4 h-4 mr-2" />
                          İncele
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-blue-900 mb-1">İmza Süreci</h3>
              <p className="text-sm text-blue-800">
                YGK'dan gelen paketleri inceleyin, intibak tablolarının tamamlandığını doğrulayın
                ve dijital imza ile Fakülte Yönetim Kurulu'na sevk edin. Eksik varsa açıklama
                notuyla Değerlendirme Komisyonuna iade edin.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <AppShell
      user={user}
      currentRole="Dean"
      onLogout={onLogout}
      onSwitchRole={onSwitchRole}
      currentSection={currentSection}
      onNavigate={(section) => {
        setCurrentSection(section as Section);
        setCurrentView('dashboard');
      }}
    >
      {renderDashboardContent()}
    </AppShell>
  );
}

interface StatProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
  accent?: boolean;
}

function Stat({ label, value, icon, bg, accent }: StatProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600 mb-1">{label}</div>
          <div className="text-2xl text-gray-900">{value}</div>
        </div>
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${bg}`}
          style={accent ? { backgroundColor: '#C00000' } : undefined}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ group, label }: { group: string; label: string }) {
  const cls =
    group === 'approved'
      ? 'bg-green-100 text-green-800 border-green-300'
      : group === 'rejected'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : group === 'locked'
          ? 'bg-orange-100 text-orange-800 border-orange-300'
          : 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return <Badge className={cls}>{label}</Badge>;
}
