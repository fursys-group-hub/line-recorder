

// ── 상수 ──
const SHEETS=["시디즈 의자 SCP","퍼시스 의자 SCP","일룸 의자 SCP","데스커 의자 SCP"];
const BRANDS=["시디즈","퍼시스","일룸","데스커"];
const EXCL=["A/S포장","도장(반제품)","재봉(반제품)","로비&수출포장(조립5)","리라이프","틸트(반제품)","우레탄","T30"];
const ALLLINES=["TC13(조립5)","벌크","도장(외부출고)","T40-2_F","T40_FKD","T80","T50-2","T50-1","T55","M02","후레임2","후레임3","플라이트","가죽","부품포장","신제품","(직접입력)"];

// ── 상태 ──
let parsed={};
let transfers=[
  {pattern:"6200",from:"T40-2_F",to:"벌크",expEx:true,label:"내수6200→벌크(수출제외)"},
  {code:"ITY00BT00A",to:"벌크",label:"비토스터디→벌크"},
  {code:"HCH3801H",to:"벌크",label:"비토헤드→벌크"}
];
let extras=[];
let lineCapa={  // 라인별 CAPA 기본값
  "TC13(조립5)":350,"벌크":250,"도장(외부출고)":200,
  "T40-2_F":150,"T40_FKD":100,"T80":100,
  "T50-2":150,"T50-1":100,"T55":80,
  "M02":150,"후레임2":150,"후레임3":150,
  "플라이트":50,"가죽":50,"부품포장":200
};
let forceStockPatterns=["G20"];  // 재고 강제 지정 패턴
let subCompanies=[
  {name:"지후산업",color:"#16a34a",lines:["T40-2_F","T40_FKD","T80","T50-2","T50-1","T55","가죽","신제품"]},
  {name:"태정산업",color:"#dc2626",lines:["부품포장","벌크","플라이트"]},
  {name:"정도산업",color:"#2563eb",lines:["도장(외부출고)","TC13(조립5)","후레임2","후레임3","M02"]}
];
let manualLineMap={};
let manualNsRatio={};  // 라인별 수기 비재고율(%). 비어있으면 생산실적 자동(pProd ratio) 사용
function setManualNs(line,val){
  const v=String(val).trim();
  if(v===''||isNaN(Number(v)))delete manualNsRatio[line];
  else manualNsRatio[line]=Math.max(0,Math.min(100,Number(v)));
}
let unmappedItems=[];
let resultData=null;
let currentTab='result';
let lastAnalysis=null;
let files={scp:'',grd:'',prod:''};
let lastShareData=null;  // 파일명 추적

// ── 유틸 ──
const N=v=>{const n=parseFloat(String(v??"").replace(/,/g,""));return isNaN(n)?0:n};
const F=n=>Math.round(n).toLocaleString();
const D=n=>n.toFixed(1);
const DC=(v,t=10)=>v<-t?"#dc2626":v>t?"#16a34a":"inherit";

// ── UI 초기화 ──
function toggleCfg(){const p=document.getElementById('cfg-panel');p.classList.toggle('show');document.getElementById('guide-panel').classList.remove('show');if(p.classList.contains('show'))renderCapa();}
function toggleGuide(){document.getElementById('guide-panel').classList.toggle('show');document.getElementById('cfg-panel').classList.remove('show');}

function renderTransfers(){
  document.getElementById('transfer-list').innerHTML=transfers.map((t,i)=>
    `<div style="margin-bottom:6px;display:flex;align-items:center;gap:6px">
      <span class="pill">${t.label}</span>
      <button class="del" onclick="transfers.splice(${i},1);renderTransfers()">✕</button>
    </div>`).join('');
}

function addTransfer(){
  const p=document.getElementById('tr-pattern')?.value.trim();
  const to=document.getElementById('tr-to')?.value.trim();
  if(p&&to){transfers.push({pattern:p,to,label:`${p}→${to}`});renderTransfers();}
}

function addTransferInline(){
  const p=document.getElementById('tr-pattern').value.trim();
  const to=document.getElementById('tr-to').value.trim();
  if(!p||!to){showError('코드 패턴과 이관 라인을 모두 입력해주세요.');return;}
  transfers.push({pattern:p,to,label:`${p}→${to}`});
  document.getElementById('tr-pattern').value='';
  document.getElementById('tr-to').value='';
  renderTransfers();
}

