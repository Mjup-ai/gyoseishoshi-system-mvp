import type { CommonModel, InputMapping, ScheduleEntry, Staff } from '../domain/types';

const columnLettersToIndex = (column: string): number => {
  return column
    .trim()
    .toUpperCase()
    .split('')
    .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;
};

const setDeepValue = (target: Record<string, unknown>, path: string, value: string): void => {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) {
    return;
  }

  let current: Record<string, unknown> = target;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const next = current[key];

    if (!next || typeof next !== 'object') {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
};

interface ParsedRow {
  staffData: Record<string, unknown>;
  scheduleSymbols: Array<{ date: string; symbol: string; column: string }>;
}

const parseRow = (row: string[], inputMapping: InputMapping): ParsedRow => {
  const staffData: Record<string, unknown> = {};
  const scheduleSymbols: Array<{ date: string; symbol: string; column: string }> = [];

  Object.entries(inputMapping.columnMapping).forEach(([column, fieldPath]) => {
    const value = (row[columnLettersToIndex(column)] ?? '').trim();
    if (!value) {
      return;
    }

    if (fieldPath.startsWith('schedule.')) {
      const date = fieldPath.slice('schedule.'.length);
      if (date) {
        scheduleSymbols.push({ date, symbol: value, column });
      }
      return;
    }

    setDeepValue(staffData, fieldPath, value);
  });

  return { staffData, scheduleSymbols };
};

export const parseWorkbookToCommonModel = (
  rows: string[][],
  inputMapping: InputMapping,
): CommonModel => {
  const staff: Staff[] = [];
  const schedule: ScheduleEntry[] = [];
  const warnings: string[] = [];

  for (let i = inputMapping.headerRow; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const parsedRow = parseRow(row, inputMapping);
    const hasStaffData = Object.keys(parsedRow.staffData).length > 0;
    const hasScheduleData = parsedRow.scheduleSymbols.length > 0;

    if (!hasStaffData && !hasScheduleData) {
      continue;
    }

    const rowNumber = i + 1;
    const name = String(parsedRow.staffData.name ?? '').trim();

    if (!name) {
      warnings.push(`行${rowNumber}: 氏名(name)が空のためスキップしました`);
      continue;
    }

    const staffId = `staff-${rowNumber}`;
    const staffEntry: Staff = {
      id: staffId,
      name,
      position:
        typeof parsedRow.staffData.position === 'string'
          ? (parsedRow.staffData.position as string)
          : undefined,
    };

    staff.push(staffEntry);

    parsedRow.scheduleSymbols.forEach(({ date, symbol, column }) => {
      const normalizedShift = inputMapping.shiftSymbols[symbol];
      if (!normalizedShift) {
        warnings.push(
          `行${rowNumber} 列${column}: 未定義の勤務記号 '${symbol}' を検出しました`,
        );
        return;
      }

      schedule.push({
        staffId,
        date,
        shiftType: normalizedShift,
      });
    });
  }

  return {
    staff,
    schedule,
    warnings,
  };
};
