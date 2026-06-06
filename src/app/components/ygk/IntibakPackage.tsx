import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { ArrowLeft, Send, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCandidates,
  sendPackage,
  IntibakApiError,
  type CandidatesDto,
} from '../../lib/api/intibak';

interface IntibakPackageProps {
  departmentId: string;
  periodId: string;
  onBack: () => void;
}

const CATEGORY_BADGE: Record<string, string> = {
  ASIL: 'bg-green-100 text-green-700 border-green-200',
  YEDEK: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  RED: 'bg-red-100 text-red-700 border-red-200',
};

export function IntibakPackage({ departmentId, periodId, onBack }: IntibakPackageProps) {
  const [data, setData] = useState<CandidatesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSign, setShowSign] = useState(false);
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await getCandidates(departmentId, periodId)); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Liste alınamadı.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [departmentId, periodId]);

  const pendingNames = (data?.candidates ?? [])
    .filter((c) => c.rankingCategory === 'ASIL' && !c.intibakCompleted)
    .map((c) => c.studentFullName);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendPackage({ signaturePassword: password, departmentId, periodId });
      toast.success(res.message ?? 'Paket Dekanlığa iletildi.');
      setSent(true);
      setShowSign(false);
      await load();
    } catch (e) {
      if (e instanceof IntibakApiError) toast.error(`${e.code ? e.code + ': ' : ''}${e.message}`);
      else toast.error('Paket gönderilemedi.');
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-1 font-bold">Değerlendirme Paketi — Dekanlığa Gönder</h1>
          <p className="text-gray-600 text-sm">{departmentId} • {periodId}</p>
        </div>
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Geri</Button>
      </div>

      {loading && <div className="p-6 text-sm text-gray-500">Yükleniyor…</div>}

      {data && (
        <>
          {sent ? (
            <Card className="p-4 bg-green-50 border-green-200 flex items-center space-x-2 text-sm text-green-800">
              <CheckCircle2 className="w-5 h-5" /> <span>Paket Dekanlığa iletildi. (Başvuru durumları "Dekanlık İncelemesi Bekliyor" oldu.)</span>
            </Card>
          ) : data.ready ? (
            <Card className="p-4 bg-green-50 border-green-200 flex items-center justify-between">
              <span className="inline-flex items-center text-sm text-green-800"><CheckCircle2 className="w-5 h-5 mr-2" />Gönderime hazır — tüm Asil adayların intibakı tamamlandı.</span>
              <Button size="sm" style={{ backgroundColor: '#C00000' }} onClick={() => setShowSign(true)}><Send className="w-4 h-4 mr-2" />Paketi Gönder</Button>
            </Card>
          ) : (
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="inline-flex items-center text-sm text-red-800 mb-1"><AlertCircle className="w-5 h-5 mr-2" />{pendingNames.length} başvurunun intibakı bekliyor — paket gönderilemez.</div>
              <div className="text-xs text-red-700">Bekleyenler: {pendingNames.join(', ') || '—'}</div>
              <Button size="sm" variant="outline" className="mt-2" disabled>Paketi Gönder (kilitli)</Button>
            </Card>
          )}

          {showSign && !sent && (
            <Card className="p-4 border-gray-200 space-y-3 max-w-md">
              <div className="inline-flex items-center text-sm font-bold text-gray-900"><ShieldCheck className="w-4 h-4 mr-2" />Dijital İmza</div>
              <Input type="password" placeholder="İmza şifresi" value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 text-xs" />
              <div className="flex gap-2">
                <Button size="sm" style={{ backgroundColor: '#C00000' }} onClick={handleSend} disabled={sending || !password}>{sending ? 'Gönderiliyor…' : 'İmzala ve Gönder'}</Button>
                <Button size="sm" variant="outline" onClick={() => setShowSign(false)}>Vazgeç</Button>
              </div>
              <p className="text-[10px] text-gray-400">İpucu (demo): imza şifresi <code>ygk-chair-signature</code>. Yalnızca YGK Başkanı gönderebilir.</p>
            </Card>
          )}

          <Card className="p-0 overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-100 border-b text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <div className="col-span-5 p-3">Öğrenci</div>
              <div className="col-span-3 p-3">Kategori</div>
              <div className="col-span-4 p-3">İntibak</div>
            </div>
            <div className="divide-y">
              {data.candidates.map((c) => (
                <div key={c.applicationId} className="grid grid-cols-12 items-center">
                  <div className="col-span-5 p-3"><span className="text-sm font-bold text-gray-900">{c.studentFullName}</span><span className="text-xs text-gray-500 font-mono ml-2">{c.studentTckn}</span></div>
                  <div className="col-span-3 p-3"><Badge className={`text-[10px] h-5 ${CATEGORY_BADGE[c.rankingCategory ?? ''] ?? ''}`}>{c.rankingCategory}</Badge></div>
                  <div className="col-span-4 p-3 text-xs">
                    {c.rankingCategory !== 'ASIL' ? <span className="text-gray-400">—</span>
                      : c.intibakCompleted ? <span className="text-green-700 font-medium inline-flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" />Tamamlandı</span>
                      : <span className="text-red-600 font-medium">Bekliyor</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
