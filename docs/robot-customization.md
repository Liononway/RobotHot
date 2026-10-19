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
