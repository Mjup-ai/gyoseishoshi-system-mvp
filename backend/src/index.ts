import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
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
