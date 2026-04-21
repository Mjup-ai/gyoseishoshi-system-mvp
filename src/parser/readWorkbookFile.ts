import * as XLSX from 'xlsx';

/** ブラウザでExcelファイルを読み込み、rows配列に変換 */
export async function readWorkbookFile(file: File, sheetName?: string): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const name = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0];

  if (!name) {
    throw new Error(`ワークシートが見つかりません（シート数: ${workbook.SheetNames.length}）`);
  }

  const sheet = workbook.Sheets[name];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  return rows;
}
