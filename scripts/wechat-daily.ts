// 每天定时把站点「精选」推送到微信（通过微信服务号中转）。
//
// 微信个人号没有可用的推送接口，只能用第三方中转服务把消息发到你的微信：
//   - serverchan  Server酱（sct.ftqq.com）：微信扫码登录后拿 SendKey，免费额度每天 5 条，够用
//   - pushplus   PushPlus（pushplus.plus）：微信扫码登录后拿 token，免费额度更宽松
// 两者都是“关注一个公众号，消息发到那个公众号”，点进去就是全文。
//
// 环境变量：
//   WECHAT_PUSH_PROVIDER   serverchan | pushplus，默认 serverchan
//   WECHAT_PUSH_TOKEN      上面拿到的 SendKey / token；为空时只打印不发送（便于试跑）
//   WECHAT_DAILY_AT        发送时刻（北京时间，HH:MM），默认 10:30
//   WECHAT_DAILY_TOP       推送多少条精选，默认 10
//   WECHAT_DAILY_MIN_SCORE 只推评分不低于该值的条目，默认 0（全推）
//   WECHAT_DAILY_RUN_ON_START  为 1 时启动立刻发一次（用于验证配置）
//   API_BASE_URL           站点接口地址，Docker 里是 http://api:3001
//   SITE_PUBLIC_URL        拼文章链接用的对外地址（手机能打开的域名；默认取 SITE_URL）

