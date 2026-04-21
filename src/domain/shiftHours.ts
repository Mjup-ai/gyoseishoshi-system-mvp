/** 勤務種別ごとのデフォルト労働時間 */
export const SHIFT_HOURS: Record<string, number> = {
  日勤: 8,
  夜勤: 16,
  早出: 7,
  遅出: 9,
  半日: 4,
  休み: 0,
  有給: 0,
  公休: 0,
} as const;

// 暫定: 厚労省基準の正式計算式に差し替え予定
export const STANDARD_WEEKLY_HOURS = 40;
export const FTE_WARNING_THRESHOLD = 1.0;
export const WEEKLY_HOURS_WARNING = 32;
