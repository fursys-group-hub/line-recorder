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
  const fc={series:0,combo:4,name:5,useType:6,stockType:7,supplier:9,price:13,code:2,color:3};
  sh.forEach((c,i)=>{const v=String(c??'').trim();
    if(v==='조합'||v==='조합코드')fc.combo=i;
    else if(v==='단품코드')fc.code=i;
    else if(v==='단품컬러'||v==='색상')fc.color=i;
    else if(v==='품목명'||v==='단품명'||v==='품명')fc.name=i;
    else if(v==='사용구분'||v==='사용/개발'||v==='구분')fc.useType=i;
    else if(v==='재고구분'||v==='재고/비재고'||v==='재고여부')fc.stockType=i;
    else if(v==='공급처'||v==='공급사'||v==='제조사')fc.supplier=i;});
  return fc;
}

const wb = XLSX.read(readFileSync(SCP_PATH), { type:'buffer', sheets:WANTED });
const combos = new Set();   // SCP 조합 (코드-색상)
const scpCodes = new Set();  // SCP 단품코드만
const scpComboParts = [];    // {code, color, combo}
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
    const c=String(r[fc.combo]??'').trim(); if(!c)continue;
    combos.add(c);
    const code=String(r[fc.code]??'').trim(), color=String(r[fc.color]??'').trim();
    scpCodes.add(code);
    scpComboParts.push({code,color,combo:c});
  }
}
console.log('SCP 조합(combo) 수:', combos.size, '| SCP 단품코드 수:', scpCodes.size);
console.log('SCP 샘플(code|color|combo):');
scpComboParts.slice(0,6).forEach(x=>console.log(`   ${x.code} | ${x.color} | ${x.combo}`));

// 생산계획 분석
const pwb = XLSX.read(readFileSync(GRID_PATH), { type:'buffer' });
const praw = XLSX.utils.sheet_to_json(pwb.Sheets[pwb.SheetNames[0]], {header:1,defval:''});
console.log('\n생산계획 샘플(품목코드[3]|색상[5]|cb):');
for(let i=1;i<7;i++){const r=praw[i]; console.log(`   ${String(r[3]??'').trim()} | ${String(r[5]??'').trim()} | ${String(r[3]??'').trim()}-${String(r[5]??'').trim()}`);}

let exactMatch=0, exactMiss=0;        // 수량
let missButCodeInScp=0, missCodeNot=0; // 매칭실패 중 코드는 SCP에 있나
const missSamples=[];
for(let i=1;i<praw.length;i++){const r=praw[i];
  const cd=String(r[3]??'').trim(), cl=String(r[5]??'').trim(), q=N(r[8]); if(!cd)continue;
  const cb=`${cd}-${cl}`;
  if(combos.has(cb)){exactMatch+=q;}
  else{
    exactMiss+=q;
    if(scpCodes.has(cd)){missButCodeInScp+=q; if(missSamples.length<12)missSamples.push(`${cb} (코드 ${cd}는 SCP재고에 있음, 색상만 불일치)`);}
    else missCodeNot+=q;
  }
}
console.log('\n=== 생산계획 수량 기준 매칭 분석 ===');
console.log(`정확매칭(재고): ${fmt(exactMatch)}`);
console.log(`매칭실패(비재고로 분류): ${fmt(exactMiss)}`);
console.log(`  └ 그중 단품코드는 SCP재고에 존재(색상표기 차이 의심): ${fmt(missButCodeInScp)}`);
console.log(`  └ 단품코드도 SCP재고에 없음(진짜 비재고/외주/반제품): ${fmt(missCodeNot)}`);
console.log(`\n색상불일치 의심 샘플:`);
missSamples.forEach(s=>console.log('   '+s));
