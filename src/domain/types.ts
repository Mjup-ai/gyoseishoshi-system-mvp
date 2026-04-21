/** 職員情報 */
export interface Staff {
  id: string;
  name: string;
  nameKana?: string;
  position?: string;        // 職種（サビ管、生活支援員等）
  qualification?: string;   // 資格
  employmentType?: string;  // 常勤/非常勤/パート
  weeklyHours?: number;     // 契約上の週労働時間
  isDedicated?: boolean;    // 専従かどうか
  startDate?: string;       // 勤務開始日
}

/** 勤務記録（1日1人分） */
export interface ScheduleEntry {
  staffId: string;
  date: string;             // YYYY-MM-DD
  shiftType: string;        // 正規化済み勤務種別
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  actualHours?: number;
}

/** 施設の勤務データ共通モデル */
export interface CommonModel {
  staff: Staff[];
  schedule: ScheduleEntry[];
  warnings: string[];
}

/** 入力マッピング: 施設のExcelフォーマット定義 */
export interface InputMapping {
  name: string;
  format: 'excel';
  sheet: string;
  headerRow: number;
  columnMapping: Record<string, string>;  // Excel列(A,B,C...) → フィールド名
  shiftSymbols: Record<string, string>;   // 勤務記号 → 正規化名
}

/** 出力マッピング: 自治体様式への転記先定義 */
export interface OutputMapping {
  name: string;
  sheet: string;
  staffStartRow: number;
  columns: Record<string, string>;  // フィールド名 → Excel列
}

/** ルールエンジン結果 */
export interface RuleResult {
  staffResults: StaffRuleResult[];
  facilityTotals: {
    fullTimeEquivalent: number;
    totalDayHours: number;
    totalNightHours: number;
    totalHolidayCount: number;
  };
  warnings: string[];
}

/** 職員単位のルール結果 */
export interface StaffRuleResult {
  staffId: string;
  name: string;
  position?: string;
  weeklyHours: number;
  fte: number;                // 常勤換算値
  status: 'ok' | 'warn' | 'danger';
  warnings: string[];
}

/** レビュー行（UI用） */
export interface ReviewRow {
  staffId: string;
  name: string;
  position?: string;
  weeklyHours: number;
  fte: number;
  status: 'ok' | 'warn' | 'danger';
  warnings: string[];
  confirmed: boolean;
  editedWeeklyHours?: number;
  editedFte?: number;
}
