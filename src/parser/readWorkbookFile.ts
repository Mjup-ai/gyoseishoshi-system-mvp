import ExcelJS from 'exceljs';

/** ブラウザでExcelファイルを読み込み、rows配列に変換 */
export async function readWorkbookFile(file: File, sheetName?: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const worksheet = sheetName
    ? workbook.getWorksheet(sheetName) ?? workbook.worksheets[0]
    : workbook.worksheets[0];

  if (!worksheet) throw new Error('ワークシートが見つかりません');

  return worksheet.getSheetValues().slice(1).map((row) => {
    if (Array.isArray(row)) {
      return row.slice(1).map((cell) => (cell == null ? '' : String(cell)));
    }
    return [];
  });
}
