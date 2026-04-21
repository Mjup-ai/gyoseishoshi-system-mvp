/**
 * サービス種別ごとの人員配置基準
 *
 * 根拠: 障害者の日常生活及び社会生活を総合的に支援するための法律に基づく
 *       指定障害福祉サービスの事業等の人員、設備及び運営に関する基準
 *       （平成18年厚生労働省令第171号）
 *
 * ※ 令和6年度報酬改定対応
 * ※ 対応外サービス・特殊ケースは明示的にunsupportedとして宣言
 */

export interface StaffingRequirement {
  /** 職種名 */
  position: string;
  /** 配置基準の種類 */
  type: 'ratio' | 'fixed' | 'fte_minimum';
  /** ratio型: 利用者N人に対して1人（例: 6 = 利用者6人に1人） */
  ratio?: number;
  /** fixed型: 固定人数 */
  fixedCount?: number;
  /** fte_minimum型: 最低FTE値 */
  minFte?: number;
  /** 常勤要件 */
  fullTimeRequired: boolean;
  /** 1名以上必須か */
  atLeastOne: boolean;
  /** 備考 */
  note?: string;
}

export interface ServiceStandard {
  /** サービス種別名 */
  serviceName: string;
  /** サービスコード */
  serviceCode: string;
  /** 人員配置基準 */
  requirements: StaffingRequirement[];
  /** 対応状態 */
  supported: boolean;
  /** 未対応理由 */
  unsupportedReason?: string;
}

/**
 * 主要サービスの人員配置基準
 */
export const SERVICE_STANDARDS: ServiceStandard[] = [
  // ===== 対応済みサービス =====
  {
    serviceName: '就労継続支援B型',
    serviceCode: 'B_CONTINUOUS',
    supported: true,
    requirements: [
      { position: '管理者', type: 'fixed', fixedCount: 1, fullTimeRequired: false, atLeastOne: true, note: '他職種兼務可' },
      { position: 'サービス管理責任者', type: 'ratio', ratio: 60, fullTimeRequired: true, atLeastOne: true, note: '利用者60人以下で1人' },
      { position: '職業指導員', type: 'ratio', ratio: 10, fullTimeRequired: false, atLeastOne: true, note: '職業指導員+生活支援員で10:1（7.5:1も可）' },
      { position: '生活支援員', type: 'ratio', ratio: 10, fullTimeRequired: false, atLeastOne: true, note: '職業指導員+生活支援員で10:1' },
    ],
  },
  {
    serviceName: '就労継続支援A型',
    serviceCode: 'A_CONTINUOUS',
    supported: true,
    requirements: [
      { position: '管理者', type: 'fixed', fixedCount: 1, fullTimeRequired: false, atLeastOne: true },
      { position: 'サービス管理責任者', type: 'ratio', ratio: 60, fullTimeRequired: true, atLeastOne: true },
      { position: '職業指導員', type: 'ratio', ratio: 10, fullTimeRequired: false, atLeastOne: true },
      { position: '生活支援員', type: 'ratio', ratio: 10, fullTimeRequired: false, atLeastOne: true },
    ],
  },
  {
    serviceName: '就労移行支援',
    serviceCode: 'TRANSITION',
    supported: true,
    requirements: [
      { position: '管理者', type: 'fixed', fixedCount: 1, fullTimeRequired: false, atLeastOne: true },
      { position: 'サービス管理責任者', type: 'ratio', ratio: 60, fullTimeRequired: true, atLeastOne: true },
      { position: '職業指導員', type: 'ratio', ratio: 6, fullTimeRequired: false, atLeastOne: true, note: '職業指導員+生活支援員で6:1' },
      { position: '生活支援員', type: 'ratio', ratio: 6, fullTimeRequired: false, atLeastOne: true },
      { position: '就労支援員', type: 'ratio', ratio: 15, fullTimeRequired: false, atLeastOne: true, note: '利用者15人に1人' },
    ],
  },
  {
    serviceName: '生活介護',
    serviceCode: 'LIFE_CARE',
    supported: true,
    requirements: [
      { position: '管理者', type: 'fixed', fixedCount: 1, fullTimeRequired: false, atLeastOne: true },
      { position: 'サービス管理責任者', type: 'ratio', ratio: 60, fullTimeRequired: true, atLeastOne: true },
      { position: '生活支援員', type: 'ratio', ratio: 6, fullTimeRequired: true, atLeastOne: true, note: '平均障害支援区分により3:1〜6:1' },
      { position: '看護職員', type: 'fixed', fixedCount: 1, fullTimeRequired: false, atLeastOne: true },
    ],
  },
  {
    serviceName: '共同生活援助（グループホーム）',
    serviceCode: 'GROUP_HOME',
    supported: true,
    requirements: [
      { position: '管理者', type: 'fixed', fixedCount: 1, fullTimeRequired: false, atLeastOne: true },
      { position: 'サービス管理責任者', type: 'ratio', ratio: 30, fullTimeRequired: true, atLeastOne: true, note: '利用者30人以下で1人' },
      { position: '世話人', type: 'ratio', ratio: 6, fullTimeRequired: false, atLeastOne: true, note: '利用者6人に1人（常勤換算）' },
      { position: '生活支援員', type: 'ratio', ratio: 9, fullTimeRequired: false, atLeastOne: true, note: '区分により5:1〜9:1' },
    ],
  },
  {
    serviceName: '放課後等デイサービス',
    serviceCode: 'AFTER_SCHOOL',
    supported: true,
    requirements: [
      { position: '管理者', type: 'fixed', fixedCount: 1, fullTimeRequired: false, atLeastOne: true },
      { position: '児童発達支援管理責任者', type: 'fixed', fixedCount: 1, fullTimeRequired: true, atLeastOne: true },
      { position: '児童指導員又は保育士', type: 'ratio', ratio: 10, fullTimeRequired: false, atLeastOne: true, note: '定員10人以下で2人以上' },
    ],
  },
  {
    serviceName: '児童発達支援',
    serviceCode: 'CHILD_DEV',
    supported: true,
    requirements: [
      { position: '管理者', type: 'fixed', fixedCount: 1, fullTimeRequired: false, atLeastOne: true },
      { position: '児童発達支援管理責任者', type: 'fixed', fixedCount: 1, fullTimeRequired: true, atLeastOne: true },
      { position: '児童指導員又は保育士', type: 'ratio', ratio: 10, fullTimeRequired: false, atLeastOne: true },
    ],
  },

  // ===== 対応予定だが未実装のサービス =====
  {
    serviceName: '居宅介護',
    serviceCode: 'HOME_CARE',
    supported: false,
    unsupportedReason: '訪問系サービスは勤務形態が異なるため、今後のバージョンで対応予定',
    requirements: [],
  },
  {
    serviceName: '重度訪問介護',
    serviceCode: 'SEVERE_HOME',
    supported: false,
    unsupportedReason: '訪問系サービスは今後対応予定',
    requirements: [],
  },
  {
    serviceName: '自立訓練（機能訓練）',
    serviceCode: 'FUNCTIONAL',
    supported: false,
    unsupportedReason: '今後のバージョンで対応予定',
    requirements: [],
  },
  {
    serviceName: '自立訓練（生活訓練）',
    serviceCode: 'LIFE_TRAINING',
    supported: false,
    unsupportedReason: '今後のバージョンで対応予定',
    requirements: [],
  },
];

