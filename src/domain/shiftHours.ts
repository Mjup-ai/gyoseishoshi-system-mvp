import { SHIFT_HOURS } from './types'

export function getShiftHours(shiftType: string, actualHours?: number) {
  return actualHours ?? SHIFT_HOURS[shiftType] ?? 0
}
