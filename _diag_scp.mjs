import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const path = 'C:\\Users\\FURSYS\\Downloads\\(보고서첨부)브랜드 입고가 기준 7~9월 SCP (1).xlsx';
const WANTED = ['SCP계획','시디즈 의자 SCP','퍼시스 의자 SCP','일룸 의자 SCP','데스커 의자 SCP'];

const buf = readFileSync(path);
const wb = XLSX.read(buf, { type: 'buffer', sheets: WANTED });

console.log('=== SheetNames ===');
console.log(wb.SheetNames);

const sheet = '시디즈 의자 SCP';
const ws = wb.Sheets[sheet];
if (!ws) { console.log('NO SHEET', sheet); process.exit(0); }
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('\n=== 시디즈 의자 SCP : 총 행수 =', raw.length);
for (let i = 0; i < Math.min(8, raw.length); i++) {
  const r = raw[i] || [];
  console.log(`\n--- row[${i}] (len=${r.length}) ---`);
  // 앞 25개 컬럼만, 인덱스와 함께
  const slice = r.slice(0, 25).map((c, idx) => `[${idx}]${String(c ?? '').trim().substring(0, 12)}`);
  console.log(slice.join(' | '));
}

// 데이터 샘플 행 (10번째 근처)
console.log('\n=== 데이터 샘플 row[5..8] 앞 18열 ===');
for (let i = 5; i < Math.min(9, raw.length); i++) {
  const r = raw[i] || [];
  console.log(`row[${i}]:`, r.slice(0, 18).map((c, idx) => `[${idx}]${String(c ?? '').trim().substring(0, 10)}`).join(' | '));
}
