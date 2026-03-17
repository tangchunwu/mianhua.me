# mianhua.me

`mianhua.me` 是一个基于 `Next.js` 的个人博客与内容站点，当前运行方式已经从原项目的 “GitHub App + 前端直推仓库” 改成了 “服务器本地存储 + 管理员登录保存”。

当前线上地址：

- [http://mianhua.me](http://mianhua.me)
- [http://www.mianhua.me](http://www.mianhua.me)

## 当前架构

核心变化：

- 内容保存不再依赖 GitHub App 私钥
- 普通访客只读
- 管理员登录后可直接在前端编辑并保存
- 内容落盘到服务器本地文件
- 图片上传通过本站后端代理到图床
- 仓库用于代码与内容同步，不承担在线编辑权限

主要数据目录：

- `data/`
  - 首页配置
  - 项目数据
  - 图片页数据
  - about 配置
  - 管理员登录限流状态
- `public/blogs/`
  - 文章正文
  - 文章配置
  - 博客索引
  - 文章内本地静态资源

## 管理员能力

当前站点支持管理员登录后在线编辑以下内容：

- 首页配置
- About
- Projects
- Pictures
- Snippets
- Bloggers
- Share
- Blog 列表
- 新建 / 编辑 / 删除文章

管理员登录方式：

- 前端点击编辑入口
- 弹出自定义管理员登录框
- 登录成功后使用服务端 `cookie` 鉴权

当前已做的安全控制：

- 登录限流
- 会话过期
- 删除二次确认
- 访客不可直接进入写作页

## 图片上传

新上传图片默认走图床：

- 图床地址：`https://openclaw-tu.us.ci/`

服务端环境变量：

```bash
IMAGE_HOST_BASE_URL=https://openclaw-tu.us.ci
IMAGE_HOST_ENABLED=true
IMAGE_HOST_AUTH_CODE=***
```

覆盖范围：

- 首页 favicon / avatar / art / background
- 社交按钮图标
- 项目图片
- 文章封面图
- 文章正文图

说明：

- 历史本地图片仍可继续使用
- 新图片优先保存为图床绝对 URL
- 第一版不做远端图床删除

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
pnpm build
```

启动：

```bash
pnpm start
```

## 服务器部署

当前线上环境：

- Ubuntu
- Node.js 通过 `nvm` 管理
- `pnpm`
- 应用监听 `3000`
- `nginx` 监听 `80`
- `nginx` 反代到 `127.0.0.1:3000`
- Cloudflare 代理域名 `mianhua.me`

典型部署命令：

```bash
pnpm install
pnpm exec next build --webpack
pnpm start -p 3000
```

## GitHub 同步策略

当前仓库：

- [https://github.com/tangchunwu/mianhua.me](https://github.com/tangchunwu/mianhua.me)

同步原则：

- 代码要进 Git
- `data/` 要进 Git
- `public/blogs/` 要进 Git
- `.env.production` 不进 Git
- 日志文件不进 Git

这样做的目的：

- 避免“线上内容改了，但仓库没有”
- 避免再次出现内容丢失后无法从版本库回滚

## 备份

当前已配置：

- 服务器本地保留最近 3 份备份
- 远端 S3 兼容对象存储定时备份

备份重点：

- `data/`
- `public/blogs/`
- `.env.production`

说明：

- GitHub 负责版本同步
- 备份负责灾难恢复
- 二者不是同一个东西

## 目录说明

主要目录：

- `src/app/`
  - 页面与 API 路由
- `src/components/`
  - 公共组件
- `src/lib/`
  - 服务端配置、管理员鉴权、图床、博客读写等能力
- `data/`
  - 运行期内容数据
- `public/blogs/`
  - 博客内容与资源

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

## 备注

这个仓库已经不是原始上游项目的默认工作流。

当前仓库以 `mianhua.me` 实际线上运行状态为准，后续改动也应继续遵循这套原则：

- 在线编辑走服务端保存
- 内容同步进 GitHub
- 敏感配置留在服务器环境变量

