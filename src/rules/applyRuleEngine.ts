import type { CommonModel, RuleResult, ScheduleEntry, StaffRuleResult } from '../domain/types';
import { SHIFT_HOURS, STANDARD_WEEKLY_HOURS, FTE_WARNING_THRESHOLD, WEEKLY_HOURS_WARNING } from '../domain/shiftHours';

// 暫定: 厚労省基準の正式計算式に差し替え予定

function groupByStaff(schedule: ScheduleEntry[]): Record<string, ScheduleEntry[]> {
  return schedule.reduce<Record<string, ScheduleEntry[]>>((acc, e) => {
    (acc[e.staffId] ??= []).push(e);
    return acc;
  }, {});
}

function inferWeeklyHours(weeklyHours: number | undefined, entries: ScheduleEntry[]): number {
  if (weeklyHours) return weeklyHours;
  const totalHours = entries.reduce((sum, e) => sum + (e.actualHours ?? SHIFT_HOURS[e.shiftType] ?? 0), 0);
  const weeks = Math.max(1, Math.ceil(entries.length / 7));
  return Number((totalHours / weeks).toFixed(1));
}

export function applyRuleEngine(model: CommonModel): RuleResult {
  const grouped = groupByStaff(model.schedule);
  const warnings = [...model.warnings];
  const staffResults: StaffRuleResult[] = [];

  let totalDayHours = 0;
  let totalNightHours = 0;
  let totalHolidayCount = 0;
  let totalWeeklyHours = 0;

  model.staff.forEach((staff) => {
    const entries = grouped[staff.id] ?? [];
    const weeklyHours = inferWeeklyHours(staff.weeklyHours, entries);
    const fte = Number((weeklyHours / STANDARD_WEEKLY_HOURS).toFixed(2));
    const staffWarnings: string[] = [];

    if (weeklyHours < WEEKLY_HOURS_WARNING) {
      staffWarnings.push(`週${weeklyHours}h（${WEEKLY_HOURS_WARNING}h未満）`);
    }
    if (fte < FTE_WARNING_THRESHOLD) {
      staffWarnings.push(`常勤換算 ${fte}（基準${FTE_WARNING_THRESHOLD}未満）`);
    }

    const status = staffWarnings.length > 0 ? (fte < 0.5 ? 'danger' : 'warn') : 'ok';

    entries.forEach((e) => {
      const hours = e.actualHours ?? SHIFT_HOURS[e.shiftType] ?? 0;
      if (e.shiftType === '日勤' || e.shiftType === '早出' || e.shiftType === '遅出') totalDayHours += hours;
      if (e.shiftType === '夜勤') totalNightHours += hours;
      if (e.shiftType === '休み' || e.shiftType === '有給' || e.shiftType === '公休') totalHolidayCount++;
    });

    totalWeeklyHours += weeklyHours;

    staffResults.push({
      staffId: staff.id,
      name: staff.name,
      position: staff.position,
      weeklyHours,
      fte,
      status,
      warnings: staffWarnings,
    });
  });

  const fullTimeEquivalent = Number((totalWeeklyHours / STANDARD_WEEKLY_HOURS).toFixed(2));

  if (fullTimeEquivalent < 1) {
    warnings.push(`施設全体の常勤換算が ${fullTimeEquivalent}（基準未満の可能性）`);
  }

  return {
    staffResults,
    facilityTotals: { fullTimeEquivalent, totalDayHours, totalNightHours, totalHolidayCount },
    warnings,
  };
}
