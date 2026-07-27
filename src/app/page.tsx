'use client'
import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DEFECT_TYPES, RECORD_MODES } from '@/lib/config'

type Mode = 'quick' | 'lot'
type Plan = { id:string; item_code:string; color_code:string; item_name:string; production_line:string; pack_plan_date:string; plan_qty:number; shift:string; lot_number:string; status:string }
type Material = { id:string; material_code:string; material_color:string; material_name:string; material_category:string }

function Section({ title, children, accent }: { title:string; children:React.ReactNode; accent?:string }) {
  return (
    <div className={`bg-white rounded-2xl mx-3 mt-3 p-4 shadow-sm ${accent?`border-l-4 ${accent}`:''}`}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}
function Counter({ label, value, onChange, min=0, max=9999, hl }: { label:string; value:number; onChange:(v:number)=>void; min?:number; max?:number; hl?:string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500 text-center mb-2">{label}</p>
      <div className="flex items-center gap-1">
        <button className="counter-btn bg-red-50 text-red-600 flex-shrink-0" onClick={()=>onChange(Math.max(min,value-1))}>−</button>
        <input type="number" value={value} min={min} max={max}
          onChange={e=>onChange(Math.max(min,Math.min(max,parseInt(e.target.value)||0)))}
          className={`min-w-0 w-full text-center text-2xl font-medium border-2 rounded-xl py-2 focus:outline-none ${hl||'border-gray-200 focus:border-green-700'}`} />
        <button className="counter-btn bg-green-50 text-green-700 flex-shrink-0" onClick={()=>onChange(Math.min(max,value+1))}>＋</button>
      </div>
    </div>
  )
}
function YieldBar({ pct }: { pct:number }) {
  const c = pct>=95?'bg-green-600':pct>=85?'bg-amber-500':'bg-red-500'
  const t = pct>=95?'text-green-700':pct>=85?'text-amber-700':'text-red-700'
  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-xl">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-500">수율</span>
        <span className={`font-bold text-2xl ${t}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${c}`} style={{width:`${Math.min(100,pct)}%`}} />
      </div>
      {pct<95&&pct>0&&<p className={`text-xs mt-1.5 text-center font-medium ${t}`}>{pct<85?'⚠ 수율 낮음':'목표 수율(95%) 미달'}</p>}
    </div>
  )
}

