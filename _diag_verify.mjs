import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const SCP_PATH = 'C:\\Users\\FURSYS\\Downloads\\(보고서첨부)브랜드 입고가 기준 7~9월 SCP (1).xlsx';
const GRID_PATH = 'C:\\Users\\FURSYS\\Downloads\\Grid00_20260625103200.xls';   // 생산계획(투입)
const GRDLIST_PATH = 'C:\\Users\\FURSYS\\Downloads\\grd_list00_20260625103254.xls'; // 재고품목

const SHEETS = ['시디즈 의자 SCP','퍼시스 의자 SCP','일룸 의자 SCP','데스커 의자 SCP'];
const BRANDS = ['시디즈','퍼시스','일룸','데스커'];
const WANTED = ['SCP계획', ...SHEETS];
const N = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; };

// ===== 수정된 로직 복제 =====
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
  return{saleCol,tgtCol,prodCol,prodAmtCol};
}

const wb = XLSX.read(readFileSync(SCP_PATH), { type:'buffer', sheets:WANTED });
const allMonthItems={}, combos=new Set(), availMonths=new Set();
const perBrand={};
for(let si=0;si<4;si++){
  const b=BRANDS[si], ws=wb.Sheets[SHEETS[si]]; if(!ws)continue;
  const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  let mr=-1; for(let ri=0;ri<Math.min(5,raw.length);ri++) if((raw[ri]||[]).some(c=>String(c??'').trim().match(/^\d+월$/))){mr=ri;break;}
  if(mr<0)continue;
  const row1=raw[mr]||[], sheetMonths=[];
  for(let i=0;i<row1.length;i++){const mv=String(row1[i]??'').trim().match(/^(\d+)월$/); if(mv)sheetMonths.push(parseInt(mv[1]));}
  const dataStartRow=mr+2, fc=findFixedCols(raw[mr+1]||[]);
  perBrand[b]={};
  for(const mo of sheetMonths){
    const cols=findMonthCols(raw,mo); if(!cols||cols.prodCol<0)continue;
    availMonths.add(mo); if(!allMonthItems[mo])allMonthItems[mo]=[];
    const{saleCol,tgtCol,prodCol,prodAmtCol}=cols;
    let cnt=0;
    for(let i=dataStartRow;i<raw.length;i++){
      const r=raw[i];
      const useType=String(r[fc.useType]??'').trim(), stockType=String(r[fc.stockType]??'').trim();
      if(stockType!=='재고')continue;
      if(useType!=='사용'&&useType!=='개발')continue;
      const sup=String(r[fc.supplier]??'').trim();
      const isInhouse = sup==='국내' || (b==='시디즈'?sup==='시디즈제품':sup.includes('평택'));
      if(!isInhouse)continue;
      const c=String(r[fc.combo]??'').trim(); if(!c)continue;
      combos.add(c); cnt++;
      allMonthItems[mo].push({brand:b,combo:c,name:String(r[fc.name]??'').trim(),tgtProd:N(r[prodCol]),price:N(r[fc.price])});
    }
    perBrand[b][mo]=cnt;
  }
}
console.log('=== SCP 파싱 결과 ===');
console.log('월:', [...availMonths].sort((a,b)=>a-b));
for(const mo of [...availMonths].sort((a,b)=>a-b)) console.log(`  ${mo}월: ${allMonthItems[mo].length}건`);
console.log('브랜드×월 건수:', JSON.stringify(perBrand));
console.log('combos(조합) 고유:', combos.size, '개');
console.log('combo 샘플:', [...combos].slice(0,5));
const firstMo=[...availMonths].sort((a,b)=>a-b)[0];
console.log('단가 샘플:', allMonthItems[firstMo].slice(0,3).map(x=>`${x.combo}:price=${x.price},tgtProd=${x.tgtProd}`));

// ===== 생산계획(Grid00) combo 매칭 검증 =====
console.log('\n=== 생산계획(Grid00) 매칭 검증 ===');
const pwb = XLSX.read(readFileSync(GRID_PATH), { type:'buffer' });
const praw = XLSX.utils.sheet_to_json(pwb.Sheets[pwb.SheetNames[0]], {header:1,defval:''});
console.log('헤더행:', (praw[0]||[]).slice(0,20).map((c,i)=>`[${i}]${String(c??'').trim().substring(0,8)}`).join(' '));
let matchCnt=0, totalProd=0;
const prodCombos=new Set();
for(let i=1;i<praw.length;i++){
  const r=praw[i];
  const cd=String(r[3]??'').trim(), cl=String(r[5]??'').trim();
  if(!cd)continue;
  const cb=`${cd}-${cl}`; prodCombos.add(cb); totalProd++;
  if(combos.has(cb))matchCnt++;
}
console.log(`생산계획 행: ${totalProd}, cb 고유: ${prodCombos.size}`);
console.log(`combos.has(cb) 매칭: ${matchCnt}건  ← 0이면 분석표 비거나 전부 비재고`);
console.log('생산 cb 샘플:', [...prodCombos].slice(0,5));