function renderForceStock(){
  document.getElementById('force-stock-list').innerHTML=forceStockPatterns.map((p,i)=>
    `<div style="margin-bottom:6px;display:flex;align-items:center;gap:6px">
      <span class="pill" style="background:#dbeafe;color:#1e40af">${p} → 재고로 처리</span>
      <button class="del" onclick="forceStockPatterns.splice(${i},1);renderForceStock()">✕</button>
    </div>`).join('');
}
function addForceStock(){
  const p=document.getElementById('fs-pattern').value.trim();
  if(!p){showError('코드 패턴을 입력해주세요.');return;}
  forceStockPatterns.push(p);
  document.getElementById('fs-pattern').value='';
  renderForceStock();
}
function renderNsTop10(){
  const el=document.getElementById('nonstock-top10');
  if(!el)return;
  if(!parsed.prod||!parsed.prod._nsItems){
    el.innerHTML='<span style="color:#888">③ 생산계획 파일 업로드 후 표시됩니다</span>';return;
  }
  const ns=parsed.prod._nsItems;
  const sorted=Object.entries(ns).map(([cb,v])=>({...v,combo:cb})).sort((a,b)=>b.qty-a.qty).slice(0,10);
  if(sorted.length===0){el.innerHTML='<span style="color:#16a34a">비재고 품목 없음</span>';return;}
  el.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:#fef2f2">
      <th style="padding:3px 4px;text-align:left">#</th>
      <th style="padding:3px 4px;text-align:left">라인</th>
      <th style="padding:3px 4px;text-align:left">단품코드</th>
      <th style="padding:3px 4px;text-align:left">색상</th>
      <th style="padding:3px 4px;text-align:right">수량</th>
      <th style="padding:3px 4px"></th>
    </tr></thead>
    <tbody>${sorted.map((it,i)=>`<tr style="border-bottom:1px solid #f0ede5">
      <td style="padding:3px 4px;color:#888">${i+1}</td>
      <td style="padding:3px 4px">${it.line}</td>
      <td style="padding:3px 4px;font-weight:600">${it.code}</td>
      <td style="padding:3px 4px">${it.color}</td>
      <td style="padding:3px 4px;text-align:right;color:#be185d;font-weight:600">${F(it.qty)}</td>
      <td style="padding:3px 4px"><button style="font-size:10px;padding:1px 6px;border:1px solid #93c5fd;border-radius:4px;background:#eff6ff;color:#1e40af;cursor:pointer" onclick="forceStockPatterns.push('${it.code}');renderForceStock();renderNsTop10()">재고지정</button></td>
    </tr>`).join('')}</tbody>
  </table>
  <div style="font-size:10px;color:#888;margin-top:4px">※ 전월 투입 기준 · 재고 강제 지정 패턴 제외 후 집계</div>`;
}
renderForceStock();

function renderSubCoConfig(){
  const lines=ALLLINES.filter(l=>l!=='(직접입력)');
  const el=document.getElementById('subco-config');
  if(!el)return;
  el.innerHTML=subCompanies.map((sc,si)=>`
    <div style="margin-bottom:12px;padding:10px;border:1px solid ${sc.color}33;border-radius:8px;background:${sc.color}08">
      <div style="font-weight:700;color:${sc.color};margin-bottom:6px;font-size:13px">
        <span style="display:inline-block;width:10px;height:10px;background:${sc.color};border-radius:2px;margin-right:4px"></span>
        ${sc.name}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${lines.map(l=>{
          const checked=sc.lines.includes(l);
          return `<label style="font-size:11px;display:flex;align-items:center;gap:2px;cursor:pointer;padding:2px 6px;border-radius:4px;border:1px solid ${checked?sc.color+'88':'#ddd'};background:${checked?sc.color+'15':'#fff'}">
            <input type="checkbox" ${checked?'checked':''} onchange="toggleSubCoLine(${si},'${l.replace(/'/g,"\\'")}',this.checked)" style="width:11px;height:11px">
            ${l}
          </label>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}
function toggleSubCoLine(si,line,checked){
  if(checked){
    subCompanies.forEach((sc,i)=>{if(i!==si)sc.lines=sc.lines.filter(l=>l!==line);});
    if(!subCompanies[si].lines.includes(line))subCompanies[si].lines.push(line);
  }else{
    subCompanies[si].lines=subCompanies[si].lines.filter(l=>l!==line);
  }
  renderSubCoConfig();
}
renderSubCoConfig();

function saveCapa(){
  const now=new Date();
  const label=`${now.getFullYear()}.${(now.getMonth()+1+'').padStart(2,'0')}.${(now.getDate()+'').padStart(2,'0')} ${(now.getHours()+'').padStart(2,'0')}:${(now.getMinutes()+'').padStart(2,'0')}`;
  // 현재 CAPA 값 수집
  const current={};
  const currentNs={};
  const lines=ALLLINES.filter(l=>l!=='(직접입력)');
  for(const l of lines){
    const v=lineCapa[l]||0;
    if(v>0)current[l]=v;
    if(manualNsRatio[l]!=null&&!isNaN(manualNsRatio[l]))currentNs[l]=manualNsRatio[l];
  }
  // 저장 목록 가져오기
  let saved=[];
  try{saved=JSON.parse(localStorage.getItem('scp_capa_history')||'[]');}catch(e){}
  saved.unshift({label,data:current,ns:currentNs,ts:now.toISOString()});
  if(saved.length>10)saved=saved.slice(0,10);  // 최대 10개
  localStorage.setItem('scp_capa_history',JSON.stringify(saved));
  const st=document.getElementById('capa-save-status');
  if(st){st.textContent=`✓ "${label}" 저장됨`;st.style.color='#16a34a';}
  renderCapaHistory();
}

function loadCapa(idx){
  let saved=[];
  try{saved=JSON.parse(localStorage.getItem('scp_capa_history')||'[]');}catch(e){}
  if(idx===undefined){
    // 목록 표시
    renderCapaHistory();
    return;
  }
  const entry=saved[idx];
  if(!entry)return;
  // CAPA 값 복원
  const lines=ALLLINES.filter(l=>l!=='(직접입력)');
  for(const l of lines)lineCapa[l]=entry.data[l]||0;
  // 비재고율(수기) 복원
  manualNsRatio={};
  if(entry.ns)for(const l of lines)if(entry.ns[l]!=null&&!isNaN(entry.ns[l]))manualNsRatio[l]=entry.ns[l];
  renderCapa();
  const st=document.getElementById('capa-save-status');
  if(st){st.textContent=`✓ "${entry.label}" 불러옴`;st.style.color='#2563eb';}
}

function deleteCapaHistory(idx){
  let saved=[];
  try{saved=JSON.parse(localStorage.getItem('scp_capa_history')||'[]');}catch(e){}
  saved.splice(idx,1);
  localStorage.setItem('scp_capa_history',JSON.stringify(saved));
  renderCapaHistory();
}

function renderCapaHistory(){
  const el=document.getElementById('capa-saved-list');
  if(!el)return;
  let saved=[];
  try{saved=JSON.parse(localStorage.getItem('scp_capa_history')||'[]');}catch(e){}
  if(saved.length===0){el.innerHTML='<div style="font-size:11px;color:#888">저장된 CAPA 이력이 없습니다.</div>';return;}
  el.innerHTML=`<div style="font-size:11px;color:#888;margin-bottom:4px">저장된 CAPA (최대 10개, 최신순):</div>`+
    saved.map((s,i)=>{
      const summary=Object.entries(s.data).map(([k,v])=>`${k}:${v}`).join(', ');
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:4px 8px;background:#f5f5f0;border-radius:6px">
        <span style="font-size:11px;font-weight:600;color:#333;min-width:110px">${s.label}</span>
        <span style="font-size:10px;color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${summary}</span>
        <button style="font-size:10px;padding:2px 8px;border:1px solid #93c5fd;border-radius:4px;background:#eff6ff;color:#1e40af;cursor:pointer" onclick="loadCapa(${i})">불러오기</button>
        <button style="font-size:10px;padding:2px 6px;border:1px solid #fca5a5;border-radius:4px;background:#fef2f2;color:#dc2626;cursor:pointer" onclick="deleteCapaHistory(${i})">✕</button>
      </div>`;
    }).join('');
}
renderCapaHistory();

function renderExtras(){
  const months=(parsed.scp&&parsed.scp.months)?parsed.scp.months:[5,6,7];
  document.getElementById('extra-list').innerHTML=extras.map((ex,i)=>`
    <div class="extra-row">
      <select class="einp" style="width:120px" onchange="extras[${i}].line=this.value">
        <option value="">라인 선택</option>
        ${ALLLINES.filter(l=>l!=='(직접입력)').map(l=>`<option ${ex.line===l?"selected":""}>${l}</option>`).join('')}
      </select>
      <select class="einp" style="width:70px" onchange="extras[${i}].month=Number(this.value)">
        <option value="0" ${!ex.month?'selected':''}>전체</option>
        ${months.map(m=>`<option value="${m}" ${ex.month===m?'selected':''}>${m}월</option>`).join('')}
      </select>
      <input class="einp" style="width:65px" type="number" placeholder="수량" value="${ex.qty||''}" oninput="extras[${i}].qty=Number(this.value)">
      <input class="einp" style="width:55px" placeholder="브랜드" value="${ex.brand||''}" oninput="extras[${i}].brand=this.value">
      <input class="einp" style="width:80px" placeholder="시리즈" value="${ex.series||''}" oninput="extras[${i}].series=this.value">
      <input class="einp" style="flex:1" placeholder="비고 (예: 퍼시스 대량건)" value="${ex.label||''}" oninput="extras[${i}].label=this.value">
      <button class="del" onclick="extras.splice(${i},1);renderExtras()">✕</button>
    </div>`).join('');
}

function addExtra(){extras.push({line:"",month:0,qty:0,brand:"",series:"",label:""});renderExtras();}

function renderCapa(){
  const lines=ALLLINES.filter(l=>l!=='(직접입력)');
  const autoNs=l=>{const pd=parsed.prod&&parsed.prod[l];return pd&&pd.ratio!=null?Math.round(pd.ratio):null;};
  document.getElementById('capa-list').innerHTML=`
    <div style="display:flex;gap:8px;font-size:10px;color:#888;margin-bottom:4px;padding-left:96px">
      <span style="width:60px;text-align:center">일CAPA</span><span style="width:62px;text-align:center">비재고율%</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px 16px">
      ${lines.map(l=>{
        const an=autoNs(l), ek=l.replace(/'/g,"\\'");
        return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px">
        <span style="font-size:11px;color:#555;width:90px;text-align:right">${l}</span>
        <input class="einp" type="number" style="width:60px;font-size:12px" value="${lineCapa[l]||''}" placeholder="0"
          oninput="lineCapa['${ek}']=Number(this.value)" title="일 생산능력(개)">
        <input class="einp" type="number" min="0" max="100" style="width:62px;font-size:12px" value="${manualNsRatio[l]??''}"
          placeholder="${an!=null?an+' 자동':'자동'}"
          oninput="setManualNs('${ek}',this.value)" title="비재고율(%). 비우면 생산실적 자동 적용, 입력 시 해당 라인 수기 적용 — 생산액 추정에 반영">
      </div>`;}).join('')}
    </div>
    <div style="font-size:10px;color:#888;margin-top:6px">※ 비재고율: 비우면 생산실적(생산계획) 자동값 적용, 숫자 입력 시 그 라인만 수기 적용. 생산 예상액 추정에 반영됩니다.</div>`;
}
renderCapa();

// ── Supabase 공유 (Vercel API 프록시 경유) ──
const API_BASE=location.origin+'/api/share';

async function shareResult(){
  if(!lastShareData){showError('먼저 분석을 실행하세요');return;}
  const btn=document.getElementById('share-btn');
  btn.textContent='저장 중...';btn.disabled=true;
  try{
    const shareObj=JSON.parse(lastShareData);
    const res=await fetch(API_BASE,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data:shareObj})
    });
    if(!res.ok){const txt=await res.text().catch(()=>'');throw new Error(`HTTP ${res.status}: ${txt.substring(0,100)}`);}
    const rows=await res.json();
    const id=rows[0]?.id;
    if(!id)throw new Error('ID 생성 실패');
    const url=location.origin+location.pathname+'?id='+id;
    await navigator.clipboard.writeText(url).catch(()=>{});
    btn.textContent='✓ 링크 복사됨!';btn.style.background='#d1fae5';btn.style.color='#166534';
    const info=document.getElementById('calc-info');
    if(info)info.innerHTML=`<span style="color:#16a34a">공유 링크: <a href="${url}" target="_blank" style="color:#2563eb">${url}</a> (7일 후 만료)</span>`;
    setTimeout(()=>{btn.textContent='🔗 공유 링크';btn.style.background='#ede9fe';btn.style.color='#6b21a8';btn.disabled=false;},3000);
  }catch(e){
    showError('공유 실패: '+e.message);
    btn.textContent='🔗 공유 링크';btn.style.background='#ede9fe';btn.style.color='#6b21a8';btn.disabled=false;
  }
}

// ── 공유 결과 로드 (Vercel API 프록시 경유) ──
async function loadSharedResult(){
  const params=new URLSearchParams(location.search);
  const id=params.get('id');
  if(!id)return false;
  try{
    const res=await fetch(`${API_BASE}?id=${id}`);
    if(!res.ok)return false;
    const rows=await res.json();
    if(!rows||rows.length===0){
      document.getElementById('result-area').innerHTML=`
        <div style="text-align:center;padding:60px 20px;background:#fff;border:1px solid #e5e2da;border-radius:12px">
          <div style="font-size:48px;margin-bottom:16px">⏰</div>
          <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:8px">공유 링크가 만료되었습니다</div>
          <div style="font-size:14px;color:#888">7일이 지나 삭제되었거나 잘못된 링크입니다.</div>
        </div>`;
      return true;
    }
    const row=rows[0];
    if(row.expires_at&&new Date(row.expires_at)<new Date()){
      document.getElementById('result-area').innerHTML=`
        <div style="text-align:center;padding:60px 20px;background:#fff;border:1px solid #e5e2da;border-radius:12px">
          <div style="font-size:48px;margin-bottom:16px">⏰</div>
          <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:8px">공유 링크가 만료되었습니다</div>
          <div style="font-size:14px;color:#888">7일이 지나 만료된 링크입니다.</div>
        </div>`;
      return true;
    }
    const saved=row.data;
    // 새 구조(mr: 월별) 또는 기존 구조(d: 단일월) 지원
    if(saved.mr){
      // 3개월 공유 데이터
      const months=saved.months||Object.keys(saved.mr).map(Number).sort((a,b)=>a-b);
      const firstMonth=months[0];
      const firstMr=saved.mr[firstMonth];
      if(!firstMr)return false;
      const data=firstMr.d.map(r=>({line:r.l,cnt:r.c,sale:r.s,tgtProd:r.tp,cur:r.cu,tgt_prev:r.tp2,tgt_cur:r.tc,td:r.td,tr:r.tr,nr:r.nr,d3:r.d3,d4:r.d4,dd:r.dd,dr:r.dr,sh:r.sh,ff:r.ff,capa:r.ca,capaRemain:r.cr,stockAmt:r.sa||0,nsEstAmt:r.na||0,totalAmt:r.ta||0,dailyAmt:r.da||0}));
      // monthResults 복원
      const monthResults={};
      for(const mo of months){
        const md=saved.mr[mo];
        monthResults[mo]={data:md.d.map(r=>({line:r.l,cnt:r.c,sale:r.s,tgtProd:r.tp,cur:r.cu,tgt_prev:r.tp2,tgt_cur:r.tc,td:r.td,tr:r.tr,nr:r.nr,d3:r.d3,d4:r.d4,dd:r.dd,dr:r.dr,sh:r.sh,ff:r.ff,capa:r.ca,capaRemain:r.cr,stockAmt:r.sa||0,nsEstAmt:r.na||0,totalAmt:r.ta||0,dailyAmt:r.da||0})),
          wn:md.wn,top:md.top,amt:md.amt};
      }
      // 소회사 복원
      if(saved.sc){
        const sharedSc=saved.sc.map(s=>({name:s.n,color:s.c,lines:s.l}));
        window._sharedSubCo=sharedSc;
      }
      resultData={data,wp:saved.wp,wn:firstMr.wn,targetMonth:firstMonth,
        monthResults,months,monthlyLines:saved.ml||null};
      renderSharedMultiMonth(saved,months,monthResults);
      return true;
    }
    // 기존 단일월 구조
    if(!saved.d)return false;
    const data=saved.d.map(r=>({line:r.l,cnt:r.c,sale:r.s,tgtProd:r.tp,cur:r.cu,tgt_prev:r.tp2,tgt_cur:r.tc,td:r.td,tr:r.tr,nr:r.nr,d3:r.d3,d4:r.d4,dd:r.dd,dr:r.dr,sh:r.sh,ff:r.ff,capa:r.ca,capaRemain:r.cr,stockAmt:r.sa||0,nsEstAmt:r.na||0,totalAmt:r.ta||0,dailyAmt:r.da||0}));
    const restored={data,targetMonth:saved.tm,wp:saved.wp,wn:saved.wn,timestamp:saved.ts||row.created_at,
      files:{scp:saved.f?.s||'',grd:saved.f?.g||'',prod:saved.f?.p||''},
      extras:saved.ex||[],top:saved.top||null,amt:saved.amt||null,items:saved.items||null,ml:saved.ml||null};
    // 공유 화면에서도 더블클릭 모달 동작하도록 resultData 설정
    if(saved.items){
      const sharedLineItems={};
      for(const[ln,its]of Object.entries(saved.items)){
        sharedLineItems[ln]=its.map(it=>({
          combo:it.cb,name:it.nm||'',tgtProd:it.c||0,curInv:it.ci||0,tgtScp:it.ts||0,
          price:it.pr||0,prodAmt:it.am||0,sale:it.c||0,prev:it.p||0
        }));
      }
      resultData={data,wp:saved.wp,wn:saved.wn,targetMonth:saved.tm,lineItems:sharedLineItems,monthlyLines:saved.ml||null};
    }
    renderSharedResult(restored);
    return true;
  }catch(e){console.warn('공유 로드 실패:',e);return false;}
}

function renderSharedMultiMonth(saved,months,monthResults){
  const area=document.getElementById('result-area');
  const ts=saved.ts?new Date(saved.ts):null;
  const timeStr=ts?`${ts.getFullYear()}.${(ts.getMonth()+1+'').padStart(2,'0')}.${(ts.getDate()+'').padStart(2,'0')} ${(ts.getHours()+'').padStart(2,'0')}:${(ts.getMinutes()+'').padStart(2,'0')}`:'';
  const fmtW=n=>{if(n>=100000000)return (n/100000000).toFixed(1)+'억';if(n>=10000)return Math.round(n/10000)+'만';return F(n);};
  const sc=window._sharedSubCo||subCompanies;
  const colors=['#2563eb','#16a34a','#f59e0b'];
  
  // 월별 요약 카드
  const monthCards=months.map((mo,mi)=>{
    const mr=monthResults[mo];
    const tots=mr.data.reduce((a,r)=>{a.d4+=r.d4;a.tgtProd+=(r.tgtProd||0);return a;},{d4:0,tgtProd:0});
    return `<div class="card" style="border-left:3px solid ${colors[mi%3]}">
      <div class="lab">${mo}월 (${mr.wn}일)</div>
      <div class="val" style="font-size:16px">${F(tots.tgtProd)}</div>
      <div class="sub">일투입 ${D(tots.d4)} ${mr.amt?'· '+fmtW(mr.amt.total):''}</div>
    </div>`;
  }).join('');
  
  // CAPA 현황 (첫 월 기준)
  const firstData=monthResults[months[0]].data;
  const capaLines=firstData.filter(r=>r.capa>0);
  const overCapa=capaLines.filter(r=>r.capaRemain<0).sort((a,b)=>a.capaRemain-b.capaRemain);
  const looseCapa=capaLines.filter(r=>r.capaRemain>=0).sort((a,b)=>b.capaRemain-a.capaRemain);
  const fmtOver=r=>`${r.line}(${D(Math.abs(r.capaRemain))}개/일, ${Math.abs(r.capa>0?(r.capaRemain/r.capa*100):0).toFixed(0)}% 부족)`;
  const fmtLoose=r=>`${r.line}(${D(r.capaRemain)}개/일, ${(r.capa>0?(r.capaRemain/r.capa*100):0).toFixed(0)}% 여유)`;
  
  // TOP10 (첫 월)
  const firstTop=monthResults[months[0]].top||{dec:[],inc:[]};
  const pm=months[0]-1;
  const mkTRow=(t,i)=>{
    const dc=t.d<0?'#dc2626':'#16a34a';
    const rs=t.r===999?'신규':(t.r>=0?'+':'')+t.r+'%';
    return `<tr style="border-bottom:1px solid #f0ede5"><td style="padding:3px 6px;font-size:11px;color:#888">${i+1}</td><td style="padding:3px 6px;font-size:11px">${t.l}</td><td style="padding:3px 6px;font-size:11px;font-weight:600">${t.cd}</td><td style="padding:3px 6px;font-size:11px">${t.cl}</td><td style="padding:3px 6px;font-size:11px;text-align:right">${t.p>0?F(t.p):'-'}</td><td style="padding:3px 6px;font-size:11px;text-align:right">${t.c>0?F(t.c):'-'}</td><td style="padding:3px 6px;font-size:11px;text-align:right;color:${dc};font-weight:700">${t.d>=0?'+':''}${F(t.d)}</td><td style="padding:3px 6px;font-size:11px;color:${dc}">${rs}</td></tr>`;
  };
  const thS='padding:3px 6px;font-size:10px;text-align:left';const thR='padding:3px 6px;font-size:10px;text-align:right';
  
  // 월별 라인 테이블
  const allLines=new Set();
  for(const mo of months)for(const r of monthResults[mo].data)allLines.add(r.line);
  const lineList=[...allLines];
  const lineData=lineList.map(ln=>{
    const vals=months.map(mo=>{
      const r=monthResults[mo].data.find(d=>d.line===ln);
      return{tp:r?.tgtProd||0,d4:r?.d4||0,amt:r?.totalAmt||0};
    });
    return{line:ln,vals,total:vals.reduce((s,v)=>s+v.tp,0)};
  }).sort((a,b)=>b.total-a.total);
  const monthSums=months.map((mo,mi)=>({
    tp:lineData.reduce((s,d)=>s+d.vals[mi].tp,0),
    d4:lineData.reduce((s,d)=>s+d.vals[mi].d4,0),
    amt:lineData.reduce((s,d)=>s+d.vals[mi].amt,0)
  }));
  
  // 금액 요약
  const amtHtml=months.map((mo,mi)=>{
    const a=monthResults[mo].amt;
    return a?`<span style="color:${colors[mi%3]};font-weight:700">${mo}월 ${fmtW(a.daily)}/일, ${fmtW(a.total)}/월</span>`:'';
  }).filter(Boolean).join(' · ');
  
  area.innerHTML=`
    <div style="background:#fff;border:1px solid #e5e2da;border-radius:12px;overflow:hidden">
      <div style="padding:16px 20px;background:linear-gradient(135deg,#fafaf8,#f0edff);border-bottom:1px solid #e5e2da">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:17px;font-weight:800">📋 ${months.map(m=>m+'월').join('·')} SCP 라인별 부하 분석</div>
            <div style="font-size:12px;color:#888;margin-top:4px">분석: ${timeStr} · ${saved.f?.s||''}</div>
          </div>
          <div style="background:#ede9fe;padding:6px 12px;border-radius:8px;font-size:11px;color:#6b21a8;font-weight:600">🔗 공유된 분석 결과</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(${months.length},1fr);border-bottom:1px solid #e5e2da">${monthCards}</div>
      
      ${capaLines.length>0?`<div style="padding:14px 20px;border-bottom:1px solid #e5e2da;background:#faf5ff">
        <div style="font-size:13px;font-weight:700;color:#6b21a8;margin-bottom:6px">⚡ CAPA 현황 (${months[0]}월 기준)</div>
        <div style="font-size:12px;line-height:1.8">
          ${overCapa.length>0?`<div><span style="color:#dc2626;font-weight:700">초과 ${overCapa.length}개:</span> ${overCapa.map(fmtOver).join(', ')}</div>`:`<div style="color:#16a34a">✓ 초과 없음</div>`}
          ${looseCapa.length>0?`<div><span style="color:#16a34a;font-weight:700">여유 ${looseCapa.length}개:</span> ${looseCapa.map(fmtLoose).join(', ')}</div>`:''}
        </div>
      </div>`:''}
      
      <div style="padding:16px 20px;border-bottom:1px solid #e5e2da">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div><div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:6px">📉 목표입고 감소 TOP 10 (${pm}월 투입 대비)</div>
            <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#fef2f2"><th style="${thS}">#</th><th style="${thS}">라인</th><th style="${thS}">단품</th><th style="${thS}">색상</th><th style="${thR}">${pm}월</th><th style="${thR}">${months[0]}월</th><th style="${thR}">증감</th><th style="${thS}">률</th></tr></thead>
            <tbody>${(firstTop.dec||[]).map((t,i)=>mkTRow(t,i)).join('')}</tbody></table></div>
          <div><div style="font-size:12px;font-weight:700;color:#16a34a;margin-bottom:6px">📈 목표입고 증가 TOP 10 (${pm}월 투입 대비)</div>
            <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f0fdf4"><th style="${thS}">#</th><th style="${thS}">라인</th><th style="${thS}">단품</th><th style="${thS}">색상</th><th style="${thR}">${pm}월</th><th style="${thR}">${months[0]}월</th><th style="${thR}">증감</th><th style="${thS}">률</th></tr></thead>
            <tbody>${(firstTop.inc||[]).map((t,i)=>mkTRow(t,i)).join('')}</tbody></table></div>
        </div>
      </div>
      
      <div style="padding:14px 20px;background:#fffbeb;border-bottom:1px solid #fde68a">
        <div style="font-size:14px;font-weight:700;color:#92400e">💰 생산 예상액 (입고가 기준): ${amtHtml}</div>
      </div>
      
      <div style="padding:16px 20px;border-bottom:1px solid #e5e2da">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px">📊 월별 라인별 생산 추이</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#1a1a1a;color:#fff">
              <th style="padding:5px 8px;text-align:left" rowspan="2">라인</th>
              ${months.map((m,i)=>`<th colspan="3" style="padding:5px 4px;text-align:center;background:${colors[i%3]}22;color:${colors[i%3]};border-left:2px solid #333">${m}월 (${monthResults[m].wn}일)</th>`).join('')}
            </tr>
            <tr style="background:#f5f5f0">
              ${months.map(()=>`<th style="padding:3px 4px;font-size:10px;text-align:right;border-left:2px solid #e5e2da">입고</th><th style="padding:3px 4px;font-size:10px;text-align:right">일투입</th><th style="padding:3px 4px;font-size:10px;text-align:right">금액</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${lineData.map(d=>`<tr style="border-bottom:1px solid #f0ede5">
              <td style="padding:4px 8px;font-weight:600;font-size:12px">${d.line}</td>
              ${d.vals.map((v,mi)=>`<td style="padding:3px 4px;text-align:right;font-size:12px;border-left:2px solid #f0ede5">${F(v.tp)}</td><td style="padding:3px 4px;text-align:right;font-weight:600;color:${colors[mi%3]};font-size:12px">${D(v.d4)}</td><td style="padding:3px 4px;text-align:right;font-size:11px;color:#888">${v.amt>=1e8?(v.amt/1e8).toFixed(1)+'억':Math.round(v.amt/1e7)+'백만'}</td>`).join('')}
            </tr>`).join('')}
            <tr style="font-weight:700;border-top:2px solid #1a1a1a">
              <td style="padding:5px 8px">합계</td>
              ${monthSums.map((s,mi)=>`<td style="padding:4px 4px;text-align:right;border-left:2px solid #ddd">${F(s.tp)}</td><td style="padding:4px 4px;text-align:right;color:${colors[mi%3]}">${D(s.d4)}</td><td style="padding:4px 4px;text-align:right;font-size:11px">${fmtW(s.amt)}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
      
      <div style="padding:16px 20px">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px">📈 소회사별 일투입 추이</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          ${sc.map((s,si)=>`<div style="border:1px solid ${s.color}33;border-radius:10px;padding:12px;cursor:pointer" ondblclick="showFullChart(${si})">
            <div style="font-size:13px;font-weight:700;color:${s.color};margin-bottom:8px"><span style="display:inline-block;width:10px;height:10px;background:${s.color};border-radius:2px;margin-right:4px"></span>${s.name}</div>
            <div id="subco-chart-${si}"></div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  
  // 공유 그래프용 데이터 설정
  const sharedLineData=lineData.map(d=>({line:d.line,vals:d.vals.map(v=>v.d4)}));
  const prevData={};
  for(const d of firstData){prevData[d.line]=d.d3||0;}
  window._chartData={allLD:sharedLineData,prevData,chartMonths:[months[0]-1,...months],chartLabels:[months[0]-1+'월',...months.map(m=>m+'월')],
    lineColors:{'TC13(조립5)':'#2563eb','벌크':'#dc2626','도장(외부출고)':'#16a34a','T40-2_F':'#f59e0b','T40_FKD':'#7c3aed','T80':'#0891b2','T50-2':'#be185d','T50-1':'#059669','T55':'#d97706','M02':'#4f46e5','후레임2':'#0d9488','후레임3':'#ca8a04','플라이트':'#db2777','가죽':'#6366f1','부품포장':'#9333ea','신제품':'#e11d48'}};
  if(window._sharedSubCo)subCompanies=window._sharedSubCo;
  setTimeout(()=>{for(let i=0;i<subCompanies.length;i++)drawSubCoChart(i,false);},100);
}

function renderSharedResult(saved){
  const area=document.getElementById('result-area');
  const ts=saved.timestamp?new Date(saved.timestamp):null;
  const timeStr=ts?`${ts.getFullYear()}.${(ts.getMonth()+1+'').padStart(2,'0')}.${(ts.getDate()+'').padStart(2,'0')} ${(ts.getHours()+'').padStart(2,'0')}:${(ts.getMinutes()+'').padStart(2,'0')}`:'';
  const data=saved.data;
  const tots=data.reduce((a,r)=>{a.cnt+=r.cnt;a.d3+=r.d3;a.d4+=r.d4;a.tgtProd+=(r.tgtProd||0);a.sale+=(r.sale||0);a.tgt_prev+=(r.tgt_prev||0);a.tgt_cur+=(r.tgt_cur||0);a.sh+=(r.sh||0);return a;},{cnt:0,d3:0,d4:0,tgtProd:0,sale:0,tgt_prev:0,tgt_cur:0,sh:0});
  const tm=saved.targetMonth||5;
  const pm=tm-1;
  const wp=saved.wp||22;const wn=saved.wn||20;
  const prods=data.filter(r=>r.line!=="부품포장");
  const parts=data.filter(r=>r.line==="부품포장");
  
  const mkMiniRow=r=>{
    const dc=r.dd<0?'#dc2626':r.dd>0?'#16a34a':'#888';
    const esc=r.line.replace(/'/g,"\\'");
    const capaTd=r.capa>0?`<td class="tc" style="font-size:12px">${r.capa}</td><td class="tc" style="color:${r.capaRemain<0?'#dc2626':r.capaRemain<30?'#f59e0b':'#16a34a'};font-size:12px;font-weight:${r.capaRemain<0?700:400}">${r.capaRemain!==null?((r.capaRemain>=0?'+':'')+D(r.capaRemain)+' <span style="font-size:10px;opacity:0.7">('+(r.capa>0?(r.capaRemain/r.capa*100).toFixed(0):0)+'%)</span>'):'-'}</td>`:`<td class="tc" style="color:#ccc;font-size:12px">-</td><td class="tc" style="color:#ccc;font-size:12px">-</td>`;
    return `<tr style="border-bottom:1px solid #f0ede5">
      <td style="padding:6px 10px;font-weight:600;font-size:13px">${r.line}</td>
      <td class="tc" style="font-size:12px">${r.cnt}</td>
      <td class="tr" style="font-size:12px">${F(r.tgtProd||r.sale)}</td>
      <td class="tc" style="font-size:12px">${D(r.d3)}</td>
      <td class="tc" style="font-size:13px;font-weight:600">${D(r.d4)}</td>
      <td class="tc" style="color:${dc};font-weight:${Math.abs(r.dd)>10?700:400};font-size:12px;cursor:pointer;text-decoration:underline dotted" ondblclick="showDiffModal('${esc}')">${r.dd>=0?'+':''}${D(r.dd)}</td>
      <td class="tc" style="color:${dc};font-size:12px">${r.dr>=0?'+':''}${r.dr.toFixed(1)}%</td>
      <td class="tr" style="font-size:12px">${F(r.cur)}</td>
      <td class="tr" style="font-size:12px">${F(r.tgt_cur)}</td>
      <td class="tc" style="font-size:12px;color:${r.ff<90?'#dc2626':'#888'};font-weight:${r.ff<90?700:400};cursor:pointer;text-decoration:underline dotted" ondblclick="showFulfillModal('${esc}')">${r.ff.toFixed(0)}%</td>
      ${capaTd}
    </tr>`;
  };
  const mkMiniSub=(rows,label,cls)=>{
    const s=rows.reduce((a,r)=>{a.cnt+=r.cnt;a.d3+=r.d3;a.d4+=r.d4;a.tp+=(r.tgtProd||r.sale||0);a.cur+=r.cur;a.tc+=(r.tgt_cur||0);return a;},{cnt:0,d3:0,d4:0,tp:0,cur:0,tc:0});
    const dd=+(s.d4-s.d3).toFixed(1);const dr=s.d3>0?+((s.d4-s.d3)/s.d3*100).toFixed(1):0;
    return `<tr style="font-weight:700;${cls==='total'?'border-top:2px solid #1a1a1a;border-bottom:2px solid #1a1a1a':'background:#f5f5f0;border-top:1px solid #ddd;border-bottom:1px solid #ddd'}">
      <td style="padding:6px 10px;font-size:13px">${label}</td>
      <td class="tc" style="font-size:12px">${s.cnt}</td>
      <td class="tr" style="font-size:12px">${F(s.tp)}</td>
      <td class="tc" style="font-size:12px">${D(s.d3)}</td><td class="tc" style="font-size:13px">${D(s.d4)}</td>
      <td class="tc" style="color:${DC(dd)};font-size:12px">${dd>=0?'+':''}${D(dd)}</td>
      <td class="tc" style="color:${DC(dr)};font-size:12px">${dr>=0?'+':''}${dr.toFixed(1)}%</td>
      <td class="tr" style="font-size:12px">${F(s.cur)}</td>
      <td class="tr" style="font-size:12px">${F(s.tc)}</td>
      <td colspan="3"></td></tr>`;
  };
  
  // CAPA 현황
  const capaLines=data.filter(r=>r.capa>0);
  const overCapa=capaLines.filter(r=>r.capaRemain<0).sort((a,b)=>a.capaRemain-b.capaRemain);
  const looseCapa=capaLines.filter(r=>r.capaRemain>=0).sort((a,b)=>b.capaRemain-a.capaRemain);
  const fmtOver=r=>`${r.line}(${D(Math.abs(r.capaRemain))}개/일, ${Math.abs(r.capa>0?(r.capaRemain/r.capa*100):0).toFixed(0)}% 부족)`;
  const fmtLoose=r=>`${r.line}(${D(r.capaRemain)}개/일, ${(r.capa>0?(r.capaRemain/r.capa*100):0).toFixed(0)}% 여유)`;
  
  // 추가건 표시
  const extrasHtml=saved.extras&&saved.extras.length>0?
    `<div style="padding:10px 20px;border-bottom:1px solid #e5e2da;font-size:12px;color:#7c3aed;background:#faf5ff">
      📌 추가건: ${saved.extras.map(e=>`${e.l||e.line} ${e.n||e.label} +${e.q||e.qty}`).join(' / ')}
    </div>`:'';

  area.innerHTML=`
    <div style="background:#fff;border:1px solid #e5e2da;border-radius:12px;overflow:hidden">
      <div style="padding:16px 20px;background:linear-gradient(135deg,#fafaf8,#f0edff);border-bottom:1px solid #e5e2da">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:17px;font-weight:800;color:#1a1a1a">📋 ${tm}월 SCP 라인별 부하 분석</div>
            <div style="font-size:12px;color:#888;margin-top:4px">
              분석 시각: ${timeStr} · 사용 파일: ${saved.files?.scp||'-'}
            </div>
          </div>
          <div style="background:#ede9fe;padding:6px 12px;border-radius:8px;font-size:11px;color:#6b21a8;font-weight:600">🔗 공유된 분석 결과</div>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #e5e2da">
        <div class="card"><div class="lab">${tm}월 목표입고</div><div class="val">${F(tots.tgtProd||tots.sale)}</div></div>
        <div class="card"><div class="lab">일투입 (${pm}월${wp}일→${tm}월${wn}일)</div><div class="val" style="color:${tots.d4-tots.d3<0?'#dc2626':'#16a34a'}">${D(tots.d3)} → ${D(tots.d4)}</div><div class="sub" style="color:${tots.d4-tots.d3<0?'#dc2626':'#16a34a'}">${tots.d4-tots.d3>=0?'+':''}${D(tots.d4-tots.d3)}</div></div>
        <div class="card"><div class="lab">목표재고 (${pm}월→${tm}월)</div><div class="val" style="color:#7c3aed">${F(tots.tgt_prev)} → ${F(tots.tgt_cur)}</div></div>
        <div class="card"><div class="lab">예상 목표재고 부족분</div><div class="val" style="color:${tots.sh>0?'#dc2626':'#888'}">${F(tots.sh)}개</div></div>
      </div>
      
      ${extrasHtml}
      
      ${capaLines.length>0?`<div style="padding:14px 20px;border-bottom:1px solid #e5e2da;background:#faf5ff">
        <div style="font-size:13px;font-weight:700;color:#6b21a8;margin-bottom:6px">⚡ CAPA 현황</div>
        <div style="font-size:12px;line-height:1.8">
          ${overCapa.length>0?`<div><span style="color:#dc2626;font-weight:700">초과 ${overCapa.length}개:</span> ${overCapa.map(fmtOver).join(', ')}</div>`:`<div style="color:#16a34a">✓ CAPA 초과 라인 없음</div>`}
          ${looseCapa.length>0?`<div><span style="color:#16a34a;font-weight:700">여유 ${looseCapa.length}개:</span> ${looseCapa.map(fmtLoose).join(', ')}</div>`:''}
        </div>
      </div>`:''}
      
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#1a1a1a;color:#fff">
            <th style="padding:7px 10px;font-size:11px;text-align:left">라인</th>
            <th style="padding:7px 6px;font-size:11px">품목</th>
            <th style="padding:7px 6px;font-size:11px">목표입고</th>
            <th style="padding:7px 6px;font-size:11px">${pm}월</th>
            <th style="padding:7px 6px;font-size:11px">${tm}월</th>
            <th style="padding:7px 6px;font-size:11px">증감</th>
            <th style="padding:7px 6px;font-size:11px">증감률</th>
            <th style="padding:7px 6px;font-size:11px">현재고</th>
            <th style="padding:7px 6px;font-size:11px">${tm}월목표</th>
            <th style="padding:7px 6px;font-size:11px">충족률</th>
            <th style="padding:7px 6px;font-size:11px">CAPA</th>
            <th style="padding:7px 6px;font-size:11px">잔여여유</th>
          </tr></thead>
          <tbody>
            ${prods.map(mkMiniRow).join('')}
            ${mkMiniSub(prods,'제품 소계','sub')}
            <tr><td colspan="12" style="height:4px;background:#fafaf8"></td></tr>
            ${parts.map(mkMiniRow).join('')}
            ${parts.length?mkMiniSub(parts,'부품 소계','sub'):''}
            <tr><td colspan="12" style="height:4px;background:#fafaf8"></td></tr>
            ${mkMiniSub(data,'합계','total')}
          </tbody>
        </table>
      </div>
      <div style="padding:12px 20px;background:#fafaf8;font-size:11px;color:#888;text-align:center">
        일투입 = (SCP 목표입고량 + 비재고 유지 + 추가건) ÷ 영업일 · 충족률 = 현재고 ÷ 당월 목표재고 × 100
      </div>
      ${buildSharedTop10(saved.top,tm-1,tm)}
      ${buildSharedAmount(saved.amt,tm)}
      ${saved.ml?buildMonthlyChart(tm):''}
    </div>`;
}

function buildSharedTop10(top,pm,tm){
  if(!top||(!top.dec?.length&&!top.inc?.length))return '';
  const mkRow=(t,i)=>{
    const dc=t.d<0?'#dc2626':t.d>0?'#16a34a':'#888';
    const rateStr=t.r===999?'신규':(t.r>=0?'+':'')+t.r+'%';
    return `<tr style="border-bottom:1px solid #f0ede5">
      <td style="padding:4px 6px;font-size:11px;color:#888">${i+1}</td>
      <td style="padding:4px 6px;font-size:11px">${t.l}</td>
      <td style="padding:4px 6px;font-size:11px;font-weight:600">${t.cd}</td>
      <td style="padding:4px 6px;font-size:11px">${t.cl}</td>
      <td style="padding:4px 6px;font-size:11px;color:#666;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.nm||''}</td>
      <td style="padding:4px 6px;font-size:11px;text-align:right">${t.p>0?F(t.p):'-'}</td>
      <td style="padding:4px 6px;font-size:11px;text-align:right">${t.c>0?F(t.c):'-'}</td>
      <td style="padding:4px 6px;font-size:11px;text-align:right;color:${dc};font-weight:700">${t.d>=0?'+':''}${F(t.d)}</td>
      <td style="padding:4px 6px;font-size:11px;text-align:center;color:${dc}">${rateStr}</td>
    </tr>`;
  };
  const thS='padding:4px 6px;font-size:10px;text-align:left';
  const thR='padding:4px 6px;font-size:10px;text-align:right';
  const thC='padding:4px 6px;font-size:10px;text-align:center';
  return `<div style="padding:16px 20px;border-top:1px solid #e5e2da">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:6px">📉 목표입고 감소 TOP 10 (${pm}월 투입 대비)</div>
        <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#fef2f2">
          <th style="${thS}">#</th><th style="${thS}">라인</th><th style="${thS}">단품</th><th style="${thS}">색상</th><th style="${thS}">품목명</th>
          <th style="${thR}">${pm}월</th><th style="${thR}">${tm}월</th><th style="${thR}">증감</th><th style="${thC}">률</th>
        </tr></thead><tbody>${(top.dec||[]).map((t,i)=>mkRow(t,i)).join('')}</tbody></table>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#16a34a;margin-bottom:6px">📈 목표입고 증가 TOP 10 (${pm}월 투입 대비)</div>
        <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f0fdf4">
          <th style="${thS}">#</th><th style="${thS}">라인</th><th style="${thS}">단품</th><th style="${thS}">색상</th><th style="${thS}">품목명</th>
          <th style="${thR}">${pm}월</th><th style="${thR}">${tm}월</th><th style="${thR}">증감</th><th style="${thC}">률</th>
        </tr></thead><tbody>${(top.inc||[]).map((t,i)=>mkRow(t,i)).join('')}</tbody></table>
      </div>
    </div>
  </div>`;
}

function buildSharedAmount(amt,tm){
  if(!amt)return '';
  const fmtW=n=>{if(n>=100000000)return (n/100000000).toFixed(1)+'억';if(n>=10000)return Math.round(n/10000)+'만';return F(n);};
  return `<div style="padding:16px 20px;background:#fffbeb;border-top:1px solid #fde68a">
    <div style="font-size:14px;font-weight:700;color:#92400e">💰 ${tm}월 생산 예상액은 <span style="font-size:18px;color:#1a1a1a">${fmtW(amt.daily)}/일</span>, <span style="font-size:18px;color:#1a1a1a">${fmtW(amt.total)}/월</span> (입고가 기준)로 추정됩니다.</div>
    <div style="font-size:11px;color:#888;margin-top:4px">재고 ${fmtW(amt.stock)} + 비재고 추정 ${fmtW(amt.nsEst)}${amt.lobby>0?' + 로비수출 '+fmtW(amt.lobby):''}</div>
  </div>`;
}

// 페이지 로드 시: Supabase 공유 결과 확인 → 없으면 일반 모드
(async()=>{
  const shared=await loadSharedResult();
  if(!shared){/* 일반 앱 모드 */}
})();

// ── 라인 매핑 ──
function gLine(cb,lm){
  // 1. 수기 지정 우선
  if(manualLineMap[cb])return manualLineMap[cb];
  // 2. lineMap 정확 매칭
  let ln=lm[cb];
  if(!ln){const cd=cb.split("-")[0];ln=lm[cd];
    if(!ln){
      for(let l=Math.min(10,cd.length);l>=3;l--){
        for(const[k,v]of Object.entries(lm)){if(k.startsWith(cd.substring(0,l))){ln=v;break;}}
        if(ln)break;
      }
    }
  }
  // 3. 이관 규칙 적용
  if(ln){const cd=cb.split("-")[0];
    for(const t of transfers){
      if(t.pattern&&cd.includes(t.pattern)&&(!t.from||ln===t.from))ln=t.to;
      if(t.code&&cd.startsWith(t.code))ln=t.to;
    }
  }
  return ln;
}

// ── 파싱 ──
// 서브헤더 행에서 고정 컬럼 위치를 이름으로 탐지 (하드코딩 방지)
function findFixedCols(subHeaderRow){
  const fc={series:0,combo:4,name:5,useType:6,stockType:7,supplier:9,price:13};
  subHeaderRow.forEach((c,i)=>{
    const v=String(c??'').trim();
    if(v==='시리즈'||v==='계열'||v==='브랜드계열')fc.series=i;
    else if(v==='조합'||v==='조합코드')fc.combo=i;
    else if(v==='품목명'||v==='단품명'||v==='품명')fc.name=i;
    else if(v==='사용구분'||v==='사용/개발'||v==='구분')fc.useType=i;
    else if(v==='재고구분'||v==='재고/비재고'||v==='재고여부')fc.stockType=i;
    else if(v==='공급처'||v==='공급사'||v==='제조사')fc.supplier=i;
    else if(v==='브랜드공가'||v==='공가'||v==='단가'||v==='입고단가'||v==='입고 단가'||v==='기준단가')fc.price=i;
  });
  return fc;
}

// 월별 컬럼 구조: 월 표기(4월/5월/6월) 행을 자동탐지, 그 다음 행에 세부 항목
// (의자 SCP 시트는 1행 공백이므로 raw[1] 고정 대신 스캔)
function findMonthCols(raw, targetMonth){
  // 월 라벨이 있는 행 자동탐지 (최대 5행 스캔)
  let monthRowIdx = -1;
  for(let ri=0;ri<Math.min(5,raw.length);ri++){
    if((raw[ri]||[]).some(c=>String(c??'').trim().match(/^\d+월$/))){monthRowIdx=ri;break;}
  }
  if(monthRowIdx<0) return null;
  const row1 = raw[monthRowIdx] || [];
  const row2 = raw[monthRowIdx+1] || [];
  const monthLabel = `${targetMonth}월`;
  let startCol = -1;
  for(let i=0;i<row1.length;i++){
    if(String(row1[i]??'').trim()===monthLabel){startCol=i;break;}
  }
  if(startCol<0) return null;
  let endCol = row1.length;
  for(let i=startCol+1;i<row1.length;i++){
    if(String(row1[i]??'').trim().match(/^\d+월$/)){endCol=i;break;}
  }
  let saleCol=-1, tgtCol=-1, prodCol=-1, prodAmtCol=-1;
  for(let i=startCol;i<endCol;i++){
    const h=String(row2[i]??'').trim();
    if(h==='판매예상량' && saleCol<0) saleCol=i;
    if((h==='목표재고'||h==='타겟재고') && tgtCol<0) tgtCol=i;
    if(h==='목표 입고' && prodCol<0) prodCol=i;
    if(h==='목표입고금액' && prodAmtCol<0) prodAmtCol=i;
    if(h==='목표생산금액' && prodAmtCol<0) prodAmtCol=i;
  }
  return{saleCol,tgtCol,prodCol,prodAmtCol,startCol,endCol};
}

function pSCP(wb){
  const allMonthItems={};  // {월 → items[]}
  const combos=new Set();
  const availMonths=new Set();
  
  for(let si=0;si<4;si++){
    const b=BRANDS[si],ws=wb.Sheets[SHEETS[si]];if(!ws)continue;
    const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    // 월 라벨 행 자동탐지 (1행 공백인 의자 SCP 시트 대응)
    let monthRowIdx=-1;
    for(let ri=0;ri<Math.min(5,raw.length);ri++){
      if((raw[ri]||[]).some(c=>String(c??'').trim().match(/^\d+월$/))){monthRowIdx=ri;break;}
    }
    if(monthRowIdx<0)continue;
    const row1=raw[monthRowIdx]||[];
    const sheetMonths=[];
    for(let i=0;i<row1.length;i++){
      const mv=String(row1[i]??'').trim().match(/^(\d+)월$/);
      if(mv)sheetMonths.push(parseInt(mv[1]));
    }
    const dataStartRow=monthRowIdx+2; // 월행 + 서브헤더행 + 1
    const fc=findFixedCols(raw[monthRowIdx+1]||[]); // 컬럼 위치 이름으로 탐지
    // 각 월별 파싱
    for(const mo of sheetMonths){
      const cols=findMonthCols(raw,mo);
      if(!cols||cols.prodCol<0)continue;
      availMonths.add(mo);
      if(!allMonthItems[mo])allMonthItems[mo]=[];
      const{saleCol,tgtCol,prodCol,prodAmtCol}=cols;
      for(let i=dataStartRow;i<raw.length;i++){
        const r=raw[i];
        const useType=String(r[fc.useType]??"").trim();
        const stockType=String(r[fc.stockType]??"").trim();
        if(stockType!=="재고")continue;
        if(useType!=="사용"&&useType!=="개발")continue;
        const sup=String(r[fc.supplier]??"").trim();
        // 자사 국내공장(평택 등) 생산품만 — 협력사(외주)·VN(베트남) 제외
        // 신버전 표기: '국내' / 구버전 하위호환: '시디즈제품'·'평택' 포함
        const isInhouse = sup==="국내"
          || (b==="시디즈" ? sup==="시디즈제품" : sup.includes("평택"));
        if(!isInhouse)continue;
        const c=String(r[fc.combo]??"").trim();if(!c)continue;
        combos.add(c);
        const saleVal=saleCol>=0?N(r[saleCol]):0;
        const tgtProd=N(r[prodCol]);
        const price=N(r[fc.price]);
        const prodAmt=prodAmtCol>=0?N(r[prodAmtCol]):(tgtProd*price);
        const isDev=useType==="개발";
        allMonthItems[mo].push({brand:b,series:String(r[fc.series]??"").trim(),combo:c,name:String(r[fc.name]??"").trim().substring(0,40),
          sale:saleVal,tgtProd,tgtScp:tgtCol>=0?N(r[tgtCol]):0,price,prodAmt,isDev});
      }
    }
  }
  const months=[...availMonths].sort((a,b)=>a-b);
  // 월별 영업일 입력 UI 생성
  const wdEl=document.getElementById('monthly-workdays');
  if(wdEl){
    wdEl.innerHTML='<div style="font-size:11px;color:#dc2626;font-weight:700;margin-bottom:4px">⚠ 영업일을 반드시 확인/수정하세요</div>'+months.map(m=>{
      const existing=document.getElementById('wd-'+m);
      const val=existing?existing.value:20;
      return `<div>
      <label class="cfg-label" style="color:#dc2626;font-weight:700">${m}월 *</label>
      <input class="num" type="number" id="wd-${m}" value="${val}" style="width:50px;border-color:#dc2626;color:#dc2626;font-weight:700" onfocus="this.style.borderColor='#2563eb';this.style.color='#1a1a1a'" onchange="this.style.borderColor='#16a34a';this.style.color='#16a34a'">
    </div>`;
    }).join('');
  }
  return{allMonthItems,combos,months};
}

function pGrd(wb){
  const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""});
  const lm={},im={},tm={};
  for(let i=2;i<raw.length;i++){
    const r=raw[i],cd=String(r[1]??"").trim(),cl=String(r[2]??"").trim();
    if(!cd||cd==="undefined")continue;
    const cb=`${cd}-${cl}`;
    let ln=String(r[4]??"").trim().replace("라인]","");
    if(!ln||ln==="undefined"||ln==="nan")continue;
    lm[cb]=ln;if(!lm[cd])lm[cd]=ln;im[cb]=N(r[7]);tm[cb]=N(r[6]);
  }
  return{lm,im,tm};
}