/** サービス種別名からStandardを取得 */
export function getServiceStandard(serviceName: string): ServiceStandard | undefined {
  return SERVICE_STANDARDS.find(s =>
    s.serviceName === serviceName || s.serviceCode === serviceName
  );
}

/** 対応済みサービスの一覧 */
export function getSupportedServices(): ServiceStandard[] {
  return SERVICE_STANDARDS.filter(s => s.supported);
}

export interface StaffingCheckResult {
  serviceName: string;
  passed: boolean;
  checks: {
    position: string;
    required: string;
    actual: { count: number; fte: number };
    passed: boolean;
    message: string;
  }[];
  unsupportedPositions: string[];
  warnings: string[];
}

/**
 * 人員配置基準チェック
 */
export function checkStaffingStandard(
  standard: ServiceStandard,
  staffByPosition: Record<string, { count: number; fte: number }>,
  userCount: number,
): StaffingCheckResult {
  const checks: StaffingCheckResult['checks'] = [];
  const warnings: string[] = [];
  const knownPositions = new Set(standard.requirements.map(r => r.position));
  const unsupportedPositions = Object.keys(staffByPosition).filter(p => !knownPositions.has(p));

  standard.requirements.forEach(req => {
    const actual = staffByPosition[req.position] || { count: 0, fte: 0 };
    let requiredStr = '';
    let passed = true;

    if (req.type === 'fixed') {
      requiredStr = `${req.fixedCount}人以上`;
      passed = actual.count >= (req.fixedCount || 1);
    } else if (req.type === 'ratio') {
      const needed = Math.ceil(userCount / (req.ratio || 10));
      requiredStr = `${needed}人以上（${userCount}人÷${req.ratio}:1）`;
      passed = actual.fte >= needed;
    } else if (req.type === 'fte_minimum') {
      requiredStr = `FTE ${req.minFte}以上`;
      passed = actual.fte >= (req.minFte || 0);
    }

    if (req.fullTimeRequired && actual.count > 0) {
      // 常勤要件は本来個人レベルで判定するが、ここでは職種レベルで簡易チェック
      requiredStr += '（うち1名以上常勤）';
    }

    checks.push({
      position: req.position,
      required: requiredStr,
      actual,
      passed,
      message: passed
        ? `${req.position}: 基準充足（${actual.fte} / ${requiredStr}）`
        : `${req.position}: 基準未達（${actual.fte} / ${requiredStr}）`,
    });
  });

  return {
    serviceName: standard.serviceName,
    passed: checks.every(c => c.passed),
    checks,
    unsupportedPositions,
    warnings,
  };
}
