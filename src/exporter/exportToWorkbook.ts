import ExcelJS from 'exceljs';
import type { Staff } from '../domain/types';
import type { OutputMapping } from '../domain/types';

/** 確定データをExcelワークブックに出力（将来テンプレ注入に差し替え可能） */
export async function exportToWorkbook(params: {
  mapping: OutputMapping;
  staff: Staff[];
  confirmed: Record<string, { weeklyHours: number; fte: number }>;
}): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(params.mapping.sheet);

  // ヘッダー行
  const cols = params.mapping.columns;
  ws.getCell(`${cols.name}1`).value = '氏名';
  ws.getCell(`${cols.position}1`).value = '職種';
  ws.getCell(`${cols.weeklyHours}1`).value = '週労働時間';
  ws.getCell(`${cols.fte}1`).value = '常勤換算';

  // ヘッダースタイル
  ['name', 'position', 'weeklyHours', 'fte'].forEach((key) => {
    const cell = ws.getCell(`${cols[key]}1`);
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });

  // データ行
  params.staff.forEach((staff, index) => {
    const row = params.mapping.staffStartRow + index;
    ws.getCell(`${cols.name}${row}`).value = staff.name;
    ws.getCell(`${cols.position}${row}`).value = staff.position ?? '';
    ws.getCell(`${cols.weeklyHours}${row}`).value = params.confirmed[staff.id]?.weeklyHours ?? '';
    ws.getCell(`${cols.fte}${row}`).value = params.confirmed[staff.id]?.fte ?? '';
  });

  // 列幅調整
  ws.getColumn(cols.name).width = 20;
  ws.getColumn(cols.position).width = 15;
  ws.getColumn(cols.weeklyHours).width = 12;
  ws.getColumn(cols.fte).width = 10;

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
