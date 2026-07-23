import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const SCP_PATH = 'C:\\Users\\FURSYS\\Downloads\\(보고서첨부)브랜드 입고가 기준 7~9월 SCP (1).xlsx';
const GRID_PATH = 'C:\\Users\\FURSYS\\Downloads\\Grid00_20260625103200.xls';
const SHEETS = ['시디즈 의자 SCP','퍼시스 의자 SCP','일룸 의자 SCP','데스커 의자 SCP'];
const BRANDS = ['시디즈','퍼시스','일룸','데스커'];
const WANTED = ['SCP계획', ...SHEETS];
const N = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; };
const fmt = n => Math.round(n).toLocaleString();

function findFixedCols(sh){
  const fc={series:0,combo:4,name:5,useType:6,stockType:7,supplier:9,price:13};
  sh.forEach((c,i)=>{const v=String(c??'').trim();
    if(v==='시리즈'||v==='계열'||v==='브랜드계열')fc.series=i;
    else if(v==='조합'||v==='조합코드')fc.combo=i;
    else if(v==='품목명'||v==='단품명'||v==='품명')fc.name=i;
    else if(v==='사용구분'||v==='사용/개발'||v==='구분')fc.useType=i;
    else if(v==='재고구분'||v==='재고/비재고'||v==='재고여부')fc.stockType=i;
    else if(v==='공급처'||v==='공급사'||v==='제조사')fc.supplier=i;
    else if(v==='브랜드공가'||v==='공가'||v==='단가'||v==='입고단가'||v==='입고 단가'||v==='기준단가')fc.price=i;});
  return fc;
}
function findMonthCols(raw, mo){
  let mr=-1; for(let ri=0;ri<Math.min(5,raw.length);ri++) if((raw[ri]||[]).some(c=>String(c??'').trim().match(/^\d+월$/))){mr=ri;break;}
  if(mr<0)return null;
  const row1=raw[mr]||[], row2=raw[mr+1]||[], label=`${mo}월`;
  let sc=-1; for(let i=0;i<row1.length;i++) if(String(row1[i]??'').trim()===label){sc=i;break;}
  if(sc<0)return null;
  let ec=row1.length; for(let i=sc+1;i<row1.length;i++) if(String(row1[i]??'').trim().match(/^\d+월$/)){ec=i;break;}
  let saleCol=-1,tgtCol=-1,prodCol=-1,prodAmtCol=-1;
  for(let i=sc;i<ec;i++){const h=String(row2[i]??'').trim();
    if(h==='판매예상량'&&saleCol<0)saleCol=i;
    if((h==='목표재고'||h==='타겟재고')&&tgtCol<0)tgtCol=i;
    if(h==='목표 입고'&&prodCol<0)prodCol=i;
    if(h==='목표입고금액'&&prodAmtCol<0)prodAmtCol=i;
    if(h==='목표생산금액'&&prodAmtCol<0)prodAmtCol=i;}
  return{saleCol,tgtCol,prodCol,prodAmtCol,startCol:sc,endCol:ec};
}

const wb = XLSX.read(readFileSync(SCP_PATH), { type:'buffer', sheets:WANTED });

// === 시디즈 시트 월 블록 구조 출력 ===
const ws0 = wb.Sheets['시디즈 의자 SCP'];
const raw0 = XLSX.utils.sheet_to_json(ws0,{header:1,defval:''});
console.log('=== 시디즈 의자 SCP row1(월)/row2(항목) 전체 ===');
console.log('row1:', (raw0[1]||[]).map((c,i)=>{const v=String(c??'').trim();return v?`[${i}]${v}`:null;}).filter(Boolean).join(' '));
console.log('row2:', (raw0[2]||[]).map((c,i)=>{const v=String(c??'').trim();return v?`[${i}]${v}`:null;}).filter(Boolean).join(' '));
console.log('\n=== 월별 컬럼 위치 (시디즈 시트) ===');
for(const mo of [7,8,9]){
  const c=findMonthCols(raw0,mo);
  console.log(`${mo}월: start=${c.startCol} end=${c.endCol} | sale=${c.saleCol} tgt재고=${c.tgtCol} 목표입고=${c.prodCol} 목표입고금액=${c.prodAmtCol}`);
}

