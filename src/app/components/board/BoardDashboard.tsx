import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../AppShell';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Scale,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  ArrowLeft,
  Lock,
  RefreshCw,
} from 'lucide-react';
import type { User } from '../../App';
import { PackageReview } from './PackageReview';
import {
  BoardApiError,
  BoardQueueItem,
  DEPARTMENT_LABELS,
  PERIOD_LABELS,
  listQueue,
  lifecycleDisplay,
} from '../../lib/api/board';
import { toast } from 'sonner';

interface BoardDashboardProps {
  user: User;
  onLogout: () => void;
  onSwitchRole?: () => void;
}

type BoardView = 'dashboard' | 'package-review';
type Section = 'dashboard';

export function BoardDashboard({ user, onLogout, onSwitchRole }: BoardDashboardProps) {
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [currentView, setCurrentView] = useState<BoardView>('dashboard');
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
    if (currentView === 'dashboard') void fetchQueue();
  }, [currentView, fetchQueue]);

  const handleReviewPackage = (packageId: string) => {
    setSelectedPackage(packageId);
    setCurrentView('package-review');
  };

  const renderDashboardContent = () => {
    if (currentView === 'package-review' && selectedPackage) {
      return (
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => setCurrentView('dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <PackageReview
            packageId={selectedPackage}
            onBack={() => setCurrentView('dashboard')}
          />
        </div>
      );
    }

    const groups = items.reduce(
      (acc, item) => {
        const g = lifecycleDisplay(item.state.lifecycle).group;
        acc[g] = (acc[g] ?? 0) + 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0, locked: 0 } as Record<string, number>,
    );

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-gray-900 mb-2">Fakülte Yönetim Kurulu Paneli</h1>
            <p className="text-gray-600">Transfer Paketlerinin Nihai İncelemesi ve Onayı</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchQueue()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard label="İnceleme Bekleyen" value={groups.pending} icon={<Scale className="w-6 h-6 text-yellow-600" />} bg="bg-yellow-100" />
          <StatCard label="Onaylanan / Yayınlanan" value={groups.approved} icon={<CheckCircle2 className="w-6 h-6 text-green-600" />} bg="bg-green-100" />
          <StatCard label="Reddedilen / İade" value={groups.rejected} icon={<XCircle className="w-6 h-6 text-red-600" />} bg="bg-red-100" />
          <StatCard label="Kilitli (702-HASH)" value={groups.locked} icon={<Lock className="w-6 h-6 text-orange-600" />} bg="bg-orange-100" />
        </div>

        {/* Packages for Review */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-gray-900">Kurul Paket Kuyruğu</h2>
            <Badge className="bg-gray-100 text-gray-700 border-gray-300">
              Toplam: {items.length}
            </Badge>
          </div>

          {loading && items.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">Yükleniyor...</div>
          ) : error ? (
            <div className="text-sm text-red-600 py-8 text-center">
              {error} —{' '}
              <button className="underline" onClick={() => void fetchQueue()}>
                tekrar dene
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">
              Şu anda kurul kuyruğunda paket bulunmuyor.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const display = lifecycleDisplay(item.state.lifecycle);
                const dept =
                  DEPARTMENT_LABELS[item.pkg.departmentId] ?? item.pkg.departmentId;
                const period = PERIOD_LABELS[item.pkg.periodId] ?? item.pkg.periodId;
                const total =
                  item.pkg.asilApplicationIds.length +
                  item.pkg.yedekApplicationIds.length;
                const note = item.state.clarificationNote ?? item.state.hashLockReason;
                return (
                  <div
                    key={item.pkg.packageId}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-gray-900">{dept}</h3>
                          <StatusBadge group={display.group} label={display.label} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2">
                          <div>
                            <div className="text-gray-600">Paket ID</div>
                            <div className="text-gray-900 font-mono text-xs">
                              {item.pkg.packageId.slice(0, 8)}…
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">Dönem</div>
                            <div className="text-gray-900">{period}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Asil / Yedek</div>
                            <div className="text-gray-900">
                              {item.pkg.asilApplicationIds.length} /{' '}
                              {item.pkg.yedekApplicationIds.length}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">Toplam Aday</div>
                            <div className="text-gray-900">{total}</div>
                          </div>
                        </div>
                        {note && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm">
                            <span className="text-blue-900">Not: </span>
                            <span className="text-blue-800">{note}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReviewPackage(item.pkg.packageId)}
                        >
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

        {/* Board Instructions */}
        <Card className="p-6 bg-purple-50 border-purple-200">
          <div className="flex gap-3">
            <Scale className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-purple-900 mb-1">Kurul İnceleme Süreci</h3>
              <p className="text-sm text-purple-800">
                Dekanlıktan gelen imzalı paketleri inceleyin, sıralama listelerini ve
                tavsiyeleri değerlendirin, kurul toplantısında özel durumları tartışın ve
                nihai kabul veya red kararlarını verin. Onaylanan paketler "Yayına Onayla"
                ile ÖİDB'ye iletilir.
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
      currentRole="Board"
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

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
}

function StatCard({ label, value, icon, bg }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600 mb-1">{label}</div>
          <div className="text-2xl text-gray-900">{value}</div>
        </div>
        <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center`}>
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
        ? 'bg-red-100 text-red-800 border-red-300'
        : group === 'locked'
          ? 'bg-orange-100 text-orange-800 border-orange-300'
          : 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return <Badge className={cls}>{label}</Badge>;
}
