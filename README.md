# Good English — 英语战斗力恢复系统

> 不是"学英语"，是从你认为好的英文内容中提取精华，用 AI 模拟真实硅谷场景对话，系统恢复高级英语表达和采访能力。

**线上地址**：https://good-english-two.vercel.app

---

## 核心理念

博士学历英语荒废多年（约四级水平），目标：去硅谷与 AI 领域牛人交流。

**定制化工具** > 现成 App。围绕自己真实素材（X 推文、YouTube 视频、Blog 采访）构建专属学习系统：

1. 从你认为好的英文内容自动提取词汇和句型
2. 用 SM-2 间隔重复算法管理复习计划
3. AI 扮演 VC / 创始人 / 研究员，模拟真实硅谷对话
4. 实时纠错 + 流利度评分
5. 语音输入（OpenAI Whisper）

---

## Tech Stack

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 样式 | Tailwind CSS v4（深色主题） |
| 本地缓存 | Dexie.js (IndexedDB) |
| 云端主存储 | Supabase（Auth + PostgreSQL） |
| AI | Vercel AI SDK v6（多 Provider 抽象层） |
| 语音识别 | OpenAI Whisper (`/api/transcribe`) |
| 部署 | Vercel |

---

## UI 设计规范

> 以下为当前已落地的设计决策，升级迭代时请保持一致。

### 色彩系统（深色主题，`app/globals.css`）

| Token | 值 | 用途 |
|-------|----|------|
| `--background` | `#0a0a0f` | 页面底色 |
| `--foreground` | `#e4e4e7` | 主文字 |
| `--card` | `#141419` | 卡片 / 侧边栏背景 |
| `--primary` | `#6366f1` | 主操作色（按钮、激活态） |
| `--accent` | `#10b981` | 成功 / 完成状态 |
| `--muted` | `#27272a` | 分割线、次级区块 |
| `--muted-foreground` | `#71717a` | 辅助文字、占位符 |
| `--border` | `#27272a` | 边框 |
| `--destructive` | `#ef4444` | 警告 / 红标 |

### 字体（`app/layout.tsx` + `app/globals.css`）

| 角色 | 字体 | CSS 变量 | 中文 fallback |
|------|------|----------|---------------|
| 正文 / 代码 | JetBrains Mono 400/500/700 | `--font-mono` | Noto Sans SC → PingFang SC → system-ui |
| 标题 | Lora 400/700 | `--font-serif` | Noto Serif SC → Georgia |

**行高 Token**（CSS 变量，统一应用到全站）：

```css
--leading-body:    1.65   /* p / li / body */
--leading-heading: 1.25   /* h1–h6 */
--leading-tight:   1.4    /* button / label / small */
```

### Logo 系统（`components/ui/logo.tsx`）

**Banner Logo**（移动端顶栏）
- 组件：`<LogoBanner />`
- 渲染方式：SVG 像素艺术，`p=3 gap=2`，`fixedHeight=22`（高度固定 22px，宽度按比例自适应 ~188px）
- 字母网格：5×7 像素点阵，含 1px 3D 阴影 + 1px 顶部高光
- 颜色：`GOOD` → `#7A8694`（灰），`ENGLISH` → `#C0CDD8`（浅白），阴影 → `#06090C`

**页面标题 Heading**（仪表盘 `/`）
- 组件：`<GoodEnglishHeading />`
- 渲染方式：HTML `<h1>` 文本，字体 `var(--font-mono)`，`font-weight: 700`，`font-size: 1.6rem`，`letter-spacing: 0.04em`
- 不使用 SVG，是普通可选中的文本标题

### 布局（`components/layout/sidebar.tsx` + `app/layout.tsx`）

**侧边栏**
- 桌面展开宽：`md:w-56`（224px）；折叠宽：`md:w-16`（64px）
- 折叠/展开切换按钮在底部 footer
- 侧边栏内**不放 logo，不放 slogan**，只有导航项

**移动端顶部 Banner**
- 固定高度：`h-12`（48px），`z-40`，背景 `var(--card)`
- 包含：汉堡菜单按钮（`h-5 w-5`）+ `<LogoBanner />`
- 不随页面滚动（`position: fixed`）

**主内容区偏移**（防 banner 遮挡）
- 移动端：`pt-[50px]`（48px banner + 2px 呼吸空间）
- 桌面端：`md:pt-6`（正常 padding，无 banner）

### iOS Safari 防自动缩放规则

> iOS Safari 对字号 < 16px 的 input / textarea 获得焦点时会自动放大页面。

**规则：所有用户可编辑的输入框字号必须 ≥ 16px（`text-base`）**

