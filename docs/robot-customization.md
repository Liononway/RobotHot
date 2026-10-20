# RobotHot：机器人资讯站的定制说明

这份文件记录本仓库相对 AIHOT 模板改了什么、每条需求是怎么实现的、以及还有哪些信源需要你补配置。
框架本身的定制方法见 `docs/customize.md`。

## 一、站点身份（site/site.ts）

- 站名 `RobotHot`，行业词 `机器人`，MCP 前缀 `robothot`
- 出刊时间：日报每天 08:00，周报每周一 10:00，月报每月 1 日 10:30（北京时间）
- 报告报头的字标（`site/brand/nameplates/*.svg`）已按新的行业词重新生成（脚本：`scripts/nameplates.ts`）

## 二、行业 KnowHow（industry/）

| 文件 | 内容 |
|---|---|
| `taxonomy.ts` | 七个类别：整机、技术、落地、行业、论文、教程、观点；标签词表与厂商名录（特斯拉、宇树、智元、Figure 等 22 家） |
| `topics.json` | 主题目录：按厂商、技术方向、内容类型三组 |
| `selection.ts` | 入选门槛（T1 60 / T1_5 65 / T2 76） |
| `prompts/prefilter.md` | 预筛：只放机器人/智能硬件相关内容；纯软件大模型、普通消费电子、RPA 之类的“机器人”一律挡掉 |
| `prompts/selection-score.md` | 评分：强调量产/交付/订单等“阶段”证据，压住概念视频和重复演示 |
| `prompts/content-understanding.md`、`structure.md` | 内容理解与结构化抽取（区分“演示 / 量产 / 交付 / 订单”） |
| `prompts/rules-domain.md` | 机器人领域翻译规则（DoF、灵巧手、关节模组、VLA、sim-to-real……） |

## 三、信源（industry/sources.json，首次启动导入，之后在后台“信源”里改）

已启用（13 个）：

| 信源 | 类型 | 覆盖 |
|---|---|---|
| IEEE Spectrum · Robotics | RSS | 海外权威媒体 |
| MIT Technology Review · Robots | RSS | 海外媒体 |
| TechCrunch · Robotics | RSS | 海外融资/产品 |
| The Verge · Robotics | RSS | 海外媒体 |
| Robohub | RSS | 海外社区 |
| 量子位、雷峰网 | RSS | 国内媒体（融资、落地、技术） |
| NVIDIA Blog | RSS | 官方一手（芯片、Isaac/GR00T） |
| arXiv cs.RO | RSS | 机器人论文 |
| GitHub 智能硬件与机器人开源周榜 | external | 由采集脚本推送 |
| X：Elon Musk / NVIDIA / Fei-Fei Li | RSS（经 RSSHub） | 关键人物社媒，见第五节 |

预置、未启用：

- 公众号 11 个（机器人前瞻、Z Potential、GEIA 全球具身智能观察、Tracy 的具身人才笔记、具身智能机器人圈、具身智能一线、我爱Robot、关节模组之家、Robo百科、风向情报笔记、机器人开放社区）：以 `mp_account`（极致了付费通道）形式留在清单里备忘；实际接 wewe-rss 后用普通 RSS 源，见第五节

## 四、需求 1：GitHub 智能硬件周榜（scripts/github-weekly.ts）

GitHub 搜索接口不支持“最近一周”这种相对日期，所以用一个常驻采集器实现：

- 每次运行自己算出 `created:>YYYY-MM-DD`（默认回溯 7 天）
- 按 8 个 topic 查询（robotics / robot / humanoid-robot / humanoid / embodied-ai / quadruped / drones / smart-hardware），去重后按 star 从多到少取前 30
- 通过 `POST /api/ingest/items` 推给站点（`docker-compose.yml` 里的 `github-weekly` 服务，每 6 小时一次）
- 周报出刊时，这一周推入的仓库都在库里

可选：在 `.env` 里配 `GITHUB_TOKEN=ghp_...` 提高搜索配额（未登录是 10 次/分钟）。

## 五、X 与公众号的取数方式（自建 RSS 中转，用自己的账号）

为了不依赖付费的 SocialData / 极致了，compose 里加了两个本地中转容器，把社媒内容转成 RSS：

### 1. X 人物账号 → RSSHub（容器 `rsshub`，端口 1200）

