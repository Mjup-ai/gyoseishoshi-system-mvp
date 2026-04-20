import { useMemo, useState } from 'react'

import './App.css'

import type { Staff } from './domain/types'
import { exportToWorkbook, downloadWorkbook } from './exporter/exportToWorkbook'
import { loadInputMapping } from './lib/loadInputMapping'
import { loadOutputMapping } from './lib/loadOutputMapping'
import { parseWorkbookToCommonModel } from './parser/parseWorkbookToCommonModel'
import { readWorkbookFile } from './parser/readWorkbookFile'
import { ReviewTable } from './review/ReviewTable'
import { applyRuleEngine } from './rules/applyRuleEngine'

const inputMapping = loadInputMapping()
const outputMapping = loadOutputMapping()

function App() {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [uploadStatus, setUploadStatus] = useState('Excelファイルをアップロードしてください（必須）')
  const [confirmed, setConfirmed] = useState<Record<string, { weeklyHours: number; fte: number }> | null>(null)
  const [exportStatus, setExportStatus] = useState('未出力')

  const parsed = useMemo(() => (rows ? parseWorkbookToCommonModel(rows, inputMapping) : null), [rows])
  const ruleResult = useMemo(() => (parsed ? applyRuleEngine(parsed) : null), [parsed])
  const exportableStaff = useMemo<Staff[]>(() => parsed?.staff ?? [], [parsed])

  const handleFileChange = async (file?: File) => {
    if (!file) return
    try {
      const nextRows = await readWorkbookFile(file, inputMapping.sheet)
      setRows(nextRows)
      setConfirmed(null)
      setExportStatus('未出力')
      setUploadStatus(`${file.name} を読込済み`)
    } catch (error) {
      setRows(null)
      setConfirmed(null)
      setUploadStatus(`読込失敗: ${error instanceof Error ? error.message : '不明なエラー'}`)
    }
  }

  const handleExport = async () => {
    if (!confirmed || !parsed) return
    const buffer = await exportToWorkbook({
      mapping: outputMapping,
      staff: exportableStaff,
      confirmed,
    })
    downloadWorkbook(buffer as ArrayBuffer, 'gh-kinmu-sample.xlsx')
    setExportStatus('Excel出力済み')
  }

  return (
    <main className="app-shell">
      <header className="hero compact">
        <div>
          <h1>行政書士システム MVP</h1>
          <p className="lede">
            まずExcelファイルをアップロードすると、勤務情報を自動解析し、確認画面で数値調整後に出力できます。
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>1. Excelアップロード</h2>
          <span>{uploadStatus}</span>
        </div>
        <label className="upload-box">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => handleFileChange(event.target.files?.[0])}
          />
          <span>Excelファイルを選択</span>
        </label>
      </section>

      <section className="panel two-column">
        <div>
          <div className="panel-header">
            <h2>出力マッピング</h2>
            <span>提出様式への転記先</span>
          </div>
          <pre>{JSON.stringify(outputMapping, null, 2)}</pre>
        </div>

        <div>
          <div className="panel-header">
            <h2>解析結果</h2>
            <span>アップロード後に表示</span>
          </div>
          <pre>{JSON.stringify(ruleResult ?? { message: 'Excelをアップロードすると結果を表示します' }, null, 2)}</pre>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>2. 内容確認</h2>
          <span>アップロード後に編集・確定</span>
        </div>
        {parsed ? (
          <ReviewTable model={parsed} onConfirm={setConfirmed} />
        ) : (
          <p className="empty-state">Excelファイルをアップロードすると、確認テーブルが表示されます。</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>3. Excel出力</h2>
          <span>{exportStatus}</span>
        </div>
        <button className="confirm-button" disabled={!parsed || !confirmed} onClick={handleExport}>
          Excelをダウンロード
        </button>
      </section>
    </main>
  )
}

export default App
