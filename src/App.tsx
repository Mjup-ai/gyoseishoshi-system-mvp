import { useMemo, useState } from 'react'

import './App.css'

import type { Staff } from './domain/types'
import { exportToWorkbook, downloadWorkbook } from './exporter/exportToWorkbook'
import { loadSampleInputMapping } from './lib/loadInputMapping'
import { loadSampleOutputMapping } from './lib/loadOutputMapping'
import { sampleWorkbookRows } from './parser/sampleWorkbook'
import { parseWorkbookToCommonModel } from './parser/parseWorkbookToCommonModel'
import { readWorkbookFile } from './parser/readWorkbookFile'
import { ReviewTable } from './review/ReviewTable'
import { applyRuleEngine } from './rules/applyRuleEngine'

const inputMapping = loadSampleInputMapping()
const outputMapping = loadSampleOutputMapping()

function App() {
  const [rows, setRows] = useState<string[][]>(sampleWorkbookRows)
  const [uploadStatus, setUploadStatus] = useState('サンプルデータを表示中')
  const [confirmed, setConfirmed] = useState<Record<string, { weeklyHours: number; fte: number }> | null>(null)
  const [exportStatus, setExportStatus] = useState('未出力')

  const parsed = useMemo(() => parseWorkbookToCommonModel(rows, inputMapping), [rows])
  const ruleResult = useMemo(() => applyRuleEngine(parsed), [parsed])
  const exportableStaff = useMemo<Staff[]>(() => parsed.staff, [parsed])

  const handleFileChange = async (file?: File) => {
    if (!file) return
    const nextRows = await readWorkbookFile(file, inputMapping.sheet)
    setRows(nextRows)
    setConfirmed(null)
    setUploadStatus(`${file.name} を読込済み`)
  }

  const handleExport = async () => {
    if (!confirmed) return
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
          <p className="eyebrow">行政書士システム MVP</p>
          <h1>実Excelアップロード対応を追加</h1>
          <p className="lede">
            ブラウザからExcelファイルを選んで読み込み、rows配列へ変換して既存 parser に渡せるようにした。
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
            <h2>output_mapping</h2>
            <span>自治体様式のセル位置定義</span>
          </div>
          <pre>{JSON.stringify(outputMapping, null, 2)}</pre>
        </div>

        <div>
          <div className="panel-header">
            <h2>rule_engine result</h2>
            <span>出力前の確認用</span>
          </div>
          <pre>{JSON.stringify(ruleResult, null, 2)}</pre>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>2. review_step</h2>
          <span>確定データができたらExcel出力できる</span>
        </div>
        <ReviewTable model={parsed} onConfirm={setConfirmed} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>3. exporter</h2>
          <span>{exportStatus}</span>
        </div>
        <button className="confirm-button" disabled={!confirmed} onClick={handleExport}>
          Excelをダウンロード
        </button>
      </section>
    </main>
  )
}

export default App