- 原理：RSSHub 用你 X 账号的登录态 Cookie 抓取，把任意账号时间线转成 RSS。
- 当前实测**未填 Cookie 也能取到公开时间线**（elonmusk 100 条、drfeifei 99 条、nvidia 17 条，已配置走本机代理 `host.docker.internal:7892` 访问 X）。
- 如果以后取不到内容，再补 Cookie：浏览器登录 X 小号 → F12 → Application → Cookies → x.com，复制 `auth_token` 和 `ct0`，填进 `.env` 的 `TWITTER_AUTH_TOKEN` 和 `TWITTER_COOKIE`，然后 `docker compose restart rsshub`。**用小号，别用主号。**
- 已接入的信源（每小时抓一次）：`rss-x-elonmusk`、`rss-x-nvidia`（黄仁勋本人没有活跃 X 账号，用 NVIDIA 官方号覆盖）、`rss-x-drfeifei`。
- 加新人：在 RSSHub 用 `http://rsshub:1200/twitter/user/<用户名>?key=<RSSHUB_ACCESS_KEY>` 这个地址，到后台“信源”新建 RSS 源即可。
- `RSSHUB_ACCESS_KEY` 在 `.env` 里，访问 feed 必须带。

### 2. 微信公众号 → zlzchat（`../zlzchat/`，端口 10082）

> 原先部署的 wewe-rss 已停用（作者中转服务 `weread.111965.xyz` 自 2026 年 4 月起长期 502，扫码登录不可用），compose 里已注释保留。替代品 zlzchat（github.com/565800105/zlzchat）原理相同，作者中转服务目前在线。

- 部署：`../zlzchat/docker-compose.yml`（Java + MySQL + Redis 三容器），应用文件在 `../zlzchat/app/`，数据库密码在 `../zlzchat/.secrets`。启动：`cd ../zlzchat && source .secrets && docker compose up -d`。
- 管理界面：http://localhost:10082/admin ，账号 `system` 密码 `admin123`（首次登录后请改密码）。
- zlzchat 容器已接入 RobotHot 的 Docker 网络（`docker network connect aihot_default zlzchat`，重启 zlzchat 后需要重连一次），worker 用 `http://zlzchat:801/...` 抓取；`PRIVATE_FEED_HOSTS` 已加 `zlzchat`。
- 用法：登录后台 → 读书账号管理 → 扫码登录微信读书（建议小号）→ 订阅源管理里按名称或文章链接添加公众号 → 开启 cron 定时拉取。
- feed 地址：全部订阅 `http://zlzchat:801/atom`；单个号 `http://zlzchat:801/feedAtom/{feedId}`；分类 `http://zlzchat:801/mpClassificationAtom/{classificationId}`。开放 API 需在后台参数设置里配 `api.apikey`。
- 订阅好后把 feed 地址告诉我（或在后台直接复制），我批量加成 RobotHot 的 RSS 信源。
- 注意事项（来自项目文档）：微信读书对账号有人机识别，499 风控后等几小时自动解除；读书会员账号风控更少；公众号内容抓取偶尔被腾讯拦截属正常现象。

**已接入的 8 个公众号**（kind = `rss`，不是 `mp_account`；后者走付费的极致了，没配 key 不会工作）：

| 公众号 | 信源 id | feedId |
|---|---|---|
| 机器人前瞻 | mp-jiqirenqianzhan | 8732d3bc8ad031e31da43df609e626e3 |
| AI机器人前瞻 | mp-ai-jiqirenqianzhan | 1adeb331c0413cfafb3f0a5ba68628f8 |
| 具身智能一线 | mp-jushen-frontline | 802a6cea662ed1df8d0b371d4219c205 |
| 我爱Robot | mp-iloverobot | c8470dd4f066ea74e362223b71d3a263 |
| GEIA全球具身智能观察 | mp-geia | b0baac73a87f777e7cfb9399007526b4 |
| 机器人开放社区 | mp-robot-open-community | fc0a0488e90f7b4e86bda71ec7ea4af3 |
| Robo百科 | mp-robo-wiki | 1a1acd7124a195f0abb25ee372b74078 |
| 铁卫士 | mp-tieweishi | 0c72410231612fdad0a6b69975b81a11 |

