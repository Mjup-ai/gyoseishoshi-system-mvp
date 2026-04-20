export type Staff = {
  id: string
  name: string
  nameKana?: string
  position?: string
  qualification?: string
  employmentType?: string
  isDedicated?: boolean
  weeklyHours?: number
  startDate?: string
}

export type ScheduleEntry = {
  staffId: string
  date: string
  shiftType: string
  startTime?: string
  endTime?: string
  breakMinutes?: number
  actualHours?: number
}

export type CommonModel = {
  staff: Staff[]
  schedule: ScheduleEntry[]
  warnings: string[]
}

export const SHIFT_HOURS: Record<string, number> = {
  日勤: 8,
  夜勤: 16,
  休み: 0,
  有給: 0,
}

export type InputMapping = {
  name: string
  format: 'excel'
  sheet: string
  headerRow: number
  columnMapping: Record<string, string>
  shiftSymbols: Record<string, string>
}

export type RuleResult = {
  fullTimeEquivalent: number
  shiftTotals: {
    dayHours: number
    nightHours: number
    holidayCount: number
  }
  warnings: string[]
}
