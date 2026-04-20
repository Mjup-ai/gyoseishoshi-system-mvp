import ExcelJS from 'exceljs'

export async function readWorkbookFile(file: File, sheetName?: string) {
  const workbook = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  await workbook.xlsx.load(buffer)

  const worksheet = sheetName
    ? workbook.getWorksheet(sheetName) ?? workbook.worksheets[0]
    : workbook.worksheets[0]

  return worksheet.getSheetValues().slice(1).map((row) => {
    if (Array.isArray(row)) {
      return row.slice(1).map((cell) => (cell == null ? '' : String(cell)))
    }
    return []
  })
}
