import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

const TEMPLATE_DIR = path.resolve(__dirname, '..', 'templates');
if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: TEMPLATE_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ['.xlsx', '.xls'].includes(ext));
  },
});

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'gyoseishoshi-backend' });
});

// === 自治体 ===

// 一覧
app.get('/api/municipalities', async (_req, res) => {
  const items = await prisma.municipality.findMany({ orderBy: { name: 'asc' } });
  res.json({ items });
});

// 作成
app.post('/api/municipalities', async (req, res) => {
  const { name, prefecture, notes } = req.body;
  if (!name) return res.status(400).json({ error: '自治体名は必須です' });
  const item = await prisma.municipality.create({ data: { name, prefecture, notes } });
  res.json(item);
});

// テンプレアップロード
app.post('/api/municipalities/:id/template', upload.single('template'), async (req, res) => {
  const id = String(req.params.id);
  if (!req.file) return res.status(400).json({ error: 'ファイルが必要です' });
  const item = await prisma.municipality.update({
    where: { id },
    data: { templateFile: req.file.filename },
  });
  res.json(item);
});

// 出力マッピング更新
app.put('/api/municipalities/:id/mapping', async (req, res) => {
  const id = String(req.params.id);
  const { outputMapping } = req.body;
  const item = await prisma.municipality.update({
    where: { id },
    data: { outputMapping: JSON.stringify(outputMapping) },
  });
  res.json(item);
});

// テンプレ解析（セル位置自動検出）
app.post('/api/municipalities/:id/detect-mapping', async (req, res) => {
  const id = String(req.params.id);
  const muni = await prisma.municipality.findUnique({ where: { id } });
  if (!muni?.templateFile) return res.status(404).json({ error: 'テンプレートが未登録です' });
  const filePath = path.join(TEMPLATE_DIR, muni.templateFile);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'ファイルが見つかりません' });

  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const ws = workbook.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'シートが見つかりません' });

    const PATTERNS: Record<string, RegExp> = {
      name: /氏名|名前|従業者名|職員名/,
      position: /職種|資格名|職名|役職/,
      weeklyHours: /週.*時間|勤務時間|所定.*時間|労働時間/,
      fte: /常勤換算|換算|FTE/i,
      employmentType: /常勤.*非常勤|勤務形態|雇用形態|常勤区分/,
      qualification: /資格|免許/,
      dedicatedOrConcurrent: /専従.*兼務|専任.*兼任|専従|兼務/,
    };

    const detected: Record<string, { column: string; row: number; value: string }> = {};
    let headerRow = 0;

    for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
      const row = ws.getRow(r);
      let matchCount = 0;
      row.eachCell({ includeEmpty: false }, (cell: any, col: number) => {
        const val = String(cell.value ?? '').trim();
        if (!val) return;
        let letter = '';
        let c = col;
        while (c > 0) { const mod = (c - 1) % 26; letter = String.fromCharCode(65 + mod) + letter; c = Math.floor((c - 1) / 26); }
        for (const [field, pat] of Object.entries(PATTERNS)) {
          if (pat.test(val) && !detected[field]) {
            detected[field] = { column: letter, row: r, value: val };
            matchCount++;
          }
        }
      });
      if (matchCount >= 2 && !headerRow) headerRow = r;
    }

    const columns: Record<string, string> = {};
    for (const [f, info] of Object.entries(detected)) columns[f] = info.column;

    const required = ['name', 'position', 'fte'];
    const confidence = required.filter(f => columns[f]).length / required.length;

    const mapping = {
      name: muni.name,
      sheet: ws.name || 'Sheet1',
      staffStartRow: headerRow ? headerRow + 1 : 3,
      columns,
    };

    // 自動保存（confidence > 0.5の場合）
    if (confidence > 0.5) {
      await prisma.municipality.update({
        where: { id },
        data: { outputMapping: JSON.stringify(mapping) },
      });
    }

    res.json({ mapping, confidence, detected, headerRow, autoSaved: confidence > 0.5 });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// テンプレ注入API（サーバー側でexceljsを使い、スタイル保持）
