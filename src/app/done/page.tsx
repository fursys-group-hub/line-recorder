'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
function DoneContent() {
  const params=useSearchParams(); const router=useRouter()
  const mode=params.get('mode'); const itemCode=params.get('item_code')??''; const colorCode=params.get('color_code')??''
  const itemName=params.get('item_name')??''; const line=params.get('line')??''
  const good=params.get('good')??'0'; const input=params.get('input')??'0'
  const defect=params.get('defect')??'0'; const defects=params.get('defects')??''
  const yld=params.get('yield')??'0'; const st=params.get('st')??'0'; const photoCount=parseInt(params.get('photos')??'0')
  const modeLabel=mode==='quick'?'빠른 불량 기록':'로트 마감'
  const yieldNum=parseFloat(yld); const yieldColor=yieldNum>=95?'#166534':yieldNum>=85?'#d97706':'#dc2626'
  const stNum=parseInt(st)
  const rows=[
    { label:'모드', value:modeLabel },{ label:'라인', value:line },
    { label:'제품', value:`${itemCode} / ${colorCode}` },{ label:'단품명', value:itemName },
    ...(mode!=='quick'?[
      { label:'투입', value:`${input}개` },{ label:'양품', value:`${good}개` },
      { label:'수율', value:`${yld}%`, color:yieldColor },
    ]:[]),
    { label:'불량', value:`${defect}개${defects?` (${defects})`:''}`, color:parseInt(defect)>0?'#dc2626':undefined },
    ...(stNum>0?[{ label:'ST', value:`${stNum}초 (${Math.floor(stNum/60)}분 ${stNum%60}초)` }]:[]),
    ...(photoCount>0?[{ label:'사진', value:`${photoCount}장 첨부`, color:'#166534' }]:[]),
  ].filter(r=>r.value&&r.value!=='null개')
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-green-50">
      <div className="w-16 h-16 bg-green-800 rounded-full flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-xl font-medium text-green-800 mb-1">기록 완료</h1>
      <p className="text-sm text-gray-500 mb-6">저장 완료 · Google Sheets 5분 내 반영</p>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-sm p-5 mb-6">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(r=>(
              <tr key={r.label}><td className="text-gray-400 py-1.5 w-16 align-top">{r.label}</td>
                <td className="font-medium py-1.5" style={r.color?{color:r.color}:{}}>{r.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={()=>router.push('/')} className="w-full max-w-sm py-4 bg-green-800 text-white rounded-2xl text-base font-medium">다음 기록 입력</button>
      <button onClick={()=>router.push('/history')} className="w-full max-w-sm py-3 mt-2 text-green-700 text-sm font-medium">오늘 기록 보기 →</button>
    </div>
  )
}
export default function DonePage(){ return <Suspense><DoneContent /></Suspense> }
