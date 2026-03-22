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

## 四大核心功能

### 1. 素材导入 & 智能提取（`/import`）
- 粘贴文本直接 AI 提取；URL 写入 Supabase 抓取队列，由常驻 Mac mini 调用 Content Fetcher skill 处理
- AI 自动提取：高级词汇 / 可复用句型 / 关键短语
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
- Auth Provider：Google OAuth（需在 Google Cloud Console 配置）

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

### Google OAuth（待完成配置）
1. Google Cloud Console → 新建项目 → OAuth Consent Screen → Credentials
2. Authorized redirect URI：`https://twjsspsplskqsgmnegrk.supabase.co/auth/v1/callback`
3. 将 Client ID + Secret 填入 Supabase → Authentication → Providers → Google

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

worker 默认使用 Supabase Realtime 监听新任务，并用 15 秒轻量轮询做兜底，不依赖每分钟 cron。归档文件名统一为 `YYYY-MM-DD_HHmm_来源_内容slug_短哈希.md`。

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

---

## 背景

> 船长博士学历，英语荒废多年约四级水平，计划去硅谷与 AI 领域牛人交流。
>
> 拒绝使用市面上任何 App，选择 vibe coding 一个定制工具，围绕自己真实认可的英文内容系统恢复高级表达和采访能力。
>
> 核心信念：**输入决定输出**。从你认为好的内容中学习，才能说出你想说的话。
