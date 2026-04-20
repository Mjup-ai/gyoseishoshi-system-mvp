import ExcelJS from 'exceljs'

import type { Staff } from '../domain/types'
import type { OutputMapping } from '../lib/loadOutputMapping'

export async function exportToWorkbook(params: {
  mapping: OutputMapping
  staff: Staff[]
  confirmed: Record<string, { weeklyHours: number; fte: number }>
}) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(params.mapping.sheet)

  worksheet.getCell(`${params.mapping.columns.name}1`).value = '氏名'
  worksheet.getCell(`${params.mapping.columns.position}1`).value = '職種'
  worksheet.getCell(`${params.mapping.columns.weeklyHours}1`).value = '週時間'
  worksheet.getCell(`${params.mapping.columns.fte}1`).value = 'FTE'

  params.staff.forEach((staff, index) => {
    const row = params.mapping.staffStartRow + index
    worksheet.getCell(`${params.mapping.columns.name}${row}`).value = staff.name
    worksheet.getCell(`${params.mapping.columns.position}${row}`).value = staff.position ?? ''
    worksheet.getCell(`${params.mapping.columns.weeklyHours}${row}`).value = params.confirmed[staff.id]?.weeklyHours ?? ''
    worksheet.getCell(`${params.mapping.columns.fte}${row}`).value = params.confirmed[staff.id]?.fte ?? ''
  })

  return workbook.xlsx.writeBuffer()
}

export function downloadWorkbook(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
