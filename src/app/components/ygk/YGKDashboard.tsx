import { useState } from 'react';
import { AppShell } from '../AppShell';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Users,
  TrendingUp,
  FileCheck,
  List,
  Award,
  ArrowLeft,
  Inbox
} from 'lucide-react';
import type { User } from '../../App';
import { YGKQueue } from './YGKQueue';
import { ApplicationReview } from './ApplicationReview';
import { AcademicEligibility } from './AcademicEligibility';
import { RankingTable } from './RankingTable';
import { IntibakGeneration } from './IntibakGeneration';
import { IntibakQueue } from './IntibakQueue';
import { IntibakPackage } from './IntibakPackage';

interface YGKDashboardProps {
  user: User;
  onLogout: () => void;
  onSwitchRole?: () => void;
}

type Section = 'dashboard' | 'evaluations' | 'rankings' | 'intibak' | 'queue';
type YGKView = 'dashboard' | 'queue' | 'review' | 'eligibility' | 'ranking' | 'intibak';

export function YGKDashboard({ user, onLogout, onSwitchRole }: YGKDashboardProps) {
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [currentView, setCurrentView] = useState<YGKView>('dashboard');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  // Scenario 6 (Intibak) sub-flow: queue → generation (per applicant) → package.
  type IntibakView = 'queue' | 'generation' | 'package';
  const [intibakView, setIntibakView] = useState<IntibakView>('queue');
  const [intibakApp, setIntibakApp] = useState<{ id: string; name: string; readOnly: boolean } | null>(null);
  const [intibakPkg, setIntibakPkg] = useState<{ departmentId: string; periodId: string } | null>(null);

  const handleOpenApplication = (applicationId: string) => {
    setSelectedApplicationId(applicationId);
    setCurrentView('review');
  };

  const renderDashboardContent = () => {
    // review önce kontrol edilmeli — section=queue kalırken view=review olabilir
    if (currentView === 'review' && selectedApplicationId) {
      return (
        <ApplicationReview
          applicationId={selectedApplicationId}
          onBack={() => {
            setCurrentView('queue');
            setCurrentSection('queue');
            setSelectedApplicationId(null);
          }}
          onScoreConfirmed={() => {
            // Puan onaylandı → sıralama ekranına geç
            setCurrentView('ranking');
            setCurrentSection('rankings');
            setSelectedApplicationId(null);
          }}
        />
      );
    }

    if (currentView === 'queue' || currentSection === 'queue') {
      return (
        <div className="space-y-4">
          <YGKQueue onOpenApplication={handleOpenApplication} />
        </div>
      );
    }

    if (currentView === 'eligibility' || currentSection === 'evaluations') {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => { setCurrentView('dashboard'); setCurrentSection('dashboard'); }} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <AcademicEligibility onBack={() => { setCurrentView('dashboard'); setCurrentSection('dashboard'); }} />
        </div>
      );
    }

    if (currentView === 'ranking' || currentSection === 'rankings') {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => { setCurrentView('dashboard'); setCurrentSection('dashboard'); }} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <RankingTable onBack={() => { setCurrentView('dashboard'); setCurrentSection('dashboard'); }} />
        </div>
      );
    }

    if (currentView === 'intibak' || currentSection === 'intibak') {
      if (intibakView === 'generation' && intibakApp) {
        return (
          <IntibakGeneration
            applicationId={intibakApp.id}
            studentName={intibakApp.name}
            readOnly={intibakApp.readOnly}
            onBack={() => { setIntibakView('queue'); setIntibakApp(null); }}
          />
        );
      }
      if (intibakView === 'package' && intibakPkg) {
        return (
          <IntibakPackage
            departmentId={intibakPkg.departmentId}
            periodId={intibakPkg.periodId}
            onBack={() => { setIntibakView('queue'); setIntibakPkg(null); }}
          />
        );
      }
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => { setCurrentView('dashboard'); setCurrentSection('dashboard'); }} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <IntibakQueue
            onOpenApplication={(id, name, readOnly) => {
              setIntibakApp({ id, name, readOnly });
              setIntibakView('generation');
            }}
            onOpenPackage={(departmentId, periodId) => {
              setIntibakPkg({ departmentId, periodId });
              setIntibakView('package');
            }}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-gray-900 mb-2">YGK Komisyon Paneli</h1>
          <p className="text-gray-600">Bölüm İntibak ve Transfer Komisyonu - Akademik Değerlendirme ve Sıralama</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Toplam Başvuran</div>
                <div className="text-2xl text-gray-900">24</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Uygun Bulunan</div>
                <div className="text-2xl text-gray-900">18</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Sıralanan</div>
                <div className="text-2xl text-gray-900">18</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">İntibakı Hazır</div>
                <div className="text-2xl text-gray-900">12</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Award className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Quotas */}
        <Card className="p-6">
          <h2 className="text-gray-900 mb-4">Dönem Bazlı Kontenjanlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-gray-900">3. Dönem Giriş</div>
                  <div className="text-sm text-gray-600">2. Sınıf Transferi</div>
                </div>
                <Badge>Kontenjan: 8</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Toplam Başvuran:</span>
                  <span className="text-gray-900">15</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Uygun:</span>
                  <span className="text-gray-900">12</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Asil:</span>
                  <span className="text-green-600">8</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Yedek:</span>
                  <span className="text-yellow-600">4</span>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-gray-900">5. Dönem Giriş</div>
                  <div className="text-sm text-gray-600">3. Sınıf Transferi</div>
                </div>
                <Badge>Kontenjan: 4</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Toplam Başvuran:</span>
                  <span className="text-gray-900">9</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Uygun:</span>
                  <span className="text-gray-900">6</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Asil:</span>
                  <span className="text-green-600">4</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Yedek:</span>
                  <span className="text-yellow-600">2</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Workflow Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center space-y-2"
            onClick={() => setCurrentView('queue')}
          >
            <Inbox className="w-8 h-8" style={{ color: '#7A1616' }} />
            <div>
              <div className="text-sm">İnceleme Kuyruğu</div>
              <div className="text-xs text-gray-500 mt-1">Bekleyen başvuruları incele</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center space-y-2"
            onClick={() => setCurrentView('eligibility')}
          >
            <FileCheck className="w-8 h-8" style={{ color: '#7A1616' }} />
            <div>
              <div className="text-sm">Akademik Uygunluk İncelemesi</div>
              <div className="text-xs text-gray-500 mt-1">GPA, dönem ve gereksinim kontrolü</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center space-y-2"
            onClick={() => setCurrentView('ranking')}
          >
            <List className="w-8 h-8" style={{ color: '#7A1616' }} />
            <div>
              <div className="text-sm">Sıralama ve Listeler</div>
              <div className="text-xs text-gray-500 mt-1">Asil/Yedek listelerini oluştur</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center space-y-2"
            onClick={() => { setIntibakView('queue'); setIntibakApp(null); setIntibakPkg(null); setCurrentView('intibak'); }}
          >
            <Award className="w-8 h-8" style={{ color: '#7A1616' }} />
            <div>
              <div className="text-sm">Ders Muafiyeti (İntibak)</div>
              <div className="text-xs text-gray-500 mt-1">Ders eşleştirme ve muafiyet</div>
            </div>
          </Button>
        </div>

        {/* Scoring Formula */}
        <Card className="p-6">
          <h2 className="text-gray-900 mb-4">Transfer Puanı Hesaplama Formülü</h2>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-900 mb-2">
              <strong>Puan = (YKS / 500 × 0.9) + (GPA × 0.1)</strong>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>• YKS Bileşeni: %90 ağırlık (500 üzerinden normalize edilir)</div>
              <div>• GPA Bileşeni: %10 ağırlık</div>
              <div>• Sonuç 5 ondalık basamak hassasiyetle saklanır</div>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <AppShell
      user={user}
      currentRole="YGK"
      onLogout={onLogout}
      onSwitchRole={onSwitchRole}
      currentSection={currentSection}
      onNavigate={(section) => {
        setCurrentSection(section as Section);
        setSelectedApplicationId(null);
        if (section === 'dashboard') {
          setCurrentView('dashboard');
        } else if (section === 'queue') {
          setCurrentView('queue');
        } else if (section === 'rankings') {
          setCurrentView('ranking');
        } else if (section === 'intibak') {
          setIntibakView('queue');
          setIntibakApp(null);
          setIntibakPkg(null);
          setCurrentView('intibak');
        }
      }}
    >
      {renderDashboardContent()}
    </AppShell>
  );
}
