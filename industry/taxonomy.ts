// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉结构抽取模型这一类收什么、
 * 和相邻类别的边界在哪（总的归类原则写在 prompts/structure.md 里）。
 * commentary 标出评论类（教程、观点）：日报写过的事又有评论类的后续报道，只占一行快讯（报道它的信源够多时除外）。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 * tagColor 是飞书推送卡片里跟在标题后面的这一类小标签的颜色（飞书 text_tag 的颜色名）。
 * feedLabel 是分类 RSS 标题里的名字（不写就用 label）。公开接口、RSS 和 MCP 里要把一类并进另一类发布，写在站点设置里（site/site.ts 的 PUBLIC_CATEGORIES）。
 */
export const CATEGORIES = [
  { key: "hardware", tagColor: "indigo", label: "整机", feedLabel: "机器人整机", section: "整机与硬件", guide: "机器人整机与硬件的发布、版本更新和迭代：人形、四足、机械臂、移动底盘、无人机、仿生机器人，以及关节模组、灵巧手、传感器、机器人芯片等核心零部件的发布。机器人厂商发布的软件平台、SDK 与开发工具仍是产品，不因厂商背景归技术；既有整机的表演、比赛和落地归应用。" },
  { key: "tech", tagColor: "turquoise", label: "技术", feedLabel: "技术发布", section: "技术发布", guide: "具身智能模型、VLA、运动控制、操作算法、仿真平台、训练数据集与技术方案的研究与发布，含开放权重和论文预印本对应的工程发布。只有论文本身的报道归论文；厂商整机发布里附带的技术说明归整机。" },
  { key: "deployment", tagColor: "green", label: "落地", feedLabel: "应用落地", section: "应用落地", guide: "机器人进入真实场景的进展：工厂产线部署、商业服务、物流仓储、医疗手术、表演展示、比赛获奖、公开演示，以及交付与订单（采购中标、批量出货）。看重点是发生了真实部署还是只有意向；纯粹的意向合作签约归行业。" },
  { key: "industry", tagColor: "orange", label: "行业", feedLabel: "行业动态", section: "行业与融资", guide: "已发生的公司经营、融资并购、人事、合作、诉讼、政策、真实安全事故及调查进展。融资以官宣或可靠媒体报道为准；新闻由当事人发帖、带有态度，也不因此变成观点。" },
  { key: "paper", tagColor: "violet", label: "论文", feedLabel: "论文", section: "论文研究", guide: "以新研究方法、实验设计与发现为核心的论文、技术报告、新基准或研究数据集。系统性红队实验属于研究；既有榜单成绩归技术，真实事故的新闻调查归行业。" },
  { key: "tip", tagColor: "green", label: "教程", section: "技巧与观点", guide: "读者可以照着使用的方法、部署实践、仿真搭建、二次开发教程与工程复盘。重点是可复用的做法；单纯发布工具归技术，只有态度和预测而无做法归观点。", commentary: true },
  { key: "opinion", tagColor: "purple", label: "观点", section: "技巧与观点", guide: "重点是作者的解释、判断、主张、预测、评论或访谈观点，包括对机器人行业格局、技术路线、量产时间的判断。讨论市场不自动归行业，作者是名人不自动归观点。", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; tagColor: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 这个行业最受关注的一类发布（机器人行业是新整机）：日报报头的“N 款新整机”、改分类后修订已出的报告都按它数。
 * category 是类别，tag 是标签，两者都对上才算；unit 接在数字后面。
 * 没有这样一类的行业设成 null，报头就不显示这个数。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "hardware", tag: "产品发布", unit: "款新整机" };

/** 周报月报的总述可以直接写、不必在报道里找到出处的行业通用词（小写）。站名会自动算进去。 */
export const PLAIN_TERMS: readonly string[] = ["ai", "robot", "robotics", "humanoid", "embodied", "机器人", "具身智能", "人形机器人"];

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = ["model_release", "product_launch", "tool_or_prompt", "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。 */
export const CATEGORY_TAGS = [
  "产品发布", "技术发布", "应用落地", "融资/并购", "行业动态", "论文/研究", "开源/仓库", "评测/基准",
  "教程/实践", "现象/趋势", "大佬观点", "政策/监管", "非机器人/通用硬件", "其他",
] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = [
  "人形机器人", "四足机器人", "机械臂", "具身智能", "VLA/操作", "运动控制", "工业机器人", "服务机器人",
  "医疗机器人", "无人机", "灵巧手", "零部件/传感器", "仿真/数据集", "开源生态", "人机交互",
] as const;

/** 可选的实体标签（公司、机构、平台）。 */
export const ENTITY_TAGS = [
  "特斯拉", "波士顿动力", "Figure AI", "宇树科技", "智元机器人", "傅利叶智能", "优必选", "越疆科技",
  "Agility Robotics", "1X Technologies", "Apptronik", "Physical Intelligence", "NVIDIA", "小米", "小鹏", "华为",
  "GitHub", "arXiv",
] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  "融资/收购": "融资/并购", 融资: "融资/并购", 收购: "融资/并购", 投资: "融资/并购", 并购: "融资/并购", 获投: "融资/并购", 完成轮: "融资/并购",
  发布: "产品发布", 产品: "产品发布", 更新: "产品发布", 机型: "产品发布", 整机: "产品发布", 新品: "产品发布", 亮相: "产品发布",
  技术: "技术发布", 算法: "技术发布", 模型: "技术发布", 框架: "技术发布",
  落地: "应用落地", 商业化: "应用落地", 场景: "应用落地", 订单: "应用落地", 交付: "应用落地", 部署应用: "应用落地", 表演: "应用落地", 比赛: "应用落地", 赛事: "应用落地",
  合作: "行业动态", 生态: "行业动态", 人事: "行业动态", 公司动态: "行业动态", 行业: "行业动态", 动态: "行业动态", 诉讼: "行业动态",
  政策: "政策/监管", 监管: "政策/监管", 法规: "政策/监管", 标准: "政策/监管", 安全事故: "行业动态",
  论文: "论文/研究", 研究: "论文/研究", paper: "论文/研究", papers: "论文/研究",
  "open-source": "开源/仓库", 开源: "开源/仓库", 仓库: "开源/仓库", repo: "开源/仓库",
  教程: "教程/实践", 玩法: "教程/实践", 指南: "教程/实践", 技巧: "教程/实践", 最佳实践: "教程/实践", 实践: "教程/实践", 复盘: "教程/实践",
  观点: "大佬观点", 大佬: "大佬观点", 访谈: "大佬观点", 判断: "大佬观点",
  趋势: "现象/趋势", 现象: "现象/趋势",
  评测: "评测/基准", 基准: "评测/基准", benchmark: "评测/基准", 榜单: "评测/基准",
  非机器人: "非机器人/通用硬件", "non-robot": "非机器人/通用硬件", 通用硬件: "非机器人/通用硬件", 智能硬件泛: "非机器人/通用硬件",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/**
 * 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。
 * aliases 给结构抽取模型看；orgNames 是这家公司发消息时开头用的组织名（公司、实验室、团队），
 * 在它自己的主题页上读者知道说的是谁，可以省去；otherNames 是公司的其他称呼（官方账号名、子品牌）。
 * 所有这些名字都用来认出说的是哪家公司，比如把事实的主体对到发布方。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }> = {
  tesla: { name: "特斯拉 Tesla", displayTag: "特斯拉", aliases: ["Tesla", "特斯拉", "Optimus", "擎天柱"], orgNames: ["Tesla", "特斯拉", "Tesla Optimus"] },
  "boston-dynamics": { name: "波士顿动力", displayTag: "波士顿动力", aliases: ["Boston Dynamics", "波士顿动力", "Atlas", "Spot"] },
  figure: { name: "Figure AI", displayTag: "Figure AI", aliases: ["Figure AI", "Figure", "Helix"] },
  unitree: { name: "宇树科技", displayTag: "宇树科技", aliases: ["宇树", "Unitree", "宇树科技", "H1", "G1", "R1"], orgNames: ["Unitree", "宇树", "宇树科技"] },
  zhiyuan: { name: "智元机器人", displayTag: "智元机器人", aliases: ["智元", "AgiBot", "AgiBot 智元", "远征", "灵犀"], orgNames: ["智元机器人", "智元", "AgiBot"] },
  fourier: { name: "傅利叶智能", displayTag: "傅利叶智能", aliases: ["Fourier", "傅利叶", "GR-3", "GRx"], orgNames: ["傅利叶智能", "Fourier Intelligence", "Fourier"] },
  ubtech: { name: "优必选", displayTag: "优必选", aliases: ["UBTECH", "优必选", "Walker"], orgNames: ["优必选", "UBTECH"] },
  dobot: { name: "越疆科技", displayTag: "越疆科技", aliases: ["Dobot", "越疆", "越疆机器人"], orgNames: ["越疆科技", "越疆", "Dobot"] },
  nvidia: { name: "NVIDIA 英伟达", displayTag: "NVIDIA", aliases: ["NVIDIA", "英伟达", "Jetson", "Isaac", "GR00T"], orgNames: ["NVIDIA", "英伟达"] },
  xiaomi: { name: "小米", displayTag: "小米", aliases: ["小米", "Xiaomi", "CyberOne", "CyberDog"], orgNames: ["小米", "Xiaomi"] },
  xpeng: { name: "小鹏", displayTag: "小鹏", aliases: ["小鹏", "XPeng", "XPENG", "IRON 机器人"], orgNames: ["小鹏", "XPeng", "小鹏汇天"] },
  huawei: { name: "华为", displayTag: "华为", aliases: ["华为", "Huawei"], orgNames: ["华为", "Huawei"] },
  agility: { name: "Agility Robotics", displayTag: "Agility Robotics", aliases: ["Agility Robotics", "Agility", "Digit"] },
  "one-x": { name: "1X Technologies", displayTag: "1X Technologies", aliases: ["1X", "1X Technologies", "NEO"] },
  apptronik: { name: "Apptronik", displayTag: "Apptronik", aliases: ["Apptronik", "Apollo 机器人"] },
  "physical-intelligence": { name: "Physical Intelligence", displayTag: "Physical Intelligence", aliases: ["Physical Intelligence", "π0", "pi0"] },
  skild: { name: "Skild AI", displayTag: "Skild AI", aliases: ["Skild AI", "Skild"] },
  galbot: { name: "银河通用", displayTag: "银河通用", aliases: ["银河通用", "Galbot"], orgNames: ["银河通用", "Galbot"] },
  astribot: { name: "星动纪元", displayTag: "星动纪元", aliases: ["星动纪元", "Astribot"], orgNames: ["星动纪元", "Astribot"] },
  "deep-robotics": { name: "云深处科技", displayTag: "云深处科技", aliases: ["云深处", "Deep Robotics", "绝影"], orgNames: ["云深处科技", "云深处", "Deep Robotics"] },
  engineai: { name: "众擎机器人", displayTag: "众擎机器人", aliases: ["众擎", "EngineAI", "Engine AI"], orgNames: ["众擎机器人", "众擎", "EngineAI"] },
  "world-labs": { name: "World Labs", displayTag: null, aliases: ["World Labs", "空间智能"] },
};

/**
 * 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 行业没有这个问题时可以留空数组。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "tesla", name: "特斯拉 / Optimus", patterns: [/tesla|特斯拉|optimus|擎天柱/i] },
  { id: "boston-dynamics", name: "波士顿动力", patterns: [/boston\s?dynamics|波士顿动力/i, /\batlas\b/i] },
  { id: "figure", name: "Figure AI", patterns: [/\bfigure\s?(ai|robotics)\b/i, /\bhelix\b/i] },
  { id: "unitree", name: "宇树科技", patterns: [/unitree|宇树/i] },
  { id: "zhiyuan", name: "智元机器人", patterns: [/智元|agibot/i] },
  { id: "fourier", name: "傅利叶智能", patterns: [/傅利叶/i, /\bfourier\b/i] },
  { id: "ubtech", name: "优必选", patterns: [/优必选|ubtech/i, /\bwalker\s?[s2\d]/i] },
  { id: "nvidia", name: "NVIDIA", patterns: [/nvidia|英伟达|\bjetson\b|\bisaac\b|\bgr00t\b|\bblackwell\b/i] },
  { id: "xiaomi", name: "小米", patterns: [/小米|xiaomi|cyberone|cyberdog/i] },
  { id: "xpeng", name: "小鹏", patterns: [/小鹏|xpeng/i] },
  { id: "agility", name: "Agility Robotics", patterns: [/agility\s?robotics/i] },
  { id: "one-x", name: "1X Technologies", patterns: [/\b1x\s?(technologies|tech)?\b/i] },
  { id: "apptronik", name: "Apptronik", patterns: [/apptronik/i] },
  { id: "physical-intelligence", name: "Physical Intelligence", patterns: [/physical\s?intelligence|\bπ0\b|\bpi-?0\b/i] },
  { id: "dobot", name: "越疆科技", patterns: [/越疆|\bdobot\b/i] },
  { id: "galbot", name: "银河通用", patterns: [/银河通用|galbot/i] },
  { id: "astribot", name: "星动纪元", patterns: [/星动纪元|astribot/i] },
  { id: "deep-robotics", name: "云深处科技", patterns: [/云深处|deep\s?robotics|绝影/i] },
  { id: "engineai", name: "众擎机器人", patterns: [/众擎|engine\s?ai\b/i] },
];

/** 这些域名上的文章，发布方就是对应的公司（托管平台如 GitHub、arXiv 不算）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "tesla", domains: ["tesla.com"] },
  { entityId: "boston-dynamics", domains: ["bostondynamics.com"] },
  { entityId: "figure", domains: ["figure.ai"] },
  { entityId: "unitree", domains: ["unitree.com"] },
  { entityId: "nvidia", domains: ["nvidia.com", "blogs.nvidia.com"] },
  { entityId: "agility", domains: ["agilityrobotics.com"] },
  { entityId: "one-x", domains: ["1x.tech"] },
  { entityId: "apptronik", domains: ["apptronik.com"] },
];

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "nvidia", pattern: /@nvidia(?:geforce|ai)?\b/i },
  { entityId: "unitree", pattern: /@unitreerobotics\b/i },
];
