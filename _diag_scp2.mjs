import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const WANTED = ['SCP계획','시디즈 의자 SCP','퍼시스 의자 SCP','일룸 의자 SCP','데스커 의자 SCP'];

function analyze(path, label) {
  console.log(`\n\n######## ${label} ########`);
  console.log(path);
  let wb;
  try { wb = XLSX.read(readFileSync(path), { type: 'buffer', sheets: WANTED }); }
  catch (e) { console.log('READ ERROR', e.message); return; }
  console.log('Sheets:', wb.SheetNames.filter(s => WANTED.includes(s)));

  for (const sheet of ['시디즈 의자 SCP','퍼시스 의자 SCP','일룸 의자 SCP','데스커 의자 SCP']) {
    const ws = wb.Sheets[sheet];
    if (!ws) { console.log(`\n[${sheet}] 없음`); continue; }
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    // 월 헤더행 찾기
    let mr = -1;
    for (let i = 0; i < Math.min(5, raw.length); i++)
      if ((raw[i]||[]).some(c => String(c??'').trim().match(/^\d+월$/))) { mr = i; break; }
    const supplierVals = {}, useVals = {}, stockVals = {};
    const dataStart = mr + 2;
    for (let i = dataStart; i < raw.length; i++) {
      const r = raw[i] || [];
      const sup = String(r[9]??'').trim();
      const use = String(r[6]??'').trim();
      const stk = String(r[7]??'').trim();
      if (sup) supplierVals[sup] = (supplierVals[sup]||0)+1;
      if (use) useVals[use] = (useVals[use]||0)+1;
      if (stk) stockVals[stk] = (stockVals[stk]||0)+1;
    }
    console.log(`\n[${sheet}] 월헤더행=${mr}, 데이터시작=${dataStart}, 총행=${raw.length}`);
    console.log('  공급처(9):', JSON.stringify(supplierVals));
    console.log('  사용구분(6):', JSON.stringify(useVals));
    console.log('  재고구분(7):', JSON.stringify(stockVals));
  }
}

analyze('C:\\Users\\FURSYS\\Downloads\\(보고서첨부)브랜드 입고가 기준 7~9월 SCP (1).xlsx', '신규 7~9월 (안나옴)');
analyze('C:\\Users\\FURSYS\\Downloads\\(보고서첨부)입고가 기준 6~8월 SCP.xlsx', '구버전 6~8월 (작동했던것?)');
