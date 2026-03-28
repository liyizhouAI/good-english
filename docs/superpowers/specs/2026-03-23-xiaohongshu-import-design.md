# 小红书素材导入集成设计

**日期**: 2026-03-23
**状态**: 已批准，待实现

---

## 背景

Good English 的素材导入流程已支持 YouTube / X / 知乎 / 微信公众号。小红书是用户的重要内容来源，但目前：
1. Worker 和前端均无法识别 `xiaohongshu.com` / `xhslink.com` URL
2. 用户从小红书 App 分享时得到的是混合文案（`"看这篇 http://xhslink.com/xxx 复制后打开小红书"`），`parseUrls()` 会直接丢弃这类输入

`fetch.py` 已完整实现 `fetch_xiaohongshu()`，并自动对小红书启用持久化 session。本次只需在 Good English 侧打通识别和路由即可。

---

## 认证方案

**持久化 session（一次性手动设置）**

```bash
python3 /Users/liyizhouai/Desktop/openclaw/skill/内容抓取/scripts/fetch.py --login-xhs
```

Session 保存至 `~/.cache/内容抓取/chrome_profile/`。Worker 调用 fetch.py 时无需传任何额外 flag，fetch.py 内部自动检测平台并启用持久化 session。Session 过期后重新执行上述命令即可。

---

## 改动范围（3 个文件）

### 1. `app/import/page.tsx`

**`UrlContentType`** — 新增 `"xiaohongshu"`

**`detectUrlType()`** — 新增：
```ts
if (/(?:xiaohongshu\.com|xhslink\.com)/i.test(url)) return "xiaohongshu";
```

**`urlTypeLabel()`** — 新增：
```ts
if (type === "xiaohongshu") return "📕 小红书";
```

**`parseUrls()`** — 改为支持分享文案中的嵌入 URL：
```
原逻辑：每行以 http 开头才保留
新逻辑：
  - 行以 http 开头 → 直接保留（原有行为不变）
  - 行内含嵌入 http URL → 提取第一个匹配（支持分享文案粘贴）
  - 无 URL → 丢弃
```

### 2. `lib/server/content-fetcher.ts`

**`UrlType`** — 新增 `"xiaohongshu"`

**`detectUrlType()`** — 新增：
```ts
if (/(?:xiaohongshu\.com|xhslink\.com)/i.test(url)) return "xiaohongshu";
```

**`fetchUrlContent()`** — 小红书与 twitter/zhihu/wechat 同路径，走 `fetchViaContentFetcher()`，无 jina 降级。错误信息补充提示：
```
小红书抓取失败：<原始错误>。请确保已运行 --login-xhs 完成授权。
```

### 3. `scripts/process-fetch-jobs.mjs`

**`detectUrlType()`** — 新增：
```js
if (/(?:xiaohongshu\.com|xhslink\.com)/i.test(url)) return "xiaohongshu";
```

`fetchContent()` 中小红书不传任何额外 flag（fetch.py 自动处理）。

---

## 数据流

```
用户输入: "看这篇 http://xhslink.com/o/abc123 复制后打开【小红书】"
          ↓ import/page.tsx parseUrls() 提取 http://xhslink.com/o/abc123
          ↓ 写入 Supabase content_fetch_jobs { source_url, user_id }
          ↓ Worker 识别 type = "xiaohongshu"
          ↓ execFile(fetch.py, [url, -o, tempDir])  // 无额外 flag
          ↓ fetch.py 自动用 ~/.cache/内容抓取/chrome_profile/ 持久化 session
          ↓ 抓取成功 → Markdown 归档到 DB/
          ↓ /api/extract 提取词汇/句型
          ↓ 写回 Supabase user_learning_data ✅
```

---

## 不在范围内

- session 过期时的前端友好提示（下一轮迭代）
- CDP 模式集成
- 小红书图片下载优化