function pProd(wb,combos){
  const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""});
  const ld={};
  const prodItems={};
  const nsItems={};  // 비재고 품목별 수량 집계: {combo → {qty, line, name}}
  for(let i=1;i<raw.length;i++){
    const r=raw[i];
    let ln=String(r[12]??"").trim().replace("라인]","");
    if(!ln||EXCL.includes(ln))continue;
    const cd=String(r[3]??"").trim(),cl=String(r[5]??"").trim(),q=N(r[8]),cb=`${cd}-${cl}`,ex2=String(r[16]??"").trim();
    const name=String(r[4]??"").trim().substring(0,25);
    for(const t of transfers){
      if(t.pattern&&cd.includes(t.pattern)&&(!t.from||ln===t.from)){if(t.expEx&&ex2.includes("수출"))continue;ln=t.to;}
      if(t.code&&cd.startsWith(t.code))ln=t.to;
    }
    if(!ld[ln])ld[ln]={total:0,nonScp:0};
    ld[ln].total+=q;
    const isForceStock=forceStockPatterns.some(p=>cd.includes(p));
    if(!combos.has(cb)&&!isForceStock){
      ld[ln].nonScp+=q;
      if(!nsItems[cb])nsItems[cb]={qty:0,line:ln,name,code:cd,color:cl};
      nsItems[cb].qty+=q;
    }
    if(!prodItems[ln])prodItems[ln]={};
    prodItems[ln][cb]=(prodItems[ln][cb]||0)+q;
  }
  for(const d of Object.values(ld))d.ratio=d.total>0?(d.nonScp/d.total*100):0;
  ld._items=prodItems;
  ld._nsItems=nsItems;  // 비재고 품목 상세
  return ld;
}

