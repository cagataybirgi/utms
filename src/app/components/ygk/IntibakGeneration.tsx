import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Info, Plus, Sparkles, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  prepare,
  updateMappings,
  save as apiSave,
  addManualCourse,
  regenerateSuggestions,
  IntibakApiError,
  type IntibakDto,
  type MappingEntry,
  type MappingMutation,
  type MappingStatus,
} from '../../lib/api/intibak';

interface IntibakGenerationProps {
  applicationId: string;
  studentName: string;
  readOnly?: boolean;
  onBack: () => void;
  onSaved?: () => void;
}

const NOT_EXEMPT_VALUE = '__not_exempt__';

const SOURCE_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  SUGGESTED_MATCH: { label: 'Önerilen Eşleşme', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  APPROVED: { label: 'Onaylandı', cls: 'bg-green-100 text-green-700 border-green-200' },
  MANUAL_OVERRIDE: { label: 'Manuel Eşleşme', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  NOT_EXEMPT: { label: 'Muaf Değil', cls: 'bg-red-100 text-red-700 border-red-200' },
  PENDING_REVIEW: { label: 'Karar bekliyor', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function IntibakGeneration({ applicationId, studentName, readOnly = false, onBack, onSaved }: IntibakGenerationProps) {
  const [dto, setDto] = useState<IntibakDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<{ code?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErrorTargets, setSaveErrorTargets] = useState<string[]>([]);
  const [suggestedMap, setSuggestedMap] = useState<Record<string, string>>({});
  const [manual, setManual] = useState({ code: '', name: '', grade: 'AA', ects: 6 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setBlocked(null);
      try {
        const d = await prepare(applicationId);
        setDto(d);
        // Capture the engine's original suggestions so we can label later edits
        // as APPROVED (kept) vs MANUAL_OVERRIDE (changed).
        const map: Record<string, string> = {};
        d.mappings.forEach((m) => {
          if (m.status === 'SUGGESTED_MATCH' && m.targetCourseCode) {
            map[m.sourceCourseCodes.join(',')] = m.targetCourseCode;
          }
        });
        setSuggestedMap(map);
      } catch (e) {
        if (e instanceof IntibakApiError) setBlocked({ code: e.code, message: e.message });
        else setBlocked({ message: 'İntibak hazırlanamadı.' });
      } finally {
        setLoading(false);
      }
    })();
  }, [applicationId]);

  const sourceRows = (dto?.mappings ?? []).filter((m) => m.sourceCourseCodes.length > 0);
  const coveredTargets = new Set(
    (dto?.mappings ?? [])
      .filter((m) => ['SUGGESTED_MATCH', 'APPROVED', 'MANUAL_OVERRIDE', 'NO_PREVIOUS_EQUIVALENT'].includes(m.status) && m.targetCourseCode)
      .map((m) => m.targetCourseCode as string),
  );
  const uncoveredTargets = (dto?.targetCurriculum ?? []).filter((t) => !coveredTargets.has(t.code));
  const pendingSources = sourceRows.filter((m) => m.status === 'PENDING_REVIEW');
  const courseName = (code: string) => dto?.previousCourses.find((c) => c.code === code)?.name ?? code;

  const applyMutations = async (mutations: MappingMutation[]) => {
    if (readOnly) return;
    setBusy(true);
    try {
      const d = await updateMappings(applicationId, mutations);
      setDto(d);
      setSaveErrorTargets([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const onSelectTarget = (row: MappingEntry, value: string) => {
    if (value === NOT_EXEMPT_VALUE) {
      applyMutations([{ entryId: row.entryId, sourceCourseCodes: row.sourceCourseCodes, targetCourseCode: null, status: 'NOT_EXEMPT' }]);
      return;
    }
    const suggested = suggestedMap[row.sourceCourseCodes.join(',')];
    const status: MappingStatus = value === suggested ? 'APPROVED' : 'MANUAL_OVERRIDE';
    applyMutations([{ entryId: row.entryId, sourceCourseCodes: row.sourceCourseCodes, targetCourseCode: value, status }]);
  };

  const approveAllSuggestions = () => {
    const muts: MappingMutation[] = sourceRows
      .filter((m) => m.status === 'SUGGESTED_MATCH' && m.targetCourseCode)
      .map((m) => ({ entryId: m.entryId, sourceCourseCodes: m.sourceCourseCodes, targetCourseCode: m.targetCourseCode, status: 'APPROVED' as MappingStatus }));
    if (muts.length === 0) { toast.info('Onaylanacak öneri yok.'); return; }
    applyMutations(muts);
  };

  const markTargetNoEquivalent = (code: string) =>
    applyMutations([{ sourceCourseCodes: [], targetCourseCode: code, status: 'NO_PREVIOUS_EQUIVALENT' }]);

  const markAllUncovered = () => {
    if (uncoveredTargets.length === 0) return;
    applyMutations(uncoveredTargets.map((t) => ({ sourceCourseCodes: [], targetCourseCode: t.code, status: 'NO_PREVIOUS_EQUIVALENT' as MappingStatus })));
  };

  const handleAddManual = async () => {
    if (!manual.code || !manual.name) { toast.error('Ders kodu ve adı zorunlu.'); return; }
    setBusy(true);
    try {
      setDto(await addManualCourse(applicationId, { code: manual.code, name: manual.name, letterGrade: manual.grade, ects: Number(manual.ects) }));
      setManual({ code: '', name: '', grade: 'AA', ects: 6 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ders eklenemedi.');
    } finally { setBusy(false); }
  };

  const handleRegenerate = async () => {
    setBusy(true);
    try { setDto(await regenerateSuggestions(applicationId)); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Öneri üretilemedi.'); }
    finally { setBusy(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErrorTargets([]);
    try {
      const res = await apiSave(applicationId);
      toast.success(res.message ?? 'İntibak tablosu kaydedildi.');
      onSaved?.();
      onBack();
    } catch (e) {
      if (e instanceof IntibakApiError && e.details?.incompleteTargets) {
        setSaveErrorTargets(e.details.incompleteTargets);
        toast.error(e.message);
      } else {
        toast.error(e instanceof Error ? e.message : 'Kaydedilemedi.');
      }
    } finally { setSaving(false); }
  };

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) {
    return <div className="p-10 text-sm text-gray-500">İntibak hazırlanıyor…</div>;
  }

  if (blocked) {
    return (
      <Card className="p-8 max-w-xl mx-auto text-center space-y-4 border-red-200">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">İntibak Başlatılamadı</h2>
        {blocked.code && <Badge variant="outline" className="text-[10px]">{blocked.code}</Badge>}
        <p className="text-sm text-gray-600">{blocked.message}</p>
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Kuyruğa Dön</Button>
      </Card>
    );
  }

  if (!dto) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-1 font-bold">Ders Muafiyeti (İntibak) Oluşturma</h1>
          <p className="text-gray-600 text-sm">{applicationId} • {studentName}</p>
        </div>
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Kuyruğa Dön</Button>
      </div>

      {readOnly && (
        <div className="bg-green-50 border border-green-100 p-3 rounded-lg flex items-center space-x-2 text-sm text-green-800">
          <Lock className="w-4 h-4" /> <span>Bu intibak tablosu kaydedilmiş ve kilitli (salt görünüm).</span>
        </div>
      )}

      {dto.manualEntryRequired && (
        <Card className="p-4 border-yellow-200 bg-yellow-50 space-y-3">
          <div className="flex items-start space-x-2 text-sm text-yellow-800">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <span>Transkript otomatik okunamadı. Lütfen önceki dersleri manuel girin, ardından "Önerileri Oluştur"a basın.</span>
          </div>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-2"><label className="text-[10px] font-bold uppercase text-gray-500">Kod</label><Input value={manual.code} onChange={(e) => setManual({ ...manual, code: e.target.value })} placeholder="CMPE101" className="h-9 text-xs" /></div>
            <div className="col-span-5"><label className="text-[10px] font-bold uppercase text-gray-500">Ders Adı</label><Input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="Introduction to Programming" className="h-9 text-xs" /></div>
            <div className="col-span-2"><label className="text-[10px] font-bold uppercase text-gray-500">Not</label><Input value={manual.grade} onChange={(e) => setManual({ ...manual, grade: e.target.value })} className="h-9 text-xs" /></div>
            <div className="col-span-1"><label className="text-[10px] font-bold uppercase text-gray-500">AKTS</label><Input type="number" value={manual.ects} onChange={(e) => setManual({ ...manual, ects: Number(e.target.value) })} className="h-9 text-xs" /></div>
            <div className="col-span-2 flex gap-1">
              <Button size="sm" variant="outline" onClick={handleAddManual} disabled={busy}><Plus className="w-4 h-4 mr-1" />Ekle</Button>
              <Button size="sm" onClick={handleRegenerate} disabled={busy} style={{ backgroundColor: '#C00000' }}><Sparkles className="w-4 h-4 mr-1" />Öneri</Button>
            </div>
          </div>
        </Card>
      )}

      {dto.noSuggestionsFound && !dto.manualEntryRequired && (
        <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg flex items-start space-x-2 text-xs text-yellow-800">
          <AlertCircle className="w-5 h-5 mt-0.5" /><span>Otomatik eşleşme bulunamadı. Lütfen her dersi manuel eşleştirin veya "Muaf Değil" işaretleyin.</span>
        </div>
      )}

      {!dto.manualEntryRequired && !dto.noSuggestionsFound && (
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start space-x-2 text-xs text-blue-800">
          <Info className="w-5 h-5 mt-0.5" /><span><strong>Akıllı Eşleştirici Aktif:</strong> Öneriler kod/isim/AKTS benzerliğine göre üretildi. Kaydetmeden önce inceleyin.</span>
        </div>
      )}

      {/* Source → target mapping */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-2 bg-gray-100 border-b text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <div className="p-3 border-r">Önceki Kurum (Eski Dersler)</div>
          <div className="p-3">Hedef Müfredat (Yeni Karşılıklar)</div>
        </div>
        <div className="divide-y">
          {sourceRows.length === 0 && <div className="p-6 text-sm text-gray-500">Önceki ders bulunamadı.</div>}
          {sourceRows.map((row) => {
            const badge = SOURCE_STATUS_BADGE[row.status];
            const selectValue = row.status === 'NOT_EXEMPT' ? NOT_EXEMPT_VALUE : row.targetCourseCode ?? undefined;
            return (
              <div key={row.entryId} className="grid grid-cols-2 group">
                <div className="p-4 border-r bg-white">
                  {row.sourceCourseCodes.map((code) => (
                    <div key={code} className="mb-1">
                      <span className="text-sm font-bold text-gray-900">{code}</span>
                      <span className="text-xs text-gray-600 ml-2">{courseName(code)}</span>
                    </div>
                  ))}
                  {row.similarityScore !== undefined && (
                    <div className="text-[10px] text-gray-400 mt-1">Benzerlik skoru: {row.similarityScore.toFixed(2)}</div>
                  )}
                </div>
                <div className="p-4 bg-white space-y-2">
                  <Select value={selectValue} onValueChange={(v) => onSelectTarget(row, v)} disabled={readOnly || busy}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Eşdeğer ders seçiniz…" /></SelectTrigger>
                    <SelectContent>
                      {dto.targetCurriculum.map((t) => (
                        <SelectItem key={t.code} value={t.code} className="text-xs">{t.code} — {t.name} ({t.ects} AKTS)</SelectItem>
                      ))}
                      <SelectItem value={NOT_EXEMPT_VALUE} className="text-xs">Muaf Değil / Eşdeğeri Yok</SelectItem>
                    </SelectContent>
                  </Select>
                  {badge && <Badge className={`text-[10px] h-5 ${badge.cls}`}>{badge.label}</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Target coverage */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-gray-900">Hedef Müfredat Kapsamı</div>
          {!readOnly && uncoveredTargets.length > 0 && (
            <Button size="sm" variant="outline" onClick={markAllUncovered} disabled={busy}>Kalanları "Eşdeğeri Yok" işaretle</Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {dto.targetCurriculum.map((t) => {
            const covered = coveredTargets.has(t.code);
            const errored = saveErrorTargets.includes(t.code);
            return (
              <div key={t.code} className={`flex items-center justify-between p-2 rounded border text-xs ${errored ? 'border-red-300 bg-red-50' : covered ? 'border-green-100 bg-green-50' : 'border-gray-200 bg-white'}`}>
                <span className="font-medium text-gray-800">{t.code} — {t.name}</span>
                {covered ? (
                  <span className="inline-flex items-center text-green-700"><CheckCircle2 className="w-4 h-4 mr-1" />Karar verildi</span>
                ) : (
                  <Button size="sm" variant="ghost" className="h-6 text-[11px] text-[#C00000]" disabled={readOnly || busy} onClick={() => markTargetNoEquivalent(t.code)}>Eşdeğeri Yok</Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">
          {pendingSources.length > 0 && <span className="text-red-600 mr-3">• {pendingSources.length} kaynak ders kararsız</span>}
          {uncoveredTargets.length > 0 && <span className="text-red-600">• {uncoveredTargets.length} hedef ders kararsız</span>}
          {pendingSources.length === 0 && uncoveredTargets.length === 0 && <span className="text-green-600">• Tüm kararlar tamam — kaydedilebilir</span>}
        </div>
        <div className="flex gap-3">
          {!readOnly && <Button variant="outline" size="sm" onClick={approveAllSuggestions} disabled={busy}>Tüm Önerileri Onayla</Button>}
          {!readOnly && (
            <Button size="sm" style={{ backgroundColor: '#C00000' }} onClick={handleSave} disabled={saving || busy}>
              {saving ? 'Kaydediliyor…' : <><Save className="w-4 h-4 mr-2" />İntibak Tablosunu Kaydet</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
