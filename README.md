# Good English — 英语战斗力恢复系统

> 不是"学英语"，是从你认为好的英文内容中提取精华，用 AI 模拟真实硅谷场景对话，系统恢复高级英语表达和采访能力。

## 核心理念

博士学历英语荒废多年（约四级水平），目标：去硅谷与 AI 领域牛人交流。

**定制化工具** > 现成 App。围绕自己真实素材（X 推文、YouTube 视频、Blog 采访）构建专属学习系统：

1. 从你认为好的英文内容自动提取词汇和句型
2. 用 SM-2 间隔重复算法管理复习计划
3. AI 扮演 VC / 创始人 / 研究员，模拟真实硅谷对话
4. 实时纠错 + 流利度评分

---

## Tech Stack

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) + React 19 + TypeScript |
| 样式 | Tailwind CSS v4（深色主题） |
| 存储 | Dexie.js (IndexedDB，纯本地，零服务器成本) |
| AI | Vercel AI SDK v6（多 Provider 抽象层） |
| 部署 | Vercel |

---

## 四大核心功能

### 1. 素材导入 & 智能提取（`/import`）

- 粘贴文本 或 输入 URL 自动抓取（服务端代理，绕过 CORS）
- AI 自动提取：高级词汇 / 可复用句型 / 关键短语
- 提取结果可勾选编辑后存入学习库
- 素材库支持浏览和删除

**提取 API**：`POST /api/extract` → LLM 返回结构化 JSON `{words[], patterns[], keyPhrases[]}`

### 2. 词汇恢复系统（`/vocabulary`）

- 分类词库：日常 / 商业 / AI科技 / 自定义
- **SM-2 间隔重复**：Again(重来) / Hard(困难) / Good(记住) / Easy(简单)
- 闪卡复习：点击翻转，查看中文释义 + 例句 + 语境
- 待复习词汇琥珀色高亮提示

### 3. AI 对话模拟器（`/chat`）

**4 个角色**：
- Sarah Chen — VC Partner（Sequoia，投资人视角）
- Marcus Thompson — AI Startup Founder（连续创业者）
- Dr. Emily Park — AI Researcher（DeepMind，学术风格）
- Alex Rivera — Product Manager（Google，产品思维）

**5 个场景**：自我介绍 / AI趋势讨论 / 创业商业交流 / 社交寒暄 / 媒体采访

**实时反馈**（每轮对话后）：
- 纠错：原句 → 建议改法 + 中文解释
- 评分：流利度 / 词汇量 / 语法（各 1-10 分）

### 4. 句型训练（`/patterns`）

- 按场景分类：自我介绍 / AI讨论 / 商业 / 社交 / 采访
- 融入 SM-2 复习系统，智能安排复习时间
- 闪卡正面：英文句型，背面：中文含义 + 例句

---

## AI Provider 配置

多 Provider 支持，API Key 存 localStorage（不上传服务器）。

在 **设置页面** (`/settings`) 配置，支持：

| Provider | 默认模型 | Base URL |
|----------|---------|---------|
| 阿里云百炼（Qwen） | qwen-plus | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| OpenRouter | claude-3.5-sonnet | `https://openrouter.ai/api/v1` |
| MiniMax | abab6.5s-chat | `https://api.minimax.chat/v1` |
| Kimi（月之暗面） | moonshot-v1-8k | `https://api.moonshot.cn/v1` |

> **推荐**：用阿里云百炼（qwen-plus），成本低，中文纠错效果好。

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 3456）
npm run dev

# 构建生产版本
npm run build
```

打开 http://localhost:3456 ，进入设置页配置 AI Provider API Key 即可使用。

---

## 数据库结构（IndexedDB via Dexie）

```
words       — 词汇（SM-2字段 + 分类 + 来源素材）
patterns    — 句型（SM-2字段 + 场景 + 来源素材）
materials   — 导入素材（原文 + 提取结果）
conversations — 对话历史
userStats   — 学习统计
```

全部存在浏览器 IndexedDB，关闭浏览器数据保留，清除浏览器数据会丢失。**建议定期 JSON 导出备份**（待实现）。

---

## 项目结构

```
Good English/
├── app/
│   ├── page.tsx              # 仪表盘（实时统计）
│   ├── import/page.tsx       # 素材导入 & 提取
│   ├── vocabulary/page.tsx   # 词汇复习系统
│   ├── chat/page.tsx         # AI 对话模拟
│   ├── patterns/page.tsx     # 句型训练
│   ├── settings/page.tsx     # AI Provider 设置
│   └── api/
│       ├── chat/route.ts     # 流式对话 API
│       ├── extract/route.ts  # 素材提取 API
│       ├── evaluate/route.ts # 练习评估 API
│       └── fetch-url/route.ts # URL 抓取代理
├── lib/
│   ├── ai/
│   │   ├── providers.ts      # 多 Provider 工厂
│   │   └── prompts.ts        # 所有 AI 提示词
│   ├── db/
│   │   ├── database.ts       # Dexie 数据库定义
│   │   ├── vocabulary.ts     # 词汇 CRUD
│   │   ├── patterns.ts       # 句型 CRUD
│   │   └── materials.ts      # 素材 CRUD
│   ├── hooks/
│   │   └── use-settings.ts   # Provider 配置 Hook
│   ├── utils/
│   │   └── sm2.ts            # SM-2 间隔重复算法
│   └── types/                # TypeScript 类型定义
└── components/
    └── layout/sidebar.tsx    # 侧边栏导航
```

---

## SM-2 算法说明

每次复习后选择难度，系统计算下次复习时间：

| 评级 | 说明 | 效果 |
|------|------|------|
| Again | 完全忘记 | 间隔重置为 1 天 |
| Hard | 勉强记住 | 间隔增长缓慢 |
| Good | 正常记住 | 间隔正常增长 |
| Easy | 轻松记住 | 间隔大幅增长，提升难度因子 |

连续 Easy 评级会让复习间隔指数级增长（1天→6天→15天→...），只需复习真正困难的内容。

---

## 后续迭代方向

- [ ] 数据 JSON 导出/导入（备份防丢失）
- [ ] 仪表盘：每日打卡连续记录、学习曲线图
- [ ] 语音输入（Web Speech API）
- [ ] 句型填空练习模式
- [ ] YouTube 字幕自动提取（youtube-transcript）
- [ ] 移动端优化
- [ ] PWA 离线支持

---

## 背景

> 船长博士学历，英语荒废多年约四级水平，计划去硅谷与 AI 领域牛人交流。
>
> 拒绝使用市面上任何 App，选择 vibe coding 一个定制工具，围绕自己真实认可的英文内容系统恢复高级表达和采访能力。
>
> 核心信念：**输入决定输出**。从你认为好的内容中学习，才能说出你想说的话。