// ── 파일 로딩 ──
const WANTED_SCP_SHEETS=['SCP계획','시디즈 의자 SCP','퍼시스 의자 SCP','일룸 의자 SCP','데스커 의자 SCP'];

function detectKindFromHeader(rows){
  for(let i=0;i<Math.min(5,rows.length);i++){
    const r=rows[i];
    const has=t=>r.some(c=>String(c??'').includes(t));
    if(has('계획량')&&has('협력사'))return'prod';
    if(has('현재고')&&has('목표'))return'grd';
  }
  return null;
}

function loadFile(input,type){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const buf=new Uint8Array(e.target.result);
      // 수정B: SCP 시트만 선택 파싱 → 단품코드 60만행 OOM 방지
      const wbScp=XLSX.read(buf,{type:'array',sheets:WANTED_SCP_SHEETS});
      let detectedType,wb;
      if(WANTED_SCP_SHEETS.some(s=>wbScp.SheetNames.includes(s))){
        wb=wbScp; detectedType='scp';
      }else{
        // grd / prod 파일: 전체 파싱 후 컬럼 시그니처로 자동 분류
        wb=XLSX.read(buf,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        detectedType=detectKindFromHeader(rows)||type;
      }
      if(detectedType==='scp'){
        parsed.scp=pSCP(wb);files.scp=file.name;
        document.getElementById('s-scp').innerHTML=`<div class="fname" style="background:#dbeafe;color:#2563eb">${file.name}</div><div style="font-size:11px;color:#888;margin-top:4px">${parsed.scp.months.map(m=>m+'월').join('·')} · ${Object.values(parsed.scp.allMonthItems).reduce((s,a)=>s+a.length,0)}건</div>`;
        document.getElementById('u-scp').classList.add('done');
      }else if(detectedType==='grd'){
        parsed.grd=pGrd(wb);files.grd=file.name;
        document.getElementById('s-grd').innerHTML=`<div class="fname" style="background:#d1fae5;color:#059669">${file.name}</div><div style="font-size:11px;color:#888;margin-top:4px">${Object.keys(parsed.grd.lm).length}건</div>`;
        document.getElementById('u-grd').classList.add('done');
      }else if(detectedType==='prod'){
        if(!parsed.scp){showError("SCP를 먼저 업로드하세요");return;}
        parsed._prodWb=wb;parsed.prod=pProd(wb,parsed.scp.combos);files.prod=file.name;
        document.getElementById('s-prod').innerHTML=`<div class="fname" style="background:#ede9fe;color:#7c3aed">${file.name}</div><div style="font-size:11px;color:#888;margin-top:4px">${Object.keys(parsed.prod).length}라인</div>`;
        document.getElementById('u-prod').classList.add('done');
        renderNsTop10();
      }else{
        showError('파일 종류를 인식할 수 없습니다. 올바른 파일을 확인해주세요.');
        return;
      }
      const allReady=parsed.scp&&parsed.grd&&parsed.prod;
      document.getElementById('run-btn').disabled=!allReady;
      if(allReady)detectUnmapped();
      hideError();
    }catch(err){showError(`파일 오류: ${err.message}`);}
  };
  reader.readAsArrayBuffer(file);
}

