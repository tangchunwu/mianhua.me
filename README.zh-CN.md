# mianhua.me

[English](./README.md) | [简体中文](./README.zh-CN.md)

`mianhua.me` 是一个基于 `Next.js` 的个人博客与内容站点，当前已经改造成支持“前端登录编辑 + 服务端落盘保存”的轻量自托管内容系统。

## 项目概览

这个仓库已经不再使用原项目的“GitHub App + 前端直接提交仓库”的工作流。

现在的运行方式是：

- 访客只读
- 管理员可从前端登录
- 内容直接保存到服务器
- 图片通过服务端代理上传
- GitHub 负责版本同步，不承担在线编辑后端

线上地址：

- [https://mianhua.me](https://mianhua.me)
- [https://www.mianhua.me](https://www.mianhua.me)

仓库地址：

- [https://github.com/tangchunwu/mianhua.me](https://github.com/tangchunwu/mianhua.me)

## 当前特性

- 前端管理员登录与在线编辑
- 服务端本地内容存储
- 文章新建、编辑、删除
- 支持编辑 About / Projects / Pictures / Snippets / Bloggers / Share
- 新图片接入图床上传
- GitHub 同步代码与内容历史
- `nginx + Cloudflare` 域名接入
- 备份链路用于灾难恢复

## 当前架构

```text
浏览器
  -> Cloudflare
  -> Nginx
  -> Next.js 应用 (:3000)
  -> 本地内容文件 (data/, public/blogs/)
  -> 图床代理 (openclaw-tu.us.ci)
```

### 运行模型

- `Next.js` 提供页面和接口
- `nginx` 把 `mianhua.me` 反代到 `127.0.0.1:3000`
- 内容主要存放在：
  - `data/`
  - `public/blogs/`
- 敏感配置保留在服务器环境变量
- GitHub 保存代码与内容快照历史

## 与原项目的差异

原始上游项目的核心是 GitHub 仓库驱动的内容编辑。

当前版本已经改成：

- 去掉 GitHub 私钥式在线编辑
- 增加管理员登录与 cookie 鉴权
- 内容直接写入服务器
- 编辑权限只给管理员
- 图片上传改为走服务端图床代理

## 可编辑内容

管理员登录后可以直接在前端编辑这些内容：

- 首页配置
- About
- Projects
- Pictures
- Snippets
- Bloggers
- Share
- 博客列表
- 新建 / 编辑 / 删除文章

## 管理员鉴权

编辑能力由服务端鉴权保护。

已实现的安全控制：

- 登录限流
- 会话过期
- 删除二次确认
- 写作页只允许管理员进入

## 图片上传

新上传图片默认走图床：

- `https://openclaw-tu.us.ci/`

相关环境变量：

```bash
IMAGE_HOST_BASE_URL=https://openclaw-tu.us.ci
IMAGE_HOST_ENABLED=true
IMAGE_HOST_AUTH_CODE=***
```

覆盖范围：

- favicon / avatar / 首页插画 / 背景图
- 社交按钮图标
- 项目图片
- 文章封面图
- 文章正文图

说明：

- 历史本地图片仍可继续使用
- 新图片优先保存为图床绝对 URL
- 当前版本不实现远端图片删除

## 项目结构

```text
src/
  app/                页面与 API 路由
  components/         公共组件
  lib/                鉴权、服务端配置、博客读写、图床逻辑
  stores/             UI 状态管理
data/                 运行期内容数据
public/blogs/         博客内容与相关资源
```

关键接口：

- `src/app/api/admin/login/route.ts`
- `src/app/api/admin/logout/route.ts`
- `src/app/api/admin/status/route.ts`
- `src/app/api/config/route.ts`
- `src/app/api/content/[key]/route.ts`
- `src/app/api/blog/save/route.ts`
- `src/app/api/blog/delete/route.ts`
- `src/app/api/blog/listing/route.ts`
- `src/app/api/image-host/upload/route.ts`

## 本地开发

安装依赖：

```bash
pnpm install
```

开发模式：

```bash
pnpm dev
```

构建：

```bash
pnpm exec next build --webpack
```

启动：

```bash
pnpm start
```

## 生产部署

当前线上环境：

- Ubuntu
- Node.js 通过 `nvm` 管理
- `pnpm`
- `Next.js` 运行在 `3000`
- `nginx` 监听 `80`
- Cloudflare 代理域名

典型部署流程：

```bash
pnpm install
pnpm exec next build --webpack
pnpm start -p 3000
```

## GitHub 同步策略

GitHub 用来保存当前运行站点的版本历史。

明确纳入版本管理：

- 源代码
- `data/`
- `public/blogs/`

不纳入版本管理：

- `.env.production`
- 运行日志
- 临时部署文件

这样做的目的是避免这种情况：

> 线上内容已经改了，但仓库里没有这份状态

## 备份策略

GitHub 不是完整备份层。

当前备份重点：

- `data/`
- `public/blogs/`
- `.env.production`

职责划分：

- GitHub：版本同步与历史追踪
- 备份：灾难恢复

## 域名接入

站点已接入：

- `mianhua.me`
- `www.mianhua.me`

当前访问链路：

- Cloudflare DNS
- `nginx` 反向代理
- 服务器上的 Next.js 应用

## 说明

这个仓库现在应该被视为 `mianhua.me` 当前实际部署状态的源码与内容快照，而不是原始上游项目的“纯净镜像”。

后续继续维护时，建议遵循这三条：

- 在线编辑先保存到服务器
- 内容改动再同步回 GitHub
- 敏感配置始终留在仓库之外

