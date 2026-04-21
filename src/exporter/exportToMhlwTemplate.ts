import * as XLSX from 'xlsx';
import type { Staff, ScheduleEntry } from '../domain/types';
import { SHIFT_HOURS } from '../domain/shiftHours';

/**
 * 厚労省テンプレートにデータを注入して出力（SheetJSベース）
 */
export async function exportToMhlwTemplate(params: {
  templateBuffer: ArrayBuffer;
  sheetName?: string;
  staff: Staff[];
  schedule: ScheduleEntry[];
  confirmed: Record<string, { weeklyHours: number; fte: number }>;
  facilityName?: string;
  year?: number;
  month?: number;
}): Promise<ArrayBuffer> {
  const wb = XLSX.read(params.templateBuffer, { type: 'array' });

  // シート選択
  let sheetName = params.sheetName;
  if (!sheetName || !wb.SheetNames.includes(sheetName)) {
    sheetName = wb.SheetNames.find(n => n.includes('汎用'))
      || wb.SheetNames.find(n => n.includes('勤務形態'))
      || wb.SheetNames[0];
  }
  if (!sheetName) throw new Error('テンプレートにシートが見つかりません');

  const ws = wb.Sheets[sheetName];

  // 年月設定 (Row 2: 0-indexed row 1)
  const year = params.year || new Date().getFullYear();
  const month = params.month || new Date().getMonth() + 1;
  XLSX.utils.sheet_add_aoa(ws, [[year]], { origin: { r: 1, c: 12 } }); // M2
  XLSX.utils.sheet_add_aoa(ws, [[month]], { origin: { r: 1, c: 18 } }); // S2

  // 事業所名
  if (params.facilityName) {
    XLSX.utils.sheet_add_aoa(ws, [[params.facilityName]], { origin: { r: 1, c: 34 } }); // AI2
  }

  // スケジュールをstaff×dateでインデックス化
  const scheduleMap = new Map<string, Map<string, ScheduleEntry>>();
  params.schedule.forEach(e => {
    if (!scheduleMap.has(e.staffId)) scheduleMap.set(e.staffId, new Map());
    scheduleMap.get(e.staffId)!.set(e.date, e);
  });

  // データ行に注入 (0-indexed row 10〜29)
  const dataStartRow = 10;
  params.staff.forEach((staff, index) => {
    if (index >= 20) return;
    const row = dataStartRow + index;

    // A: No.
    setCellValue(ws, row, 0, index + 1);
    // B: 職種
    setCellValue(ws, row, 1, staff.position || '');
    // C: 勤務形態
    const empType = staff.employmentType?.includes('非常勤') ? 'C' :
                    staff.isDedicated === false ? 'B' : 'A';
    setCellValue(ws, row, 2, empType);
    // D: 資格
    setCellValue(ws, row, 3, staff.qualification || '');
    // E: 氏名
    setCellValue(ws, row, 4, staff.name);

    // F〜AJ: 日ごとの勤務時間
    const staffSchedule = scheduleMap.get(staff.id);
    if (staffSchedule) {
      let dayIndex = 0;
      staffSchedule.forEach((entry) => {
        if (dayIndex >= 31) return;
        const col = 5 + dayIndex; // F=col 5 (0-indexed)
        const hours = entry.actualHours ?? SHIFT_HOURS[entry.shiftType] ?? 0;
        if (hours > 0) {
          setCellValue(ws, row, col, hours);
        }
        dayIndex++;
      });
    }

    // AK: 勤務時間合計
    const confirmed = params.confirmed[staff.id];
    if (confirmed) {
      setCellValue(ws, row, 36, confirmed.weeklyHours * 4); // 月間概算
      // AL: 週平均
      setCellValue(ws, row, 37, confirmed.weeklyHours);
    }
  });

  // ArrayBufferとして書き出し
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out;
}

function setCellValue(ws: XLSX.WorkSheet, row: number, col: number, value: string | number) {
  const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
  if (!ws[cellRef]) ws[cellRef] = {};
  ws[cellRef].v = value;
  ws[cellRef].t = typeof value === 'number' ? 'n' : 's';
}
