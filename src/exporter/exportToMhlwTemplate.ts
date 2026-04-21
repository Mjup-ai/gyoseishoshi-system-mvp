import ExcelJS from 'exceljs';
import type { Staff, ScheduleEntry } from '../domain/types';
import { SHIFT_HOURS } from '../domain/shiftHours';

/**
 * 厚労省テンプレートにデータを注入して出力
 * テンプレの構造:
 * - Row 1 (0-idx 0): タイトル
 * - Row 7 (0-idx 6): ヘッダー (No., 職種, 勤務形態, 資格, 氏名, 日付...)
 * - Row 11-30 (0-idx 10-29): データ行 (No.1〜20)
 * - Col A: No., B: 職種, C: 勤務形態, D: 資格, E: 氏名
 * - Col F〜AJ: 日ごとの勤務時間
 * - Col AK: 合計, AL: 週平均, AM: 兼務状況
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
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(params.templateBuffer as any);

  // シート選択（指定名 or 汎用 or 最初のシート）
  let ws = params.sheetName ? workbook.getWorksheet(params.sheetName) : undefined;
  if (!ws) ws = workbook.getWorksheet('勤務形態一覧表（汎用）');
  if (!ws) ws = workbook.worksheets.find(s => s.name.includes('勤務形態'));
  if (!ws) ws = workbook.worksheets[0];
  if (!ws) throw new Error('テンプレートにシートが見つかりません');

  // 年月設定 (Row 2, 0-indexed Row 1)
  const year = params.year || new Date().getFullYear();
  const month = params.month || new Date().getMonth() + 1;
  ws.getCell('M2').value = year;
  ws.getCell('S2').value = month;

  // 事業所名 (Row 2, Col AI)
  if (params.facilityName) {
    ws.getCell('AI2').value = params.facilityName;
  }

  // スケジュールをstaff×dateでインデックス化
  const scheduleMap = new Map<string, Map<string, ScheduleEntry>>();
  params.schedule.forEach(e => {
    if (!scheduleMap.has(e.staffId)) scheduleMap.set(e.staffId, new Map());
    scheduleMap.get(e.staffId)!.set(e.date, e);
  });

  // データ行に注入 (Row 11〜30, 0-indexed 10〜29)
  const dataStartRow = 11; // 1-indexed (exceljs)
  params.staff.forEach((staff, index) => {
    if (index >= 20) return; // テンプレは最大20行
    const row = dataStartRow + index;

    // A: No.
    ws!.getCell(`A${row}`).value = index + 1;
    // B: 職種
    ws!.getCell(`B${row}`).value = staff.position || '';
    // C: 勤務形態 (A=常勤専従, B=常勤兼務, C=非常勤専従, D=非常勤兼務)
    const empType = staff.employmentType?.includes('非常勤') ? 'C' :
                    staff.isDedicated === false ? 'B' : 'A';
    ws!.getCell(`C${row}`).value = empType;
    // D: 資格
    ws!.getCell(`D${row}`).value = staff.qualification || '';
    // E: 氏名
    ws!.getCell(`E${row}`).value = staff.name;

    // F〜AJ: 日ごとの勤務時間 (col 6〜36, 最大31日)
    const staffSchedule = scheduleMap.get(staff.id);
    if (staffSchedule) {
      let dayIndex = 0;
      staffSchedule.forEach((entry) => {
        if (dayIndex >= 31) return;
        const col = 6 + dayIndex; // F=6
        const hours = entry.actualHours ?? SHIFT_HOURS[entry.shiftType] ?? 0;
        if (hours > 0) {
          ws!.getCell(row, col).value = hours;
        }
        dayIndex++;
      });
    }

    // AK: 勤務時間合計
    const confirmed = params.confirmed[staff.id];
    if (confirmed) {
      ws!.getCell(`AK${row}`).value = confirmed.weeklyHours * 4; // 月間概算
      // AL: 週平均
      ws!.getCell(`AL${row}`).value = confirmed.weeklyHours;
    }
  });

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
