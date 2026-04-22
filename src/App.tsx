import { useEffect, useMemo, useState } from 'react';
import type { Staff, RuleResult, InputMapping, OutputMapping } from './domain/types';
import { loadSampleInputMapping, loadSampleOutputMapping } from './lib/loadMapping';
import { apiFetch } from './lib/api';
import { readWorkbookFile } from './parser/readWorkbookFile';
import { parseWorkbookToCommonModel } from './parser/parseWorkbookToCommonModel';
import { applyRuleEngine } from './rules/applyRuleEngine';
import { calculateOfficialFte, DEFAULT_FTE_CONFIG } from './domain/fteRules';
import type { FacilityFteResult } from './domain/fteRules';
import { ReviewTable } from './review/ReviewTable';
import { exportToWorkbook, downloadWorkbook } from './exporter/exportToWorkbook';
import { getSupportedServices, getServiceStandard, checkStaffingStandard } from './domain/staffingStandards';
import type { StaffingCheckResult } from './domain/staffingStandards';

interface MunicipalityItem { id: string; name: string; prefecture?: string; templateFile?: string; outputMapping?: string; mappingType?: string; }
interface FacilityItem { id: string; name: string; facilityType?: string; inputMapping?: string; }

type Step = 1 | 2 | 3;

function App() {
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<Record<string, { weeklyHours: number; fte: number }> | null>(null);
  const [exported, setExported] = useState(false);
  const [exportMeta, setExportMeta] = useState<{ sheetUsed?: string; autoFilled?: string[]; manualRequired?: string[] } | null>(null);
  const [selectedService, setSelectedService] = useState('');
  const [userCount, setUserCount] = useState(10);

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
  const officialFte: FacilityFteResult | null = useMemo(() => (parsed ? calculateOfficialFte(parsed, DEFAULT_FTE_CONFIG) : null), [parsed]);

  const complianceCheck: StaffingCheckResult | null = useMemo(() => {
    if (!officialFte || !selectedService) return null;
    const standard = getServiceStandard(selectedService);
    if (!standard || !standard.supported) return null;
    const staffByPosition: Record<string, { count: number; fte: number }> = {};
    officialFte.staffDetails.forEach(d => {
      const pos = d.position || '（未設定）';
      if (!staffByPosition[pos]) staffByPosition[pos] = { count: 0, fte: 0 };
      staffByPosition[pos].count++;
      staffByPosition[pos].fte = Math.floor((staffByPosition[pos].fte + d.fte) * 100) / 100;
    });
    return checkStaffingStandard(standard, staffByPosition, userCount);
  }, [officialFte, selectedService, userCount]);
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
    if (!confirmed || !parsed) return;
    let buf: ArrayBuffer;
    const muniName = selectedMuni?.name || '出力';

    // テンプレがある自治体ならサーバー側でテンプレ注入（スタイル保持）
    if (selectedMuniId && selectedMuni?.templateFile) {
      try {
        const res = await apiFetch(`/api/municipalities/${selectedMuniId}/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff: staffList,
            schedule: parsed.schedule,
            confirmed,
            facilityName: selectedFacility?.name,
            serviceCode: selectedService || undefined,
            standardWeeklyHours: 40,
          }),
        });
        if (res.ok) {
          buf = await res.arrayBuffer();
          setExportMeta({
            sheetUsed: decodeURIComponent(res.headers.get('X-Sheet-Used') || ''),
            autoFilled: decodeURIComponent(res.headers.get('X-Auto-Filled') || '').split(',').filter(Boolean),
            manualRequired: decodeURIComponent(res.headers.get('X-Manual-Required') || '').split(',').filter(Boolean),
          });
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
                    {(() => {
                      const grouped: Record<string, MunicipalityItem[]> = {};
                      municipalities.forEach(m => {
                        const key = m.prefecture || 'その他';
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(m);
                      });
                      return Object.entries(grouped).map(([pref, items]) => (
                        <optgroup key={pref} label={pref}>
                          {items.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name}{m.mappingType === 'MHLW_STANDARD' && m.name !== '厚労省' ? '' : ''}{!m.mappingType ? ' (未対応)' : ''}
                            </option>
                          ))}
                        </optgroup>
                      ));
                    })()}
                  </select>
                  {selectedMuni && selectedMuni.outputMapping?.includes('FALLBACK') && (
                    <p className="text-[10px] text-amber-600 mt-1">⚠ この自治体は厚労省標準様式での出力です。自治体独自様式とは異なる場合があります。</p>
                  )}
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

              {/* 公式FTE計算結果 */}
              {officialFte && (
                <>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                      <div className="text-2xl font-bold text-blue-800">{officialFte.totalFte}</div>
                      <div className="text-xs text-blue-600 font-medium">常勤換算合計</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-xl font-bold text-slate-800">{officialFte.staffDetails.filter(d => !d.excluded).length}</div>
                      <div className="text-xs text-slate-500">算入対象者</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-xl font-bold text-slate-800">{officialFte.standardWeeklyHours}h</div>
                      <div className="text-xs text-slate-500">常勤基準（週）</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-xl font-bold text-slate-800">{officialFte.standardMonthlyHours}h</div>
                      <div className="text-xs text-slate-500">常勤基準（月）</div>
                    </div>
                  </div>

                  {/* 職種別集計 */}
                  <div className="rounded-lg bg-slate-50 p-3 mb-4">
                    <div className="text-xs font-semibold text-slate-600 mb-2">職種別常勤換算</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(officialFte.positionTotals).map(([pos, data]) => (
                        <span key={pos} className="text-xs bg-white rounded px-2 py-1 border border-slate-200">
                          {pos}: {data.fte}（{data.count}名）
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 計算根拠 */}
                  <details className="mb-4">
                    <summary className="text-xs text-blue-600 cursor-pointer font-medium">計算根拠を表示</summary>
                    <pre className="mt-2 text-xs text-slate-600 bg-slate-50 rounded p-3 whitespace-pre-wrap">{officialFte.basis}</pre>
                  </details>
                </>
              )}

              {/* 警告 */}
              {officialFte && officialFte.warnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6">
                  <div className="text-sm font-semibold text-amber-800 mb-1">⚠ 警告</div>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {officialFte.warnings.map((w, i) => <li key={i}>・{w}</li>)}
                  </ul>
                </div>
              )}

              {/* 配置基準チェック */}
              <div className="rounded-lg border border-slate-200 p-4 mb-6">
                <h3 className="text-sm font-bold text-slate-700 mb-3">人員配置基準チェック</h3>
                <div className="flex gap-3 items-end mb-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">サービス種別</label>
                    <select
                      value={selectedService}
                      onChange={e => setSelectedService(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm mt-1"
                    >
                      <option value="">-- 選択してください --</option>
                      {getSupportedServices().map(s => (
                        <option key={s.serviceCode} value={s.serviceCode}>{s.serviceName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-40">
                    <label className="text-xs text-slate-500">利用者数</label>
                    <input
                      type="number"
                      value={userCount}
                      onChange={e => setUserCount(Number(e.target.value) || 0)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm mt-1"
                      min={1}
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">※前月末の利用者数または直近の平均利用者数（自治体の指示に従ってください）</p>
                  </div>
                </div>

                {complianceCheck && (
                  <div className={`rounded-lg p-4 ${
                    complianceCheck.overallLevel === 'compliant' ? 'bg-green-50 border border-green-200' :
                    complianceCheck.overallLevel === 'review' ? 'bg-yellow-50 border border-yellow-200' :
                    complianceCheck.overallLevel === 'non_compliant' ? 'bg-red-50 border border-red-200' :
                    'bg-slate-50 border border-slate-200'
                  }`}>
                    <div className="text-sm font-bold mb-2">
                      {complianceCheck.overallLevel === 'compliant' && '🟢 適合: 人員配置基準を充足しています'}
                      {complianceCheck.overallLevel === 'review' && '🟡 要確認: 基準は満たしていますが、余裕が小さいため確認を推奨します'}
                      {complianceCheck.overallLevel === 'non_compliant' && '🔴 不適合: 基準未達の項目があります'}
                    </div>
                    <div className="space-y-1">
                      {complianceCheck.checks.map((c, i) => (
                        <div key={i} className="text-xs flex items-center gap-2">
                          <span>{c.level === 'compliant' ? '🟢' : c.level === 'review' ? '🟡' : c.level === 'non_compliant' ? '🔴' : '⚪'}</span>
                          <span className={c.level === 'non_compliant' ? 'text-red-700 font-medium' : 'text-slate-700'}>{c.message}</span>
                        </div>
                      ))}
                    </div>
                    {complianceCheck.unsupportedPositions.length > 0 && (
                      <div className="mt-2 text-xs text-slate-500">
                        ⚪ 検証対象外の職種: {complianceCheck.unsupportedPositions.join(', ')}
                      </div>
                    )}
                    <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-400">
                      <div>基準: 令和6年度報酬改定ベース</div>
                      <div>注意: 自治体独自運用・加算要件・個別解釈がある場合は最終確認してください</div>
                    </div>
                  </div>
                )}
              </div>

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
                <>
                  <p className="text-sm text-emerald-600 font-medium">ファイルがダウンロードされました。</p>
                  {exportMeta && (
                    <div className="mt-4 text-left w-full max-w-md">
                      {exportMeta.sheetUsed && (
                        <div className="text-xs text-slate-600 mb-2">
                          使用シート: <span className="font-medium">{exportMeta.sheetUsed}</span>
                        </div>
                      )}
                      {exportMeta.autoFilled && exportMeta.autoFilled.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs font-semibold text-green-700 mb-1">🟢 自動入力済み</div>
                          <div className="flex flex-wrap gap-1">
                            {exportMeta.autoFilled.map((item, i) => (
                              <span key={i} className="text-[10px] bg-green-50 text-green-700 rounded px-1.5 py-0.5 border border-green-200">{item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {exportMeta.manualRequired && exportMeta.manualRequired.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-amber-700 mb-1">🟡 手入力が必要</div>
                          <div className="flex flex-wrap gap-1">
                            {exportMeta.manualRequired.map((item, i) => (
                              <span key={i} className="text-[10px] bg-amber-50 text-amber-700 rounded px-1.5 py-0.5 border border-amber-200">{item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
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
        <div className="max-w-2xl mx-auto mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-left">
          <div className="text-xs font-bold text-amber-800 mb-1">⚠ β版（ベータ版）のご利用にあたって</div>
          <ul className="text-[10px] text-amber-700 space-y-0.5">
            <li>・この機能はβ版です。動作や出力に不具合がある場合があります</li>
            <li>・最終提出前に必ず出力内容をご確認ください</li>
            <li>・自治体独自様式・運用差分がある場合があります</li>
            <li>・一部の自治体では厚労省標準様式での出力となる場合があります</li>
          </ul>
        </div>
        Mjup株式会社 — 行政書士システム β版 — 機密
      </footer>
    </div>
  );
}

export default App;
