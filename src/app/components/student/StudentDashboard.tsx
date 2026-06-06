import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AppShell } from '../AppShell';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  FileText,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  ArrowLeft,
  Loader2,
  Upload,
} from 'lucide-react';
import type { User } from '../../App';
import { ApplicationForm, type ApplicationFormValues } from './ApplicationForm';
import { DocumentUpload } from './DocumentUpload';
import { createApplication, listApplications, cancelApplication, getActivePeriod, type ApplicationSummaryDto } from '../../lib/api/document-upload';

const DRAFT_STORAGE_KEY = 'utms_application_draft';
import { ApplicationTimeline } from './ApplicationTimeline';
import { FinalResult } from './FinalResult';
import { AppealForm } from './AppealForm';

interface StudentDashboardProps {
  user: User;
  onLogout: () => void;
  onSwitchRole?: () => void;
}

type StudentView =
  | 'dashboard'
  | 'new-application'
  | 'upload-documents'
  | 'view-timeline'
  | 'view-result'
  | 'submit-appeal';

type Section = 'dashboard';

export function StudentDashboard({ user, onLogout, onSwitchRole }: StudentDashboardProps) {
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [currentView, setCurrentView] = useState<StudentView>('dashboard');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [applications, setApplications] = useState<ApplicationSummaryDto[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [draftData, setDraftData] = useState<Partial<ApplicationFormValues> | undefined>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : undefined;
    } catch {
      return undefined;
    }
  });
  const [draftApplicationId, setDraftApplicationId] = useState<string | null>(() => {
    return localStorage.getItem(DRAFT_STORAGE_KEY + '_id');
  });

  useEffect(() => {
    listApplications(user.id)
      .then(setApplications)
      .catch(() => setApplications([]))
      .finally(() => setAppsLoading(false));
  }, [user.id]);

  const handleFormSave = async (data: ApplicationFormValues) => {
    // Draft: save to DB + localStorage
    if (data.isDraft) {
      setIsSubmittingApplication(true);
      try {
        // If a draft already exists in DB, delete it first
        if (draftApplicationId) {
          await cancelApplication(draftApplicationId, user.id).catch(() => {});
        }
        const { applicationId } = await createApplication(user.id, {
          studentTckn: data.tckn ?? user.tckn,
          studentFullName: `${data.name ?? ''} ${data.surname ?? ''}`.trim() || user.name,
          targetDepartmentId: data.targetProgram || 'DRAFT',
          targetFacultyId: 'faculty-engineering',
          transferType: data.transferType || 'DRAFT',
          targetSemester: Number(data.targetSemester) || 0,
          submittedGpa: Number(data.gpa) || 0,
          submittedYksScore: data.osymScore ? Number(data.osymScore) : undefined,
          yksExamYear: data.osymYear ? Number(data.osymYear) : undefined,
          currentInstitution: data.institution,
          currentDepartment: data.department,
          isDraft: true,
        });
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem(DRAFT_STORAGE_KEY + '_id', applicationId);
        setDraftData(data);
        setDraftApplicationId(applicationId);
        setCurrentView('dashboard');
        // Refresh application list
        listApplications(user.id).then(setApplications).catch(() => {});
      } catch (e) {
        setApplicationError(e instanceof Error ? e.message : 'Taslak kaydedilemedi.');
      } finally {
        setIsSubmittingApplication(false);
      }
      return;
    }

    // Final submission: clear draft from DB + localStorage, create real application
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.removeItem(DRAFT_STORAGE_KEY + '_id');
    setDraftData(undefined);
    setApplicationError(null);
    setIsSubmittingApplication(true);
    try {
      // Cancel existing draft in DB if any
      if (draftApplicationId) {
        await cancelApplication(draftApplicationId, user.id).catch(() => {});
        setDraftApplicationId(null);
      }
      const { applicationId } = await createApplication(user.id, {
        studentTckn: data.tckn ?? user.tckn,
        studentFullName: `${data.name ?? ''} ${data.surname ?? ''}`.trim() || user.name,
        targetDepartmentId: data.targetProgram ?? 'unknown',
        targetFacultyId: 'faculty-engineering',
        transferType: data.transferType ?? 'HORIZONTAL',
        targetSemester: Number(data.targetSemester ?? 3),
        submittedGpa: Number(data.gpa ?? 0),
        submittedYksScore: data.osymScore ? Number(data.osymScore) : undefined,
        yksExamYear: data.osymYear ? Number(data.osymYear) : undefined,
        currentInstitution: data.institution,
        currentDepartment: data.department,
      });
      setActiveApplicationId(applicationId);
      setCurrentView('upload-documents');
    } catch (e) {
      setApplicationError(e instanceof Error ? e.message : 'Başvuru oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  const handleCancelApplication = async (applicationId: string) => {
    if (!window.confirm('Bu başvuruyu iptal etmek istediğinizden emin misiniz?')) return;
    try {
      await cancelApplication(applicationId, user.id);
      setApplications(prev => prev.filter(a => a.applicationId !== applicationId));
      toast.success('Başvuru iptal edildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Başvuru iptal edilemedi');
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return { label: 'Taslak', className: 'bg-gray-100 text-gray-700' };
      case 'PENDING_DOCUMENT_UPLOAD':
        return { label: 'Belge Bekleniyor', className: 'bg-blue-100 text-blue-800' };
      case 'RETURNED_FOR_CORRECTION':
        return { label: 'Düzeltme İstendi', className: 'bg-orange-100 text-orange-800' };
      case 'PENDING_OIDB_VERIFICATION':
        return { label: 'OIDB İncelemesinde', className: 'bg-yellow-100 text-yellow-800' };
      case 'INTAKE_VERIFIED':
      case 'PENDING_YGK_FORWARDING':
      case 'IN_REVIEW_YDYO':
      case 'IN_REVIEW_YGK':
        return { label: 'İncelemede', className: 'bg-yellow-100 text-yellow-800' };
      case 'RANKED_ASIL':
        return { label: 'Asil Listesi', className: 'bg-green-100 text-green-800' };
      case 'RANKED_YEDEK':
        return { label: 'Yedek Listesi', className: 'bg-teal-100 text-teal-800' };
      case 'RANKED_RED':
      case 'REJECTED_AT_INTAKE':
        return { label: 'Reddedildi', className: 'bg-red-100 text-red-800' };
      case 'RESULTS_PUBLISHED':
        return { label: 'Sonuçlandı', className: 'bg-green-100 text-green-800' };
      default:
        return { label: status, className: 'bg-gray-100 text-gray-800' };
    }
  };

  const renderDashboardContent = () => {
    if (currentView === 'new-application') {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setCurrentView('dashboard')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          {applicationError && (
            <div className="flex items-center gap-2 p-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {applicationError}
            </div>
          )}
          <ApplicationForm
            onSave={handleFormSave}
            onCancel={() => setCurrentView('dashboard')}
            draftData={draftData}
            userTckn={user.tckn}
          />
        </div>
      );
    }

    if (currentView === 'upload-documents') {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setCurrentView('new-application')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <DocumentUpload
            applicationId={activeApplicationId ?? ''}
            userId={user.id}
            onComplete={() => setCurrentView('dashboard')}
            onBack={() => setCurrentView('new-application')}
          />
        </div>
      );
    }

    if (currentView === 'view-timeline' && selectedAppId) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => { setCurrentView('dashboard'); setSelectedAppId(null); }} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <ApplicationTimeline
            applicationId={selectedAppId}
            userId={user.id}
            onBack={() => {
              setCurrentView('dashboard');
              setSelectedAppId(null);
            }}
          />
        </div>
      );
    }

    if (currentView === 'view-result' && selectedAppId) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => { setCurrentView('dashboard'); setSelectedAppId(null); }} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <FinalResult
            applicationId={selectedAppId}
            onAppeal={() => setCurrentView('submit-appeal')}
            onBack={() => {
              setCurrentView('dashboard');
              setSelectedAppId(null);
            }}
          />
        </div>
      );
    }

    if (currentView === 'submit-appeal' && selectedAppId) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setCurrentView('view-result')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Dön
          </Button>
          <AppealForm
            applicationId={selectedAppId}
            onSubmit={() => setCurrentView('dashboard')}
            onCancel={() => setCurrentView('view-result')}
          />
        </div>
      );
    }

    // Default Dashboard/Applications view
    return (
      <div className="space-y-6">
        {/* Period / general error banner */}
        {applicationError && currentView === 'dashboard' && (
          <div className="flex items-center gap-2 p-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {applicationError}
          </div>
        )}

        {/* Draft resume banner */}
        {draftData && (
          <div className="flex items-center justify-between p-4 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Kaydedilmiş bir taslak başvurunuz var
                {draftData.targetProgram ? ` (${draftData.targetProgram})` : ''}.
                Kaldığınız yerden devam edebilirsiniz.
              </span>
            </div>
            <div className="flex gap-2 ml-4 shrink-0">
              <Button size="sm" variant="outline" onClick={async () => {
                if (draftApplicationId) {
                  await cancelApplication(draftApplicationId, user.id).catch(() => {});
                  setDraftApplicationId(null);
                }
                localStorage.removeItem(DRAFT_STORAGE_KEY);
                localStorage.removeItem(DRAFT_STORAGE_KEY + '_id');
                setDraftData(undefined);
                listApplications(user.id).then(setApplications).catch(() => {});
              }}>
                Sil
              </Button>
              <Button size="sm" style={{ backgroundColor: '#C00000' }} onClick={() => setCurrentView('new-application')}>
                Devam Et
              </Button>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-900 mb-2">Hoş Geldiniz, {user.name}!</h1>
            <p className="text-gray-600">Transfer başvurularınızı buradan yönetebilirsiniz.</p>
          </div>
          <Button
            style={{ backgroundColor: '#C00000' }}
            onClick={async () => {
              const period = await getActivePeriod();
              if (!period || !period.isActive) {
                setApplicationError('Şu anda aktif bir başvuru dönemi bulunmamaktadır. Lütfen daha sonra tekrar deneyiniz.');
                return;
              }
              setApplicationError(null);
              setCurrentView('new-application');
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Başvuru Oluştur
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Toplam Başvuru</div>
                <div className="text-2xl text-gray-900">{appsLoading ? '…' : applications.length}</div>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#C00000' }}>
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">İncelemede</div>
                <div className="text-2xl text-gray-900">
                  {appsLoading ? '…' : applications.filter(a => a.currentStatus !== 'PENDING_DOCUMENT_UPLOAD' && !a.currentStatus.startsWith('RANKED') && !a.currentStatus.startsWith('REJECTED')).length}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Belge Bekleniyor</div>
                <div className="text-2xl text-gray-900">
                  {appsLoading ? '…' : applications.filter(a => a.currentStatus === 'PENDING_DOCUMENT_UPLOAD' || a.currentStatus === 'RETURNED_FOR_CORRECTION').length}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Reddedilen</div>
                <div className="text-2xl text-gray-900">
                  {appsLoading ? '…' : applications.filter(a => a.currentStatus.startsWith('REJECTED') || a.currentStatus === 'RANKED_RED').length}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Applications Table */}
        <Card className="p-6">
          <h2 className="text-gray-900 mb-4">Tüm Başvurularım</h2>
          {appsLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Yükleniyor...
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              Henüz başvurunuz bulunmamaktadır. Yeni bir başvuru oluşturun.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Başvuru ID</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Hedef Program</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Durum</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Yüklenen Belge</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">Son Güncelleme</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-700">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const statusConfig = getStatusConfig(app.currentStatus);
                    const canContinueUpload = app.currentStatus === 'PENDING_DOCUMENT_UPLOAD' || app.currentStatus === 'RETURNED_FOR_CORRECTION';
                    const isDraft = app.currentStatus === 'DRAFT';
                    return (
                      <tr key={app.applicationId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-xs text-gray-500 font-mono">{app.applicationId.slice(0, 8)}…</td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-900">{app.targetDepartmentId}</div>
                          <div className="text-xs text-gray-500">{app.targetFacultyId}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{app.uploadedDocumentCount} belge</td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(app.lastModifiedAt).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            {isDraft && (
                              <Button
                                size="sm"
                                style={{ backgroundColor: '#C00000' }}
                                onClick={() => {
                                  // If localStorage draft belongs to a different app, clear its form data
                                  const savedId = localStorage.getItem(DRAFT_STORAGE_KEY + '_id');
                                  if (savedId !== app.applicationId) {
                                    localStorage.removeItem(DRAFT_STORAGE_KEY);
                                    setDraftData(undefined);
                                  }
                                  // Register this app as the active draft so re-saving cancels it first
                                  setDraftApplicationId(app.applicationId);
                                  localStorage.setItem(DRAFT_STORAGE_KEY + '_id', app.applicationId);
                                  setCurrentView('new-application');
                                }}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Devam Et
                              </Button>
                            )}
                            {canContinueUpload && (
                              <Button
                                size="sm"
                                style={{ backgroundColor: '#C00000' }}
                                onClick={() => {
                                  setActiveApplicationId(app.applicationId);
                                  setCurrentView('upload-documents');
                                }}
                              >
                                <Upload className="w-3 h-3 mr-1" />
                                Belge Yükle
                              </Button>
                            )}
                            {!isDraft && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedAppId(app.applicationId);
                                  setCurrentView('view-timeline');
                                }}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Takip Et
                              </Button>
                            )}
                            {(isDraft || canContinueUpload) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleCancelApplication(app.applicationId)}
                              >
                                İptal Et
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
      currentRole="Student"
      onLogout={onLogout}
      onSwitchRole={onSwitchRole}
      currentSection={currentSection}
      onNavigate={(section) => {
        setCurrentSection(section as Section);
        setCurrentView('dashboard');
        setSelectedAppId(null);
      }}
    >
      {renderDashboardContent()}
    </AppShell>
  );
}
