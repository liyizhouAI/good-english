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
| 本地存储 | Dexie.js (IndexedDB) |
| 云端同步 | Supabase（Auth + PostgreSQL） |
| AI | Vercel AI SDK v6（多 Provider 抽象层） |
| 语音识别 | OpenAI Whisper (`/api/transcribe`) |
| 部署 | Vercel |

---

## 四大核心功能

### 1. 素材导入 & 智能提取（`/import`）
- 粘贴文本 或 输入 URL 自动抓取（服务端代理，绕过 CORS）
- AI 自动提取：高级词汇 / 可复用句型 / 关键短语
- 提取结果可勾选编辑后存入学习库

### 2. 词汇恢复系统（`/vocabulary`）
- SM-2 间隔重复：Again / Hard / Good / Easy
- 闪卡复习：点击翻转，查看中文释义 + 例句 + 语境
- 待复习词汇高亮提示

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
- 数据库表：`user_settings`（用于 API Key 云端同步）
- Auth Provider：Google OAuth（需在 Google Cloud Console 配置）

#### Supabase SQL（首次初始化，已执行）
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
├── supabase/settings-sync.ts # 云端设置读写
└── types/                    # TypeScript 类型

components/
├── layout/sidebar.tsx        # 侧边栏（响应式，支持折叠）
└── auth/login-card.tsx       # Google 登录卡片
```

---

## 待完成

- [ ] Google OAuth 配置（Google Cloud Console → Supabase）
- [ ] 数据 JSON 导出/导入备份
- [ ] 千问 Paraformer 语音识别（验证 compatible-mode 是否支持直传）
- [ ] 仪表盘学习曲线图、连续打卡
- [ ] YouTube 字幕自动提取
- [ ] PWA 离线支持

---

## 背景

> 船长博士学历，英语荒废多年约四级水平，计划去硅谷与 AI 领域牛人交流。
>
> 拒绝使用市面上任何 App，选择 vibe coding 一个定制工具，围绕自己真实认可的英文内容系统恢复高级表达和采访能力。
>
> 核心信念：**输入决定输出**。从你认为好的内容中学习，才能说出你想说的话。
