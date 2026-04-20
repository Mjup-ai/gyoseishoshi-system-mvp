import type { CommonModel, InputMapping, ScheduleEntry, Staff } from '../domain/types'

function columnLetterToIndex(letter: string) {
  return letter.toUpperCase().charCodeAt(0) - 65
}

function buildTargetIndexMap(mapping: InputMapping) {
  return Object.entries(mapping.columnMapping).reduce<Record<string, number>>((acc, [column, target]) => {
    acc[target] = columnLetterToIndex(column)
    return acc
  }, {})
}

export function parseWorkbookToCommonModel(rows: string[][], mapping: InputMapping): CommonModel {
  const staff: Staff[] = []
  const schedule: ScheduleEntry[] = []
  const warnings: string[] = []

  const targetIndexMap = buildTargetIndexMap(mapping)
  const nameIndex = targetIndexMap['staff.name']
  const positionIndex = targetIndexMap['staff.position']

  if (nameIndex == null) {
    throw new Error('input_mapping.yaml に staff.name の列定義がありません')
  }

  const dataRows = rows.slice(mapping.headerRow)

  dataRows.forEach((row, rowIndex) => {
    const name = row[nameIndex]?.trim()

    if (!name) {
      warnings.push(`row:${rowIndex + mapping.headerRow + 1} 氏名が空です`)
      return
    }

    const staffId = `staff-${rowIndex + 1}`
    staff.push({
      id: staffId,
      name,
      position: positionIndex == null ? undefined : row[positionIndex]?.trim() || undefined,
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
