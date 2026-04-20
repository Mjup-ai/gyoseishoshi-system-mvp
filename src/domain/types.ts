export interface Staff {
  id: string;
  name: string;
  nameKana?: string;
  position?: string;
  qualification?: string;
  employmentType?: string;
  weeklyHours?: number;
}

export interface ScheduleEntry {
  staffId: string;
  date: string;
  shiftType: string;
  startTime?: string;
  endTime?: string;
  actualHours?: number;
}

export interface CommonModel {
  staff: Staff[];
  schedule: ScheduleEntry[];
  warnings: string[];
}

export interface InputMapping {
  name: string;
  format: string;
  sheet: string;
  headerRow: number;
  columnMapping: Record<string, string>;
  shiftSymbols: Record<string, string>;
}

export interface OutputMapping {
  sheet: string;
  staffStartRow: number;
  columns: Record<string, string>;
}

export interface RuleResult {
  fullTimeEquivalent: number;
  shiftTotals: Record<string, number>;
  warnings: string[];
}
