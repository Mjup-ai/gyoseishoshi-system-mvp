/**
 * 常勤換算計算ルール
 *
 * 根拠:
 * - 障害者の日常生活及び社会生活を総合的に支援するための法律に基づく指定障害福祉サービスの
 *   事業等の人員、設備及び運営に関する基準（平成18年厚生労働省令第171号）
 * - 「従業者の勤務体制及び勤務形態一覧表」の参考様式の取扱いについて
 *   （令和2年3月31日 介護保険最新情報vol.805）
 * - 障害福祉サービスにおける常勤換算方法に関するQ&A（厚生労働省）
 *
 * 計算式:
 *   常勤換算数 = 当該職種の全従業者の勤務延時間数 ÷ 常勤の従業者が勤務すべき時間数
 *
 * 注意:
 * - 「常勤の従業者が勤務すべき時間数」は事業所が定める（週32h〜40h、下限32h）
 * - 1人あたりの算入上限 = 常勤の勤務すべき時間数（超過分は切り捨て）
 * - 育休・産休・傷病で暦月1ヶ月超の欠勤者は算入不可
 * - 育児短時間勤務（週30h以上）の特例あり
 * - 端数処理: 小数点以下第2位まで（第3位切り捨て）
 */

import type { ScheduleEntry, CommonModel } from './types';

/** 事業所の常勤設定 */
export interface FacilityFteConfig {
  /** 常勤の従業者が勤務すべき週時間数（32〜40h、デフォルト40h） */
  standardWeeklyHours: number;
  /** 計算期間の週数（通常4週） */
  periodWeeks: number;
  /** 計算期間区分: '4weeks'=4週間, 'calendar'=暦月 */
  periodType: '4weeks' | 'calendar';
}

export const DEFAULT_FTE_CONFIG: FacilityFteConfig = {
  standardWeeklyHours: 40,
  periodWeeks: 4,
  periodType: '4weeks',
};

/** 従業者の勤務形態区分 */
export type EmploymentCategory = 'A' | 'B' | 'C' | 'D';
// A: 常勤・専従
// B: 常勤・兼務
// C: 非常勤・専従
// D: 非常勤・兼務

/** 従業者ごとのFTE計算結果 */
export interface StaffFteDetail {
  staffId: string;
  name: string;
  position?: string;
  category: EmploymentCategory;
  /** 実勤務時間（期間合計） */
  actualHours: number;
  /** 算入可能時間（上限適用後） */
  countableHours: number;
  /** 個人FTE値 */
  fte: number;
  /** 週平均勤務時間 */
  weeklyAverage: number;
  /** 除外フラグ（長期欠勤等） */
  excluded: boolean;
  excludeReason?: string;
  warnings: string[];
}

/** 施設全体のFTE計算結果 */
export interface FacilityFteResult {
  /** 施設の常勤換算合計 */
  totalFte: number;
  /** 常勤の勤務すべき月間時間 */
  standardMonthlyHours: number;
  /** 常勤の勤務すべき週時間 */
  standardWeeklyHours: number;
  /** 職員ごとの詳細 */
  staffDetails: StaffFteDetail[];
  /** 職種別FTE集計 */
  positionTotals: Record<string, { count: number; fte: number }>;
  /** 警告 */
  warnings: string[];
  /** 計算根拠 */
  basis: string;
}

/** SHIFT_HOURS: 勤務種別→時間のマッピング */
const SHIFT_HOURS: Record<string, number> = {
  '日勤': 8, '夜勤': 16, '早出': 7, '遅出': 9,
  '半日': 4, '休み': 0, '有給': 0, '公休': 0,
};

/**
 * 正式な常勤換算計算
 */