// ── 미매핑 감지 ──
function detectUnmapped(){
  if(!parsed.scp||!parsed.grd)return;
  const months=parsed.scp.months||[];
  const firstItems=parsed.scp.allMonthItems[months[0]]||[];
  // 미매핑 표 헤더의 월 표기를 실제 첫 월로 갱신 (4월 하드코딩 제거)
  const saleTh=document.getElementById('unmapped-sale-th');
  if(saleTh)saleTh.textContent=`${months[0]??''}월판매예상`;
  const{lm}=parsed.grd;
  unmappedItems=firstItems.filter(it=>{
    if(manualLineMap[it.combo])return false;
    return !gLine(it.combo,lm);
  });
  if(unmappedItems.length===0){
    document.getElementById('unmapped-banner').style.display='none';
    return;
  }
  // 브랜드+시리즈 단위로 묶어서 표시
  const groups={};
  for(const it of unmappedItems){
    const key=`${it.brand}|${it.series}`;
    if(!groups[key])groups[key]={brand:it.brand,series:it.series,combos:[],totalSale:0};
    groups[key].combos.push(it.combo);
    groups[key].totalSale+=it.sale;
  }
  const rows=Object.values(groups).sort((a,b)=>b.totalSale-a.totalSale);
  const tbody=document.getElementById('unmapped-body');
  tbody.innerHTML=rows.map((g,i)=>`
    <tr>
      <td>${g.brand}</td>
      <td style="font-weight:600">${g.series}</td>
      <td style="font-size:11px;color:#888">${g.combos.slice(0,3).join(', ')}${g.combos.length>3?` 외 ${g.combos.length-3}건`:''}</td>
      <td></td>
      <td style="font-weight:600;color:#1a1a1a">${F(g.totalSale)}</td>
      <td>
        <select class="einp" id="umap-${i}" style="width:130px">
          <option value="">라인 선택</option>
          ${ALLLINES.filter(l=>l!=='(직접입력)').map(l=>`<option>${l}</option>`).join('')}
          <option value="__direct">직접 입력...</option>
        </select>
      </td>
    </tr>
  `).join('');
  // 직접 입력 이벤트
  rows.forEach((_,i)=>{
    const sel=document.getElementById(`umap-${i}`);
    sel.addEventListener('change',()=>{
      if(sel.value==='__direct'){const v=prompt('라인명 입력');if(v)sel.value=v;else sel.value='';}
    });
  });
  document.getElementById('unmapped-banner').style.display='block';
  document.getElementById('calc-info').textContent=`⚠ ${unmappedItems.length}개 품목 라인 미배정`;
}

function applyUnmapped(){
  const{lm}=parsed.grd;
  const groups={};
  for(const it of unmappedItems){
    const key=`${it.brand}|${it.series}`;
    if(!groups[key])groups[key]={combos:[]};
    groups[key].combos.push(it.combo);
  }
  const rows=Object.values(groups);
  let assigned=0;
  rows.forEach((g,i)=>{
    const sel=document.getElementById(`umap-${i}`);
    const ln=sel?.value;
    if(ln&&ln!=='__direct'){
      for(const cb of g.combos){manualLineMap[cb]=ln;}
      assigned++;
    }
  });
  document.getElementById('unmapped-banner').style.display='none';
  document.getElementById('calc-info').textContent=`${assigned}개 시리즈 라인 배정 완료`;
  if(assigned>0)runCalc();
}

function dismissUnmapped(){
  document.getElementById('unmapped-banner').style.display='none';
  document.getElementById('calc-info').textContent='';
}

// ── 계산 ──
function calcOneMonth(monthItems,lm,im,tm,prod,wp,wn,ft,currentMonth){
  const rows=[];
  let skipped=0;
  for(const it of monthItems){
    let ln=gLine(it.combo,lm);
    if(!ln||EXCL.includes(ln)){
      if(it.isDev){ln='신제품';}else{if(!ln)skipped++;continue;}
    }
    rows.push({...it,line:ln,curInv:im[it.combo]||0,tgtMar:tm[it.combo]||0});
  }
  for(const e of extras){
    if(e.line&&e.qty>0&&(!e.month||e.month===currentMonth))rows.push({brand:e.brand||"추가",series:e.series||"추가건",combo:`ex_${Date.now()}_${Math.random()}`,name:e.label,sale:e.qty,tgtProd:e.qty,inv:0,line:e.line,curInv:0,tgtMar:0,prodAmt:0,note:e.label});
  }
  const tbl={},cbl={};
  for(const[cb,tg]of Object.entries(tm)){
    const ln=gLine(cb,lm);
    if(ln&&!EXCL.includes(ln)){tbl[ln]=(tbl[ln]||0)+tg;cbl[ln]=(cbl[ln]||0)+(im[cb]||0);}
  }
  const la={};
  const lineItems={};
  for(const r of rows){
    if(!la[r.line])la[r.line]={sale:0,tgtProd:0,tgtScp:0,cur:0,tgt:0,cnt:0,prodAmt:0,notes:[]};
    if(!lineItems[r.line])lineItems[r.line]=[];
    const a=la[r.line];a.sale+=r.sale;a.tgtProd+=(r.tgtProd||0);a.tgtScp+=(r.tgtScp||0);a.cur+=r.curInv;a.tgt+=r.tgtMar;a.cnt++;a.prodAmt+=(r.prodAmt||0);
    if(r.note)a.notes.push(r.note);
    lineItems[r.line].push({combo:r.combo,name:r.name||'',brand:r.brand||'',series:r.series||'',
      curInv:r.curInv,tgtMar:r.tgtMar,tgtScp:r.tgtScp||0,sale:r.sale,tgtProd:r.tgtProd||0,price:r.price||0,prodAmt:r.prodAmt||0});
  }
  const res=[];
  for(const[ln,a]of Object.entries(la)){
    const pd=prod[ln]||{total:0,nonScp:0,ratio:0};
    const d3=pd.total>0?pd.total/wp:0;
    const t3=tbl[ln]||0;
    const tgtScpTotal=a.tgtScp,curTotal=a.cur;
    const ff=tgtScpTotal>0?(curTotal/tgtScpTotal*100):100;
    const sh=tgtScpTotal>0?Math.max(tgtScpTotal-curTotal,0):0;
    const d4=(a.tgtProd+pd.nonScp)/wn,dd=d4-d3,dr=d3>0?(dd/d3*100):0;
    const tgt_prev=t3,tgt_cur=a.tgtScp;
    const td=tgt_cur-tgt_prev,tr2=tgt_prev>0?(td/tgt_prev*100):0;
    const capa=lineCapa[ln]||0;
    const capaRemain=capa>0?+(capa-d4).toFixed(1):null;
    const stockAmt=a.prodAmt;
    // 수기 비재고율 우선, 없으면 생산실적 자동(pProd ratio)
    const nsRatio=(manualNsRatio[ln]!=null&&!isNaN(manualNsRatio[ln]))?Number(manualNsRatio[ln]):pd.ratio;
    const nsEstAmt=nsRatio>0&&nsRatio<100?Math.round(stockAmt*(nsRatio/(100-nsRatio))):0;
    const totalAmt=stockAmt+nsEstAmt;const dailyAmt=wn>0?Math.round(totalAmt/wn):0;
    res.push({line:ln,cnt:a.cnt,sale:a.sale,tgtProd:a.tgtProd,cur:a.cur,tgt_prev,tgt_cur,td,tr:+tr2.toFixed(1),nr:+Number(nsRatio).toFixed(1),d3:+d3.toFixed(1),d4:+d4.toFixed(1),dd:+dd.toFixed(1),dr:+dr.toFixed(1),sh,ff:+ff.toFixed(1),stockAmt,nsEstAmt,totalAmt,dailyAmt,capa,capaRemain,notes:a.notes.join(", ")});
  }
  res.sort((a,b)=>a.dr-b.dr);
  return{data:res,lineItems,skipped};
}

function runCalc(){
  try{
    const wp=+document.getElementById('wp').value||22;
    const ft=+document.getElementById('ft').value||90;
    const{allMonthItems,combos,months}=parsed.scp;
    const{lm,im,tm}=parsed.grd;
    if(parsed._prodWb) parsed.prod=pProd(parsed._prodWb,combos);
    const prod=parsed.prod;
    renderNsTop10();
    
    // 각 월별 계산
    const monthResults={};
    const firstMonth=months[0];
    for(const mo of months){
      const wn=+(document.getElementById(`wd-${mo}`)?.value)||20;
      const items=allMonthItems[mo]||[];
      const r=calcOneMonth(items,lm,im,tm,prod,wp,wn,ft,mo);
      monthResults[mo]={...r,wp,wn,ft,month:mo};
    }
    
    // 첫 번째 월을 기본 표시용으로 설정
    const primary=monthResults[firstMonth];
    resultData={
      data:primary.data,wp,wn:+(document.getElementById(`wd-${firstMonth}`)?.value)||20,
      ft,skipped:primary.skipped,targetMonth:firstMonth,
      lineItems:primary.lineItems,
      monthResults,months
    };
    
    // 월별 라인 집계 (그래프용)
    const monthlyLines={};
    for(const mo of months){
      monthlyLines[mo]={};
      for(const r of monthResults[mo].data){
        monthlyLines[mo][r.line]={tp:r.tgtProd,amt:r.stockAmt||0};
      }
    }
    resultData.monthlyLines=monthlyLines;
    
    // 공유 데이터
    const lobbyAmt=N(document.getElementById('amt-lobby')?.value||0);
    try{
      const shareData={months,wp,ts:new Date().toISOString(),
        f:{s:files.scp||'',g:files.grd||'',p:files.prod||''},
        ex:extras.filter(e=>e.line&&e.qty>0).map(e=>({l:e.line,q:e.qty,b:e.brand,s:e.series,n:e.label})),
        lobby:lobbyAmt,ml:monthlyLines,mr:{}};
      for(const mo of months){
        const mr=monthResults[mo];
        const wn=mr.wn;
        const totalStock=mr.data.reduce((s,r)=>s+(r.stockAmt||0),0);
        const totalNsEst=mr.data.reduce((s,r)=>s+(r.nsEstAmt||0),0);
        const prodI=prod||{};
        // TOP10
        const diffItems=[];
        for(const r of mr.data){
          const scpItems=mr.lineItems[r.line]||[];
          const prodMap=(prodI._items||{})[r.line]||{};
          for(const it of scpItems){
            if((it.combo||'').startsWith('ex_'))continue;
            const prev=prodMap[it.combo]||0,cur=it.tgtProd||0,diff=cur-prev;
            if(prev===0&&cur===0)continue;
            diffItems.push({l:r.line,cd:it.combo.split('-')[0],cl:it.combo.split('-').slice(1).join('-'),
              nm:(it.name||'').substring(0,25),p:prev,c:cur,d:diff,r:prev>0?+((diff/prev)*100).toFixed(1):cur>0?999:0});
          }
        }
        shareData.mr[mo]={
          d:mr.data.map(r=>({l:r.line,c:r.cnt,s:r.sale,tp:r.tgtProd,cu:r.cur,tp2:r.tgt_prev,tc:r.tgt_cur,td:r.td,tr:r.tr,nr:r.nr,d3:r.d3,d4:r.d4,dd:r.dd,dr:r.dr,sh:r.sh,ff:r.ff,ca:r.capa,cr:r.capaRemain,sa:r.stockAmt,na:r.nsEstAmt,ta:r.totalAmt,da:r.dailyAmt})),
          wn,
          top:{dec:diffItems.filter(a=>a.d<0).sort((a,b)=>a.d-b.d).slice(0,10),
               inc:diffItems.filter(a=>a.d>0).sort((a,b)=>b.d-a.d).slice(0,10)},
          amt:{stock:totalStock,nsEst:totalNsEst,lobby:lobbyAmt,total:totalStock+totalNsEst+lobbyAmt,daily:wn>0?Math.round((totalStock+totalNsEst+lobbyAmt)/wn):0}
        };
      }
      // 소회사 정보도 공유
      shareData.sc=subCompanies.map(s=>({n:s.name,c:s.color,l:s.lines}));
      lastShareData=JSON.stringify(shareData);
    }catch(e){console.warn('공유 데이터 생성 실패:',e);}
    
    const info=`${months.map(m=>m+'월').join('·')} ${primary.data.length}개 라인 분석 완료`;
    document.getElementById('calc-info').textContent=info;
    document.getElementById('dl-btn').style.display='';
    document.getElementById('share-btn').style.display='';
    document.getElementById('tabs').style.display='flex';
    hideError();
    renderResult(currentTab);
  }catch(e){showError(`계산 오류: ${e.message}`);}
}

function showTab(t,btn){
  currentTab=t;
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderResult(t);
}

