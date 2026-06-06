import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Search,
  Eye,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface QueueApplication {
  applicationId: string;
  studentFullName: string;
  studentTckn: string;
  targetDepartmentId: string;
  targetSemester: number;
  submittedGpa: number;
  submittedYksScore: number | null;
  currentStatus: string;
  submittedAt: string;
  ydyoExempt: boolean;
  preScreening: any;
}

interface YGKQueueProps {
  onOpenApplication: (applicationId: string) => void;
}

export function YGKQueue({ onOpenApplication }: YGKQueueProps) {
  const [applications, setApplications] = useState<QueueApplication[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<QueueApplication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue();
  }, []);

  useEffect(() => {
    filterApplications();
  }, [applications, searchQuery, statusFilter]);

  const getAuthHeaders = () => ({
    'x-mock-user': localStorage.getItem('currentUser')
      ? JSON.parse(localStorage.getItem('currentUser')!).id
      : 'user-ygk-member',
  });

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ranking/queue', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch queue');
      const data = await response.json();
      setApplications(data.applications || []);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterApplications = () => {
    let filtered = applications;

    if (searchQuery) {
      filtered = filtered.filter(app =>
        app.studentFullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.applicationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.studentTckn.includes(searchQuery)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.currentStatus === statusFilter);
    }

    setFilteredApplications(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'INTAKE_VERIFIED':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Beklemede</Badge>;
      case 'IN_REVIEW_YGK':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">İncelemede</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDepartmentName = (departmentId: string) => {
    const departments: Record<string, string> = {
      'dept-ce': 'Bilgisayar Mühendisliği',
      'dept-computer-engineering': 'Bilgisayar Mühendisliği',
      'dept-ee': 'Elektrik Mühendisliği',
      'dept-electrical-engineering': 'Elektrik Mühendisliği',
      'dept-me': 'Makina Mühendisliği',
      'dept-civil': 'İnşaat Mühendisliği',
      'dept-arch': 'Mimarlık',
      'dept-architecture': 'Mimarlık',
    };
    return departments[departmentId] || departmentId;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">Yükleniyor...</div>
      </Card>
    );
  }

  const pendingCount = applications.filter(a => a.currentStatus === 'INTAKE_VERIFIED').length;
  const inReviewCount = applications.filter(a => a.currentStatus === 'IN_REVIEW_YGK').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-gray-900 mb-2">YGK İnceleme Kuyruğu</h2>
        <p className="text-gray-600">Transfer başvurularını inceleyin ve akademik uygunluk değerlendirmesi yapın</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">Toplam Başvuru</div>
              <div className="text-2xl text-gray-900">{applications.length}</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">İnceleme Bekleyen</div>
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
              <div className="text-sm text-gray-600 mb-1">İncelemede</div>
              <div className="text-2xl text-gray-900">{inReviewCount}</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Öğrenci adı, TC veya başvuru ID ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Tümü ({applications.length})
            </Button>
            <Button
              variant={statusFilter === 'INTAKE_VERIFIED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('INTAKE_VERIFIED')}
            >
              Beklemede ({pendingCount})
            </Button>
            <Button
              variant={statusFilter === 'IN_REVIEW_YGK' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('IN_REVIEW_YGK')}
            >
              İncelemede ({inReviewCount})
            </Button>
          </div>
        </div>
      </Card>

      {/* Applications Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Başvuru ID</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Öğrenci</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Bölüm</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Dönem</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">GPA</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">YKS</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Filtreye uygun başvuru bulunamadı'
                      : 'Kuyrukta başvuru bulunmuyor'}
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.applicationId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {app.applicationId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{app.studentFullName}</div>
                      <div className="text-xs text-gray-500">{app.studentTckn}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getDepartmentName(app.targetDepartmentId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {app.targetSemester}. Dönem
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {app.submittedGpa.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {app.submittedYksScore || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(app.currentStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button
                        size="sm"
                        onClick={() => onOpenApplication(app.applicationId)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        İncele
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