export function calculateOfficialFte(
  model: CommonModel,
  config: FacilityFteConfig = DEFAULT_FTE_CONFIG,
): FacilityFteResult {
  const warnings: string[] = [];
  const standardMonthlyHours = config.standardWeeklyHours * config.periodWeeks;
  const staffDetails: StaffFteDetail[] = [];

  // 職員ごとの勤務時間を集計
  const scheduleByStaff = new Map<string, ScheduleEntry[]>();
  model.schedule.forEach(e => {
    if (!scheduleByStaff.has(e.staffId)) scheduleByStaff.set(e.staffId, []);
    scheduleByStaff.get(e.staffId)!.push(e);
  });

  model.staff.forEach(staff => {
    const entries = scheduleByStaff.get(staff.id) || [];
    const staffWarnings: string[] = [];

    // 実勤務時間の合計
    let actualHours = 0;
    entries.forEach(e => {
      const hours = e.actualHours ?? SHIFT_HOURS[e.shiftType] ?? 0;
      actualHours += hours;
    });

    // 勤務形態区分の判定
    const isFullTime = (staff.weeklyHours ?? actualHours / config.periodWeeks) >= config.standardWeeklyHours;
    const isDedicated = staff.isDedicated !== false; // デフォルトは専従
    const category: EmploymentCategory = isFullTime
      ? (isDedicated ? 'A' : 'B')
      : (isDedicated ? 'C' : 'D');

    // 除外判定（長期欠勤: 全期間無勤務）
    const excluded = actualHours === 0 && entries.length === 0;
    const excludeReason = excluded ? '勤務実績なし（長期欠勤の可能性）' : undefined;

    // 算入可能時間（上限 = 常勤の勤務すべき月間時間）
    const countableHours = Math.min(actualHours, standardMonthlyHours);

    // 超過警告
    if (actualHours > standardMonthlyHours) {
      staffWarnings.push(`勤務時間が上限を超過（${actualHours}h > ${standardMonthlyHours}h）。${standardMonthlyHours}hで算入`);
    }

    // 個人FTE（小数点以下第2位まで、第3位切り捨て）
    const fte = excluded ? 0 : Math.floor((countableHours / standardMonthlyHours) * 100) / 100;

    // 週平均
    const weeklyAverage = Number((actualHours / config.periodWeeks).toFixed(1));

    // 常勤なのにFTE < 1.0の警告
    if (isFullTime && fte < 1.0 && !excluded) {
      staffWarnings.push(`常勤扱いだがFTE ${fte}（欠勤・遅刻等の可能性）`);
    }

    staffDetails.push({
      staffId: staff.id,
      name: staff.name,
      position: staff.position,
      category,
      actualHours,
      countableHours,
      fte,
      weeklyAverage,
      excluded,
      excludeReason,
      warnings: staffWarnings,
    });
  });

  // 施設全体のFTE
  const totalFte = Math.floor(staffDetails.reduce((sum, d) => sum + d.fte, 0) * 100) / 100;

  // 職種別集計
  const positionTotals: Record<string, { count: number; fte: number }> = {};
  staffDetails.forEach(d => {
    const pos = d.position || '（未設定）';
    if (!positionTotals[pos]) positionTotals[pos] = { count: 0, fte: 0 };
    positionTotals[pos].count++;
    positionTotals[pos].fte = Math.floor((positionTotals[pos].fte + d.fte) * 100) / 100;
  });

  // 全体警告
  if (totalFte < 1) {
    warnings.push(`施設全体の常勤換算が ${totalFte}（基準未満の可能性）`);
  }

  const basis = [
    '計算根拠: 障害者総合支援法に基づく指定障害福祉サービス事業等の人員基準（平成18年厚労省令第171号）',
    `常勤の勤務すべき時間数: 週${config.standardWeeklyHours}時間 / 月${standardMonthlyHours}時間`,
    `計算期間: ${config.periodType === '4weeks' ? '4週間' : '暦月'}（${config.periodWeeks}週）`,
    '端数処理: 小数点以下第2位まで（第3位切り捨て）',
    '算入上限: 1人あたり常勤の勤務すべき月間時間数',
  ].join('\n');

  return {
    totalFte,
    standardMonthlyHours,
    standardWeeklyHours: config.standardWeeklyHours,
    staffDetails,
    positionTotals,
    warnings: [...warnings, ...model.warnings],
    basis,
  };
}
