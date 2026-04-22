/**
 * 厚労省テンプレのシートマッピング定義
 *
 * サービス種別→使用シート名の対応表
 * セル位置定義（全シート共通構造）
 *
 * 根拠: 厚労省「従業者の勤務の体制及び勤務形態一覧表」参考様式
 */

/** セル位置定義（1-indexed: exceljsの行番号） */
export interface SheetCellMapping {
  /** ヘッダー行（0-indexed） */
  headerRow: number;
  /** データ開始行（1-indexed、exceljsに渡す値） */
  dataStartRow: number;
  /** 最大データ行数 */
  maxSlots: number;
  /** 列マッピング（1-indexed列番号） */
  columns: {
    no: number;          // A=1: No.
    position: number;    // B=2: 職種
    employmentType: number; // C=3: 勤務形態(A/B/C/D)
    qualification: number;  // D=4: 資格
    name: number;        // E=5: 氏名
    dailyStart: number;  // F=6: 日別勤務時間の開始列
    dailyEnd: number;    // AJ=36: 日別勤務時間の終了列（最大31日）
    totalHours: number;  // AK=37: 勤務時間合計
    weeklyAverage: number; // AL=38: 週平均勤務時間
    concurrent: number;  // AM=39: 兼務状況
  };
  /** ヘッダー部の特殊セル（1-indexed） */
  header: {
    yearCell: string;     // 年: M2
    monthCell: string;    // 月: S2
    facilityNameCell: string; // 事業所名: AI2
    standardHoursWeekCell?: string; // 常勤の週時間
    standardHoursMonthCell?: string; // 常勤の月時間
  };
  /** 自動入力可能な項目 */
  autoFillable: string[];
  /** 手入力が必要な項目 */
  manualRequired: string[];
}

/** 標準セル配置（ほぼ全シート共通） */
const STANDARD_MAPPING: SheetCellMapping = {
  headerRow: 6,
  dataStartRow: 11, // 1-indexed (exceljs)
  maxSlots: 20,
  columns: {
    no: 1,
    position: 2,
    employmentType: 3,
    qualification: 4,
    name: 5,
    dailyStart: 6,
    dailyEnd: 36,
    totalHours: 37,
    weeklyAverage: 38,
    concurrent: 39,
  },
  header: {
    yearCell: 'M2',
    monthCell: 'S2',
    facilityNameCell: 'AI2',
  },
  autoFillable: [
    'No.（連番）',
    '氏名',
    '職種',
    '勤務形態（A/B/C/D）',
    '日別勤務時間',
    '勤務時間合計',
    '週平均勤務時間',
    '年月',
    '事業所名',
  ],
  manualRequired: [
    '資格（資格名は元データに依存）',
    '兼務状況（兼務先・職務内容）',
    'サービス種別（プルダウン選択）',
    '記載期間（4週 or 暦月）',
    '予定/実績の別',
    '常勤の勤務すべき時間数（事業所ごとに異なる）',
  ],
};

/** 児童系シート用（dataStartRowが1行ズレる） */
const CHILD_MAPPING: SheetCellMapping = {
  ...STANDARD_MAPPING,
  dataStartRow: 12, // 児童系は1行下
};

/** サービス種別→シート名の対応表 */
export interface ServiceSheetEntry {
  /** サービスコード（staffingStandards.tsのserviceCodeと対応） */
  serviceCode: string;
  /** サービス名 */
  serviceName: string;
  /** 厚労省テンプレ内のシート名 */
  sheetName: string;
  /** セル配置 */
  cellMapping: SheetCellMapping;
  /** 対応状態 */
  supported: boolean;
}