// === 월별 합계 (전 브랜드) ===
console.log('\n=== 월별 합계 (전 브랜드, 국내 재고품목) ===');
const monthTot={};
for(let si=0;si<4;si++){
  const b=BRANDS[si], ws=wb.Sheets[SHEETS[si]]; if(!ws)continue;
  const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  let mr=-1; for(let ri=0;ri<Math.min(5,raw.length);ri++) if((raw[ri]||[]).some(c=>String(c??'').trim().match(/^\d+월$/))){mr=ri;break;}
  if(mr<0)continue;
  const fc=findFixedCols(raw[mr+1]||[]);
  for(const mo of [7,8,9]){
    const cols=findMonthCols(raw,mo); if(!cols||cols.prodCol<0)continue;
    if(!monthTot[mo])monthTot[mo]={qty:0,amt:0,amtCalc:0,cnt:0};
    for(let i=mr+2;i<raw.length;i++){
      const r=raw[i];
      if(String(r[fc.stockType]??'').trim()!=='재고')continue;
      const ut=String(r[fc.useType]??'').trim(); if(ut!=='사용'&&ut!=='개발')continue;
      const sup=String(r[fc.supplier]??'').trim();
      if(!(sup==='국내'||(b==='시디즈'?sup==='시디즈제품':sup.includes('평택'))))continue;
      if(!String(r[fc.combo]??'').trim())continue;
      const tgtProd=N(r[cols.prodCol]); const price=N(r[fc.price]);
      const amtCol=cols.prodAmtCol>=0?N(r[cols.prodAmtCol]):0;
      monthTot[mo].qty+=tgtProd; monthTot[mo].amt+=amtCol; monthTot[mo].amtCalc+=tgtProd*price; monthTot[mo].cnt++;
    }
  }
}
for(const mo of [7,8,9]){const t=monthTot[mo];
  console.log(`${mo}월: ${t.cnt}건 | 목표입고수량합=${fmt(t.qty)} | 목표입고금액합(컬럼)=${fmt(t.amt)} | 수량×단가=${fmt(t.amtCalc)}`);
}

// === 생산계획 라인별 비재고율 ===
console.log('\n=== 생산계획 라인별 비재고율 → 비재고추정 배율 ===');
const combos = new Set();
for(let si=0;si<4;si++){
  const b=BRANDS[si], ws=wb.Sheets[SHEETS[si]]; if(!ws)continue;
  const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  let mr=-1; for(let ri=0;ri<Math.min(5,raw.length);ri++) if((raw[ri]||[]).some(c=>String(c??'').trim().match(/^\d+월$/))){mr=ri;break;}
  if(mr<0)continue; const fc=findFixedCols(raw[mr+1]||[]);
  for(let i=mr+2;i<raw.length;i++){const r=raw[i];
    if(String(r[fc.stockType]??'').trim()!=='재고')continue;
    const ut=String(r[fc.useType]??'').trim(); if(ut!=='사용'&&ut!=='개발')continue;
    const sup=String(r[fc.supplier]??'').trim();
    if(!(sup==='국내'||(b==='시디즈'?sup==='시디즈제품':sup.includes('평택'))))continue;
    const c=String(r[fc.combo]??'').trim(); if(c)combos.add(c);
  }
}
const pwb = XLSX.read(readFileSync(GRID_PATH), { type:'buffer' });
const praw = XLSX.utils.sheet_to_json(pwb.Sheets[pwb.SheetNames[0]], {header:1,defval:''});
const EXCL=[]; // 앱의 EXCL 미반영(근사)
const ld={};
for(let i=1;i<praw.length;i++){const r=praw[i];
  let ln=String(r[12]??'').trim().replace('라인]',''); if(!ln)continue;
  const cd=String(r[3]??'').trim(), cl=String(r[5]??'').trim(), q=N(r[8]); const cb=`${cd}-${cl}`;
  if(!ld[ln])ld[ln]={total:0,nonScp:0};
  ld[ln].total+=q;
  if(!combos.has(cb))ld[ln].nonScp+=q;
}
Object.entries(ld).sort((a,b)=>b[1].nonScp/Math.max(b[1].total,1)-a[1].nonScp/Math.max(a[1].total,1)).forEach(([ln,d])=>{
  const ratio=d.total>0?d.nonScp/d.total*100:0;
  const mult=ratio>0&&ratio<100?(ratio/(100-ratio)):0;
  console.log(`  ${ln}: total=${fmt(d.total)} nonScp=${fmt(d.nonScp)} 비재고율=${ratio.toFixed(1)}% → 비재고추정배율=${mult.toFixed(2)}x (생산액 ${(1+mult).toFixed(2)}배)`);
});
