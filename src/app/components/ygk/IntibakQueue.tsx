import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Award, RefreshCw, ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  getCandidates,
  DEPARTMENTS,
  DEFAULT_PERIOD,
  type IntibakCandidate,
  type CandidatesDto,
} from '../../lib/api/intibak';

interface IntibakQueueProps {
  onOpenApplication: (applicationId: string, studentName: string, readOnly: boolean) => void;
  onOpenPackage: (departmentId: string, periodId: string) => void;
}

const CATEGORY_BADGE: Record<string, string> = {
  ASIL: 'bg-green-100 text-green-700 border-green-200',
  YEDEK: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  RED: 'bg-red-100 text-red-700 border-red-200',
};

export function IntibakQueue({ onOpenApplication, onOpenPackage }: IntibakQueueProps) {
  const [departmentId, setDepartmentId] = useState(DEPARTMENTS[0].id);
  const [data, setData] = useState<CandidatesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (dept: string) => {
    setLoading(true);
    setError('');
    try {
      setData(await getCandidates(dept, DEFAULT_PERIOD));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liste alınamadı.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(departmentId);
  }, [departmentId]);

  const asil = data?.candidates.filter((c) => c.rankingCategory === 'ASIL') ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-1 font-bold">İntibak Kuyruğu — Asil Adaylar</h1>
          <p className="text-gray-600 text-sm">Bir Asil öğrenci seçip ders muafiyeti (intibak) hazırlayın.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-72 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => load(departmentId)}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {data && (
        <Card className="p-4 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-700">
            Asil: <span className="font-bold">{data.asilTotal}</span> • İntibakı tamamlanan:{' '}
            <span className="font-bold text-green-600">{data.asilCompleted}</span>
            {data.ready && <span className="ml-2 text-green-700 font-medium">• Paket gönderime hazır</span>}
          </div>
          <Button
            size="sm"
            style={{ backgroundColor: '#C00000' }}
            disabled={data.asilTotal === 0}
            onClick={() => onOpenPackage(departmentId, DEFAULT_PERIOD)}
          >
            Paket / Dekanlığa Gönder
          </Button>
        </Card>
      )}

      {loading && <div className="text-sm text-gray-500 p-6">Yükleniyor…</div>}
      {error && <div className="text-sm text-red-600 p-6 bg-red-50 rounded-lg border border-red-100">{error}</div>}

      {!loading && !error && (
        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-12 bg-gray-100 border-b text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <div className="col-span-4 p-3">Öğrenci</div>
            <div className="col-span-2 p-3">Kategori</div>
            <div className="col-span-3 p-3">İntibak Durumu</div>
            <div className="col-span-3 p-3 text-right">İşlem</div>
          </div>
          <div className="divide-y">
            {asil.length === 0 && (
              <div className="p-6 text-sm text-gray-500">Bu bölüm/dönem için Asil aday bulunamadı.</div>
            )}
            {asil.map((c: IntibakCandidate) => (
              <div key={c.applicationId} className="grid grid-cols-12 items-center hover:bg-gray-50">
                <div className="col-span-4 p-3">
                  <div className="text-sm font-bold text-gray-900">{c.studentFullName}</div>
                  <div className="text-xs text-gray-500 font-mono">{c.studentTckn}</div>
                </div>
                <div className="col-span-2 p-3">
                  <Badge className={`text-[10px] h-5 ${CATEGORY_BADGE[c.rankingCategory ?? ''] ?? ''}`}>
                    {c.rankingCategory}
                  </Badge>
                </div>
                <div className="col-span-3 p-3">
                  {c.intibakCompleted ? (
                    <span className="inline-flex items-center text-xs text-green-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> İntibak Tamamlandı
                    </span>
                  ) : c.intibakStarted ? (
                    <span className="text-xs text-orange-600 font-medium">Devam ediyor</span>
                  ) : (
                    <span className="text-xs text-gray-500">Başlanmadı</span>
                  )}
                </div>
                <div className="col-span-3 p-3 text-right">
                  <Button
                    size="sm"
                    variant={c.intibakCompleted ? 'outline' : 'default'}
                    style={c.intibakCompleted ? undefined : { backgroundColor: '#C00000' }}
                    onClick={() => onOpenApplication(c.applicationId, c.studentFullName, c.intibakCompleted)}
                  >
                    <Award className="w-4 h-4 mr-1" />
                    {c.intibakCompleted ? 'Görüntüle' : 'İntibak Hazırla'}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