已修复的位置：
- `app/import/page.tsx`：URL 输入框、文本输入框 → `text-base`
- `app/settings/page.tsx`：API Key 输入框 → `text-base`

新增 input / textarea 时，一律使用 `text-base` 或更大字号，禁止在移动端可见的输入框使用 `text-sm`。

### 确认对话框规则

**破坏性操作（删除、清空等）统一使用浏览器原生 `confirm()` 弹窗**，不做内联确认 UI。

- 简洁：无需额外状态管理
- 一致：系统级弹窗，用户习惯明确
- 已应用：素材导入页失败任务删除（`confirm("确定删除这条失败任务？")`）

新增删除类操作时，直接在 `onClick` 里调用 `if (!confirm("...")) return;`，无需自定义弹窗组件。

### 设置页云端同步（`app/settings/page.tsx`）

- API Key 填写后**自动本地保存**（localStorage），并在 1 秒防抖后静默同步到 Supabase `user_settings` 表
- 页面底部提供**手动「保存设置」按钮**（`CloudUpload` 图标），调用 `forceSave()` 立即同步，不等防抖
- 按钮状态反馈：保存中 → 已保存（绿色）→ 3 秒后恢复；未登录时提示登录；失败时红色提示
- 换设备登录后，页面加载时自动拉取云端设置（远端数据优先），API Key 无需重新填写

`forceSave` 实现位置：`lib/hooks/use-settings.ts`，返回 `"ok" | "not_logged_in" | "error"`。

---

## 四大核心功能

### 1. 素材导入 & 智能提取（`/import`）
- 粘贴文本直接 AI 提取；URL 写入 Supabase 抓取队列，由常驻 Mac mini 调用 Content Fetcher skill 处理
- AI 自动提取：高级词汇 / 可复用句型 / 关键短语
- 中文内容也会提炼核心概念、金句、观点、事件，并转成自然英语学习材料入库
- 抓取完成后自动归档 Markdown 到项目内 `DB/`
- Markdown、词汇、句型统一写回 Supabase，所有设备读取同一份云端数据

### 2. 词汇恢复系统（`/vocabulary`）
- SM-2 间隔重复：Again / Hard / Good / Easy
- 闪卡复习：点击翻转，查看中文释义 + 例句 + 语境
- 待复习词汇高亮提示
- **云端主存储**：打开即从 Supabase 拉取最新数据，复习/删除操作实时同步，多设备数据完全一致

### 3. AI 对话模拟器（`/chat`）
- 4 个角色：VC Partner / AI创始人 / AI研究员 / PM
- 5 个场景：自我介绍 / AI趋势 / 创业商业 / 社交寒暄 / 媒体采访
- 实时纠错 + 流利度/词汇/语法三维评分
- 支持语音输入（需配置 OpenAI Key）

### 4. 句型训练（`/patterns`）
- 按场景分类，融入 SM-2 复习系统
- 闪卡正面：英文句型，背面：中文含义 + 例句

---

## AI Provider 配置

Settings 页面（`/settings`）配置，支持多个 Provider 自由切换。

| Provider | 推荐模型 | 用途 |
|----------|---------|------|
| 阿里云百炼（Qwen） | qwen-plus | AI 对话（推荐，便宜） |
| MiniMax | MiniMax-M2.7-highspeed | AI 对话（国内快） |
| Kimi（月之暗面） | kimi-k2.5 | AI 对话 |
| OpenAI | gpt-4o | AI 对话 + **语音识别（必须）** |
| OpenRouter | claude-sonnet-4-6 | AI 对话（多模型聚合） |

> **语音输入**：固定使用 OpenAI Whisper，需要单独配置 OpenAI API Key。AI 对话可用任意 Provider。

### API Key 跨设备同步
用 Google 账号登录后，API Key 自动加密同步到 Supabase，换设备登录即恢复。

---

## 基础设施 & 账号

### Vercel
- 项目：`liyizhous-projects/good-english`
- 生产域名：`https://good-english-two.vercel.app`
- 部署命令：
  ```bash
  vercel deploy --prod --token YOUR_TOKEN --scope liyizhous-projects
  ```

### Supabase
- 项目 URL：`https://twjsspsplskqsgmnegrk.supabase.co`
- Region：Northeast Asia (Seoul)
- 数据库表：
  - `user_settings`：API Key 云端同步
  - `user_learning_data`：词汇 / 句型 / 素材云端主存储（云端为准，多设备实时同步）
  - `content_fetch_jobs`：URL 抓取任务队列（手机提交 URL，Mac mini 消费任务）
