import ExcelJS from 'exceljs';
import type { Staff } from '../domain/types';
import type { OutputMapping } from '../domain/types';

/** 白紙Excelに出力（テンプレなしの場合） */
export async function exportToWorkbook(params: {
  mapping: OutputMapping;
  staff: Staff[];
  confirmed: Record<string, { weeklyHours: number; fte: number }>;
}): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(params.mapping.sheet);

  const cols = params.mapping.columns;
  ws.getCell(`${cols.name}1`).value = '氏名';
  ws.getCell(`${cols.position}1`).value = '職種';
  ws.getCell(`${cols.weeklyHours}1`).value = '週労働時間';
  ws.getCell(`${cols.fte}1`).value = '常勤換算';

  ['name', 'position', 'weeklyHours', 'fte'].forEach((key) => {
    const cell = ws.getCell(`${cols[key]}1`);
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });

  params.staff.forEach((staff, index) => {
    const row = params.mapping.staffStartRow + index;
    ws.getCell(`${cols.name}${row}`).value = staff.name;
    ws.getCell(`${cols.position}${row}`).value = staff.position ?? '';
    ws.getCell(`${cols.weeklyHours}${row}`).value = params.confirmed[staff.id]?.weeklyHours ?? '';
    ws.getCell(`${cols.fte}${row}`).value = params.confirmed[staff.id]?.fte ?? '';
  });

  ws.getColumn(cols.name).width = 20;
  ws.getColumn(cols.position).width = 15;
  ws.getColumn(cols.weeklyHours).width = 12;
  ws.getColumn(cols.fte).width = 10;

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** テンプレExcelにデータを注入して出力 */
export async function exportWithTemplate(params: {
  templateBuffer: ArrayBuffer;
  mapping: OutputMapping;
  staff: Staff[];
  confirmed: Record<string, { weeklyHours: number; fte: number }>;
}): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(params.templateBuffer);

  // テンプレのシートを取得（名前一致 or 最初のシート）
  let ws = workbook.getWorksheet(params.mapping.sheet);
  if (!ws) ws = workbook.worksheets[0];
  if (!ws) throw new Error('テンプレートにワークシートが見つかりません');

  const cols = params.mapping.columns;

  // データを注入（既存のセルスタイルを保持したまま値だけ上書き）
  params.staff.forEach((staff, index) => {
    const row = params.mapping.staffStartRow + index;
    if (cols.name) ws!.getCell(`${cols.name}${row}`).value = staff.name;
    if (cols.position) ws!.getCell(`${cols.position}${row}`).value = staff.position ?? '';
    if (cols.weeklyHours) ws!.getCell(`${cols.weeklyHours}${row}`).value = params.confirmed[staff.id]?.weeklyHours ?? '';
    if (cols.fte) ws!.getCell(`${cols.fte}${row}`).value = params.confirmed[staff.id]?.fte ?? '';
  });

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export function downloadWorkbook(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
