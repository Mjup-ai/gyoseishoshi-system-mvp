import type { CommonModel, InputMapping, ScheduleEntry, Staff } from '../domain/types'

function columnLetterToIndex(letter: string) {
  return letter.toUpperCase().charCodeAt(0) - 65
}

export function parseWorkbookToCommonModel(rows: string[][], mapping: InputMapping): CommonModel {
  const staff: Staff[] = []
  const schedule: ScheduleEntry[] = []
  const warnings: string[] = []

  const dataRows = rows.slice(mapping.headerRow)

  dataRows.forEach((row, rowIndex) => {
    const nameIndex = columnLetterToIndex('A')
    const positionIndex = columnLetterToIndex('B')
    const name = row[nameIndex]?.trim()

    if (!name) {
      warnings.push(`row:${rowIndex + mapping.headerRow + 1} 氏名が空です`)
      return
    }

    const staffId = `staff-${rowIndex + 1}`
    staff.push({
      id: staffId,
      name,
      position: row[positionIndex]?.trim() || undefined,
    })

    Object.entries(mapping.columnMapping).forEach(([column, target]) => {
      if (!target.startsWith('schedule.')) return
      const raw = row[columnLetterToIndex(column)]?.trim()
      if (!raw) return

      const date = target.replace('schedule.', '')
      const shiftType = mapping.shiftSymbols[raw] ?? raw

      if (!(raw in mapping.shiftSymbols)) {
        warnings.push(`${name}: ${date} の勤務記号 "${raw}" が未定義です`)
      }

      schedule.push({
        staffId,
        date,
        shiftType,
      })
    })
  })

  return { staff, schedule, warnings }
}
