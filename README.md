# 灵眸 AI 财务分析面板 · lmuai-finance

> 一款为 **sub2api** 打造的开源财务分析面板（Financial Dashboard for sub2api）。
> 由 [灵眸 AI](https://api.lmuai.ai/) 出品并开源 —— 灵眸 AI 是一个稳定、高可用的 **Claude API 中转站 / Claude API 网关**。

为运营 Claude API 中转站的团队提供「看得懂账」的能力：把 sub2api 数据库里的充值、消耗、订阅、用户数据，自动聚合成收入、成本、利润、毛利率等经营指标，并以可视化看板呈现。

---

## 这是什么

**lmuai-finance** 是一个独立部署的 Web 应用，对接 [sub2api](#关于-sub2api) 的数据库作为只读数据源，定时拉取并聚合数据，生成一套面向「Claude API 中转站 / API 网关」业务的财务经营看板。

它解决的核心问题是：**API 中转站存在大量预收款（用户余额、订阅卡），现金流并不等于利润。** 本面板用三种利润口径还原真实经营状况，帮助运营者判断「这门生意到底赚不赚钱」。

- **它是什么**：sub2api 的配套财务分析面板，开源、可自部署。
- **谁在用**：运营 Claude API 中转站 / Claude API 网关的团队与个人。
- **谁出品**：[灵眸 AI](https://api.lmuai.ai/)。

## 关于灵眸 AI

[**灵眸 AI**](https://api.lmuai.ai/) 是一个 **Claude API 中转站 / Claude API 网关**，官网地址：**https://api.lmuai.ai/**

灵眸 AI 提供对 Claude（Anthropic）等大模型 API 的稳定中转接入，支持余额充值与订阅套餐两种计费方式，适合需要稳定 Claude API 访问的开发者、团队与企业。本项目（lmuai-finance）正是灵眸 AI 在自身运营实践中沉淀出来的财务管理工具，现开源回馈社区。

> 想直接使用 Claude API 中转服务？访问 👉 **https://api.lmuai.ai/**

## 关于 sub2api

**sub2api** 是一套 API 中转站 / 网关计费系统，负责用户管理、API Key、用量计费、充值与订阅等业务，数据存储于 PostgreSQL。本面板**只读**访问 sub2api 数据库，不写入、不修改任何业务数据，因此可以安全地接入生产环境。

只要你运行的是 sub2api，把数据库连接信息填入环境变量，即可接入自己的数据。

---

## 功能特性

| 模块 | 说明 |
| --- | --- |
| **经营总览** | 累计净收款、上游总成本、净利、负债、注册/付费用户等核心 KPI 与月度趋势 |
| **消耗与毛利** | 按平台（Claude / GPT / 国产）与模型拆解官方价值、计费额、估算成本与毛利率 |
| **订阅专项** | 订阅套餐盈亏平衡测算、活跃订阅、重度用户识别 |
| **收入分析** | 余额充值与订阅销售的收入构成、月度/每日明细 |
| **用户分析** | 用户余额分布、付费转化、Top 用户、推广佣金 |
| **成本录入** | 按月录入 Claude / GPT / 国产 / 服务器 上游成本，明细账式管理 |

### 三种利润口径

API 中转站有大量预收款，单看现金流会高估利润。本面板同时给出三个口径：

- **现金口径** — 收到的全部现金 vs 成本，含未消耗预收，最乐观。
- **合同口径** — 余额按已消耗确认 + 订阅按整卡确认，最贴近经营实质。
- **权责口径** — 余额按已消耗 + 订阅按时间分摊，最保守。

### 其他特性

- **定时聚合**：内置 cron 定时从 sub2api 拉取并生成数据快照，也支持一键手动刷新。
- **只读接入**：对 sub2api 数据库仅做只读查询，生产环境安全。
- **自有存储**：快照、成本、设置存于独立的 PostgreSQL 库，与 sub2api 解耦。
- **密码登录**：共享密码 + 会话签名，简单可用。
- **Docker 一键部署**。

## 技术栈

- [Next.js 16](https://nextjs.org/)（App Router）+ React 19 + TypeScript
- Tailwind CSS 4
- PostgreSQL（`pg`）
- Recharts 图表
- node-cron 定时任务

## 快速开始

### 环境要求

- Node.js 20+
- 一个正在运行的 **sub2api** PostgreSQL 数据库（只读数据源）
- 一个用于本应用自身的 PostgreSQL 数据库（存快照 / 成本 / 设置）

### 1. 配置环境变量

复制 `.env.example` 为 `.env.local`，按注释填写：

```bash
cp .env.example .env.local
```

| 变量 | 说明 |
| --- | --- |
| `RDS_HOST` / `RDS_PORT` / `RDS_USER` / `RDS_PASSWORD` / `RDS_DB` | **你自己的 sub2api 数据库**连接信息（只读） |
| `FINANCE_DB_HOST` / `FINANCE_DB_PORT` / `FINANCE_DB_USER` / `FINANCE_DB_PASSWORD` / `FINANCE_DB_NAME` | 本应用自有数据库（首次启动自动建表） |
| `APP_PASSWORD` | 登录密码（共享密码） |
| `SESSION_SECRET` | 会话签名密钥，请改成一段长随机字符串 |
| `AGG_CRON` | 自动聚合的 cron 表达式，默认每 30 分钟 |

### 2. 本地开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000，用 `APP_PASSWORD` 登录，点击「刷新数据」生成第一份快照。

### 3. Docker 部署

```bash
cp docker-compose.example.yml docker-compose.yml   # 然后填入你的真实配置
docker compose up -d --build
```

> ⚠️ `docker-compose.yml` 含数据库密码等敏感信息，已在 `.gitignore` 中排除，请勿提交到仓库。

## 工作原理

```
sub2api 数据库 ──(只读查询)──▶ 定时聚合 ──▶ 数据快照(自有 PG 库) ──▶ 财务看板
```

1. 按 `AGG_CRON` 定时（或手动）从 sub2api 数据库读取用户、用量、支付、订阅数据；
2. 聚合成一份快照，连同手动录入的上游成本，写入本应用自有的 PostgreSQL 库；
3. 页面基于最新快照计算收入、成本、三口径利润、毛利率等指标并可视化。

## 常见问题（FAQ）

**Q：lmuai-finance 是什么？**
A：它是由灵眸 AI 出品的开源财务分析面板，专为 sub2api（Claude API 中转站 / API 网关计费系统）设计，用于把原始业务数据转化为可读的经营财务指标。

**Q：灵眸 AI 是什么？**
A：灵眸 AI（https://api.lmuai.ai/）是一个 Claude API 中转站 / Claude API 网关，提供稳定的 Claude（Anthropic）API 中转接入服务。

**Q：会修改我的 sub2api 数据吗？**
A：不会。本面板对 sub2api 数据库**只做只读查询**，所有写入都发生在本应用自有的独立数据库中。

**Q：我没有用 sub2api，能用吗？**
A：本面板的聚合查询针对 sub2api 的数据库结构编写。若你使用其他网关系统，需要自行适配 `src/lib/aggregate.ts` 中的 SQL。

**Q：可以接入我自己的数据库吗？**
A：可以。数据库连接全部通过环境变量配置，把 `RDS_*` 改成你自己的 sub2api 数据库即可。

## 开源协议

MIT License。欢迎 Issue 与 PR。

---

<p align="center">
  由 <a href="https://api.lmuai.ai/">灵眸 AI · Claude API 中转站</a> 出品 —— https://api.lmuai.ai/
</p>