- Auth Provider：Google OAuth（已打通，用于 URL 导入和 API Key 跨设备同步）

#### Supabase SQL（已执行）

**user_settings**（API Key 同步）：
```sql
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  settings_data TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_only" ON user_settings
  FOR ALL USING (auth.uid() = user_id);
```

**user_learning_data**（词汇/句型/素材云端主存储）：
```sql
create table if not exists user_learning_data (
  user_id       uuid references auth.users primary key,
  words_data    text not null default '[]',
  patterns_data text not null default '[]',
  materials_data text not null default '[]',
  updated_at    timestamptz not null default now()
);
alter table user_learning_data enable row level security;
create policy "Users manage own learning data"
  on user_learning_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**content_fetch_jobs**（URL 抓取队列）：
```sql
create table if not exists content_fetch_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source_url text not null,
  status text not null default 'pending',
  error text,
  result_summary jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_content_fetch_jobs_status_requested_at
  on content_fetch_jobs(status, requested_at);

alter table content_fetch_jobs enable row level security;

create policy "Users manage own fetch jobs"
  on content_fetch_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Google OAuth
1. Google Cloud Console → 新建项目 → OAuth Consent Screen → Credentials
2. Authorized redirect URI：`https://twjsspsplskqsgmnegrk.supabase.co/auth/v1/callback`
3. 将 Client ID + Secret 填入 Supabase → Authentication → Providers → Google
4. 登录后 `/import` 会直接把 URL 抓取任务绑定到当前 `user_id`

### 环境变量
`.env.local`（本地开发用）：
```
NEXT_PUBLIC_SUPABASE_URL=https://twjsspsplskqsgmnegrk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_EBofpvQB7hTJdWvllQdVIw_oUkuWvUa
```
Vercel 生产环境已配置同名变量。

---

## URL 导入工作流

适用于核心场景：**手机上看到好内容，直接扔给 Good English。**

1. 手机浏览器打开 `/import`，登录 Google，提交 URL
2. 前端把 URL 写入 Supabase `content_fetch_jobs`
3. Mac mini 常驻执行 `scripts/process-fetch-jobs.mjs --watch`
4. 脚本调用本机 Content Fetcher skill 抓全文，生成 Markdown，并归档到 `DB/`
5. 脚本调用 `/api/extract` 提取词汇 / 句型 / 关键短语
6. 最终把 `materials_data / words_data / patterns_data` 直接写回 Supabase

这样手机、Mac、其他设备都只认 Supabase，不依赖某一台设备的本地 IndexedDB。

### 导入页体验

- 默认入口改为 `粘贴 URL`
- 最近任务列表固定显示在导入页下方
- 刷新页面时会先回显最近任务缓存，再立刻向 Supabase 补拉真实状态
- Realtime + 短间隔补拉 + 页面重新聚焦刷新，尽量把状态恢复压到 3 秒内
- 列表最多显示 5 条可视高度，超过后滚动显示

### Mac mini Worker

初始化云端表：
```bash
SUPABASE_SERVICE_ROLE_KEY=YOUR_KEY node scripts/setup-sync-table.mjs
```

启动常驻 worker（推荐）：
```bash
SUPABASE_SERVICE_ROLE_KEY=YOUR_KEY npm run worker
```

手动扫一次队列（补救/调试用）：
```bash
SUPABASE_SERVICE_ROLE_KEY=YOUR_KEY npm run worker:once
```

worker 默认使用 Supabase Realtime 监听新任务，并用 60 秒轻量轮询做兜底，不依赖每分钟 cron。空闲时只保持一个轻量 Node 进程和一条长连接，资源占用很低。归档文件名统一为 `YYYY-MM-DD_HHmm_来源_内容slug_短哈希.md`。

---

## 2026-03-28 开发进展

### AI 对话模拟器全面升级（`/chat`）

**排版视觉**
- AI 英文回复统一使用 `font-mono` 等宽字体，视觉上与用户输入明显区分，更易阅读
- 评分区三个维度（流利度 / 词汇 / 语法）使用三种不同颜色高亮，快速区分

**实时流式输出**
- 修复原来整条 AI 回复等全部生成后才显示的问题
- 现在采用正则实时提取 `"reply"` 字段内容，逐字流式展示，延迟感消除

**推理模型兼容（`<think>` 过滤）**
- Qwen / DeepSeek-R1 等推理模型会在回复前输出 `<think>...</think>` 推理过程
- 三层过滤：流式过程中跳过 think 块 → 全文 strip → parsed.reply 再 strip
- 用户界面完全看不到推理过程，只看到干净的英文回复