const PROVIDER = (process.env.WECHAT_PUSH_PROVIDER || "serverchan").trim().toLowerCase();
/** pushplus 的发送渠道：留空走默认公众号；填 clawbot 则落到微信 ClawBot 对话里。 */
const CHANNEL = (process.env.WECHAT_PUSH_CHANNEL || "").trim().toLowerCase();
const TOKEN = (process.env.WECHAT_PUSH_TOKEN || "").trim();
const AT = (process.env.WECHAT_DAILY_AT || "10:30").trim();
const TOP = Math.max(1, Math.min(20, Number(process.env.WECHAT_DAILY_TOP) || 10));
const MIN_SCORE = Number(process.env.WECHAT_DAILY_MIN_SCORE) || 0;
const RUN_ON_START = (process.env.WECHAT_DAILY_RUN_ON_START || "").trim() === "1";
/** 为 1 时只发一次就退出，用于手动验证配置，不进常驻循环。 */
const ONCE = (process.env.WECHAT_DAILY_ONCE || "").trim() === "1";
const API_BASE = (process.env.API_BASE_URL || "http://api:3001").replace(/\/+$/, "");
const SITE = (process.env.SITE_PUBLIC_URL || process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** 北京时间相对 UTC 的固定偏移；中国不实行夏令时，可以直接当常量用。 */
const TZ_OFFSET_MS = 8 * 3600_000;

interface Item {
  id: string;
  title: string;
  summary?: string | null;
  reason?: string | null;
  score?: number | null;
  category?: string | null;
  tags?: string[] | null;
  source?: { name?: string } | null;
  selected?: boolean;
}

interface Card {
  item: Item;
}

function log(...parts: unknown[]): void {
  console.log(new Date().toISOString(), ...parts);
}

/** 把 "10:30" 解析成当天的分钟数，写错就退回 10:30。 */
function parseAt(text: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return { hour: 10, minute: 30 };
  const hour = Math.min(23, Math.max(0, Number(m[1])));
  const minute = Math.min(59, Math.max(0, Number(m[2])));
  return { hour, minute };
}

/** 下一个发送时刻（毫秒时间戳）：今天还没到就今天，过了就明天。 */
function nextRunAt(now = Date.now()): number {
  const { hour, minute } = parseAt(AT);
  const beijing = new Date(now + TZ_OFFSET_MS);
  let target =
    Date.UTC(beijing.getUTCFullYear(), beijing.getUTCMonth(), beijing.getUTCDate(), hour, minute, 0) - TZ_OFFSET_MS;
  if (target <= now) target += 24 * 3600_000;
  return target;
}

function beijingDateText(now = new Date()): string {
  const d = new Date(now.getTime() + TZ_OFFSET_MS);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

/** 取首页「精选」：时间线接口已按评分排好，selected 为真的就是入选条目。 */
async function fetchFeatured(): Promise<Item[]> {
  const url = `${API_BASE}/api/site/timeline?limit=40`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`timeline ${res.status}`);
  const data = (await res.json()) as { cards?: Card[] };
  const items = (data.cards || []).map((c) => c.item).filter((it): it is Item => !!it);
  return items
    .filter((it) => it.selected !== false && (it.score ?? 0) >= MIN_SCORE)
    .slice(0, TOP);
}

function oneLine(text: string | null | undefined, max: number): string {
  const s = (text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Server酱 / PushPlus 都吃 Markdown，正文按“标题 + 一句话摘要 + 链接”排。 */
function renderMarkdown(items: Item[]): string {
  const lines: string[] = [];
  items.forEach((it, i) => {
    const link = `${SITE}/items/${it.id}`;
    lines.push(`**${i + 1}. [${oneLine(it.title, 80)}](${link})**`);
    const brief = oneLine(it.summary || it.reason, 110);
    if (brief) lines.push(`> ${brief}`);
    const meta = [it.source?.name, it.category ? `#${it.category}` : ""].filter(Boolean).join(" · ");
    if (meta) lines.push(`<sub>${meta}</sub>`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

/** ClawBot 的 txt 模板只认纯文本（富文本模板只展示前 50 字），所以再备一版纯文本排版。 */
function renderPlain(items: Item[]): string {
  const lines: string[] = [];
  items.forEach((it, i) => {
    lines.push(`${i + 1}. ${oneLine(it.title, 80)}`);
    const brief = oneLine(it.summary || it.reason, 110);
    if (brief) lines.push(`   ${brief}`);
    const meta = [it.source?.name, it.category ? `#${it.category}` : ""].filter(Boolean).join(" · ");
    if (meta) lines.push(`   ${meta}`);
    lines.push(`   ${SITE}/items/${it.id}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

async function push(title: string, markdown: string, plain: string): Promise<void> {
  if (!TOKEN) {
    log("未配置 WECHAT_PUSH_TOKEN，只打印不发送");
    console.log(`\n=== ${title} ===\n${CHANNEL === "clawbot" ? plain : markdown}`);
    return;
  }
  let url: string;
  let body: unknown;
  if (PROVIDER === "pushplus") {
    url = "https://www.pushplus.plus/send";
    const useTxt = CHANNEL === "clawbot";
    body = {
      token: TOKEN,
      title,
      // ClawBot 官方对富文本只显示前 50 字，官方文档建议用 txt 模板发纯文本。
      content: useTxt ? plain : markdown,
      template: useTxt ? "txt" : "markdown",
      ...(CHANNEL ? { channel: CHANNEL } : {}),
    };
  } else {
    url = `https://sctapi.ftqq.com/${TOKEN}.send`;
    body = { title, desp: markdown };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`推送失败 ${res.status}: ${text.slice(0, 200)}`);
  // 这两个服务失败时也返回 HTTP 200，真正的结果在 body 的 code 里：
  // pushplus 成功是 200，Server酱成功是 0。不校验就会把失败当成功写进日志。
  let code: unknown;
  try {
    code = (JSON.parse(text) as { code?: unknown }).code;
  } catch {
    code = undefined;
  }
  const ok = PROVIDER === "pushplus" ? Number(code) === 200 : Number(code) === 0;
  if (code !== undefined && !ok) throw new Error(`推送被拒绝 code=${String(code)}: ${text.slice(0, 200)}`);
  log("推送成功", text.slice(0, 160));
}

async function sendOnce(): Promise<void> {
  const items = await fetchFeatured();
  if (!items.length) {
    log("今天没有精选条目，跳过");
    return;
  }
  const title = `RobotHot 精选 · ${beijingDateText()}（${items.length} 条）`;
  await push(title, renderMarkdown(items), renderPlain(items));
  log(`已推送 ${items.length} 条`);
}

async function main(): Promise<void> {
  log(`启动：provider=${PROVIDER} channel=${CHANNEL || "默认"} token=${TOKEN ? "已配置" : "未配置"} 每天 ${AT}（北京时间）`);
  if (RUN_ON_START || ONCE) {
    await sendOnce();
    if (ONCE) return;
  }
  for (;;) {
    const target = nextRunAt();
    const wait = target - Date.now();
    log(`下一次推送 ${new Date(target + TZ_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ")}（${Math.round(wait / 60000)} 分钟后）`);
    await new Promise((resolve) => setTimeout(resolve, Math.max(1000, wait)));
    try {
      await sendOnce();
    } catch (error) {
      log("推送出错，明天再试", (error as Error).message);
    }
    // 留出一点余量，避免同一分钟内重复触发。
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
