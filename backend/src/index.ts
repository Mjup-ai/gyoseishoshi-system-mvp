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