- 每个源 `interval_minutes = 60`，`config.fetchPublicContent = true`：feed 里只有标题和链接，正文由后台按文章页抓取。
- 新增公众号：先在 zlzchat 后台添加拿到 feedId，再到 `industry/sources.json` 加一条 `kind: "rss"` 的源（或后台“信源 → 新建 RSS”直接填 `http://zlzchat:801/feedAtom/<feedId>`），然后 `docker compose run --rm --no-deps -v "$PWD/industry:/app/industry:ro" setup node scripts/seed.ts`。

**微信文章正文的两个补丁（`packages/backend/src/`，重装框架时要保留）**：

1. `content/extract.ts` 的 `revealWechatArticle()`：微信文章页把正文容器 `#js_content` 设成 `visibility:hidden; opacity:0`，等页面脚本执行后才显示；容器里不跑脚本，抽取会得到空正文。这里在 Readability 之前去掉该样式（只动样式，不动内容）。
2. `content/extract.ts` 的 `pageFetchable()`：框架原本把 `mp.weixin.qq.com` 列为不可抓取（正文由付费的极致了提供）。这里放开，公众号 RSS 源才会去抓正文。
3. `providers/jina.ts` 的 `jinaConfigured()` + `extractFromUrl()`：没配 `JINA_API_KEY` 时直接返回“无正文”，不再抛错，避免每篇文章白重试三次。

### 3. 其他

- **抖音（铁卫士等）**：框架和 RSSHub 都没有稳定的抖音路由，需要另写外部脚本按 `/api/ingest/items` 推送。
- **具身之家（jushenhome.com）** 等没有 RSS 的国内站点：在后台新建 `web_list` 信源，填列表页地址和链接/标题选择器；页面是 JS 渲染的话抓不到。

## 六、日常运维

```bash
docker compose up -d --build   # 改了源码后重新构建并启动
docker compose logs -f worker  # 看抓取和模型处理
docker compose down            # 停止（数据保留）
```

后台：`http://localhost:3000/admin`，密码是 `.env` 里的 `ADMIN_PASSWORD`（框架强制要求设置，不能为空）。

## 七、备份与恢复

所有内容都在 Docker 卷里，误删容器或卷就没了，所以要备份。脚本：`scripts/backup-local.sh`（手动跑：`bash scripts/backup-local.sh`）。

每次产出三份文件到 `../robot-hot-backups/`（与仓库同级，**不在仓库内**，避免密钥进 git）：

| 文件 | 内容 | 恢复方式 |
|---|---|---|
| `aihot-<时间>.sql.gz` | 站点库：文章、信源、事实、报告、回执 | `gunzip -c … \| docker exec -i aihot-db-1 psql -U aihot -d aihot` |
| `zlzchat-<时间>.sql.gz` | 公众号中转库 `gzhweb`：已添加的号与 feed_id（丢了要重新扫码登录） | `gunzip -c … \| docker exec -i zlz-mysql8 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'`（dump 自带 `CREATE DATABASE`/`USE`，无需先建库） |
| `secrets-<时间>.tar.gz` | `.env` + `zlzchat/.secrets`，权限 600 | `tar xzf … -C ..` |

保留最近 14 天（`ROBOTHOT_BACKUP_KEEP_DAYS` 可改），日志在同目录 `backup.log`。

**每天 03:30 自动执行**：`~/Library/LaunchAgents/cn.robothot.backup.plist` 已写好，装一次即可（在当前这台机器上因沙箱限制装不上，需在「终端」里手动执行）：

```bash
launchctl bootstrap gui/501 ~/Library/LaunchAgents/cn.robothot.backup.plist
launchctl print gui/501/cn.robothot.backup | head -20   # 看到 state = waiting 即生效
```

卸载：`launchctl bootout gui/501/cn.robothot.backup`。机器睡眠时错过的时间点，会在唤醒后补跑一次。

**验证备份可用**（建议每月做一次）：把 dump 还原到临时库，数一下表里的行数对不对，再删掉临时库。

```bash
docker exec aihot-db-1 psql -U aihot -d postgres -c "create database restore_test;"
gunzip -c ../robot-hot-backups/aihot-*.sql.gz | docker exec -i aihot-db-1 psql -U aihot -d restore_test -q
docker exec aihot-db-1 psql -U aihot -d restore_test -c "select count(*) from articles;"
docker exec aihot-db-1 psql -U aihot -d postgres -c "drop database restore_test;"
```