app.post('/api/municipalities/:id/export', express.json({ limit: '5mb' }), async (req, res) => {
  const id = String(req.params.id);
  const muni = await prisma.municipality.findUnique({ where: { id } });
  if (!muni?.templateFile) return res.status(404).json({ error: 'テンプレートが未登録です' });
  const filePath = path.join(TEMPLATE_DIR, muni.templateFile);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'テンプレートファイルが見つかりません' });

  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const { staff, schedule, confirmed, facilityName, year, month, sheetName, serviceCode, dataStartRow: customDataStart } = req.body;

    // シート選択（サービスコード→シート名マッピング）
    const SHEET_MAP: Record<string, { sheet: string; dataStart: number }> = {
      'GENERIC': { sheet: '勤務形態一覧表（汎用）', dataStart: 11 },
      'HOME_CARE': { sheet: '勤務形態一覧表（居宅介護）', dataStart: 11 },
      'SEVERE_HOME': { sheet: '勤務形態一覧表（重度訪問介護）', dataStart: 11 },
      'ACCOMPANY': { sheet: '勤務形態一覧表（同行援護）', dataStart: 11 },
      'BEHAVIOR': { sheet: '勤務形態一覧表（行動援護）', dataStart: 11 },
      'MEDICAL_CARE': { sheet: '勤務形態一覧表（療養介護）', dataStart: 11 },
      'LIFE_CARE': { sheet: '勤務形態一覧表（生活介護）', dataStart: 11 },
      'FUNCTIONAL': { sheet: '勤務形態一覧表（機能訓練）', dataStart: 11 },
      'LIFE_TRAINING': { sheet: '勤務形態一覧表（生活訓練）', dataStart: 11 },
      'TRANSITION': { sheet: '勤務形態一覧表（就労移行支援）', dataStart: 11 },
      'A_B_CONTINUOUS': { sheet: '勤務形態一覧表（就労継続支援A型・B型）', dataStart: 11 },
      'RETENTION': { sheet: '勤務形態一覧表（就労定着支援）', dataStart: 11 },
      'INDEPENDENT': { sheet: '勤務形態一覧表（自立生活援助）', dataStart: 11 },
      'GH_INCLUSIVE': { sheet: '勤務形態一覧表（共同生活援助・介護サービス包括型）', dataStart: 11 },
      'GH_EXTERNAL': { sheet: '勤務形態一覧表（共同生活援助・外部サービス利用型）', dataStart: 11 },
      'GH_DAYTIME': { sheet: '勤務形態一覧表（共同生活援助・日中サービス支援型', dataStart: 11 },
      'FACILITY': { sheet: '勤務形態一覧表（障害者支援施設）', dataStart: 11 },
      'GENERAL_CONSULT': { sheet: '勤務形態一覧表（一般相談支援）', dataStart: 11 },
      'SPECIFIC_CONSULT': { sheet: '勤務形態一覧（特定相談支援・障害児相談支援）', dataStart: 11 },
      'CHILD_AFTER_SCHOOL': { sheet: '勤務形態一覧表（児童発達支援・放課後デイサービス）', dataStart: 12 },
      'CHILD_SEVERE': { sheet: '勤務形態一覧表（児童発達支援・主として重症心身障害児）', dataStart: 12 },
      'CHILD_CENTER': { sheet: '勤務形態一覧表（児童発達支援センター）', dataStart: 12 },
      'CHILD_HOME_VISIT': { sheet: '勤務形態一覧表（居宅訪問型児童発達支援）', dataStart: 11 },
      'CHILD_NURSERY_VISIT': { sheet: '勤務形態一覧表（保育所等訪問支援）', dataStart: 11 },
      'CHILD_WELFARE_FACILITY': { sheet: '勤務形態一覧表（福祉型障害児入所施設）', dataStart: 11 },
      'CHILD_MEDICAL_FACILITY': { sheet: '勤務形態一覧表（医療型障害児入所施設）', dataStart: 11 },
    };

    const mapped = serviceCode ? SHEET_MAP[serviceCode] : null;
    const targetSheetName = sheetName || mapped?.sheet;
    const dataStart = customDataStart || mapped?.dataStart || 11;

    let ws = targetSheetName ? workbook.getWorksheet(targetSheetName) : null;
    if (!ws) ws = workbook.worksheets.find((s: any) => s.name.includes('汎用'));
    if (!ws) ws = workbook.worksheets.find((s: any) => s.name.includes('勤務形態'));
    if (!ws) ws = workbook.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'シートが見つかりません' });

    // 年月
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;
    ws.getCell('M2').value = y;
    ws.getCell('S2').value = m;
    if (facilityName) ws.getCell('AI2').value = facilityName;

    // スケジュールマップ
    const SHIFT_HOURS: Record<string, number> = { '日勤': 8, '夜勤': 16, '早出': 7, '遅出': 9, '半日': 4, '休み': 0, '有給': 0, '公休': 0 };
    const scheduleMap: Record<string, Record<string, any>> = {};
    (schedule || []).forEach((e: any) => {
      if (!scheduleMap[e.staffId]) scheduleMap[e.staffId] = {};
      scheduleMap[e.staffId][e.date] = e;
    });

    // 全シートの共有数式をクリア（exceljsのShared Formula競合回避）
    ws.eachRow({ includeEmpty: false }, (row: any) => {
      row.eachCell({ includeEmpty: false }, (cell: any) => {
        if (cell._value && cell._value.model && cell._value.model.sharedFormula) {
          const result = cell._value.model.result;
          delete cell._value.model.sharedFormula;
          cell._value.model.type = 2;
          cell.value = result || 0;
        }
      });
    });

    // データ注入（dataStart〜dataStart+19, 1-indexed）
    const usedSheetName = ws.name;
    const filledItems = ['No.', '氏名', '職種', '勤務形態', '日別勤務時間', '勤務時間合計', '週平均勤務時間', '年月', '事業所名'];
    const manualItems = ['資格', '兼務状況', '記載期間', '予定/実績の別', '常勤の勤務すべき時間数'];

    (staff || []).forEach((s: any, index: number) => {
      if (index >= 20) return;
      const row = dataStart + index;

      ws.getCell(`A${row}`).value = index + 1;
      ws.getCell(`B${row}`).value = s.position || '';
      const empType = s.employmentType?.includes('非常勤') ? 'C' : s.isDedicated === false ? 'B' : 'A';
      ws.getCell(`C${row}`).value = empType;
      ws.getCell(`D${row}`).value = s.qualification || '';
      ws.getCell(`E${row}`).value = s.name;

      // 日ごとの勤務時間
      const staffSched = scheduleMap[s.id] || {};
      let dayIndex = 0;
      Object.values(staffSched).forEach((entry: any) => {
        if (dayIndex >= 31) return;
        const col = 6 + dayIndex; // F=6 (1-indexed)
        const hours = entry.actualHours ?? SHIFT_HOURS[entry.shiftType] ?? 0;
        if (hours > 0) {
          ws.getCell(row, col).value = hours;
        }
        dayIndex++;
      });

      // 合計・週平均（共有数式をクリアしてから値を入れる）
      const conf = confirmed?.[s.id];
      if (conf) {
        const akCell = ws.getCell(`AK${row}`);
        akCell.value = conf.weeklyHours * 4;
        delete (akCell as any).sharedFormula;
        const alCell = ws.getCell(`AL${row}`);
        alCell.value = conf.weeklyHours;
        delete (alCell as any).sharedFormula;
      }
    });

    // バッファとして返す
    const buffer = await workbook.xlsx.writeBuffer();
    // メタ情報をヘッダーに含める
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(muni.name + '_勤務体制一覧.xlsx')}`);
    res.setHeader('X-Sheet-Used', encodeURIComponent(usedSheetName));
    res.setHeader('X-Auto-Filled', encodeURIComponent(filledItems.join(',')));
    res.setHeader('X-Manual-Required', encodeURIComponent(manualItems.join(',')));
    res.setHeader('X-Staff-Count', String((staff || []).length));
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error('Export error:', e);
    res.status(500).json({ error: String(e) });
  }
});

// テンプレダウンロード
app.get('/api/municipalities/:id/template/download', async (req, res) => {
  const id = String(req.params.id);
  const muni = await prisma.municipality.findUnique({ where: { id } });
  if (!muni?.templateFile) return res.status(404).json({ error: 'テンプレートが未登録です' });
  const filePath = path.join(TEMPLATE_DIR, muni.templateFile);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'ファイルが見つかりません' });
  res.download(filePath);
});

// 削除
app.delete('/api/municipalities/:id', async (req, res) => {
  await prisma.municipality.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// === 施設 ===

// 一覧
app.get('/api/facilities', async (_req, res) => {
  const items = await prisma.facility.findMany({ orderBy: { name: 'asc' } });
  res.json({ items });
});

// 作成
app.post('/api/facilities', async (req, res) => {
  const { name, facilityType, inputMapping, notes } = req.body;
  if (!name) return res.status(400).json({ error: '施設名は必須です' });
  const item = await prisma.facility.create({
    data: { name, facilityType, inputMapping: inputMapping ? JSON.stringify(inputMapping) : null, notes },
  });
  res.json(item);
});

// 入力マッピング更新
app.put('/api/facilities/:id/mapping', async (req, res) => {
  const id = String(req.params.id);
  const { inputMapping } = req.body;
  const item = await prisma.facility.update({
    where: { id },
    data: { inputMapping: JSON.stringify(inputMapping) },
  });
  res.json(item);
});

// 削除
app.delete('/api/facilities/:id', async (req, res) => {
  await prisma.facility.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// === 変換履歴 ===

app.get('/api/conversions', async (_req, res) => {
  const items = await prisma.conversion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { municipality: true, facility: true },
  });
  res.json({ items });
});

app.post('/api/conversions', async (req, res) => {
  const { municipalityId, facilityId, inputFileName, outputFileName, staffCount, totalFte, warnings, status } = req.body;
  const item = await prisma.conversion.create({
    data: {
      municipalityId,
      facilityId,
      inputFileName,
      outputFileName,
      staffCount,
      totalFte,
      warnings: warnings ? JSON.stringify(warnings) : null,
      status: status || 'completed',
    },
  });
  res.json(item);
});

app.listen(PORT, () => {
  console.log(`Gyoseishoshi backend listening at http://localhost:${PORT}`);
});
