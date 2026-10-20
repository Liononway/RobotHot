// 每天定时把站点「精选」推到消息渠道。
//
// 渠道三选一（PUSH_PROVIDER）：
//   feishu      飞书群「自定义机器人」webhook。一次配置，没有保活限制，推荐。
//   pushplus    PushPlus（pushplus.plus）：微信扫码登录拿 token，发到公众号或 ClawBot 对话。
//   serverchan  Server酱（sct.ftqq.com）：微信扫码登录拿 SendKey，发到公众号。
// 微信个人号没有开放推送接口，只能经第三方中转；飞书则给每个群直接提供 webhook。
//
// 环境变量：
//   PUSH_PROVIDER          feishu | pushplus | serverchan，默认 feishu
//   PUSH_AT                发送时刻（北京时间，HH:MM），默认 10:30
//   PUSH_TOP               推送多少条精选，默认 10
//   PUSH_MIN_SCORE         只推评分不低于该值的条目，默认 0（全推）
//   PUSH_RUN_ON_START      为 1 时启动立刻发一次
//   PUSH_ONCE              为 1 时只发一次就退出（手动验收用）
//   FEISHU_PUSH_WEBHOOK_URL  飞书群机器人地址
//   FEISHU_PUSH_SECRET       机器人「签名校验」的密钥；用关键词或 IP 白名单时留空
//   PUSH_TOKEN             pushplus token / Server酱 SendKey
//   PUSH_CHANNEL           pushplus 渠道：留空=公众号，clawbot=微信 ClawBot
//   API_BASE_URL           站点接口地址，Docker 里是 http://api:3001
//   SITE_PUBLIC_URL        拼文章链接用的对外地址（手机上能打开的域名；默认取 SITE_URL）
//
// 兼容旧名：WECHAT_PUSH_PROVIDER / WECHAT_PUSH_TOKEN / WECHAT_PUSH_CHANNEL / WECHAT_DAILY_*。

import { createHmac } from "node:crypto";

/** 依次取第一个非空的环境变量，便于把旧的 WECHAT_* 名字继续当别名用。 */
function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

const PROVIDER = (env("PUSH_PROVIDER", "WECHAT_PUSH_PROVIDER") || "feishu").toLowerCase();
/** pushplus 的发送渠道：留空走默认公众号；填 clawbot 则落到微信 ClawBot 对话里。 */
const CHANNEL = env("PUSH_CHANNEL", "WECHAT_PUSH_CHANNEL").toLowerCase();
const TOKEN = env("PUSH_TOKEN", "WECHAT_PUSH_TOKEN");
const FEISHU_WEBHOOK = env("FEISHU_PUSH_WEBHOOK_URL");
const FEISHU_SECRET = env("FEISHU_PUSH_SECRET");
const AT = (env("PUSH_AT", "WECHAT_DAILY_AT") || "10:30");
const TOP = Math.max(1, Math.min(20, Number(env("PUSH_TOP", "WECHAT_DAILY_TOP")) || 10));
const MIN_SCORE = Number(env("PUSH_MIN_SCORE", "WECHAT_DAILY_MIN_SCORE")) || 0;
const RUN_ON_START = env("PUSH_RUN_ON_START", "WECHAT_DAILY_RUN_ON_START") === "1";
/** 为 1 时只发一次就退出，用于手动验证配置，不进常驻循环。 */
const ONCE = env("PUSH_ONCE", "WECHAT_DAILY_ONCE") === "1";
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

/**
 * 飞书消息卡片。每条精选一个 div，标题带链接，摘要按 lark_md 渲染，
 * 来源与分类用灰色小字，最后一条 note 说明总量。
 */
function feishuCard(title: string, items: Item[]): unknown {
  const elements: unknown[] = [];
  items.forEach((it, i) => {
    const link = `${SITE}/items/${it.id}`;
    const brief = oneLine(it.summary || it.reason, 120);
    const meta = [it.source?.name, it.category ? `#${it.category}` : ""].filter(Boolean).join(" · ");
    const lines = [`**${i + 1}. [${oneLine(it.title, 80)}](${link})**`];
    if (brief) lines.push(brief);
    if (meta) lines.push(`<font color='grey'>${meta}</font>`);
    elements.push({ tag: "div", text: { tag: "lark_md", content: lines.join("\n") } });
    elements.push({ tag: "hr" });
  });
  elements.push({
    tag: "note",
    elements: [{ tag: "plain_text", content: `共 ${items.length} 条 · RobotHot 每日精选 · ${SITE}` }],
  });
  return {
    config: { wide_screen_mode: true },
    header: { template: "blue", title: { tag: "plain_text", content: title } },
    elements,
  };
}