备份目录本身没有异地副本，要防整机损坏，把 `robot-hot-backups/` 定期拷到移动硬盘或网盘（含密钥，注意加密）。

## 八、每日精选推送到飞书 / 微信（scripts/daily-push.ts）

每天 10:30（北京时间）把首页「精选」推出去。三个渠道，`PUSH_PROVIDER` 切换：

| 渠道 | 需要什么 | 特点 |
|---|---|---|
| `feishu`（默认，推荐） | 飞书群机器人 webhook | 一次配置，无保活限制，卡片排版 |
| `pushplus` | pushplus token | 微信：公众号或 ClawBot 对话 |
| `serverchan` | Server酱 SendKey | 微信：公众号，每天 5 条 |

### 飞书（推荐）

1. 飞书里建一个群（自己一个人也行）→ 群设置 → **群机器人** → 添加机器人 → **自定义机器人**
2. 安全设置三选一，推荐 **自定义关键词**，填 `RobotHot`（推送标题里一定带这个词）；
   选「签名校验」则把密钥抄下来填进 `FEISHU_PUSH_SECRET`
3. 复制 webhook 地址，填进 `.env`：

```bash
PUSH_PROVIDER=feishu
FEISHU_PUSH_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx
# FEISHU_PUSH_SECRET=            # 只有选了「签名校验」才需要
PUSH_AT=10:30                    # 北京时间
PUSH_TOP=10                      # 推几条精选
```

```bash
docker compose up -d daily-push
docker logs -f aihot-daily-push-1          # 看下一次发送时间
docker compose run --rm --no-deps -e PUSH_ONCE=1 daily-push   # 立刻发一次验收
```

卡片按条排列：标题（带链接）、一句话摘要、来源与分类（灰色小字），末尾一条 note 写总量和站点地址。
**飞书不需要每天保活**，配一次就能一直收。

### 微信（备用）

微信个人号没有推送接口，只能经第三方中转：

| 通道 | 注册地址 | 拿到什么 |
|---|---|---|
| PushPlus | https://www.pushplus.plus | `token`（需实名；channel=clawbot 时发到 ClawBot 对话） |
| Server酱 | https://sct.ftqq.com | `SENDKEY` |

```bash
PUSH_PROVIDER=pushplus
PUSH_CHANNEL=clawbot        # 留空=公众号；clawbot=微信 ClawBot 对话
PUSH_TOKEN=你的key
```

ClawBot 有官方保活限制：绑定后要主动发一条消息激活，之后**每 10 条、每 24 小时**要再主动说一句话。
脚本做了兜底：ClawBot 拒发时自动改走默认公众号重发一次，避免消息静默丢失。

### 共同说明

- **取数**：读 `/api/site/timeline` 的精选流（`selected` 为真的条目，按评分排），取前 N 条。
- **调度**：容器常驻，自己算下一个 10:30，不依赖宿主机 cron，也不依赖 Agent。
- **链接**：正文链接由 `SITE_PUBLIC_URL` 拼出，默认 `http://localhost:3000`，手机上打不开。
  有了公网域名后改成那个域名再重启容器：

```bash
SITE_PUBLIC_URL=https://你的域名
```

## 九、换模型（`.env` 里的 `LLM_*`）

所有分析步骤（预筛、打分、结构化、理解、摘要、日报）默认共用一个 OpenAI 兼容模型，改 `.env` 三行就换：

```bash
LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/plan/v3   # 火山方舟 Agent 套餐
LLM_API_KEY=ark-...
LLM_MODEL=deepseek-v4.1-flash
LLM_EXTRA_JSON={"thinking":{"type":"disabled"}}             # 关掉思考模式，否则等于推理模型
```

改完重启后端（`docker compose up -d --force-recreate api worker`），新调用立刻生效；已分析的文章不会自动重跑
（回执按 `模型 + 提示词版本 + 输入哈希` 记账，换模型就是一套新账）。

### 关掉深度思考（一次配好，全站所有步骤都生效）

框架在每个请求体里都会展开 `LLM_EXTRA_JSON`（`providers/llm.ts` 的 `...(spec.extra ?? {})`），
所以**这一个变量就是全站总开关**——预筛、打分、结构化、理解、摘要、日报、翻译全都带上它，不用逐步配。
字段名各家不一样，填错会被服务商以 400 拒掉：

