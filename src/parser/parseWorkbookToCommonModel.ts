import type { CommonModel, InputMapping, ScheduleEntry, Staff } from '../domain/types';

function columnLetterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

/** InputMappingに基づきExcelのrows配列をCommonModelに変換 */
export function parseWorkbookToCommonModel(rows: string[][], mapping: InputMapping): CommonModel {
  const staff: Staff[] = [];
  const schedule: ScheduleEntry[] = [];
  const warnings: string[] = [];

  const dataRows = rows.slice(mapping.headerRow);

  dataRows.forEach((row, rowIndex) => {
    // 名前列を動的に取得
    const nameCol = Object.entries(mapping.columnMapping).find(([, v]) => v === 'name')?.[0];
    const posCol = Object.entries(mapping.columnMapping).find(([, v]) => v === 'position')?.[0];

    const nameIndex = nameCol ? columnLetterToIndex(nameCol) : 0;
    const posIndex = posCol ? columnLetterToIndex(posCol) : 1;
    const name = row[nameIndex]?.trim();

    if (!name) {
      if (row.some((c) => c.trim())) {
        warnings.push(`行${rowIndex + mapping.headerRow + 1}: 氏名が空です`);
      }
      return;
    }

    const staffId = `staff-${rowIndex + 1}`;
    staff.push({
      id: staffId,
      name,
      position: row[posIndex]?.trim() || undefined,
    });

    // スケジュール列を処理
    Object.entries(mapping.columnMapping).forEach(([column, target]) => {
      if (!target.startsWith('schedule.')) return;
      const raw = row[columnLetterToIndex(column)]?.trim();
      if (!raw) return;

      const date = target.replace('schedule.', '');
      const shiftType = mapping.shiftSymbols[raw] ?? raw;

      if (!(raw in mapping.shiftSymbols)) {
        warnings.push(`${name}: ${date} の勤務記号「${raw}」が未定義です`);
      }

      schedule.push({ staffId, date, shiftType });
    });
  });

  return { staff, schedule, warnings };
}
