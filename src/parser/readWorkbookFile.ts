import ExcelJS from 'exceljs';

const normalizeCellValue = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text.trim();
  }

  if (typeof value === 'object' && 'result' in value) {
    const result = value.result;
    if (result === null || result === undefined) {
      return '';
    }
    return String(result).trim();
  }

  return String(value).trim();
};

const getWorksheet = (workbook: ExcelJS.Workbook, sheetName?: string): ExcelJS.Worksheet => {
  if (sheetName) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new Error(`指定シートが見つかりません: ${sheetName}`);
    }
    return worksheet;
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('ワークブックにシートがありません');
  }

  return worksheet;
};

export const readWorkbookFile = async (file: File, sheetName?: string): Promise<string[][]> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = getWorksheet(workbook, sheetName);
  const rows: string[][] = [];
  const totalColumns = Math.max(worksheet.actualColumnCount, worksheet.columnCount);

  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const rowValues: string[] = [];

    for (let col = 1; col <= totalColumns; col += 1) {
      rowValues.push(normalizeCellValue(row.getCell(col).value));
    }

    rows.push(rowValues);
  });

  return rows;
};
