import { useEffect, useMemo, useState } from 'react';
import type { CommonModel, InputMapping } from './domain/types';
import { loadInputMapping } from './lib/loadInputMapping';
import { parseWorkbookToCommonModel } from './parser/parseWorkbookToCommonModel';
import { readWorkbookFile } from './parser/readWorkbookFile';

const inputMappingUrl = new URL('./mappings/input/sample.yaml', import.meta.url).toString();

function App() {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<InputMapping | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [result, setResult] = useState<CommonModel | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initMapping = async () => {
      try {
        const loaded = await loadInputMapping(inputMappingUrl);
        setMapping(loaded);
        setSheetName(loaded.sheet);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'InputMappingの読み込みに失敗しました');
      }
    };

    void initMapping();
  }, []);

  const handleParse = async () => {
    if (!inputFile || !mapping) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const rows = await readWorkbookFile(inputFile, sheetName || mapping.sheet);
      const parsed = parseWorkbookToCommonModel(rows, mapping);
      setResult(parsed);
    } catch (error) {
      setResult(null);
      setErrorMessage(error instanceof Error ? error.message : 'Excelファイルの読込に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const isParseDisabled = useMemo(() => {
    return !inputFile || !mapping || isLoading;
  }, [inputFile, mapping, isLoading]);

  return (
    <main>
      <h1>勤務体制変換ツール</h1>
      <ol>
        <li>
          <h2>Step 1</h2>
          <p>入力ファイルとマッピングを選択</p>
          <div>
            <label htmlFor="xlsx-file">Excel(.xlsx)ファイル</label>
            <input
              id="xlsx-file"
              type="file"
              accept=".xlsx"
              onChange={(event) => setInputFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label htmlFor="sheet-name">シート名</label>
            <input
              id="sheet-name"
              value={sheetName}
              onChange={(event) => setSheetName(event.target.value)}
              placeholder="例: シフト表"
            />
          </div>
          <button type="button" onClick={() => void handleParse()} disabled={isParseDisabled}>
            {isLoading ? '読込中...' : '読込して変換'}
          </button>
          {errorMessage ? <p>{errorMessage}</p> : null}
          {result ? (
            <div>
              <p>スタッフ件数: {result.staff.length}</p>
              <p>シフト件数: {result.schedule.length}</p>
              <p>警告件数: {result.warnings.length}</p>
            </div>
          ) : null}
        </li>
        <li>
          <h2>Step 2</h2>
          <p>ルール評価と警告を確認</p>
        </li>
        <li>
          <h2>Step 3</h2>
          <p>変換結果を出力</p>
        </li>
      </ol>
    </main>
  );
}

export default App;
