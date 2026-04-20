import type { CommonModel } from '../domain/types'
import { getShiftHours } from '../domain/shiftHours'

export type ReviewRow = {
  staffId: string
  name: string
  position?: string
  weeklyHours: number
  fte: number
  status: 'danger' | 'warn' | 'ok'
  warnings: string[]
}

export function buildReviewRows(model: CommonModel): ReviewRow[] {
  return model.staff.map((staff) => {
    const entries = model.schedule.filter((entry) => entry.staffId === staff.id)
    const totalHours = entries.reduce((sum, entry) => sum + getShiftHours(entry.shiftType, entry.actualHours), 0)
    const weeklyHours = Number((((staff.weeklyHours ?? totalHours / 3) * 7)).toFixed(1))
    const fte = Number((weeklyHours / 40).toFixed(2))
    const warnings = model.warnings.filter((warning) => warning.includes(staff.name))

    const status = warnings.length > 0 ? 'danger' : fte < 1 ? 'warn' : 'ok'

    return {
      staffId: staff.id,
      name: staff.name,
      position: staff.position,
      weeklyHours,
      fte,
      status,
      warnings,
    }
  })
}
