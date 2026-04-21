import type { InputMapping, OutputMapping } from '../domain/types';

// 暫定: YAMLファイルではなくハードコードのサンプル定義
// 実運用時はfetchでYAMLを読み込む

export function loadSampleInputMapping(): InputMapping {
  return {
    name: 'サンプルグループホーム',
    format: 'excel',
    sheet: 'シフト表',
    headerRow: 2,
    columnMapping: {
      A: 'name',
      B: 'position',
      C: 'schedule.2026-04-01',
      D: 'schedule.2026-04-02',
      E: 'schedule.2026-04-03',
      F: 'schedule.2026-04-04',
      G: 'schedule.2026-04-05',
      H: 'schedule.2026-04-06',
      I: 'schedule.2026-04-07',
    },
    shiftSymbols: {
      '○': '日勤',
      '×': '休み',
      '△': '早出',
      '▽': '遅出',
      '夜': '夜勤',
      '有': '有給',
      '半': '半日',
      '公': '公休',
    },
  };
}

export function loadSampleOutputMapping(): OutputMapping {
  return {
    name: 'サンプル自治体様式',
    sheet: '勤務体制一覧表',
    staffStartRow: 3,
    columns: {
      name: 'A',
      position: 'B',
      weeklyHours: 'C',
      fte: 'D',
    },
  };
}
