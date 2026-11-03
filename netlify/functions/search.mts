import type { Config, Context } from "@netlify/functions"

// 매장별 검색 결과를 모아 { items, sources } 로 돌려주는 함수.
// GET /api/search?q=검색어&used=0|1|2   (0=새 제품만, 1=중고만, 2=둘 다)

type Item = {
  store: string
  tier: "official" | "platform" | "used"
  name: string
  price: number | null
  oldPrice?: number | null
  url: string
  image?: string
  rating?: number | null
  reviews?: number | null
  sold?: number | null
  seller?: string
  location?: string
  trusted?: boolean
}
type Source = { store: string; ok: boolean; count: number; error?: string; ms: number }

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const TIMEOUT_MS = 9000
const PER_STORE = 12

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "user-agent": UA,
        "accept-language": "vi-VN,vi;q=0.9,en;q=0.8",
        ...(init.headers || {}),
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  } finally {
    clearTimeout(t)
  }
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}
const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .trim()

// ---------- Tiki (공개 상품 API) ----------
async function tiki(q: string): Promise<Item[]> {
  const res = await get(
    `https://tiki.vn/api/v2/products?limit=${PER_STORE}&include=advertisement&aggregations=2&q=${encodeURIComponent(q)}`,
    { headers: { accept: "application/json" } },
  )
  const j: any = await res.json()
  return (j.data || [])
    .filter((p: any) => p && p.name && p.price)
    .map((p: any): Item => {
      const seller = p.seller_name || p.current_seller?.name || ""
      const sellerType = String(p.visible_impression_info?.amplitude?.seller_type || "")
      const tikiTrading = p.seller_id === 1 || /^tiki trading$/i.test(seller.trim())
      const officialStore = p.is_from_official_store === true || (!tikiTrading && sellerType === "OFFICIAL_STORE")
      const trusted = tikiTrading || officialStore
      return {
        store: "Tiki",
        tier: "platform",
        name: p.name,
        price: num(p.price),
        oldPrice: num(p.original_price),
        url: `https://tiki.vn/${p.url_path || p.url_key + ".html"}`,
        image: p.thumbnail_url,
        rating: p.rating_average || null,
        reviews: p.review_count || null,
        sold: p.quantity_sold?.value || null,
        seller: tikiTrading ? "Tiki Trading" : officialStore ? `${seller} (공식 브랜드 매장)` : seller || undefined,
        trusted,
      }
    })
}

// ---------- Chotot (중고, 공개 API) ----------
async function chotot(q: string): Promise<Item[]> {
  const res = await get(
    `https://gateway.chotot.com/v1/public/ad-listing?q=${encodeURIComponent(q)}&limit=${PER_STORE}&st=s,k&key_param_included=true`,
    { headers: { accept: "application/json" } },
  )
  const j: any = await res.json()
  return (j.ads || [])
    .filter((a: any) => a && a.subject)
    .map((a: any): Item => ({
      store: "Chotot",
      tier: "used",
      name: a.subject,
      price: num(a.price),
      url: `https://www.chotot.com/${a.list_id}.htm`,
      image: a.image || a.thumbnail_image,
      seller: a.company_ad ? "업체" : "개인",
      location: [a.area_name, a.region_name].filter(Boolean).join(", "),
    }))
}

// ---------- Phong Vũ (Teko 검색 API) ----------
async function phongvu(q: string): Promise<Item[]> {
  const res = await get("https://discovery.tekoapis.com/api/v2/search-skus-v2", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", origin: "https://phongvu.vn", referer: "https://phongvu.vn/" },
    body: JSON.stringify({ terminalId: 4, page: 1, pageSize: PER_STORE, filter: {}, isNeedFeaturedProducts: false, query: q }),
  })
  const j: any = await res.json()
  const list = j?.data?.products || j?.products || []
  return list
    .map((p: any): Item | null => {
      const name = p.name || p.productInfo?.name
      if (!name) return null
      const canonical = p.canonical || p.productInfo?.canonical || ""
      const seller = p.seller?.displayName || ""
      return {
        store: "Phong Vũ",
        tier: "official",
        name,
        price: num(p.latestPrice ?? p.prices?.[0]?.latestPrice),
        oldPrice: num(p.supplierRetailPrice ?? p.prices?.[0]?.supplierRetailPrice),
        url: canonical.startsWith("http") ? canonical : `https://phongvu.vn/${canonical.replace(/^\//, "")}`,
        image: p.imageUrl || p.productInfo?.imageUrl,
        seller: seller || undefined,
        trusted: !seller || /phong v[uũ]/i.test(seller),
      }
    })
    .filter(Boolean) as Item[]
}

