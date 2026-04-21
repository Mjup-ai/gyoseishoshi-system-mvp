import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const TEMPLATE_DIR = path.resolve(__dirname, '..', 'templates');

// 都道府県マッピング
const PREFECTURE_MAP: Record<string, string> = {
  '北海道': '北海道', '宮城県': '宮城県', '福島県': '福島県', '群馬県': '群馬県',
  '千葉県': '千葉県', '富山県': '富山県', '石川県': '石川県', '愛知県': '愛知県',
  '三重県': '三重県', '大阪府': '大阪府', '高知県': '高知県', '佐賀県': '佐賀県',
  '福岡県': '福岡県', '沖縄県': '沖縄県', '新潟県': '新潟県', '東京都': '東京都',
  '福島市': '福島県', '秋田市': '秋田県', '宇都宮市': '栃木県', '前橋市': '群馬県',
  '高崎市': '群馬県', '千葉市': '千葉県', '船橋市': '千葉県', '横浜市': '神奈川県',
  '川崎市': '神奈川県', '富山市': '富山県', '浜松市': '静岡県', '静岡市': '静岡県',
  '大阪市': '大阪府', '堺市': '大阪府', '摂津市': '大阪府', '神戸市': '兵庫県',
  '岡山市': '岡山県', '広島市': '広島県', '北九州市': '福岡県', '久留米市': '福岡県',
  '札幌市': '北海道', '仙台市': '宮城県',
};

async function main() {
  const dirs = fs.readdirSync(TEMPLATE_DIR).filter((d) => {
    const stat = fs.statSync(path.join(TEMPLATE_DIR, d));
    return stat.isDirectory() && !['mhlw', 'osaka', 'fukuoka', 'funabashi', 'kurume', 'hokkaido', 'kitakyushu', 'sapporo', 'gunma'].includes(d);
  });

  let created = 0;
  let skipped = 0;

  for (const dir of dirs) {
    const name = dir.replace(/_.*$/, ''); // 愛知県_施設外 → 愛知県
    if (name === 'download.sh' || name === 'WAM' || name === 'こども家庭庁') continue;

    const prefecture = PREFECTURE_MAP[name] || null;
    const templateFiles = fs.readdirSync(path.join(TEMPLATE_DIR, dir)).filter((f) => f.endsWith('.xlsx') || f.endsWith('.xls'));
    const templateFile = templateFiles[0] || null;

    if (!templateFile) continue;

    // Copy template to a clean name
    const cleanName = `${name}.${templateFile.split('.').pop()}`;
    const src = path.join(TEMPLATE_DIR, dir, templateFile);
    const dest = path.join(TEMPLATE_DIR, cleanName);
    if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);

    try {
      await prisma.municipality.upsert({
        where: { name },
        update: { prefecture, templateFile: cleanName },
        create: { name, prefecture, templateFile: cleanName },
      });
      created++;
      console.log(`✓ ${name} (${prefecture || '?'}) → ${cleanName}`);
    } catch (e) {
      skipped++;
      console.log(`✗ ${name}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nDone: ${created} created/updated, ${skipped} skipped`);
  await prisma.$disconnect();
}

main().catch(console.error);
