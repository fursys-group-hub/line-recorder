import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const SCP_PATH = 'C:\\Users\\FURSYS\\Downloads\\(보고서첨부)브랜드 입고가 기준 7~9월 SCP (1).xlsx';
const GRID_PATH = 'C:\\Users\\FURSYS\\Downloads\\Grid00_20260625103200.xls';
const SHEETS = ['시디즈 의자 SCP','퍼시스 의자 SCP','일룸 의자 SCP','데스커 의자 SCP'];
const BRANDS = ['시디즈','퍼시스','일룸','데스커'];
const WANTED = ['SCP계획', ...SHEETS];
const N = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; };
const EXCL=["A/S포장","도장(반제품)","재봉(반제품)","로비&수출포장(조립5)","리라이프","틸트(반제품)","우레탄","T30"];
const transfers=[{pattern:"6200",from:"T40-2_F",to:"벌크",expEx:true},{code:"ITY00BT00A",to:"벌크"},{code:"HCH3801H",to:"벌크"}];

function findFixedCols(sh){
  const fc={combo:4,code:2,color:3,useType:6,stockType:7,supplier:9};
  sh.forEach((c,i)=>{const v=String(c??'').trim();
    if(v==='조합'||v==='조합코드')fc.combo=i; else if(v==='단품코드')fc.code=i;
    else if(v==='단품컬러'||v==='색상')fc.color=i;
    else if(v==='사용구분'||v==='구분')fc.useType=i; else if(v==='재고구분')fc.stockType=i;
    else if(v==='공급처'||v==='공급사')fc.supplier=i;});
  return fc;
}
// SCP: 단품코드 → {색상:재고구분} 전체 (국내, 재고+비재고 모두 기록해 색상별 구분 확인)
const wb = XLSX.read(readFileSync(SCP_PATH), { type:'buffer', sheets:WANTED });
const scpByCode={};   // code -> Set(색상)  (국내 재고품목만)
const scpComboSet=new Set();
const scpAllByCode={}; // code -> {색상: 재고구분}  (사용구분 무관 전체, 색상별 재고/비재고 확인용)
for(let si=0;si<4;si++){
  const b=BRANDS[si], ws=wb.Sheets[SHEETS[si]]; if(!ws)continue;
  const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  let mr=-1; for(let ri=0;ri<5;ri++) if((raw[ri]||[]).some(c=>String(c??'').trim().match(/^\d+월$/))){mr=ri;break;}
  if(mr<0)continue; const fc=findFixedCols(raw[mr+1]||[]);
  for(let i=mr+2;i<raw.length;i++){const r=raw[i];
    const cd=String(r[fc.code]??'').trim(); if(!cd)continue;
    const cl=String(r[fc.color]??'').trim();
    const stk=String(r[fc.stockType]??'').trim();
    if(!scpAllByCode[cd])scpAllByCode[cd]={};
    scpAllByCode[cd][cl]=stk;
    const ut=String(r[fc.useType]??'').trim();
    const sup=String(r[fc.supplier]??'').trim();
    const ok = stk==='재고' && (ut==='사용'||ut==='개발') && (sup==='국내'||(b==='시디즈'?sup==='시디즈제품':sup.includes('평택')));
    if(ok){ if(!scpByCode[cd])scpByCode[cd]=new Set(); scpByCode[cd].add(cl); scpComboSet.add(String(r[fc.combo]??'').trim()); }
  }
}
// 생산계획 T50-1 라인의 매칭실패(코드는 SCP에 있음) 품목의 색상 비교
const praw = XLSX.utils.sheet_to_json(XLSX.read(readFileSync(GRID_PATH),{type:'buffer'}).Sheets[XLSX.read(readFileSync(GRID_PATH),{type:'buffer'}).SheetNames[0]],{header:1,defval:''});
const prodByCode={};
for(let i=1;i<praw.length;i++){const r=praw[i];
  let ln=String(r[12]??'').trim().replace('라인]',''); if(!ln||EXCL.includes(ln))continue;
  const cd=String(r[3]??'').trim(),cl=String(r[5]??'').trim(),q=N(r[8]),ex2=String(r[16]??'').trim();
  for(const t of transfers){if(t.pattern&&cd.includes(t.pattern)&&(!t.from||ln===t.from)){if(t.expEx&&ex2.includes('수출'))continue;ln=t.to;}if(t.code&&cd.startsWith(t.code))ln=t.to;}
  if(ln!=='T50-1')continue;
  if(!prodByCode[cd])prodByCode[cd]={};
  prodByCode[cd][cl]=(prodByCode[cd][cl]||0)+q;
}
console.log('=== T50-1: 단품코드별 색상 비교 (SCP재고색상 vs 생산계획색상) ===\n');
Object.entries(prodByCode).filter(([cd])=>scpByCode[cd]).sort((a,b)=>{
  const sa=Object.values(a[1]).reduce((s,v)=>s+v,0),sb=Object.values(b[1]).reduce((s,v)=>s+v,0);return sb-sa;
}).slice(0,8).forEach(([cd,cols])=>{
  const scpStockColors=[...(scpByCode[cd]||[])];
  const scpAll=scpAllByCode[cd]||{};
  console.log(`■ ${cd}`);
  console.log(`   SCP 재고색상: ${scpStockColors.join(', ')||'(없음)'}`);
  console.log(`   SCP 전체색상(재고구분): ${Object.entries(scpAll).map(([c,s])=>`${c}=${s}`).join(', ')}`);
  console.log(`   생산계획 색상(수량): ${Object.entries(cols).map(([c,q])=>`${c}(${q})`).join(', ')}`);
  // 생산계획 색상이 SCP 재고색상에 있나
  Object.keys(cols).forEach(c=>{
    const inStock=scpByCode[cd]&&scpByCode[cd].has(c);
    const inAll=scpAll[c];
    console.log(`     - ${c}: ${inStock?'SCP재고색상 일치✓':(inAll?`SCP에 있으나 재고구분=${inAll}`:'SCP에 이 색상 없음')}`);
  });
  console.log('');
});
