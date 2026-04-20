import type { CommonModel, RuleResult, ScheduleEntry, Staff } from '../domain/types'
import { getShiftHours } from '../domain/shiftHours'

function groupScheduleByStaff(schedule: ScheduleEntry[]) {
  return schedule.reduce<Record<string, ScheduleEntry[]>>((acc, entry) => {
    acc[entry.staffId] ??= []
    acc[entry.staffId].push(entry)
    return acc
  }, {})
}

function inferWeeklyHours(staff: Staff, entries: ScheduleEntry[]) {
  if (staff.weeklyHours) return staff.weeklyHours

  const totalHours = entries.reduce((sum, entry) => sum + getShiftHours(entry.shiftType, entry.actualHours), 0)
  return Number(((totalHours / 3) * 7).toFixed(1))
}

export function applyRuleEngine(model: CommonModel): RuleResult {
  const grouped = groupScheduleByStaff(model.schedule)
  const warnings = [...model.warnings]

  let totalWeeklyHours = 0
  let dayHours = 0
  let nightHours = 0
  let holidayCount = 0

  model.staff.forEach((staff) => {
    const entries = grouped[staff.id] ?? []
    const weeklyHours = inferWeeklyHours(staff, entries)
    totalWeeklyHours += weeklyHours

    if (weeklyHours < 32) {
      warnings.push(`${staff.name}: 常勤換算の基準候補 32h を下回る (${weeklyHours}h)`)
    }

    entries.forEach((entry) => {
      const actualHours = getShiftHours(entry.shiftType, entry.actualHours)
      if (entry.shiftType === '日勤') dayHours += actualHours
      if (entry.shiftType === '夜勤') nightHours += actualHours
      if (entry.shiftType === '休み' || entry.shiftType === '有給') holidayCount += 1
    })
  })

  const fullTimeEquivalent = Number((totalWeeklyHours / 40).toFixed(2))

  if (fullTimeEquivalent < 1) {
    warnings.push(`常勤換算が基準未満の可能性 (${fullTimeEquivalent})`)
  }

  return {
    fullTimeEquivalent,
    shiftTotals: {
      dayHours,
      nightHours,
      holidayCount,
    },
    warnings,
  }
}
