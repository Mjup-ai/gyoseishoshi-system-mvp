import { useEffect, useMemo, useState } from 'react';
import type { Staff, RuleResult, InputMapping, OutputMapping } from './domain/types';
import { loadSampleInputMapping, loadSampleOutputMapping } from './lib/loadMapping';
import { apiFetch } from './lib/api';
import { readWorkbookFile } from './parser/readWorkbookFile';
import { parseWorkbookToCommonModel } from './parser/parseWorkbookToCommonModel';
import { applyRuleEngine } from './rules/applyRuleEngine';
import { ReviewTable } from './review/ReviewTable';
import { exportToWorkbook, exportWithTemplate, downloadWorkbook } from './exporter/exportToWorkbook';

interface MunicipalityItem { id: string; name: string; prefecture?: string; templateFile?: string; outputMapping?: string; }
interface FacilityItem { id: string; name: string; facilityType?: string; inputMapping?: string; }

type Step = 1 | 2 | 3;

function App() {
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<Record<string, { weeklyHours: number; fte: number }> | null>(null);
  const [exported, setExported] = useState(false);

  // 自治体・施設
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [selectedMuniId, setSelectedMuniId] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [newMuniName, setNewMuniName] = useState('');
  const [newMuniPref, setNewMuniPref] = useState('');
  const [newFacName, setNewFacName] = useState('');
  const [newFacType, setNewFacType] = useState('');

  useEffect(() => {
    apiFetch('/api/municipalities').then(r => r.json()).then(d => setMunicipalities(d.items ?? [])).catch(() => {});
    apiFetch('/api/facilities').then(r => r.json()).then(d => setFacilities(d.items ?? [])).catch(() => {});
  }, []);

  const addMunicipality = async () => {
    if (!newMuniName.trim()) return;
    const r = await apiFetch('/api/municipalities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newMuniName.trim(), prefecture: newMuniPref.trim() || null }),
    });
    const item = await r.json();
    setMunicipalities(prev => [...prev, item]);
    setSelectedMuniId(item.id);
    setNewMuniName(''); setNewMuniPref('');
  };

  const addFacility = async () => {
    if (!newFacName.trim()) return;
    const r = await apiFetch('/api/facilities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFacName.trim(), facilityType: newFacType.trim() || null }),
    });
    const item = await r.json();
    setFacilities(prev => [...prev, item]);
    setSelectedFacilityId(item.id);
    setNewFacName(''); setNewFacType('');
  };

  const selectedMuni = municipalities.find(m => m.id === selectedMuniId);
  const selectedFacility = facilities.find(f => f.id === selectedFacilityId);

  // マッピング: DB登録があればそれを使う、なければサンプル
  const inputMapping: InputMapping = useMemo(() => {
    if (selectedFacility?.inputMapping) {
      try { return JSON.parse(selectedFacility.inputMapping); } catch { /* fall through */ }
    }
    return loadSampleInputMapping();
  }, [selectedFacility]);

  const outputMapping: OutputMapping = useMemo(() => {
    if (selectedMuni?.outputMapping) {
      try { return JSON.parse(selectedMuni.outputMapping); } catch { /* fall through */ }
    }
    return loadSampleOutputMapping();
  }, [selectedMuni]);

  const parsed = useMemo(() => (rows ? parseWorkbookToCommonModel(rows, inputMapping) : null), [rows, inputMapping]);
  const ruleResult: RuleResult | null = useMemo(() => (parsed ? applyRuleEngine(parsed) : null), [parsed]);
  const staffList = useMemo<Staff[]>(() => parsed?.staff ?? [], [parsed]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const r = await readWorkbookFile(file, inputMapping.sheet);
      setRows(r);
      setFileName(file.name);
      setConfirmed(null);
      setExported(false);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : '読込エラー');
    }
  };

  const handleConfirm = (data: Record<string, { weeklyHours: number; fte: number }>) => {
    setConfirmed(data);
    setStep(3);
  };

  const handleExport = async () => {
    if (!confirmed) return;
    let buf: ArrayBuffer;
    const muniName = selectedMuni?.name || '出力';

    // テンプレがある自治体ならテンプレ注入
    if (selectedMuniId && selectedMuni?.templateFile) {
      try {
        const res = await apiFetch(`/api/municipalities/${selectedMuniId}/template/download`);
        if (res.ok) {
          const templateBuffer = await res.arrayBuffer();
          buf = await exportWithTemplate({ templateBuffer, mapping: outputMapping, staff: staffList, confirmed });
        } else {
          buf = await exportToWorkbook({ mapping: outputMapping, staff: staffList, confirmed });
        }
      } catch {
        buf = await exportToWorkbook({ mapping: outputMapping, staff: staffList, confirmed });
      }
    } else {
      buf = await exportToWorkbook({ mapping: outputMapping, staff: staffList, confirmed });
    }

    downloadWorkbook(buf, `勤務体制一覧_${muniName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExported(true);
  };

  const handleReset = () => {
    setRows(null);
    setFileName('');
    setConfirmed(null);
    setExported(false);
    setError('');
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">勤務体制変換ツール</h1>
            <p className="text-xs text-slate-500 mt-0.5">福祉事業所向け — MVP</p>
          </div>
          {rows && (
            <button onClick={handleReset} className="text-sm text-slate-500 hover:text-slate-700 underline">
              最初からやり直す
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* ステップインジケーター */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { n: 1, label: 'アップロード' },
            { n: 2, label: '確認・修正' },
            { n: 3, label: 'Excel出力' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-0.5 ${step >= s.n ? 'bg-blue-500' : 'bg-slate-200'}`} />}
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > s.n ? 'bg-blue-500 text-white' :
                  step === s.n ? 'bg-blue-600 text-white' :
                  'bg-slate-200 text-slate-500'
                }`}>{step > s.n ? '✓' : s.n}</div>
                <span className={`text-sm font-medium ${step >= s.n ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: 選択 + アップロード */}
        {step === 1 && (
          <div className="space-y-6">
            {/* 自治体選択 */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-4">自治体を選択</h2>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <select
                    value={selectedMuniId}
                    onChange={(e) => setSelectedMuniId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">-- 自治体を選択 --</option>
                    {municipalities.map(m => (
                      <option key={m.id} value={m.id}>{m.prefecture ? `${m.prefecture} ${m.name}` : m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <details className="mt-3">
                <summary className="text-xs text-blue-600 cursor-pointer">新しい自治体を追加</summary>
                <div className="mt-2 flex gap-2">
                  <input placeholder="都道府県" value={newMuniPref} onChange={e => setNewMuniPref(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm w-24" />
                  <input placeholder="自治体名" value={newMuniName} onChange={e => setNewMuniName(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm flex-1" />
                  <button onClick={addMunicipality} className="rounded bg-blue-600 px-3 py-1 text-sm text-white font-medium">追加</button>
                </div>
              </details>
            </div>

            {/* 施設選択 */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-4">施設を選択</h2>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <select
                    value={selectedFacilityId}
                    onChange={(e) => setSelectedFacilityId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">-- 施設を選択 --</option>
                    {facilities.map(f => (
                      <option key={f.id} value={f.id}>{f.name}{f.facilityType ? ` (${f.facilityType})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <details className="mt-3">
                <summary className="text-xs text-blue-600 cursor-pointer">新しい施設を追加</summary>
                <div className="mt-2 flex gap-2">
                  <input placeholder="施設名" value={newFacName} onChange={e => setNewFacName(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm flex-1" />
                  <input placeholder="事業種別" value={newFacType} onChange={e => setNewFacType(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm w-32" />
                  <button onClick={addFacility} className="rounded bg-blue-600 px-3 py-1 text-sm text-white font-medium">追加</button>
                </div>
              </details>
            </div>

            {/* ファイルアップロード */}
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-2">シフト表をアップロード</h2>
            <p className="text-sm text-slate-500 mb-6">事業所のExcelシフト表（.xlsx）をアップロードしてください。</p>
            <label className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
              <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />
              </svg>
              <span className="text-sm font-medium text-slate-600">クリックしてExcelを選択</span>
              <span className="text-xs text-slate-400">.xlsx形式のみ対応</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
            {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
          </div>
          </div>
        )}

        {/* Step 2: 確認・修正 */}
        {step === 2 && ruleResult && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">解析結果</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{fileName} — {ruleResult.staffResults.length}名検出</p>
                </div>
                <button onClick={() => setStep(1)} className="text-sm text-blue-600 hover:underline">← ファイル変更</button>
              </div>

              {/* サマリー */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="text-xl font-bold text-slate-800">{ruleResult.facilityTotals.fullTimeEquivalent}</div>
                  <div className="text-xs text-slate-500">常勤換算合計</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="text-xl font-bold text-slate-800">{ruleResult.facilityTotals.totalDayHours}h</div>
                  <div className="text-xs text-slate-500">日勤時間</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="text-xl font-bold text-slate-800">{ruleResult.facilityTotals.totalNightHours}h</div>
                  <div className="text-xs text-slate-500">夜勤時間</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="text-xl font-bold text-slate-800">{ruleResult.facilityTotals.totalHolidayCount}</div>
                  <div className="text-xs text-slate-500">休日数</div>
                </div>
              </div>

              {/* 警告 */}
              {ruleResult.warnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6">
                  <div className="text-sm font-semibold text-amber-800 mb-1">⚠ 警告</div>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {ruleResult.warnings.map((w, i) => <li key={i}>・{w}</li>)}
                  </ul>
                </div>
              )}

              {/* レビューテーブル */}
              <ReviewTable staffResults={ruleResult.staffResults} onConfirm={handleConfirm} />
            </div>
          </div>
        )}

        {/* Step 3: Excel出力 */}
        {step === 3 && confirmed && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Excel出力</h2>
            <p className="text-sm text-slate-500 mb-6">確定データをExcelファイルとしてダウンロードします。</p>

            <div className="inline-flex flex-col items-center gap-4">
              <button
                onClick={handleExport}
                disabled={exported}
                className="rounded-lg bg-blue-600 px-8 py-3 text-base font-bold text-white shadow hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-default"
              >
                {exported ? '✓ ダウンロード完了' : 'Excelをダウンロード'}
              </button>

              {exported && (
                <p className="text-sm text-emerald-600 font-medium">ファイルがダウンロードされました。</p>
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(2)} className="text-sm text-blue-600 hover:underline">← 確認に戻る</button>
                <button onClick={handleReset} className="text-sm text-slate-500 hover:underline">最初からやり直す</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-xs text-slate-400">
        Mjup株式会社 — 行政書士システム MVP — 機密
      </footer>
    </div>
  );
}

export default App;