**每轮都有纠错/评分**
- 修复只有第一条消息有纠错的问题
- 根本原因：对话历史里 AI 消息只存了 `reply` 纯文本，模型看不到 JSON 格式，后续不再输出结构化数据
- 解决方案：发给 API 的历史中，AI 消息重新拼装成完整 JSON（含 `reply + corrections + feedback`），模型每轮都会继续产出结构化响应

**录音自动停止**
- 忘记点"停止录音"时，3 分钟后自动停止并触发转录
- 手动停止时清除计时器，不影响正常使用

### 布局 & 工具

**移动端视图模拟**
- 侧边栏底部新增 Monitor / Smartphone 切换按钮（仅桌面端显示）
- 点击后主内容区收窄到 430px（iPhone 17 Pro Max 宽度），居中显示，两侧虚线边框
- 方便在桌面开发时预览手机端真实效果
- 实现方式：React Context（`ViewModeContext`）+ `LayoutClient` 客户端包装组件

---

## 2026-03-23 开发进展

今天这轮把 URL 导入链路和云端同步真正拉通了，当前已经是可用状态：

- 手机浏览器提交 URL -> Supabase `content_fetch_jobs` -> Mac mini worker -> Content Fetcher -> Markdown 归档到 `DB/` -> 提取词汇句型 -> 回写 Supabase，全链路可用
- `user_settings`、`user_learning_data`、`content_fetch_jobs` 三张关键表已补齐
- Google 登录、登录回跳、URL 任务归属 `user_id` 已打通
- 导入页刷新后任务列表不会再长时间空白，排队中 / 处理中 / 已完成状态会持续显示
- 中文公众号文章不再只入素材不出学习项，而是会自动转成可学习的英文词汇和句型
- worker 增加了提取重试和超时兜底，降低偶发网络波动导致的失败
- 内容归档统一收口到现有 `DB/` 目录，没有新建重复文件夹

本轮已经实际跑通 4 条真实来源：

- X / Twitter
- YouTube
- 知乎回答
- 微信公众号文章

当前系统已经验证过：抓取完成后会同步把素材、词汇、句型写回 Supabase，多端看到的是同一份数据。

---

## 本地开发

```bash
npm install
npm run dev        # 启动开发服务器（端口 3456）
npm run build      # 构建生产版本
```

---

## 项目结构

```
app/
├── page.tsx                  # 仪表盘
├── import/page.tsx           # 素材导入 & 提取
├── vocabulary/page.tsx       # 词汇复习
├── chat/page.tsx             # AI 对话模拟
├── patterns/page.tsx         # 句型训练
├── settings/page.tsx         # AI Provider 配置 + 登录
├── auth/callback/route.ts    # Google OAuth 回调
└── api/
    ├── chat/route.ts         # 流式对话
    ├── extract/route.ts      # 素材提取
    ├── evaluate/route.ts     # 练习评估
    ├── fetch-url/route.ts    # URL 抓取代理
    └── transcribe/route.ts   # 语音识别（OpenAI Whisper）

lib/
├── ai/providers.ts           # 多 Provider 工厂
├── ai/prompts.ts             # AI 提示词
├── db/                       # Dexie IndexedDB
├── hooks/use-settings.ts     # 设置 Hook（含云端同步）
├── hooks/use-auth.ts         # Google Auth Hook
├── supabase/client.ts        # Supabase 客户端
├── supabase/settings-sync.ts # API Key 云端读写
├── supabase/data-sync.ts     # 学习数据云端主存储（push/pull，云端为准）
├── server/content-fetcher.ts # 本地 Content Fetcher / Markdown 归档工具
└── types/                    # TypeScript 类型

scripts/
├── setup-sync-table.mjs      # 初始化 Supabase 云端表
└── process-fetch-jobs.mjs    # Mac mini 抓取队列 worker

components/
├── layout/sidebar.tsx        # 侧边栏（响应式，支持折叠）
└── auth/login-card.tsx       # Google 登录卡片
```

---

## 待完成

- [ ] 数据 JSON 导出/导入备份
- [ ] 千问 Paraformer 语音识别（验证 compatible-mode 是否支持直传）
- [ ] 仪表盘学习曲线图、连续打卡
- [ ] PWA 支持
- [ ] Mac mini worker 开机自启和更完整的运行监控

---

## 背景

> 船长博士学历，英语荒废多年约四级水平，计划去硅谷与 AI 领域牛人交流。
>
> 拒绝使用市面上任何 App，选择 vibe coding 一个定制工具，围绕自己真实认可的英文内容系统恢复高级表达和采访能力。
>
> 核心信念：**输入决定输出**。从你认为好的内容中学习，才能说出你想说的话。
