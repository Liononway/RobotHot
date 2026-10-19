// GitHub 智能硬件 / 机器人开源周榜采集。
//
// GitHub 的搜索接口不支持“最近一周”这种相对日期，所以这里每次运行时自己算出绝对日期，
// 查询“近 N 天新建”的机器人相关仓库，按 star 数从多到少取前 M 个，推给站点的推送接口
// （POST /api/ingest/items）。网站每周出周报时，这一周推入的仓库就都在库里了。
//
// 环境变量：
//   INGEST_TOKEN                    推送令牌（.env 里；少于 16 位或占位值接口会拒绝）
//   API_BASE_URL                    站点接口地址，Docker 里是 http://api:3001
//   GITHUB_TOKEN                    选填，填了搜索配额更高（30 次/分钟）
//   GITHUB_WEEKLY_DAYS              回溯天数，默认 7
//   GITHUB_WEEKLY_LIMIT             取前多少个，默认 30
//   GITHUB_WEEKLY_MIN_STARS         star 下限，默认 0（新仓库可以很少星）
//   GITHUB_WEEKLY_INTERVAL_MINUTES  大于 0 时循环执行（容器里常驻），默认 0 表示只跑一次
//   GITHUB_WEEKLY_SOURCE_ID         推送用的信源 id，与 industry/sources.json 里的一致

const SOURCE_ID = process.env.GITHUB_WEEKLY_SOURCE_ID || "github-smart-hardware-weekly";
const SOURCE_NAME = "GitHub 智能硬件与机器人开源周榜";
const API_BASE = (process.env.API_BASE_URL || "http://api:3001").replace(/\/+$/, "");
const DAYS = Math.max(1, Math.min(30, Number(process.env.GITHUB_WEEKLY_DAYS) || 7));
const LIMIT = Math.max(1, Math.min(50, Number(process.env.GITHUB_WEEKLY_LIMIT) || 30));
const MIN_STARS = Math.max(0, Number(process.env.GITHUB_WEEKLY_MIN_STARS) || 0);
const INTERVAL_MIN = Math.max(0, Number(process.env.GITHUB_WEEKLY_INTERVAL_MINUTES) || 0);

/**
 * 搜索词：只用 topic 精确命中（关键词搜索会命中 README，噪声太大）。
 * 未登录的 GitHub 搜索配额是 10 次/分钟，所以控制在 8 次以内并在两次之间留间隔；
 * 配了 GITHUB_TOKEN 可以到 30 次/分钟。
 */
const QUERIES = [
  "topic:robotics",
  "topic:robot",
  "topic:humanoid-robot",
  "topic:humanoid",
  "topic:embodied-ai",
  "topic:quadruped",
  "topic:drones",
  "topic:smart-hardware",
];

interface Repo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  created_at: string;
  language: string | null;
  topics?: string[];
  owner?: { login?: string };
}

function sinceDate(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 搜索一次；撞到配额（403/429）就退避重试一次。 */
async function search(q: string, since: string): Promise<Repo[]> {
  const url =
    "https://api.github.com/search/repositories?q=" +
    encodeURIComponent(`${q} created:>${since} fork:false`) +
    "&sort=stars&order=desc&per_page=100";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RobotHotBot/1.0",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (res.ok) {
      const data = (await res.json()) as { items?: Repo[] };
      return data.items ?? [];
    }
    const body = await res.text().catch(() => "");
    if ((res.status === 403 || res.status === 429) && attempt === 0) {
      await sleep(20_000);
      continue;
    }
    throw new Error(`GitHub 搜索失败 ${res.status}: ${body.slice(0, 200)}`);
  }
  return [];
}

function titleFor(repo: Repo): string {
  const desc = (repo.description || "").replace(/\s+/g, " ").trim();
  const head = `${repo.full_name}`;
  if (!desc) return `${head}（GitHub 新开源项目）`;
  return desc.length > 120 ? `${head}：${desc.slice(0, 117)}…` : `${head}：${desc}`;
}

async function push(items: { title: string; url: string; publishedAt: string; author: string; raw: Record<string, unknown> }[]): Promise<number> {
  const token = (process.env.INGEST_TOKEN || "").trim();
  if (!token) throw new Error("缺少 INGEST_TOKEN，无法推送");
  let created = 0;
  // 接口单次最多 50 条。
  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50);
    const res = await fetch(`${API_BASE}/api/ingest/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sourceId: SOURCE_ID, sourceName: SOURCE_NAME, items: chunk }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`推送失败 ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = (await res.json().catch(() => ({}))) as { created?: number };
    created += data.created ?? 0;
  }
  return created;
}

async function runOnce(): Promise<void> {
  const since = sinceDate(DAYS);
  const byId = new Map<number, Repo>();
  for (const q of QUERIES) {
    try {
      const items = await search(q, since);
      for (const r of items) if (!byId.has(r.id)) byId.set(r.id, r);
    } catch (error) {
      console.error(`[github-weekly] 查询 "${q}" 失败：${(error as Error).message}`);
    }
    await sleep(3000); // 未登录的搜索配额是 10 次/分钟
  }
  const top = [...byId.values()]
    .filter((r) => (r.stargazers_count ?? 0) >= MIN_STARS)
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, LIMIT);

  console.log(`[github-weekly] 近 ${DAYS} 天（${since} 起）命中 ${byId.size} 个仓库，取前 ${top.length} 个`);

  const items = top.map((r) => ({
    title: titleFor(r),
    url: r.html_url,
    publishedAt: r.created_at,
    author: r.owner?.login ?? r.full_name.split("/")[0],
    raw: {
      stars: r.stargazers_count,
      language: r.language,
      topics: r.topics ?? [],
      description: r.description,
      source: "github-search",
      query: `created:>${since}`,
    },
  }));
  if (!items.length) return;
  const created = await push(items);
  console.log(`[github-weekly] 推送 ${items.length} 条，新入库 ${created} 条`);
  for (const r of top.slice(0, 10)) console.log(`  ★ ${r.stargazers_count} ${r.full_name} — ${(r.description || "").slice(0, 60)}`);
}

async function main(): Promise<void> {
  // 站点刚起来时接口还没就绪，先等一会儿。
  await new Promise((r) => setTimeout(r, Number(process.env.GITHUB_WEEKLY_START_DELAY ?? 20) * 1000));
  for (;;) {
    try {
      await runOnce();
    } catch (error) {
      console.error(`[github-weekly] 本轮失败：${(error as Error).message}`);
    }
    if (!INTERVAL_MIN) return;
    await new Promise((r) => setTimeout(r, INTERVAL_MIN * 60 * 1000));
  }
}

await main();
