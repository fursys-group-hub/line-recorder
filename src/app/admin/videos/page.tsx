'use client'
import { useEffect, useState } from 'react'

type VideoItem = {
  recordId: string
  recorded_at: string
  production_line: string
  item_code: string
  color_code: string
  item_name: string
  url: string
  desc: string
}

function ytId(url:string): string|null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    const m = u.pathname.match(/\/(shorts|embed)\/([^/?]+)/)
    if (m) return m[2]
  } catch {}
  return null
}
function thumb(url:string): string|null {
  const id = ytId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLine, setFilterLine] = useState('ALL')
  const [q, setQ] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({
      filter: 'all',
      hasVideo: 'true',
      limit: '1000',
      fields: 'id,recorded_at,production_line,item_code,color_code,item_name,video_url',
    })
    const res = await fetch(`/api/records?${params}`)
    const data = res.ok ? await res.json() : []

    const out: VideoItem[] = []
    data.forEach((r:any) => {
      if (!r.video_url) return
      let list: {url:string;desc:string}[] = []
      try { list = JSON.parse(r.video_url) } catch { list = [{ url:r.video_url, desc:'' }] }
      list.forEach(v => {
        if (v.url && v.url.trim()) out.push({
          recordId: r.id, recorded_at: r.recorded_at,
          production_line: r.production_line ?? '', item_code: r.item_code ?? '',
          color_code: r.color_code ?? '', item_name: r.item_name ?? '',
          url: v.url.trim(), desc: v.desc ?? '',
        })
      })
    })
    setVideos(out)
    setLoading(false)
  }

  const allLines = Array.from(new Set(videos.map(v=>v.production_line).filter(Boolean))).sort()
  const filtered = videos.filter(v =>
    (filterLine==='ALL' || v.production_line===filterLine) &&
    (q==='' || `${v.item_code} ${v.color_code} ${v.item_name} ${v.desc}`.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">작업 영상 모음</h1>
        <span className="text-sm text-gray-400">{loading?'불러오는 중…':`총 ${videos.length}개 영상`}</span>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">라인</label>
          <select value={filterLine} onChange={e=>setFilterLine(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white min-w-[160px] focus:outline-none">
            <option value="ALL">전체 라인</option>
            {allLines.map(l=><option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs text-gray-500 mb-1">검색 (품목코드 · 부품명 · 설명)</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="검색어 입력…"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-700" />
        </div>
        <span className="text-sm text-gray-400">{filtered.length}개 표시</span>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-400 text-sm">
          등록된 영상이 없습니다<br/>
          <span className="text-xs">라인 화면에서 기록 작성 시 YouTube 링크를 입력하면 여기에 모입니다.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((v,i) => {
            const th = thumb(v.url)
            const t = new Date(v.recorded_at)
            return (
              <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                <div className="relative aspect-video bg-gray-900">
                  {th ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={th} alt="" className="w-full h-full object-cover"
                      onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-3xl">▶</div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center text-white text-xl group-hover:scale-110 transition-transform">▶</div>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">
                    {v.desc || v.item_name || '제목 없음'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {v.production_line && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{v.production_line}</span>}
                    <span className="text-xs font-mono text-gray-400">{v.item_code}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {t.getMonth()+1}/{t.getDate()} {t.getHours().toString().padStart(2,'0')}:{t.getMinutes().toString().padStart(2,'0')}
                  </p>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
