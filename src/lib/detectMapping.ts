import ExcelJS from 'exceljs';
import type { OutputMapping } from '../domain/types';

/** ヘッダーキーワード → フィールド名のマッピング */
const HEADER_PATTERNS: Record<string, RegExp> = {
  name: /氏名|名前|従業者名|職員名/,
  position: /職種|資格|職名|役職/,
  weeklyHours: /週.*時間|勤務時間|所定.*時間|労働時間/,
  fte: /常勤換算|換算|FTE/i,
  employmentType: /常勤.*非常勤|勤務形態|雇用形態|常勤区分/,
  qualification: /資格|免許/,
  dedicatedOrConcurrent: /専従.*兼務|専任.*兼任|専従|兼務/,
};

/** テンプレExcelからセル位置を自動検出してOutputMappingを生成 */
export async function detectOutputMapping(buffer: ArrayBuffer): Promise<{
  mapping: OutputMapping;
  confidence: number;
  detectedHeaders: Record<string, { column: string; row: number; value: string }>;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const ws = workbook.worksheets[0];
  if (!ws) throw new Error('ワークシートが見つかりません');

  const detectedHeaders: Record<string, { column: string; row: number; value: string }> = {};
  let headerRow = 0;

  // 最初の20行からヘッダーを探す
  for (let rowNum = 1; rowNum <= Math.min(20, ws.rowCount); rowNum++) {
    const row = ws.getRow(rowNum);
    let matchCount = 0;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const value = String(cell.value ?? '').trim();
      if (!value) return;

      const colLetter = columnNumberToLetter(colNumber);

      for (const [field, pattern] of Object.entries(HEADER_PATTERNS)) {
        if (pattern.test(value) && !detectedHeaders[field]) {
          detectedHeaders[field] = { column: colLetter, row: rowNum, value };
          matchCount++;
        }
      }
    });

    // 2つ以上マッチした行をヘッダー行とみなす
    if (matchCount >= 2 && headerRow === 0) {
      headerRow = rowNum;
    }
  }

  const columns: Record<string, string> = {};
  for (const [field, info] of Object.entries(detectedHeaders)) {
    columns[field] = info.column;
  }

  // 必須フィールドの検出率で信頼度を計算
  const requiredFields = ['name', 'position', 'fte'];
  const foundRequired = requiredFields.filter((f) => columns[f]).length;
  const confidence = foundRequired / requiredFields.length;

  const mapping: OutputMapping = {
    name: ws.name || 'Sheet1',
    sheet: ws.name || 'Sheet1',
    staffStartRow: headerRow + 1,
    columns,
  };

  return { mapping, confidence, detectedHeaders };
}

function columnNumberToLetter(col: number): string {
  let letter = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}