// ---------- Thế Giới Di Động (검색 결과 HTML) ----------
export async function tgdd(q: string): Promise<Item[]> {
  const res = await get(`https://www.thegioididong.com/tim-kiem?key=${encodeURIComponent(q)}`, {
    headers: { accept: "text/html" },
  })
  const html = await res.text()
  const items: Item[] = []
  const seen = new Set<string>()
  // 상품 카드의 <a ... data-name="..." data-price="..." href="/..."> 를 읽는다
  const re = /<a\b([^>]*?\bdata-name="[^"]+"[^>]*)>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && items.length < PER_STORE) {
    const attrs = m[1]
    const attr = (k: string) => attrs.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1]
    const name = attr("data-name")
    const href = attr("href")
    if (!name || !href || seen.has(href)) continue
    seen.add(href)
    // 카드 안의 이미지
    const chunk = html.slice(m.index, m.index + 3000)
    const img = chunk.match(/<img[^>]+(?:data-src|src)="(https:[^"]+)"/)?.[1]
    items.push({
      store: "Thế Giới Di Động",
      tier: "official",
      name: decode(name),
      price: num(attr("data-price")),
      url: href.startsWith("http") ? href : `https://www.thegioididong.com${href}`,
      image: img,
      trusted: true,
    })
  }
  return items
}

const STORES: { name: string; fn: (q: string) => Promise<Item[]>; used: boolean }[] = [
  // Thế Giới Di Động 는 해외 서버 접속을 막아서 제외 (매장 바로가기 링크로만 제공)
  { name: "Phong Vũ", fn: phongvu, used: false },
  { name: "Tiki", fn: tiki, used: false },
  { name: "Chotot", fn: chotot, used: true },
]

export default async (req: Request, _context: Context) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors })

  const u = new URL(req.url)
  const q = (u.searchParams.get("q") || "").trim().slice(0, 120)
  const mode = u.searchParams.get("used") || "0" // 0 새 제품, 1 중고, 2 둘 다
  const only = (u.searchParams.get("stores") || "").split(",").filter(Boolean)

  if (q.length < 2) {
    return Response.json({ error: "검색어를 2글자 이상 입력하세요." }, { status: 400, headers: cors })
  }

  const picked = STORES.filter((s) => {
    if (only.length && !only.includes(s.name)) return false
    if (mode === "0") return !s.used
    if (mode === "1") return s.used
    return true
  })

  const sources: Source[] = []
  const all: Item[] = []
  await Promise.all(
    picked.map(async (s) => {
      const t0 = Date.now()
      try {
        const items = await s.fn(q)
        all.push(...items)
        sources.push({ store: s.name, ok: true, count: items.length, ms: Date.now() - t0 })
      } catch (e: any) {
        sources.push({
          store: s.name,
          ok: false,
          count: 0,
          error: e?.name === "AbortError" ? "응답 시간 초과" : String(e?.message || e).slice(0, 120),
          ms: Date.now() - t0,
        })
      }
    }),
  )

  return Response.json(
    { q, fetchedAt: new Date().toISOString(), sources, items: all },
    {
      headers: {
        ...cors,
        "cache-control": "public, max-age=0, must-revalidate",
        "netlify-cdn-cache-control": "public, durable, max-age=600, stale-while-revalidate=1800",
        "netlify-vary": "query=q|used|stores",
      },
    },
  )
}

export const config: Config = {
  path: "/api/search",
  method: ["GET", "OPTIONS"],
}