function Stopwatch({ onApply }: { onApply:(sec:number)=>void }) {
  const [running,setRunning]=useState(false)
  const [elapsed,setElapsed]=useState(0)
  const [measurements,setMeasurements]=useState<number[]>([])
  const [stopped,setStopped]=useState(false)
  const [manMin,setManMin]=useState(0)
  const [manSec,setManSec]=useState(0)
  const [finalSec,setFinalSec]=useState(0)
  const startRef=useRef<number>(0)
  const rafRef=useRef<number>(0)
  const tick=useCallback(()=>{ setElapsed(Date.now()-startRef.current); rafRef.current=requestAnimationFrame(tick) },[])
  function toggle() {
    if(!running){ startRef.current=Date.now()-elapsed; setRunning(true); setStopped(false); rafRef.current=requestAnimationFrame(tick) }
    else{ cancelAnimationFrame(rafRef.current); setRunning(false); setStopped(true) }
  }
  function save() {
    const sec=Math.round(elapsed/1000); const next=[...measurements,sec]; setMeasurements(next)
    const avg=Math.round(next.reduce((a,b)=>a+b,0)/next.length); applyFinal(avg)
    setElapsed(0); setStopped(false)
  }
  function reset() { cancelAnimationFrame(rafRef.current); setRunning(false); setStopped(false); setElapsed(0); setMeasurements([]); setFinalSec(0); setManMin(0); setManSec(0) }
  function applyFinal(sec:number){ setFinalSec(sec); setManMin(Math.floor(sec/60)); setManSec(sec%60); onApply(sec) }
  function handleManual(m:number,s:number){ const sec=m*60+s; setManMin(m); setManSec(s); applyFinal(sec) }
  const secs=Math.floor(elapsed/1000); const min=Math.floor(secs/60); const sec=secs%60; const cs=Math.floor((elapsed%1000)/10)
  const fmt=(n:number)=>n.toString().padStart(2,'0')
  const avg=measurements.length?Math.round(measurements.reduce((a,b)=>a+b,0)/measurements.length):0
  return (
    <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
      <div className="bg-gray-900 px-4 py-4 text-center">
        <div className="text-5xl font-light text-white tabular-nums tracking-wider">{fmt(min)}:{fmt(sec)}<span className="text-2xl text-gray-500">.{fmt(cs)}</span></div>
        {measurements.length>0&&(
          <div className="mt-2">
            <div className="flex gap-1.5 flex-wrap justify-center mb-1">
              {measurements.map((m,i)=><span key={i} className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-1 rounded-lg">#{i+1} {Math.floor(m/60)}:{fmt(m%60)}</span>)}
            </div>
            <div className="text-sm text-green-400 font-medium">평균 {Math.floor(avg/60)}분 {avg%60}초 ({avg}초)</div>
          </div>
        )}
      </div>
      <div className="flex gap-2 p-3">
        <button onClick={toggle} className={`flex-1 py-3 rounded-xl text-sm font-medium ${running?'bg-red-500 text-white':'bg-green-800 text-white'}`}>
          {running?'정지':stopped?'재시작':'시작'}
        </button>
        {stopped&&<button onClick={save} className="flex-1 py-3 rounded-xl text-sm font-medium bg-blue-600 text-white">저장 #{measurements.length+1}</button>}
        <button onClick={reset} className="flex-1 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-600">초기화</button>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <span className="text-xs text-gray-500 flex-shrink-0">직접 입력</span>
        <input type="number" min={0} max={59} value={manMin} onChange={e=>handleManual(parseInt(e.target.value)||0,manSec)}
          className="w-14 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-center text-base font-medium font-mono focus:outline-none focus:border-green-700 bg-white" />
        <span className="text-xs text-gray-500">분</span>
        <input type="number" min={0} max={59} value={manSec} onChange={e=>handleManual(manMin,parseInt(e.target.value)||0)}
          className="w-14 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-center text-base font-medium font-mono focus:outline-none focus:border-green-700 bg-white" />
        <span className="text-xs text-gray-500">초</span>
      </div>
      {finalSec>0&&(
        <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border-t border-green-100">
          <span className="text-xs text-gray-500">확정 ST</span>
          <span className="font-bold text-green-800 font-mono text-sm">{finalSec}초 ({Math.floor(finalSec/60)}분 {finalSec%60}초)</span>
          {measurements.length>1&&<span className="text-xs text-green-600">({measurements.length}회 평균)</span>}
          <span className="ml-auto text-green-600 text-lg">✓</span>
        </div>
      )}
    </div>
  )
}

// 업로드 전 브라우저에서 리사이즈+JPEG 압축 (긴 변 1600px, 품질 0.7)
async function compressImage(file: File, maxDim=1600, quality=0.7): Promise<Blob> {
  if(!file.type.startsWith('image/')) return file
  const bitmap = await createImageBitmap(file).catch(()=>null)
  if(!bitmap) return file
  let { width, height } = bitmap
  if(width>maxDim || height>maxDim){
    const scale = maxDim/Math.max(width,height)
    width=Math.round(width*scale); height=Math.round(height*scale)
  }
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height
  const ctx=canvas.getContext('2d'); if(!ctx) return file
  ctx.drawImage(bitmap,0,0,width,height); bitmap.close?.()
  const blob: Blob|null = await new Promise(res=>canvas.toBlob(res,'image/jpeg',quality))
  // 압축 결과가 원본보다 크면 원본 사용 (이미 작은 파일 보호)
  return (blob && blob.size < file.size) ? blob : file
}

function PhotoUpload({ photos, onPhotos }: { photos:{path:string;url:string}[]; onPhotos:(p:{path:string;url:string}[])=>void }) {
  const fileRef=useRef<HTMLInputElement>(null); const slotRef=useRef(0); const MAX=5
  const [uploading,setUploading]=useState(false)
  async function handleFile(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file)return
    setUploading(true)
    try {
      const blob=await compressImage(file)
      const formData=new FormData()
      formData.append('file',blob,'photo.jpg')
      const res=await fetch('/api/upload',{method:'POST',body:formData})
      const data=await res.json()
      if(!data.ok) throw new Error(data.error)
      const next=[...photos]; next[slotRef.current]={path:data.path,url:data.url}; onPhotos(next)
    } catch(err){ alert('사진 업로드 실패. 다시 시도해주세요.') }
    setUploading(false); e.target.value=''
  }
  function del(i:number){ const next=[...photos]; next.splice(i,1); onPhotos(next) }
  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({length:Math.min(MAX,photos.length+1)}).map((_,i)=>{
          const src=photos[i]
          return src?(
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-black border-2 border-green-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src.url} alt="" className="w-full h-full object-cover" />
              <button onClick={()=>del(i)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center">×</button>
            </div>
          ):(
            <button key={i} onClick={()=>{ slotRef.current=i; fileRef.current?.click() }} disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-green-500 hover:text-green-600 transition-colors bg-gray-50 disabled:opacity-50">
              {uploading&&i===photos.length?<span className="text-xs">올리는 중...</span>:<><span className="text-xl mb-0.5">+</span><span className="text-xs">추가</span></>}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 text-center mt-2">카메라 촬영 또는 갤러리 · 최대 {MAX}장</p>
    </div>
  )
}

function RecordForm() {
  const router=useRouter(); const params=useSearchParams(); const lineParam=params.get('line')
  const [mode,setMode]=useState<Mode>('lot')
  const [plans,setPlans]=useState<Plan[]>([]); const [selPlan,setSelPlan]=useState<Plan|null>(null)
  const [inputQty,setInputQty]=useState(0); const [goodQty,setGoodQty]=useState(0); const [defectQty,setDefectQty]=useState(0)
  const [defects,setDefects]=useState<string[]>([]); const [materials,setMaterials]=useState<Material[]>([])
  const [selMats,setSelMats]=useState<string[]>([]); const [stSeconds,setStSeconds]=useState(0)
  const [photos,setPhotos]=useState<{path:string;url:string}[]>([])
  const [videos,setVideos]=useState<{url:string;desc:string}[]>([{url:'',desc:''}])
  const [memo,setMemo]=useState('')
  const [submitting,setSubmitting]=useState(false); const [plansLoading,setPlansLoading]=useState(true)
  const [showCompleted,setShowCompleted]=useState(false)
  const [now,setNow]=useState(new Date())
  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`
  const [dateFrom,setDateFrom]=useState(todayStr)
  const [dateTo,setDateTo]=useState(todayStr)
  const [filterLine,setFilterLine]=useState('')

  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t) },[])
  useEffect(()=>{ loadPlans() },[dateFrom,dateTo])
  useEffect(()=>{ if(selPlan){ loadBom(selPlan.item_code,selPlan.color_code); setSelMats([]) } },[selPlan])
  useEffect(()=>{ if(mode!=='quick') setDefectQty(Math.max(0,inputQty-goodQty)) },[goodQty,inputQty,mode])

  async function loadPlans() {
    setPlansLoading(true)
    const params=new URLSearchParams()
    if(dateFrom&&dateTo) { params.set('dateFrom',dateFrom); params.set('dateTo',dateTo) }
    if(lineParam) params.set('line',lineParam)
    const res=await fetch(`/api/plans?${params.toString()}`)
    const p=res.ok?await res.json():[]
    setPlans(p)
    setPlansLoading(false)
  }

  const allLines = Array.from(new Set(plans.map(p=>p.production_line).filter(Boolean))).sort()
  const visiblePlans = plans.filter(p=> p.status!=='completed' && (filterLine===''||p.production_line===filterLine))
  const completedPlans = plans.filter(p=> p.status==='completed' && (filterLine===''||p.production_line===filterLine))

  // selPlan은 항상 "현재 화면에 보이는 계획" 중 하나여야 한다.
  // (목록 재조회·라인 필터 변경 시 숨겨진/삭제된 계획이 선택된 채로 남아 오기록되는 것 방지)
  useEffect(()=>{
    const vis = plans.filter(p=> p.status!=='completed' && (filterLine===''||p.production_line===filterLine))
    if(!selPlan || !vis.some(p=>p.id===selPlan.id)){
      const first = vis[0] ?? null
      setSelPlan(first)
      if(first){ setInputQty(first.plan_qty||0); setGoodQty(first.plan_qty||0) }
    }
  },[plans,filterLine])
  async function loadBom(itemCode:string,colorCode:string) {
    const res=await fetch(`/api/bom?item_code=${encodeURIComponent(itemCode)}&color_code=${encodeURIComponent(colorCode)}`)
    const data=res.ok?await res.json():[]
    setMaterials(data as Material[])
  }
  function toggleDefect(k:string){ setDefects(p=>p.includes(k)?p.filter(d=>d!==k):[...p,k]) }
  function toggleMat(key:string){ setSelMats(p=>p.includes(key)?p.filter(c=>c!==key):[...p,key]) }
  function matKey(m:Material){ return `${m.material_code}::${m.material_color}` }
  const matByCat=materials.reduce((acc,m)=>{ const c=m.material_category||'기타'; if(!acc[c])acc[c]=[]; acc[c].push(m); return acc },{} as Record<string,Material[]>)
  const yieldPct=inputQty>0?(goodQty/inputQty)*100:0

  async function handleSubmit() {
    if(!selPlan){ alert('제품을 선택해주세요'); return }
    // 선택된 계획이 현재 화면 목록에 없으면(숨김/삭제/필터 불일치) 오기록 방지
    if(!visiblePlans.some(p=>p.id===selPlan.id)){
      alert('선택한 계획이 현재 목록에 없습니다. 제품을 다시 선택해주세요.'); return
    }
    setSubmitting(true)
    const res=await fetch('/api/record',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ mode, plan_id:selPlan.id, item_code:selPlan.item_code, color_code:selPlan.color_code,
        item_name:selPlan.item_name, production_line:selPlan.production_line, shift:selPlan.shift,
        input_qty:mode!=='quick'?inputQty:null, good_qty:mode!=='quick'?goodQty:null,
        defect_qty:defectQty||null, defect_types:defects, defect_materials:selMats,
        st_seconds:mode!=='quick'&&stSeconds>0?stSeconds:null, photo_urls:photos.map(p=>p.path),
        video_url:videos.some(v=>v.url.trim())?JSON.stringify(videos.filter(v=>v.url.trim())):null,
        memo:memo||null})})
    const data=await res.json()
    if(data.ok){
      const q=new URLSearchParams({ mode, item_code:selPlan.item_code, color_code:selPlan.color_code,
        item_name:selPlan.item_name, line:selPlan.production_line,
        good:String(goodQty), input:String(inputQty), defect:String(defectQty),
        defects:defects.join(','), yield:yieldPct.toFixed(1), st:String(stSeconds), photos:String(photos.length) })
      router.push('/done?'+q.toString())
    } else { alert('저장 실패. 다시 시도해주세요.') }
    setSubmitting(false)
  }

  return (
    <div className="pb-8 max-w-md mx-auto bg-gray-100 min-h-screen">
      <div className="bg-green-800 text-white px-4 pt-4 pb-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-medium">생산 기록</h1>
              <p className="text-xs text-green-200 mt-0.5">Sidiz 평택공장</p>
            </div>
            <button onClick={()=>router.push('/history')}
              className="bg-green-700/60 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-full transition-colors">
              기록 현황
            </button>
            <a href="https://heartfelt-meringue-fe8c54.netlify.app/" target="_blank" rel="noopener noreferrer"
              className="bg-blue-700/60 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-full transition-colors">
              🔧 가공일지
            </a>
          </div>
          <div className="text-right">
            <div className="text-xl font-medium tabular-nums">{now.getHours().toString().padStart(2,'0')}:{now.getMinutes().toString().padStart(2,'0')}</div>
            <div className="text-xs text-green-200">{now.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'})}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {RECORD_MODES.map(m=>(
            <button key={m.key} onClick={()=>setMode(m.key as Mode)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${mode===m.key?'bg-white text-green-800':'bg-green-700/60 text-white'}`}>
              <div className="text-lg mb-0.5">{m.icon}</div><div>{m.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <Section title="① 시양산 제품 선택">
        {/* 날짜 기간 필터 */}
        <div className="mb-3">
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <button onClick={()=>{setDateFrom(todayStr);setDateTo(todayStr)}}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${dateFrom===todayStr&&dateTo===todayStr?'bg-green-700 text-white border-green-700':'bg-white text-gray-600 border-gray-200'}`}>오늘</button>
            <button onClick={()=>{const d=new Date();d.setDate(d.getDate()+6);const s=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;setDateFrom(todayStr);setDateTo(s)}}
              className="px-3 py-1 rounded-full text-xs font-medium border bg-white text-gray-600 border-gray-200">앞으로 7일</button>
            <button onClick={()=>{setDateFrom('');setDateTo('')}}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${!dateFrom&&!dateTo?'bg-green-700 text-white border-green-700':'bg-white text-gray-600 border-gray-200'}`}>전체</button>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} max={dateTo||undefined} onChange={e=>{setDateFrom(e.target.value); if(!dateTo)setDateTo(e.target.value)}}
              className="flex-1 min-w-0 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-700 bg-white" />
            <span className="text-gray-400 text-sm">~</span>
            <input type="date" value={dateTo} min={dateFrom||undefined} onChange={e=>{setDateTo(e.target.value); if(!dateFrom)setDateFrom(e.target.value)}}
              className="flex-1 min-w-0 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-700 bg-white" />
          </div>
        </div>
        {/* 라인 필터 */}
        {allLines.length>0&&(
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1">
            <button onClick={()=>setFilterLine('')}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${filterLine===''?'bg-green-700 text-white border-green-700':'bg-white text-gray-600 border-gray-200'}`}>
              전체
            </button>
            {allLines.map(line=>(
              <button key={line} onClick={()=>setFilterLine(line)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${filterLine===line?'bg-green-700 text-white border-green-700':'bg-white text-gray-600 border-gray-200'}`}>
                {line}
              </button>
            ))}
          </div>
        )}
        {plansLoading?<p className="text-sm text-gray-400 text-center py-3">불러오는 중...</p>
        :visiblePlans.length===0&&completedPlans.length===0?(
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">등록된 투입 계획이 없습니다</p>
            <a href="/admin/import" className="text-xs text-green-700 mt-1 block">관리자 → 데이터 가져오기 →</a>
          </div>
        ):(
          <div className="flex flex-col gap-2">
            {visiblePlans.map(p=>(
              <button key={p.id} onClick={()=>{ setSelPlan(p); setInputQty(p.plan_qty||0); setGoodQty(p.plan_qty||0) }}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${selPlan?.id===p.id?'border-green-500 bg-green-50':'border-gray-200 bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${selPlan?.id===p.id?'bg-green-200 text-green-800':'bg-gray-100 text-gray-600'}`}>{p.item_code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${selPlan?.id===p.id?'bg-green-100 text-green-700':'bg-gray-50 text-gray-500'}`}>{p.color_code}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-1.5 leading-tight">{p.item_name}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{p.production_line}</span>
                    <span className="text-xs text-gray-400">{p.pack_plan_date}</span>
                    <span className="text-xs text-gray-400">계획 {p.plan_qty}개</span>
                    {p.shift&&<span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{p.shift}</span>}
                  </div>
                </div>
                {selPlan?.id===p.id&&<span className="text-green-600 text-xl flex-shrink-0 mt-1">✓</span>}
              </button>
            ))}
            {completedPlans.length>0&&(
              <div>
                <button onClick={()=>setShowCompleted(v=>!v)}
                  className="w-full text-xs text-gray-400 py-2 flex items-center justify-center gap-1 hover:text-gray-600">
                  {showCompleted?'▲':'▼'} 완료된 계획 {completedPlans.length}건
                </button>
                {showCompleted&&completedPlans.map(p=>(
                  <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl border-2 border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-500">{p.item_code}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-400">{p.color_code}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">✅ 완료</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1.5 leading-tight">{p.item_name}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{p.production_line}</span>
                        <span className="text-xs text-gray-400">계획 {p.plan_qty}개</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {mode!=='quick'&&(
        <Section title="② 생산량 입력">
          <div className="grid grid-cols-2 gap-4 mb-1">
            <Counter label="투입 수량" value={inputQty} onChange={v=>setInputQty(v)} min={0} hl="border-gray-200 focus:border-blue-500" />
            <Counter label="양품 수량" value={goodQty} onChange={v=>setGoodQty(Math.min(v,inputQty))} max={inputQty}
              hl={goodQty<inputQty?'border-red-300 focus:border-red-500':'border-green-300 focus:border-green-600'} />
          </div>
          <YieldBar pct={yieldPct} />
        </Section>
      )}

      {mode==='quick'&&(
        <Section title="③ 불량 유형" accent={defects.length>0?'border-red-400':''}>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {DEFECT_TYPES.map(d=>(
              <button key={d.key} onClick={()=>toggleDefect(d.key)}
                className={`py-3 px-1 rounded-xl border-2 text-center text-sm font-medium transition-all ${defects.includes(d.key)?'border-red-500 bg-red-50 text-red-700':'border-gray-200 bg-white text-gray-600'}`}>
                <div>{d.key}</div><div className={`text-xs mt-0.5 ${defects.includes(d.key)?'text-red-400':'text-gray-400'}`}>{d.desc}</div>
              </button>
            ))}
          </div>
          <div className="mb-3">
            <Counter label="불량 수량" value={defectQty} onChange={setDefectQty} min={0} hl="border-red-300 focus:border-red-500" />
          </div>
          {defects.length>0&&materials.length>0&&(
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest">불량 자재</p>
                {selMats.length>0&&<span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">{selMats.length}개 선택</span>}
              </div>
              <div className="h-52 overflow-y-auto border-2 border-orange-200 rounded-xl bg-white">
                {Object.entries(matByCat).map(([cat,mats])=>(
                  <div key={cat}>
                    <div className="sticky top-0 px-3 py-1.5 bg-orange-50 text-xs font-bold text-orange-700 border-b border-orange-100">{cat}</div>
                    {mats.map(m=>{ const key=matKey(m); const on=selMats.includes(key); return (
                      <button key={m.id} onClick={()=>toggleMat(key)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-gray-50 text-left transition-colors ${on?'bg-orange-50':'hover:bg-gray-50'}`}>
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${on?'bg-orange-200 text-orange-800':'bg-gray-100 text-gray-600'}`}>{m.material_code}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${m.material_color==='XX'?'bg-gray-100 text-gray-500':on?'bg-orange-100 text-orange-700':'bg-blue-50 text-blue-600'}`}>{m.material_color}</span>
                        <span className={`text-sm flex-1 min-w-0 ${on?'text-orange-800 font-medium':'text-gray-700'}`}>{m.material_name}</span>
                        {on&&<span className="text-orange-500 flex-shrink-0 font-bold">✓</span>}
                      </button>
                    )})}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {mode!=='quick'&&(
        <Section title="③ 작업 표준시간 (ST)">
          <p className="text-xs text-gray-400 mb-3">여러 번 측정 후 자동 평균 계산 — 또는 직접 입력</p>
          <Stopwatch onApply={setStSeconds} />
        </Section>
      )}

      <Section title={mode==='quick'?'④ 불량 사진 (선택)':'④ 불량 사진 (선택)'}>
        <PhotoUpload photos={photos} onPhotos={setPhotos} />
      </Section>

      <Section title="⑤ 작업 동영상 (선택)">
        <p className="text-xs text-gray-400 mb-3">YouTube 링크와 간단한 설명을 입력하세요 (여러 개 가능)</p>
        <div className="space-y-3">
          {videos.map((v,i)=>(
            <div key={i} className="border-2 border-gray-200 rounded-xl p-3 space-y-2 bg-white">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium w-4">{i+1}</span>
                <input type="url" value={v.url} onChange={e=>{const n=[...videos];n[i]={...n[i],url:e.target.value};setVideos(n)}}
                  placeholder="https://youtube.com/..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-700" />
                {videos.length>1&&(
                  <button onClick={()=>setVideos(videos.filter((_,j)=>j!==i))}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 text-lg flex-shrink-0">×</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4"/>
                <input type="text" value={v.desc} onChange={e=>{const n=[...videos];n[i]={...n[i],desc:e.target.value};setVideos(n)}}
                  placeholder="예) 조립 공정 ST 측정 / 불량 발생 현장"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-700" />
              </div>
              {v.url.trim()&&(
                <a href={v.url} target="_blank" rel="noopener noreferrer"
                  className="ml-6 flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <span>▶</span> 링크 확인 ↗
                </a>
              )}
            </div>
          ))}
        </div>
        <button onClick={()=>setVideos([...videos,{url:'',desc:''}])}
          className="mt-2 w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-green-400 hover:text-green-700 transition-colors">
          + 영상 추가
        </button>
      </Section>

      <Section title={mode==='quick'?'⑥ 특이사항 (선택)':'⑥ 특이사항 (선택)'}>
        <textarea className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-green-700 resize-none bg-white"
          rows={3} placeholder="설비 이상, 자재 교체, 특이사항 등..." value={memo} onChange={e=>setMemo(e.target.value)} />
      </Section>

      <div className="px-3 mt-5">
        {selPlan&&(
          <div className="bg-gray-50 rounded-xl p-3 mb-3 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
            <span>📦 {selPlan.item_code}/{selPlan.color_code}</span>
            {mode!=='quick'&&<span>📊 투입 {inputQty}/양품 {goodQty}/불량 {defectQty}</span>}
            {defects.length>0&&<span>⚠ {defects.join('·')}</span>}
            {stSeconds>0&&<span>⏱ ST {stSeconds}초</span>}
            {photos.length>0&&<span>📷 {photos.length}장</span>}
          </div>
        )}
        <button onClick={handleSubmit} disabled={submitting||!selPlan}
          className="w-full py-5 bg-green-800 text-white rounded-2xl text-lg font-medium transition-all disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg shadow-green-900/20">
          {submitting?'저장 중...':'기록 제출'}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">DB에 저장 · Google Sheets 5분 내 반영</p>
      </div>
    </div>
  )
}
export default function RecordPage(){ return <Suspense><RecordForm /></Suspense> }