// ── 결과 렌더링 ──
function renderResult(tab='result'){
  if(!resultData)return;
  // 월별 탭 동적 생성
  const months=resultData.months||[resultData.targetMonth];
  const mtEl=document.getElementById('month-tabs');
  if(mtEl&&months.length>1){
    if(!resultData._activeMonth)resultData._activeMonth=months[0];
    mtEl.innerHTML=months.map(m=>`<button class="tab ${m===resultData._activeMonth?'active':''}" onclick="resultData._activeMonth=${m};renderResult('result')">${m}월</button>`).join('');
  }else if(mtEl){
    mtEl.innerHTML=`<button class="tab active">${months[0]}월 분석 결과</button>`;
  }
  
  const activeMonth=resultData._activeMonth||resultData.targetMonth;
  const mr=resultData.monthResults?resultData.monthResults[activeMonth]:null;
  const data=mr?mr.data:resultData.data;
  const wp=resultData.wp;
  const wn=mr?mr.wn:resultData.wn;
  const ft=resultData.ft||90;
  const targetMonth=activeMonth;
  const prevMonth=targetMonth-1;
  const lineItems=mr?mr.lineItems:resultData.lineItems;
  // lineItems를 resultData에 반영 (모달용)
  resultData.lineItems=lineItems;
  resultData.data=data;
  resultData.targetMonth=targetMonth;
  resultData.wn=wn;
  
  const area=document.getElementById('result-area');
  if(tab==='formula'){renderFormula(data,wp,wn,ft,targetMonth);return;}
  const tots=data.reduce((a,r)=>{a.cnt+=r.cnt;a.sale+=r.sale;a.tgtProd+=(r.tgtProd||0);a.d3+=r.d3;a.d4+=r.d4;a.cur+=r.cur;a.tgt_prev+=(r.tgt_prev||0);a.tgt_cur+=(r.tgt_cur||0);a.sh+=r.sh;return a;},{cnt:0,sale:0,tgtProd:0,d3:0,d4:0,cur:0,tgt_prev:0,tgt_cur:0,sh:0});
  const prods=data.filter(r=>r.line!=="부품포장"),parts=data.filter(r=>r.line==="부품포장");
  const NCOLS=17;
  const mkSub=(rows,label,cls)=>{
    const s=rows.reduce((a,r)=>{a.cnt+=r.cnt;a.sale+=r.sale;a.tgtProd+=(r.tgtProd||0);a.d3+=r.d3;a.d4+=r.d4;a.cur+=r.cur;a.tgt_prev+=(r.tgt_prev||0);a.tgt_cur+=(r.tgt_cur||0);return a;},{cnt:0,sale:0,tgtProd:0,d3:0,d4:0,cur:0,tgt_prev:0,tgt_cur:0});
    s.dd=+(s.d4-s.d3).toFixed(1);s.dr=s.d3>0?+((s.d4-s.d3)/s.d3*100).toFixed(1):0;
    s.td=s.tgt_cur-s.tgt_prev;s.tr=s.tgt_prev>0?+((s.tgt_cur-s.tgt_prev)/s.tgt_prev*100).toFixed(1):0;
    return `<tr class="${cls}">
      <td style="padding:6px 8px">${label}</td><td class="tc">${s.cnt}</td><td></td>
      <td class="tc">${D(s.d3)}</td><td class="tc">${D(s.d4)}</td>
      <td class="tc" style="color:${DC(s.dd)}">${s.dd>=0?"+":""}${D(s.dd)}</td>
      <td class="tc" style="color:${DC(s.dr)}">${s.dr>=0?"+":""}${s.dr.toFixed(1)}%</td>
      <td class="tr">${F(s.tgtProd||s.sale)}</td>
      <td class="tr">${F(s.cur)}</td>
      <td class="tr">${F(s.tgt_prev)}</td>
      <td class="tr">${F(s.tgt_cur)}</td>
      <td class="tr" style="color:${DC(s.td,100)}">${s.td>=0?"+":""}${F(s.td)}</td>
      <td class="tc" style="color:${DC(s.tr)}">${s.tr>=0?"+":""}${s.tr.toFixed(1)}%</td>
      <td colspan="4"></td></tr>`;
  };
  const mkRow=r=>{const bg=r.dr<-20?"row-red":r.dr>20?"row-green":"";
    const esc=r.line.replace(/'/g,"\\'");
    return `<tr class="${bg}" style="border-bottom:1px solid #f0ede5">
      <td style="padding:6px 8px;font-weight:700">${r.line}</td>
      <td class="tc">${r.cnt}</td>
      <td class="tc" style="color:${r.nr>=30?"#be185d":r.nr>=10?"#a855f7":"#888"};font-weight:${r.nr>=30?700:400}">${r.nr.toFixed(1)}%</td>
      <td class="tc">${D(r.d3)}</td>
      <td class="tc" style="font-weight:600">${D(r.d4)}</td>
      <td class="tc" style="color:${DC(r.dd)};font-weight:${Math.abs(r.dd)>10?700:400};cursor:pointer;text-decoration:underline dotted" ondblclick="showDiffModal('${esc}')">${r.dd>=0?"+":""}${D(r.dd)}</td>
      <td class="tc" style="color:${DC(r.dr)}">${r.dr>=0?"+":""}${r.dr.toFixed(1)}%</td>
      <td class="tr">${F(r.tgtProd||r.sale)}</td>
      <td class="tr">${F(r.cur)}</td>
      <td class="tr">${F(r.tgt_prev)}</td>
      <td class="tr">${F(r.tgt_cur)}</td>
      <td class="tr" style="color:${DC(r.td,100)};font-weight:${Math.abs(r.td)>100?700:400}">${r.td>=0?"+":""}${F(r.td)}</td>
      <td class="tc" style="color:${DC(r.tr)}">${r.tr>=0?"+":""}${r.tr.toFixed(1)}%</td>
      <td class="tc" style="color:${r.ff<90?"#dc2626":"#888"};font-weight:${r.ff<90?700:400};cursor:pointer;text-decoration:underline dotted" ondblclick="showFulfillModal('${esc}')">${r.ff.toFixed(0)}%</td>
      <td class="tc" style="color:${r.sh>0?"#dc2626":"#ccc"};${r.sh>0?"cursor:pointer;text-decoration:underline dotted":""}" ${r.sh>0?`ondblclick="showShortageModal('${esc}')"`:""}>${r.sh>0?F(r.sh):"-"}</td>
      <td class="tc" style="color:#6b21a8">${r.capa>0?F(r.capa):'-'}</td>
      <td class="tc" style="font-weight:${r.capaRemain!==null&&r.capaRemain<0?700:400};color:${r.capaRemain===null?'#ccc':r.capaRemain<0?'#dc2626':r.capaRemain<30?'#f59e0b':'#16a34a'}">${r.capaRemain!==null?((r.capaRemain>=0?'+':'')+D(r.capaRemain)+' <span style="font-size:10px;opacity:0.7">('+(r.capa>0?(r.capaRemain/r.capa*100).toFixed(0):0)+'%)</span>'):'-'}</td>
      </tr>`;
  };
  // 카드 요약
  const tgtDiffTot=tots.tgt_cur-tots.tgt_prev;
  const tgtRateTot=tots.tgt_prev>0?(tgtDiffTot/tots.tgt_prev*100).toFixed(1)+"%" :"-";
  area.innerHTML=`<div class="result-wrap">
    <div class="cards">
      <div class="card"><div class="lab">당월 목표입고</div><div class="val">${F(tots.tgtProd)}</div></div>
      <div class="card"><div class="lab">일투입 (${prevMonth}월${wp}일→${targetMonth}월${wn}일)</div><div class="val" style="color:${tots.d4-tots.d3<0?"#dc2626":"#16a34a"}">${D(tots.d3)} → ${D(tots.d4)}</div><div class="sub" style="color:${tots.d4-tots.d3<0?"#dc2626":"#16a34a"}">${tots.d4-tots.d3>=0?"+":""}${D(tots.d4-tots.d3)}</div></div>
      <div class="card"><div class="lab">목표재고 (${prevMonth}월→${targetMonth}월)</div><div class="val" style="color:#7c3aed">${F(tots.tgt_prev)} → ${F(tots.tgt_cur)}</div><div class="sub" style="color:${tgtDiffTot<0?"#dc2626":"#16a34a"}">${tgtDiffTot>=0?"+":""}${F(tgtDiffTot)} (${tgtRateTot})</div></div>
      <div class="card"><div class="lab">예상 목표재고 부족분</div><div class="val" style="color:${tots.sh>0?"#dc2626":"#888"}">${F(tots.sh)}개</div><div class="sub" style="color:${tots.sh>0?"#dc2626":"#888"}">${tots.sh>0?`+${(tots.sh/wn).toFixed(1)}/일`:"해당없음"}</div></div>
    </div>
    ${(resultData.skipped||0)>0?`<div style="background:#fff8e1;padding:8px 16px;font-size:12px;color:#92400e;border-bottom:1px solid #fde68a">⚠ ${resultData.skipped||0}개 품목이 라인 미배정으로 제외되었습니다.</div>`:""}
    ${buildAnalysisSummary(data,tots,prevMonth,targetMonth,wp,wn)}
    <div class="tbl-wrap"><table class="main">
      <thead>
        <tr style="background:#fafaf8">
          <th colspan="2" class="gh"></th>
          <th colspan="5" class="gh" style="background:#fce7f3;color:#be185d">비재고 반영 일투입</th>
          <th class="gh" style="background:#dbeafe;color:#1e40af">목표입고</th>
          <th colspan="5" class="gh" style="background:#d1fae5;color:#166534">재고 · 목표재고</th>
          <th colspan="2" class="gh" style="background:#fef3c7;color:#92400e">예상 목표재고 충족률</th>
          <th colspan="2" class="gh" style="background:#ede9fe;color:#6b21a8">CAPA</th>
        </tr>
        <tr style="background:#1a1a1a;color:#fff">
          <th>라인</th><th>품목</th><th>비재고%</th>
          <th>${prevMonth}월(${wp}일)</th><th>${targetMonth}월(${wn}일)</th><th>증감</th><th>증감률</th>
          <th>${targetMonth}월목표입고</th>
          <th>현재고</th><th>${prevMonth}월목표</th><th>${targetMonth}월목표</th><th>목표증감</th><th>목표증감률</th>
          <th>충족률</th><th>부족분</th>
          <th>일CAPA</th><th>잔여여유</th>
        </tr>
      </thead>
      <tbody>
        ${prods.map(mkRow).join('')}
        ${mkSub(prods,"제품 소계","sub-row")}
        <tr class="gap-row"><td colspan="17"></td></tr>
        ${parts.map(mkRow).join('')}
        ${parts.length?mkSub(parts,"부품 소계","sub-row"):""}
        <tr class="gap-row"><td colspan="17"></td></tr>
        ${mkSub(data,"합계","total-row")}
      </tbody>
    </table></div>
  </div>`;
}


// ── 분석 요약 생성 ──
function buildAnalysisSummary(data,tots,prevMonth,targetMonth,wp,wn){
  if(!resultData||!resultData.lineItems)return '';
  const prod=parsed.prod||{};
  
  // 1. 전체 품목별 증감 TOP10 수집 (목표입고량 기준)
  const allItems=[];
  for(const r of data){
    const scpItems=resultData.lineItems[r.line]||[];
    const prodItems=(prod._items||{})[r.line]||{};
    for(const it of scpItems){
      if(it.combo.startsWith('ex_'))continue;
      const prev=prodItems[it.combo]||0;
      const cur=it.tgtProd||0;  // 목표입고량
      const diff=cur-prev;
      if(prev===0&&cur===0)continue;
      allItems.push({line:r.line,code:it.combo.split('-')[0],color:it.combo.split('-').slice(1).join('-'),
        name:it.name||'',prev,cur,diff,rate:prev>0?((diff/prev)*100):cur>0?999:0});
    }
  }
  const topInc=allItems.filter(a=>a.diff>0).sort((a,b)=>b.diff-a.diff).slice(0,10);
  const topDec=allItems.filter(a=>a.diff<0).sort((a,b)=>a.diff-b.diff).slice(0,10);
  
  // 2. CAPA 분석
  const capaLines=data.filter(r=>r.capa>0);
  const overCapa=capaLines.filter(r=>r.capaRemain<0).sort((a,b)=>a.capaRemain-b.capaRemain);
  const looseCapa=capaLines.filter(r=>r.capaRemain>=0).sort((a,b)=>b.capaRemain-a.capaRemain);
  
  // CAPA 라인 표시 함수: 라인명(수량개/일, %부족/여유)
  const fmtOver=r=>`${r.line}(${D(Math.abs(r.capaRemain))}개/일, ${Math.abs(r.capa>0?(r.capaRemain/r.capa*100):0).toFixed(0)}% 부족)`;
  const fmtLoose=r=>`${r.line}(${D(r.capaRemain)}개/일, ${(r.capa>0?(r.capaRemain/r.capa*100):0).toFixed(0)}% 여유)`;
  
  // 3. HTML
  const mkItemRow=(it,i)=>{
    const dc=it.diff>0?'#16a34a':'#dc2626';
    const rateStr=it.rate===999?'신규':(it.rate>=0?'+':'')+it.rate.toFixed(1)+'%';
    return `<tr style="border-bottom:1px solid #f0ede5">
      <td style="padding:4px 8px;font-size:12px;color:#888">${i+1}</td>
      <td style="padding:4px 8px;font-size:12px">${it.line}</td>
      <td style="padding:4px 8px;font-size:12px;font-weight:600">${it.code}</td>
      <td style="padding:4px 8px;font-size:12px">${it.color}</td>
      <td style="padding:4px 8px;font-size:12px;color:#666;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.name}</td>
      <td style="padding:4px 8px;font-size:12px;text-align:right">${it.prev>0?F(it.prev):'-'}</td>
      <td style="padding:4px 8px;font-size:12px;text-align:right">${it.cur>0?F(it.cur):'-'}</td>
      <td style="padding:4px 8px;font-size:12px;text-align:right;color:${dc};font-weight:700">${it.diff>=0?'+':''}${F(it.diff)}</td>
      <td style="padding:4px 8px;font-size:12px;text-align:center;color:${dc}">${rateStr}</td>
    </tr>`;
  };
  
  const thStyle='padding:4px 8px;font-size:11px;text-align:left';
  const thR='padding:4px 8px;font-size:11px;text-align:right';
  const thC='padding:4px 8px;font-size:11px;text-align:center';
  
  return `<div style="padding:20px;border-bottom:1px solid #e5e2da">
    <div style="font-size:15px;font-weight:800;margin-bottom:14px;color:#1a1a1a">📋 ${targetMonth}월 SCP 라인별 부하 분석 요약</div>
    
    ${capaLines.length>0?`<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#6b21a8;margin-bottom:10px">⚡ CAPA 현황 요약</div>
      <div style="font-size:13px;line-height:2;color:#333">
        <div>${overCapa.length>0?`<span style="color:#dc2626;font-weight:700">CAPA 초과 ${overCapa.length}개 라인:</span> ${overCapa.map(fmtOver).join(', ')}`:`<span style="color:#16a34a;font-weight:600">✓ CAPA 초과 라인 없음</span>`}</div>
        <div>${looseCapa.length>0?`<span style="color:#16a34a;font-weight:700">여유 ${looseCapa.length}개 라인:</span> ${looseCapa.map(fmtLoose).join(', ')}`:''}
        </div>
      </div>
    </div>`:''}
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:8px">📉 목표입고 감소 TOP 10 (${prevMonth}월 투입 대비, SCP 재고품목 한정)</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#fef2f2">
            <th style="${thStyle}">#</th><th style="${thStyle}">라인</th><th style="${thStyle}">단품코드</th><th style="${thStyle}">색상</th><th style="${thStyle}">품목명</th>
            <th style="${thR}">${prevMonth}월</th><th style="${thR}">${targetMonth}월</th><th style="${thR}">증감</th><th style="${thC}">증감률</th>
          </tr></thead>
          <tbody>${topDec.map((it,i)=>mkItemRow(it,i)).join('')}</tbody>
        </table>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#16a34a;margin-bottom:8px">📈 목표입고 증가 TOP 10 (${prevMonth}월 투입 대비, SCP 재고품목 한정)</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f0fdf4">
            <th style="${thStyle}">#</th><th style="${thStyle}">라인</th><th style="${thStyle}">단품코드</th><th style="${thStyle}">색상</th><th style="${thStyle}">품목명</th>
            <th style="${thR}">${prevMonth}월</th><th style="${thR}">${targetMonth}월</th><th style="${thR}">증감</th><th style="${thC}">증감률</th>
          </tr></thead>
          <tbody>${topInc.map((it,i)=>mkItemRow(it,i)).join('')}</tbody>
        </table>
      </div>
    </div>
    
    ${buildAmountSummary(data,targetMonth,wn)}
    ${buildMonthlyChart(targetMonth)}
  </div>`;
}

function buildAmountSummary(data,targetMonth,wn){
  const lobbyAmt=N(document.getElementById('amt-lobby')?.value||0);
  const fmtW=n=>{if(n>=100000000)return (n/100000000).toFixed(1)+'억';if(n>=10000)return (n/10000).toFixed(0)+'만';return F(n);};
  const fmtM=n=>(n/1000000).toFixed(0);  // 백만원 단위
  
  let totalStock=0,totalNsEst=0;
  const lineAmts=data.map(r=>{
    totalStock+=r.stockAmt||0;totalNsEst+=r.nsEstAmt||0;
    return{line:r.line,stock:r.stockAmt||0,nsEst:r.nsEstAmt||0,total:r.totalAmt||0,daily:r.dailyAmt||0,nr:r.nr};
  }).sort((a,b)=>b.total-a.total);
  
  const grandTotal=totalStock+totalNsEst+lobbyAmt;
  const grandDaily=wn>0?Math.round(grandTotal/wn):0;
  
  return `<div style="margin-top:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px">
    <div style="font-size:14px;font-weight:700;color:#92400e">💰 ${targetMonth}월 생산 예상액은 <span style="font-size:18px;color:#1a1a1a">${fmtW(grandDaily)}/일</span>, <span style="font-size:18px;color:#1a1a1a">${fmtW(grandTotal)}/월</span> (입고가 기준)로 추정됩니다.</div>
    <div style="font-size:11px;color:#888;margin-top:6px">재고 ${fmtW(totalStock)} + 비재고 추정 ${fmtW(totalNsEst)}${lobbyAmt>0?' + 로비수출 '+fmtW(lobbyAmt):''} · 비재고 추정 = 재고금액 × (비재고율 ÷ (100-비재고율))</div>
  </div>`;
}

function buildMonthlyChart(targetMonth){
  if(!resultData||!resultData.monthlyLines||!resultData.monthResults)return '';
  const ml=resultData.monthlyLines;
  const mr=resultData.monthResults;
  const months=resultData.months||Object.keys(ml).map(Number).sort((a,b)=>a-b);
  if(months.length<2)return '';
  
  const fmtW=n=>{if(n>=100000000)return (n/100000000).toFixed(1)+'억';if(n>=10000)return Math.round(n/10000)+'만';return F(n);};
  const lobbyAmt=N(document.getElementById('amt-lobby')?.value||0);
  
  // 라인 목록
  const allLines=new Set();
  for(const mo of months){if(ml[mo])for(const ln of Object.keys(ml[mo]))allLines.add(ln);}
  const lineList=[...allLines];
  
  // 라인별 월별 데이터 수집 (일투입, 목표입고, 금액)
  const lineData=lineList.map(ln=>{
    const vals=months.map(mo=>{
      const tp=ml[mo]?.[ln]?.tp||0;
      const amt=ml[mo]?.[ln]?.amt||0;
      // 해당 월 결과에서 일투입/비재고율 가져오기
      const mrd=mr[mo]?.data?.find(r=>r.line===ln);
      const d4=mrd?.d4||0;
      const nr=mrd?.nr||0;
      const nsAmt=nr>0&&nr<100?Math.round(amt*(nr/(100-nr))):0;
      const wn=mr[mo]?.wn||20;
      return{tp,amt,nsAmt,totalAmt:amt+nsAmt,d4,wn};
    });
    return{line:ln,vals,totalTp:vals.reduce((s,v)=>s+v.tp,0)};
  }).sort((a,b)=>b.totalTp-a.totalTp);
  
  // 월별 합계
  const monthSums=months.map((mo,mi)=>{
    const tp=lineData.reduce((s,d)=>s+d.vals[mi].tp,0);
    const amt=lineData.reduce((s,d)=>s+d.vals[mi].amt,0);
    const nsAmt=lineData.reduce((s,d)=>s+d.vals[mi].nsAmt,0);
    const d4=lineData.reduce((s,d)=>s+d.vals[mi].d4,0);
    return{tp,amt,nsAmt,totalAmt:amt+nsAmt+lobbyAmt,d4};
  });
  
  const maxTp=Math.max(...lineData.flatMap(d=>d.vals.map(v=>v.tp)),1);
  const colors=['#2563eb','#16a34a','#f59e0b'];
  
  const html=`<div style="padding:20px;border-bottom:1px solid #e5e2da">
    <div style="font-size:15px;font-weight:800;margin-bottom:14px;color:#1a1a1a">📊 월별 라인별 생산 추이 (${months.map(m=>m+'월').join(' / ')})</div>
    
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#1a1a1a;color:#fff">
            <th style="padding:6px 8px;text-align:left" rowspan="2">라인</th>
            ${months.map((m,i)=>`<th colspan="3" style="padding:6px 4px;text-align:center;background:${colors[i%3]}22;color:${colors[i%3]};border-left:2px solid #333">${m}월 (${mr[m]?.wn||20}일)</th>`).join('')}
          </tr>
          <tr style="background:#f5f5f0">
            ${months.map((m,i)=>`
              <th style="padding:4px 4px;text-align:right;font-size:10px;border-left:2px solid #e5e2da">목표입고</th>
              <th style="padding:4px 4px;text-align:right;font-size:10px">일투입</th>
              <th style="padding:4px 4px;text-align:right;font-size:10px">금액</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${lineData.map(d=>{
            return `<tr style="border-bottom:1px solid #f0ede5">
              <td style="padding:5px 8px;font-weight:600">${d.line}</td>
              ${d.vals.map((v,mi)=>{
                const barW=maxTp>0?(v.tp/maxTp*100):0;
                return `
                  <td style="padding:4px 4px;text-align:right;border-left:2px solid #f0ede5">
                    <div style="position:relative">
                      <div style="position:absolute;bottom:0;left:0;height:100%;width:${barW}%;background:${colors[mi%3]}15;border-radius:2px"></div>
                      <span style="position:relative;font-weight:${mi===months.indexOf(targetMonth)?700:400}">${F(v.tp)}</span>
                    </div>
                  </td>
                  <td style="padding:4px 4px;text-align:right;font-weight:600;color:${colors[mi%3]}">${D(v.d4)}</td>
                  <td style="padding:4px 4px;text-align:right;font-size:11px;color:#888">${v.totalAmt>=100000000?(v.totalAmt/100000000).toFixed(1)+'억':(v.totalAmt/10000000).toFixed(0)+'백만'}</td>
                `;
              }).join('')}
            </tr>`;
          }).join('')}
          <tr style="font-weight:700;border-top:2px solid #1a1a1a">
            <td style="padding:6px 8px">합계</td>
            ${monthSums.map((s,mi)=>`
              <td style="padding:5px 4px;text-align:right;border-left:2px solid #ddd">${F(s.tp)}</td>
              <td style="padding:5px 4px;text-align:right;color:${colors[mi%3]}">${D(s.d4)}</td>
              <td style="padding:5px 4px;text-align:right;font-size:11px">${fmtW(s.totalAmt)}</td>
            `).join('')}
          </tr>
        </tbody>
      </table>
    </div>
    <div style="font-size:11px;color:#888;margin-top:8px">금액 = 재고 입고금액 + 비재고 추정(비재고율 기반) · 일투입 = (목표입고 + 비재고) ÷ 영업일</div>
    
    <div style="margin-top:20px">
      <div style="font-size:15px;font-weight:800;margin-bottom:14px;color:#1a1a1a">📈 소회사별 일투입 추이 (전월 실적 포함) <span style="font-size:11px;font-weight:400;color:#888">— 더블클릭 시 전체화면</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${subCompanies.map((sc,si)=>`
          <div style="background:#fff;border:1px solid ${sc.color}33;border-radius:10px;padding:12px;cursor:pointer" ondblclick="showFullChart(${si})">
            <div style="font-size:13px;font-weight:700;color:${sc.color};margin-bottom:8px">
              <span style="display:inline-block;width:10px;height:10px;background:${sc.color};border-radius:2px;margin-right:4px"></span>${sc.name}
            </div>
            <div id="subco-chart-${si}"></div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>`;
  setTimeout(()=>initSubCoCharts(lineData,months,mr),100);
  return html;
}

function initSubCoCharts(lineData,months,mr){
  const prevMonth=months[0]-1;
  const chartMonths=[prevMonth,...months];
  const chartLabels=chartMonths.map(m=>m+'월');
  const lineColors={'TC13(조립5)':'#2563eb','벌크':'#dc2626','도장(외부출고)':'#16a34a','T40-2_F':'#f59e0b',
    'T40_FKD':'#7c3aed','T80':'#0891b2','T50-2':'#be185d','T50-1':'#059669','T55':'#d97706',
    'M02':'#4f46e5','후레임2':'#0d9488','후레임3':'#ca8a04','플라이트':'#db2777','가죽':'#6366f1',
    '부품포장':'#9333ea','신제품':'#e11d48'};
  const allLD=lineData.map(d=>({line:d.line,vals:d.vals.map(v=>v.d4)}));
  const prevData={};
  for(const d of lineData){
    const mrd=mr[months[0]]?.data?.find(r=>r.line===d.line);
    prevData[d.line]=mrd?.d3||0;
  }
  window._chartData={allLD,prevData,chartMonths,chartLabels,lineColors};
  
  for(let si=0;si<subCompanies.length;si++){
    drawSubCoChart(si,false);
  }
}

function drawSubCoChart(si,fullscreen){
  const{allLD,prevData,chartMonths,chartLabels,lineColors}=window._chartData||{};
  if(!allLD)return;
  const sc=subCompanies[si];
  const elId=fullscreen?'fullchart-svg':`subco-chart-${si}`;
  const el=document.getElementById(elId);
  if(!el)return;
  
  // 전체화면: 필터 체크박스에서 선택된 라인만
  let selectedLines=sc.lines;
  let showCapa=true;
  if(fullscreen){
    const checks=document.querySelectorAll('[data-fullline]');
    if(checks.length>0){
      selectedLines=[];
      checks.forEach(c=>{if(c.checked)selectedLines.push(c.dataset.fullline);});
    }
    const capaCheck=document.querySelector('[data-showcapa]');
    if(capaCheck)showCapa=capaCheck.checked;
  }
  
  const W=fullscreen?1100:380,H=fullscreen?500:240,PL=50,PR=fullscreen?90:60,PT=25,PB=45;
  const cw=W-PL-PR,ch=H-PT-PB;
  const nPts=chartMonths.length;
  
  const series=selectedLines.map(ln=>{
    const ld=allLD.find(d=>d.line===ln);
    const prev=prevData[ln]||0;
    const vals=[prev,...(ld?ld.vals:[])];
    const capa=lineCapa[ln]||0;
    return{line:ln,vals,color:lineColors[ln]||'#888',capa};
  }).filter(s=>s.vals.some(v=>v>0));
  
  const allVals=series.flatMap(s=>s.vals);
  // CAPA 값도 Y축 범위에 포함
  const capaVals=showCapa?series.filter(s=>s.capa>0).map(s=>s.capa):[];
  if(allVals.length===0){el.innerHTML='<div style="color:#888;font-size:12px;padding:20px;text-align:center">데이터 없음</div>';return;}
  const maxY=Math.max(...allVals,...capaVals,1)*1.2;
  const xStep=nPts>1?cw/(nPts-1):cw;
  const fs=fullscreen?1:0.85;
  
  const yTicks=5;
  const yLines=Array.from({length:yTicks+1},(_,i)=>Math.round(maxY/yTicks*i));
  
  let svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;font-family:sans-serif">`;
  svg+=`<rect x="${PL}" y="${PT}" width="${cw}" height="${ch}" fill="#fafaf8" rx="4"/>`;
  for(const yv of yLines){
    const y=PT+ch-(yv/maxY*ch);
    svg+=`<line x1="${PL}" y1="${y}" x2="${PL+cw}" y2="${y}" stroke="#e5e2da" stroke-width="0.5"/>`;
    svg+=`<text x="${PL-5}" y="${y+4}" text-anchor="end" font-size="${9*fs}" fill="#888">${yv}</text>`;
  }
  for(let i=0;i<nPts;i++){
    const x=PL+i*xStep;
    svg+=`<text x="${x}" y="${H-PB+16}" text-anchor="middle" font-size="${10*fs}" fill="#555" font-weight="${i===0?'400':'700'}">${chartLabels[i]}</text>`;
    if(i===0)svg+=`<text x="${x}" y="${H-PB+27}" text-anchor="middle" font-size="${8*fs}" fill="#999">(실적)</text>`;
    svg+=`<line x1="${x}" y1="${PT}" x2="${x}" y2="${PT+ch}" stroke="#e5e2da" stroke-width="0.5" ${i===0?'stroke-dasharray="4,2"':''}/>`;
  }
  if(nPts>1){
    const bx=PL+xStep*0.5;
    svg+=`<line x1="${bx}" y1="${PT}" x2="${bx}" y2="${PT+ch}" stroke="${sc.color}" stroke-width="1" stroke-dasharray="5,3" opacity="0.3"/>`;
  }
  // CAPA 기준선
  if(showCapa){
    for(const s of series){
      if(s.capa>0&&s.capa<=maxY){
        const cy=PT+ch-(s.capa/maxY*ch);
        svg+=`<line x1="${PL}" y1="${cy}" x2="${PL+cw}" y2="${cy}" stroke="${s.color}" stroke-width="1.5" stroke-dasharray="8,4" opacity="0.5"/>`;
        svg+=`<text x="${PL+cw+4}" y="${cy+4}" font-size="${fullscreen?9:7}" fill="${s.color}" opacity="0.7">CAPA ${s.capa}</text>`;
      }
    }
  }
  // 꺾은선
  for(const s of series){
    const pts=s.vals.map((v,i)=>({x:PL+i*xStep,y:PT+ch-(v/maxY*ch)}));
    const path=pts.map((p,i)=>i===0?`M ${p.x} ${p.y}`:`L ${p.x} ${p.y}`).join(' ');
    svg+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="${fullscreen?2.5:2}" opacity="0.85"/>`;
    for(let i=0;i<pts.length;i++){
      const p=pts[i];
      svg+=`<circle cx="${p.x}" cy="${p.y}" r="${fullscreen?5:3.5}" fill="${s.color}" stroke="#fff" stroke-width="1.5"/>`;
      const ty=p.y-(fullscreen?10:7);const tfs=fullscreen?10:8;
      svg+=`<text x="${p.x}" y="${ty}" text-anchor="middle" font-size="${tfs}" fill="${s.color}" font-weight="600">${Math.round(s.vals[i]*10)/10}</text>`;
    }
    const last=pts[pts.length-1];
    svg+=`<text x="${last.x+6}" y="${last.y+4}" font-size="${fullscreen?11:8}" fill="${s.color}" font-weight="700">${s.line}</text>`;
  }
  svg+=`</svg>`;
  el.innerHTML=svg;
}

function showFullChart(si){
  const sc=subCompanies[si];
  const{lineColors}=window._chartData||{};
  document.getElementById('modal-container').innerHTML=`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="max-width:1200px;width:95%">
        <div class="modal-header" style="border-bottom-color:${sc.color}33">
          <h3 style="color:${sc.color}">
            <span style="display:inline-block;width:12px;height:12px;background:${sc.color};border-radius:3px;margin-right:6px"></span>
            ${sc.name} — 라인별 일투입 추이
          </h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div style="padding:8px 20px;border-bottom:1px solid #e5e2da;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:11px;color:#888;margin-right:4px">라인 필터:</span>
          ${sc.lines.map(l=>{
            const lc=lineColors?.[l]||'#888';
            return `<label style="font-size:11px;display:flex;align-items:center;gap:3px;cursor:pointer;padding:2px 8px;border-radius:4px;border:1px solid ${lc}66;background:${lc}10">
              <input type="checkbox" checked onchange="drawSubCoChart(${si},true)" data-fullline="${l}" style="width:12px;height:12px;accent-color:${lc}">
              <span style="color:${lc};font-weight:600">${l}</span>
            </label>`;
          }).join('')}
          <label style="font-size:11px;display:flex;align-items:center;gap:3px;cursor:pointer;padding:2px 8px;border-radius:4px;border:1px dashed #dc2626;background:#fef2f2">
            <input type="checkbox" checked onchange="drawSubCoChart(${si},true)" data-showcapa="1" style="width:12px;height:12px;accent-color:#dc2626">
            <span style="color:#dc2626;font-weight:600">CAPA 기준선</span>
          </label>
        </div>
        <div class="modal-body" style="padding:20px">
          <div id="fullchart-svg"></div>
        </div>
      </div>
    </div>`;
  setTimeout(()=>drawSubCoChart(si,true),50);
}

function renderFormula(data,wp,wn,ft,targetMonth){const prevMonth=targetMonth-1;
  const corrections=
    transfers.map(t=>`<tr><td>품목이관</td><td>${t.label}</td><td style="text-align:right;color:#7c3aed">라인재배치</td></tr>`).join('')+
    extras.filter(e=>e.line&&e.qty>0).map(e=>`<tr><td>추가건</td><td>${e.label||e.series} (${e.line})</td><td style="text-align:right;color:#16a34a">+${e.qty}개 (+${(e.qty/wn).toFixed(1)}/일)</td></tr>`).join('')+
    Object.entries(manualLineMap).map(([cb,ln])=>`<tr><td>수기지정</td><td>${cb}</td><td style="text-align:right;color:#f59e0b">${ln}</td></tr>`).join('')+
    data.filter(r=>r.sh>0).map(r=>`<tr><td>충족률보정</td><td>${r.line} (충족률 ${r.ff}%)</td><td style="text-align:right;color:#dc2626">부족 ${F(r.sh)}개 (+${(r.sh/wn).toFixed(1)}/일)</td></tr>`).join('');
  document.getElementById('result-area').innerHTML=`<div class="formula">
    <h2>일투입 계산식</h2>
    <div class="formula-box">
      <div><strong>${prevMonth}월 일투입</strong> = 전월 전체 투입(재고+비재고) ÷ ${wp}일</div>
      <div><strong>${targetMonth}월 일투입 = (SCP 목표입고량 + 비재고 유지 + 추가건) ÷ 영업일</div><div><strong>${targetMonth}월 일투입</strong> = (목표입고 + 비재고 유지 + 추가건) ÷ ${wn}일</div>
      <div style="font-size:12px;color:#888;margin-top:8px">비재고 = 투입 품목 중 SCP에 없는 품목 (전월 실적 유지 가정)</div>
      <div style="font-size:12px;color:#888">충족률 = 현재고 ÷ 당월 목표재고(SCP) × 100 (${ft}% 미달시 부족분 추가)</div>
      <div style="font-size:12px;color:#888">목표재고 증감 = 당월목표(SCP예상기말) - 전월목표(재고리스트)</div>
    </div>
    <h3 style="font-size:14px;font-weight:700;margin-bottom:8px">적용된 보정 내역</h3>
    <table class="corr"><thead><tr><th>구분</th><th>내용</th><th>영향</th></tr></thead>
    <tbody>${corrections||'<tr><td colspan="3" style="color:#888;text-align:center">보정 없음</td></tr>'}</tbody></table>
  </div>`;
}

// ── 엑셀 ──
function dlExcel(){
  if(!resultData)return;const{data,wn}=resultData;
  const h=["포장라인","품목수","비재고%","전월일투입","당월일투입","증감","증감률","목표입고","현재고","전월목표","당월목표","목표증감","목표증감률","충족률","부족분","비고"];
  const rows=data.map(r=>[r.line,r.cnt,`${r.nr}%`,r.d3,r.d4,r.dd,`${r.dr>=0?"+":""}${r.dr}%`,r.tgtProd||r.sale,r.cur,(r.tgt_prev||0),(r.tgt_cur||0),r.td,`${r.tr>=0?"+":""}${r.tr}%`,`${r.ff}%`,r.sh,r.notes]);
  const ws=XLSX.utils.aoa_to_sheet([h,...rows]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"분석결과");
  XLSX.writeFile(wb,"SCP_부하분석.xlsx");
}

function showError(msg){const el=document.getElementById('error-box');el.textContent=msg;el.style.display='block';}
function hideError(){document.getElementById('error-box').style.display='none';}

function closeModal(){document.getElementById('modal-container').innerHTML='';}

// 부족분 더블클릭 → 당월 목표재고 대비 부족 품목 상세
function showShortageModal(line){
  if(!resultData||!resultData.lineItems)return;
  const items=resultData.lineItems[line]||[];
  // SCP 당월 목표재고(tgtScp) 대비 현재고 부족 품목
  const short=items.filter(it=>it.tgtScp>0 && it.curInv<it.tgtScp).map(it=>({
    ...it,shortage:it.tgtScp-it.curInv,
    code:it.combo.split('-')[0],color:it.combo.split('-').slice(1).join('-')
  })).sort((a,b)=>b.shortage-a.shortage);

  const totalShort=short.reduce((s,it)=>s+it.shortage,0);
  const totalTgt=short.reduce((s,it)=>s+it.tgtScp,0);
  const totalCur=short.reduce((s,it)=>s+it.curInv,0);
  const tm=resultData.targetMonth||5;

  document.getElementById('modal-container').innerHTML=`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h3>📦 ${line} — ${tm}월 목표재고 부족 품목 (${short.length}건)</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div style="padding:12px 20px;background:#fef2f2;border-bottom:1px solid #fecaca;font-size:13px;color:#991b1b">
          ${tm}월 목표재고 <strong>${F(totalTgt)}</strong> 대비 현재고 <strong>${F(totalCur)}</strong> → 부족분 <strong style="color:#dc2626">${F(totalShort)}</strong>개
        </div>
        <div class="modal-body">
          <table>
            <thead><tr>
              <th>단품코드</th><th>색상</th><th style="text-align:right">${tm}월 목표</th>
              <th style="text-align:right">현재고</th><th style="text-align:right;color:#dc2626">부족량</th>
            </tr></thead>
            <tbody>
              ${short.map(it=>`<tr>
                <td style="font-weight:600">${it.code}</td>
                <td>${it.color}</td>
                <td class="tr">${F(it.tgtScp)}</td>
                <td class="tr">${F(it.curInv)}</td>
                <td class="tr" style="color:#dc2626;font-weight:700">${F(it.shortage)}</td>
              </tr>`).join('')}
              ${short.length===0?'<tr><td colspan="5" style="text-align:center;color:#888;padding:20px">부족 품목 없음</td></tr>':''}
              ${short.length>0?`<tr style="font-weight:700;border-top:2px solid #1a1a1a">
                <td colspan="2">합계</td>
                <td class="tr">${F(totalTgt)}</td>
                <td class="tr">${F(totalCur)}</td>
                <td class="tr" style="color:#dc2626">${F(totalShort)}</td>
              </tr>`:''}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// 충족률 더블클릭 → 전체 품목 충족률 순 상세
function showFulfillModal(line){
  const tm=resultData.targetMonth||5;
  if(!resultData||!resultData.lineItems)return;
  const items=resultData.lineItems[line]||[];
  // 당월 목표 대비 충족률 계산 (목표재고 0인 것 제외)
  const detail=items.filter(it=>it.tgtScp>0).map(it=>({
    ...it,
    code:it.combo.split('-')[0],color:it.combo.split('-').slice(1).join('-'),
    fulfill:+(it.curInv/it.tgtScp*100).toFixed(1),
    diff:it.curInv-it.tgtScp
  })).sort((a,b)=>b.fulfill-a.fulfill);  // 충족률 높은 순

  const totalTgt=detail.reduce((s,it)=>s+it.tgtScp,0);
  const totalCur=detail.reduce((s,it)=>s+it.curInv,0);
  const totalFf=totalTgt>0?+(totalCur/totalTgt*100).toFixed(1):0;

  document.getElementById('modal-container').innerHTML=`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h3>📊 ${line} — 당월 목표 대비 충족률 (${detail.length}건, 충족률 높은 순)</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div style="padding:12px 20px;background:#f0fdf4;border-bottom:1px solid #bbf7d0;font-size:13px;color:#166534">
          라인 전체 충족률: <strong>${totalFf}%</strong> (${tm}월 목표 ${F(totalTgt)} / 현재고 ${F(totalCur)} / 과부족 ${totalCur-totalTgt>=0?"+":""}${F(totalCur-totalTgt)})
        </div>
        <div class="modal-body">
          <table>
            <thead><tr>
              <th>단품코드</th><th>색상</th><th style="text-align:right">당월 목표</th>
              <th style="text-align:right">현재고</th><th style="text-align:right">과부족</th>
              <th style="text-align:center">충족률</th>
            </tr></thead>
            <tbody>
              ${detail.map(it=>{
                const fc=it.fulfill<80?'#dc2626':it.fulfill<100?'#f59e0b':it.fulfill<150?'#16a34a':'#2563eb';
                const bg=it.fulfill<80?'#fef2f2':it.fulfill>200?'#eff6ff':'';
                return `<tr style="${bg?'background:'+bg:''}">
                  <td style="font-weight:600">${it.code}</td>
                  <td>${it.color}</td>
                  <td class="tr">${F(it.tgtScp)}</td>
                  <td class="tr">${F(it.curInv)}</td>
                  <td class="tr" style="color:${it.diff>=0?'#16a34a':'#dc2626'};font-weight:${Math.abs(it.diff)>10?700:400}">${it.diff>=0?"+":""}${F(it.diff)}</td>
                  <td class="tc" style="color:${fc};font-weight:700">${it.fulfill}%</td>
                </tr>`;
              }).join('')}
              <tr style="font-weight:700;border-top:2px solid #1a1a1a">
                <td colspan="2">합계</td>
                <td class="tr">${F(totalTgt)}</td>
                <td class="tr">${F(totalCur)}</td>
                <td class="tr" style="color:${totalCur-totalTgt>=0?'#16a34a':'#dc2626'}">${totalCur-totalTgt>=0?"+":""}${F(totalCur-totalTgt)}</td>
                <td class="tc" style="font-weight:700">${totalFf}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// 일투입 증감 더블클릭 → 품목별 전월 투입 vs 당월 목표입고 비교
// 일투입 증감 더블클릭 → 품목별 전월 투입 vs 당월 목표입고 + 현재고 + 필요생산
function showDiffModal(line){
  if(!resultData||!resultData.lineItems)return;
  const scpItems=resultData.lineItems[line]||[];
  const prod=typeof parsed!=='undefined'&&parsed.prod?parsed.prod:{};
  const prodItems=(prod._items||{})[line]||{};
  const tm=resultData.targetMonth||5;
  const pm=tm-1;
  const wp=resultData.wp||21;
  const wn=resultData.wn||22;

  const rows=[];
  for(const it of scpItems){
    if((it.combo||'').startsWith('ex_'))continue;
    // 공유모드: it.prev가 있으면 사용, 아니면 parsed.prod에서 조회
    const prevQty=it.prev!==undefined?it.prev:(prodItems[it.combo]||0);
    const curQty=it.tgtProd||0;
    const curInv=it.curInv||0;
    const tgtScp=it.tgtScp||0;
    const diff=curQty-prevQty;
    const rate=prevQty>0?((diff/prevQty)*100):curQty>0?999:0;
    const code=(it.combo||'').split('-')[0];
    const color=(it.combo||'').split('-').slice(1).join('-');
    rows.push({combo:it.combo,code,color,name:it.name||'',prevQty,curQty,curInv,tgtScp,diff,rate});
  }
  rows.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff));

  const totalPrev=rows.reduce((s,r)=>s+r.prevQty,0);
  const totalCur=rows.reduce((s,r)=>s+r.curQty,0);
  const totalInv=rows.reduce((s,r)=>s+r.curInv,0);
  const totalTgt=rows.reduce((s,r)=>s+r.tgtScp,0);
  const totalDiff=totalCur-totalPrev;

  document.getElementById('modal-container').innerHTML=`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="max-width:1100px">
        <div class="modal-header">
          <h3>📈 ${line} — 재고품목 목표입고 증감 (${rows.length}건, 편차 큰 순)</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div style="padding:12px 20px;background:#fafaf8;border-bottom:1px solid #e5e2da;font-size:13px;color:#333">
          ${pm}월 투입 <strong>${F(totalPrev)}</strong> → ${tm}월 목표입고 <strong>${F(totalCur)}</strong> → 증감 <strong style="color:${DC(totalDiff)}">${totalDiff>=0?"+":""}${F(totalDiff)}</strong>
          <span style="color:#888;margin-left:8px">(일투입: ${D(totalPrev/wp)} → ${D(totalCur/wn)})</span>
          <div style="font-size:11px;color:#92400e;margin-top:4px">※ SCP 재고품목 한정 · 필요생산 = 목표입고 + ${tm}월목표 − 현재고 (현재고 많으면 필요생산 감소)</div>
        </div>
        <div class="modal-body">
          <table>
            <thead><tr>
              <th>단품코드</th><th>색상</th><th>품목명</th>
              <th style="text-align:right">${pm}월 투입</th>
              <th style="text-align:right">${tm}월 목표입고</th>
              <th style="text-align:right">증감</th>
              <th style="text-align:center">증감률</th>
              <th style="text-align:right;background:#e0f2fe">현재고</th>
              <th style="text-align:right;background:#e0f2fe">${tm}월목표</th>
              
            </tr></thead>
            <tbody>
              ${rows.filter(r=>r.prevQty>0||r.curQty>0).map(r=>{
                const dc=r.diff<0?'#dc2626':r.diff>0?'#16a34a':'#888';
                const rateStr=r.rate===999?'신규':(r.rate>=0?"+":"")+r.rate.toFixed(1)+"%";
                const bg=Math.abs(r.diff)>=50?r.diff<0?'#fef2f2':'#f0fdf4':'';
                const invHigh=r.curInv>r.tgtScp&&r.tgtScp>0;
                return '<tr style="'+(bg?'background:'+bg:'')+'">'+
                  '<td style="font-weight:600">'+r.code+'</td>'+
                  '<td>'+r.color+'</td>'+
                  '<td style="font-size:11px;color:#666;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+r.name+'</td>'+
                  '<td class="tr">'+(r.prevQty>0?F(r.prevQty):'-')+'</td>'+
                  '<td class="tr">'+(r.curQty>0?F(r.curQty):'-')+'</td>'+
                  '<td class="tr" style="color:'+dc+';font-weight:'+(Math.abs(r.diff)>=20?700:400)+'">'+(r.diff>=0?"+":"")+F(r.diff)+'</td>'+
                  '<td class="tc" style="color:'+dc+'">'+rateStr+'</td>'+
                  '<td class="tr" style="'+(invHigh?'color:#2563eb;font-weight:700':'')+'">'+F(r.curInv)+'</td>'+
                  '<td class="tr">'+(r.tgtScp>0?F(r.tgtScp):'-')+'</td>'+
                  
                  '</tr>';
              }).join('')}
              <tr style="font-weight:700;border-top:2px solid #1a1a1a">
                <td colspan="3">합계</td>
                <td class="tr">${F(totalPrev)}</td>
                <td class="tr">${F(totalCur)}</td>
                <td class="tr" style="color:${DC(totalDiff)}">${totalDiff>=0?"+":""}${F(totalDiff)}</td>
                <td class="tc">${totalPrev>0?(totalDiff/totalPrev*100).toFixed(1)+"%":"-"}</td>
                <td class="tr">${F(totalInv)}</td>
                <td class="tr">${F(totalTgt)}</td>
                
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