| 服务商 / 模型 | `LLM_EXTRA_JSON` 填什么 |
|---|---|
| 火山方舟（豆包 seed、DeepSeek、Kimi…） | `{"thinking":{"type":"disabled"}}` |
| 阿里云百炼（Qwen 系列） | `{"enable_thinking":false}` |
| 小米 MiMo | `{"thinking":{"type":"disabled"}}` |
| OpenAI（gpt-5 等） | `{"reasoning_effort":"minimal"}` |
| 智谱 GLM-5.3 | 关不掉，只能 `{"thinking":{"type":"enabled"},"reasoning_effort":"low"}` |
| Claude / 非推理模型 | 不用填（默认就不思考） |

配套两点：

- `LLM_REASONING_TOKENS` **必须留空**。它是给"思考过程"额外留的输出额度，留着只会白花钱、白等时间。
- 如果某一步在 `site/models.ts` 的预设里单独指定了模型，**预设自带的 `extra` 优先**（例如 `glm-5.3-flash` 预设就强制思考）；
  想全站不思考，就不要给步骤绑这类预设。

验证：请求成功时看 `usage.completion_tokens_details.reasoning_tokens`，是 `0` 就说明真的没思考：

```bash
docker exec aihot-db-1 psql -U aihot -d aihot -c \
  "select model, usage->'completion_tokens_details'->>'reasoning_tokens' think_tokens, latency_ms
   from receipt_attempts where status='received' order by id desc limit 10;"
```

### 为什么从 `ark-code-latest` 换掉

`ark-code-latest` 是推理型入口，实测同一道结构化题（3500 字文章 → JSON 摘要）要 8.1 秒；库里 1393 次历史调用均值 6.0 秒、最长 101 秒。
Agent 套餐里**只有部分模型可用**，其余会报 `UnsupportedModel`（“does not support the agent plan feature”），
可用清单见火山文档 <https://www.volcengine.com/docs/82379/2366394>。同一道题的实测：

| 模型 | 单次耗时 | 档位 / 上下文 | 备注 |
|---|---|---|---|
| `ark-code-latest` | 8.1s | 推理型 | 原配置，慢 |
| `doubao-seed-2.0-mini` | 2.0s | 极速 / 256k | 最快，适合高并发的预筛 |
| `deepseek-v4.1-flash` | 1.9s | 进阶 / 1M | **当前选择**，长文摘要更细 |
| `doubao-seed-2.1-lite` | 3.6s | 标准 / 1M | |
| `glm-5.3-flash` | — | 标准 / 1M | 不支持 `thinking.type=disabled`，要改成 `{"thinking":{"type":"enabled"},"reasoning_effort":"low"}` |

一篇 3.9k 字文章走完整链路（预筛 → 结构化 → 打分 ×2 → 理解）的模型耗时：**6.6 秒**（原来约 27 秒），
各步 0.8–2.6 秒，输出 JSON 正常解析，结论与旧模型一致（同一篇分数 68 → 78，摘要更详细）。

### 想让某一步用更快的模型

`site/models.ts` 的 `PRESETS` 里加一条（复用同一把 key），再在 `DEFAULTS` 里指定，或直接在后台「模型与评测」页选：

```ts
"ark-mini": { service: "llm", model: "doubao-seed-2.0-mini", baseUrlEnv: "LLM_BASE_URL",
              apiKeyEnv: "LLM_API_KEY", extra: { thinking: { type: "disabled" } }, jsonMode: true },
export const DEFAULTS: Record<string, string> = { prefilter: "ark-mini" };
```

加预设要重新构建镜像（`docker compose up -d --build api worker`）。

### 验收方式

```bash
# 看最近各步骤的实际模型与耗时
docker exec aihot-db-1 psql -U aihot -d aihot -c \
  "select r.purpose, a.model, round(a.latency_ms/1000.0,1) s from receipt_attempts a
   join receipts r on r.id=a.receipt_id where a.started_at > now()-interval '1 hour' order by a.id;"
```

`LLM_REASONING_TOKENS` 只对推理模型有意义（给思考过程留输出额度），换成非推理模型后留空即可。