export const SERVICE_SHEET_MAP: ServiceSheetEntry[] = [
  // 汎用
  { serviceCode: 'GENERIC', serviceName: '汎用', sheetName: '勤務形態一覧表（汎用）', cellMapping: STANDARD_MAPPING, supported: true },

  // 訪問系
  { serviceCode: 'HOME_CARE', serviceName: '居宅介護', sheetName: '勤務形態一覧表（居宅介護）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'SEVERE_HOME', serviceName: '重度訪問介護', sheetName: '勤務形態一覧表（重度訪問介護）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'ACCOMPANY', serviceName: '同行援護', sheetName: '勤務形態一覧表（同行援護）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'BEHAVIOR', serviceName: '行動援護', sheetName: '勤務形態一覧表（行動援護）', cellMapping: STANDARD_MAPPING, supported: true },

  // 日中活動系
  { serviceCode: 'MEDICAL_CARE', serviceName: '療養介護', sheetName: '勤務形態一覧表（療養介護）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'LIFE_CARE', serviceName: '生活介護', sheetName: '勤務形態一覧表（生活介護）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'FUNCTIONAL', serviceName: '機能訓練', sheetName: '勤務形態一覧表（機能訓練）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'LIFE_TRAINING', serviceName: '生活訓練', sheetName: '勤務形態一覧表（生活訓練）', cellMapping: STANDARD_MAPPING, supported: true },

  // 就労系
  { serviceCode: 'TRANSITION', serviceName: '就労移行支援', sheetName: '勤務形態一覧表（就労移行支援）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'CERTIFIED_TRANSITION', serviceName: '認定指定就労移行支援', sheetName: '勤務形態一覧表（認定指定就労移行支援）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'A_B_CONTINUOUS', serviceName: '就労継続支援A型・B型', sheetName: '勤務形態一覧表（就労継続支援A型・B型）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'RETENTION', serviceName: '就労定着支援', sheetName: '勤務形態一覧表（就労定着支援）', cellMapping: STANDARD_MAPPING, supported: true },

  // 居住系
  { serviceCode: 'INDEPENDENT', serviceName: '自立生活援助', sheetName: '勤務形態一覧表（自立生活援助）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'GH_INCLUSIVE', serviceName: '共同生活援助・介護サービス包括型', sheetName: '勤務形態一覧表（共同生活援助・介護サービス包括型）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'GH_EXTERNAL', serviceName: '共同生活援助・外部サービス利用型', sheetName: '勤務形態一覧表（共同生活援助・外部サービス利用型）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'GH_DAYTIME', serviceName: '共同生活援助・日中サービス支援型', sheetName: '勤務形態一覧表（共同生活援助・日中サービス支援型', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'FACILITY', serviceName: '障害者支援施設', sheetName: '勤務形態一覧表（障害者支援施設）', cellMapping: STANDARD_MAPPING, supported: true },

  // 相談系
  { serviceCode: 'GENERAL_CONSULT', serviceName: '一般相談支援', sheetName: '勤務形態一覧表（一般相談支援）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'SPECIFIC_CONSULT', serviceName: '特定相談支援・障害児相談支援', sheetName: '勤務形態一覧（特定相談支援・障害児相談支援）', cellMapping: STANDARD_MAPPING, supported: true },

  // 児童系（セル位置が1行ズレる）
  { serviceCode: 'CHILD_AFTER_SCHOOL', serviceName: '児童発達支援・放課後デイサービス', sheetName: '勤務形態一覧表（児童発達支援・放課後デイサービス）', cellMapping: CHILD_MAPPING, supported: true },
  { serviceCode: 'CHILD_SEVERE', serviceName: '児童発達支援・重症心身障害児', sheetName: '勤務形態一覧表（児童発達支援・主として重症心身障害児）', cellMapping: CHILD_MAPPING, supported: true },
  { serviceCode: 'CHILD_CENTER', serviceName: '児童発達支援センター', sheetName: '勤務形態一覧表（児童発達支援センター）', cellMapping: CHILD_MAPPING, supported: true },
  { serviceCode: 'CHILD_HOME_VISIT', serviceName: '居宅訪問型児童発達支援', sheetName: '勤務形態一覧表（居宅訪問型児童発達支援）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'CHILD_NURSERY_VISIT', serviceName: '保育所等訪問支援', sheetName: '勤務形態一覧表（保育所等訪問支援）', cellMapping: STANDARD_MAPPING, supported: true },

  // 入所系
  { serviceCode: 'CHILD_WELFARE_FACILITY', serviceName: '福祉型障害児入所施設', sheetName: '勤務形態一覧表（福祉型障害児入所施設）', cellMapping: STANDARD_MAPPING, supported: true },
  { serviceCode: 'CHILD_MEDICAL_FACILITY', serviceName: '医療型障害児入所施設', sheetName: '勤務形態一覧表（医療型障害児入所施設）', cellMapping: STANDARD_MAPPING, supported: true },
];

/** サービスコードからシート情報を取得 */
export function getServiceSheet(serviceCode: string): ServiceSheetEntry | undefined {
  return SERVICE_SHEET_MAP.find(s => s.serviceCode === serviceCode);
}

/** サービス名からシート情報を取得（部分一致） */
export function findServiceSheet(serviceName: string): ServiceSheetEntry | undefined {
  return SERVICE_SHEET_MAP.find(s =>
    s.serviceName === serviceName ||
    s.sheetName.includes(serviceName) ||
    serviceName.includes(s.serviceName)
  );
}

/** 対応済みサービス一覧 */
export function getSupportedSheets(): ServiceSheetEntry[] {
  return SERVICE_SHEET_MAP.filter(s => s.supported);
}
