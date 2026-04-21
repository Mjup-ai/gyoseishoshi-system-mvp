import * as XLSX from 'xlsx';
import type { Staff } from '../domain/types';
import type { OutputMapping } from '../domain/types';

function colLetterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

/** 白紙Excelに出力（テンプレなしの場合） */
export async function exportToWorkbook(params: {
  mapping: OutputMapping;
  staff: Staff[];
  confirmed: Record<string, { weeklyHours: number; fte: number }>;
}): Promise<ArrayBuffer> {
  const wb = XLSX.utils.book_new();
  const cols = params.mapping.columns;

  const data: (string | number)[][] = [];

  // ヘッダー
  const header: (string | number)[] = [];
  header[colLetterToIndex(cols.name)] = '氏名';
  header[colLetterToIndex(cols.position)] = '職種';
  header[colLetterToIndex(cols.weeklyHours)] = '週労働時間';
  header[colLetterToIndex(cols.fte)] = '常勤換算';
  data.push(header);

  // 空行（staffStartRowまで）
  for (let i = 1; i < params.mapping.staffStartRow - 1; i++) {
    data.push([]);
  }

  // データ行
  params.staff.forEach((staff) => {
    const row: (string | number)[] = [];
    row[colLetterToIndex(cols.name)] = staff.name;
    row[colLetterToIndex(cols.position)] = staff.position ?? '';
    row[colLetterToIndex(cols.weeklyHours)] = params.confirmed[staff.id]?.weeklyHours ?? '';
    row[colLetterToIndex(cols.fte)] = params.confirmed[staff.id]?.fte ?? '';
    data.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 列幅
  ws['!cols'] = [
    { wch: 20 }, // A
    { wch: 15 }, // B
    { wch: 12 }, // C
    { wch: 10 }, // D
  ];

  XLSX.utils.book_append_sheet(wb, ws, params.mapping.sheet);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out;
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