/** 飞书「签名校验」：HMAC-SHA256，密钥是 `时间戳\nsecret`，对空串签名后 base64。 */
function feishuSign(secret: string): { timestamp: string; sign: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = createHmac("sha256", `${timestamp}\n${secret}`).update("").digest("base64");
  return { timestamp, sign };
}

/** 发一次请求并校验业务结果；两个服务失败时也返回 HTTP 200，真实结果在 body.code。 */
async function sendRequest(url: string, body: unknown, okCode: number): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`推送失败 ${res.status}: ${text.slice(0, 200)}`);
  let code: unknown;
  try {
    const json = JSON.parse(text) as { code?: unknown; StatusCode?: unknown };
    // 飞书新版返回 code，旧版返回 StatusCode；两者成功都是 0。
    code = json.code ?? json.StatusCode;
  } catch {
    code = undefined;
  }
  if (code !== undefined && Number(code) !== okCode) throw new Error(`推送被拒绝 code=${String(code)}: ${text.slice(0, 160)}`);
  return text;
}

async function push(title: string, items: Item[]): Promise<void> {
  const markdown = renderMarkdown(items);
  const plain = renderPlain(items);

  if (PROVIDER === "feishu") {
    if (!FEISHU_WEBHOOK) {
      log("未配置 FEISHU_PUSH_WEBHOOK_URL，只打印不发送");
      console.log(`\n=== ${title} ===\n${markdown}`);
      return;
    }
    const body = {
      ...(FEISHU_SECRET ? feishuSign(FEISHU_SECRET) : {}),
      msg_type: "interactive",
      card: feishuCard(title, items),
    };
    const text = await sendRequest(FEISHU_WEBHOOK, body, 0);
    log("飞书推送成功", text.slice(0, 160));
    return;
  }

  if (!TOKEN) {
    log("未配置 PUSH_TOKEN，只打印不发送");
    console.log(`\n=== ${title} ===\n${CHANNEL === "clawbot" ? plain : markdown}`);
    return;
  }
  if (PROVIDER === "pushplus") {
    const url = "https://www.pushplus.plus/send";
    const useTxt = CHANNEL === "clawbot";
    const base = {
      token: TOKEN,
      title,
      // ClawBot 官方对富文本只显示前 50 字，官方文档建议用 txt 模板发纯文本。
      content: useTxt ? plain : markdown,
      template: useTxt ? "txt" : "markdown",
    };
    try {
      const text = await sendRequest(url, { ...base, ...(CHANNEL ? { channel: CHANNEL } : {}) }, 200);
      log("推送成功", text.slice(0, 160));
      return;
    } catch (error) {
      // ClawBot 有保活限制（每 24 小时/每 10 条要主动对话一次），过期就发不出去。
      // 这时退回默认公众号，至少消息不会静默丢掉。
      if (!CHANNEL) throw error;
      log(`渠道 ${CHANNEL} 发送失败：${(error as Error).message.slice(0, 120)}；改走默认公众号重试`);
      const text = await sendRequest(url, { ...base, content: markdown, template: "markdown" }, 200);
      log("已改由公众号送达", text.slice(0, 160));
      return;
    }
  }
  const text = await sendRequest(`https://sctapi.ftqq.com/${TOKEN}.send`, { title, desp: markdown }, 0);
  log("推送成功", text.slice(0, 160));
}

async function sendOnce(): Promise<void> {
  const items = await fetchFeatured();
  if (!items.length) {
    log("今天没有精选条目，跳过");
    return;
  }
  const title = `RobotHot 精选 · ${beijingDateText()}（${items.length} 条）`;
  await push(title, items);
  log(`已推送 ${items.length} 条`);
}

async function main(): Promise<void> {
  const ready = PROVIDER === "feishu" ? `webhook=${FEISHU_WEBHOOK ? "已配置" : "未配置"}` : `token=${TOKEN ? "已配置" : "未配置"} channel=${CHANNEL || "默认"}`;
  log(`启动：provider=${PROVIDER} ${ready} 每天 ${AT}（北京时间）`);
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
