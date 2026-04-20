import { load as parseYaml } from 'js-yaml';
import type { InputMapping } from '../domain/types';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const asStringRecord = (value: unknown, fieldName: string): Record<string, string> => {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} はオブジェクトである必要があります`);
  }

  return Object.entries(value).reduce<Record<string, string>>((acc, [key, rawValue]) => {
    if (typeof rawValue === 'string') {
      acc[key] = rawValue;
    }
    return acc;
  }, {});
};

export const loadInputMapping = async (url: string): Promise<InputMapping> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`InputMappingの読み込みに失敗しました: ${response.status}`);
  }

  const yamlText = await response.text();
  const parsed = parseYaml(yamlText);

  if (!isRecord(parsed)) {
    throw new Error('InputMapping YAMLの形式が不正です');
  }

  return {
    name: typeof parsed.name === 'string' ? parsed.name : 'sample',
    format: typeof parsed.format === 'string' ? parsed.format : 'xlsx',
    sheet: typeof parsed.sheet === 'string' ? parsed.sheet : '',
    headerRow: typeof parsed.headerRow === 'number' ? parsed.headerRow : 1,
    columnMapping: asStringRecord(parsed.columnMapping, 'columnMapping'),
    shiftSymbols: asStringRecord(parsed.shiftSymbols, 'shiftSymbols'),
  };
};
