# 飞牛文件管家

飞牛文件管家是一个基于 React + Node.js 的文件监控与清理工具，面向飞牛 / fnOS 一类运行环境，提供监控目录管理、文件名清理、文件移除、下载目录识别和操作日志查看等能力。

## 项目简介

这个项目由两部分组成：

- 前端：基于 React 18、Vite 5 和 Arco Design 的单页管理界面
- 后端：基于 Express 的本地服务，负责配置管理、文件监控、规则执行和日志记录

项目构建后，前端资源会输出到 `app/ui`，由后端静态托管，并配合仓库中的 `manifest`、`cmd`、`wizard` 等目录用于应用打包和部署。

## 核心功能

- 文件夹监控：实时监控指定目录中的文件和文件夹变化
- 文件名自动清理：按规则删除文件名中的指定字符串
- 文件自动移除：支持通配符匹配，并按规则移至回收站或彻底删除
- 下载目录检测：识别 BT/PT 下载目录，并在下载完成后触发处理
- 操作日志：记录服务启动、规则变更、文件处理结果和日志清理等操作
- 配置管理：支持日志保留天数、监控目录列表及规则配置

## 技术栈

- 前端：React 18、Vite 5、Arco Design、Axios、React Router DOM
- 后端：Express 4、chokidar、fs-extra、cors、multer

## 目录结构

```text
fileManager/
├── app/
│   ├── backend/      # Express 后端服务
│   ├── server/       # 预留目录
│   ├── ui/           # 前端构建产物
│   └── www/          # 预留目录
├── cmd/              # 安装、配置、升级等命令脚本
├── config/           # 打包和权限相关配置
├── frontend/         # React 前端源码
├── images/           # 图标和图片资源
├── wizard/           # 安装/配置向导
├── manifest          # 应用清单
└── README.md
```

## 开发环境

建议使用：

- Node.js 18 及以上
- npm 9 及以上

默认开发端口：

- 前端：`5173`
- 后端：`3300`

## 快速开始

### 1. 安装依赖

```bash
cd app/backend
npm install

cd ../../frontend
npm install
```

### 2. 启动开发环境

启动后端服务：

```bash
cd app/backend
npm run dev
```

启动前端开发服务器：

```bash
cd frontend
npm run dev
```

前端通过 Vite 代理 `/api` 到 `http://localhost:3300`。

### 3. 构建前端

```bash
cd frontend
npm run build
```

构建完成后会：

- 输出前端资源到 `app/ui`
- 复制 `images` 目录到 `app/ui/images`
- 复制 `config_backup` 到 `app/ui/config`

## 配置与运行说明

后端启动后会自动执行以下行为：

- 加载配置文件
- 初始化日志目录
- 启动已启用的文件夹监控
- 检查并清理过期日志
- 初始化回收站目录

在目标运行环境中，后端会优先使用 `TRIM_PKGVAR` 推导配置目录和日志目录；在默认开发逻辑下，会使用类似 `/shares/fileManager/...` 的路径。

## 主要 API

### 健康检查

- `GET /api/health`：检查服务是否正常运行

### 配置与日志

- `GET /api/config`：获取当前应用配置
- `POST /api/config`：更新应用配置
- `GET /api/logs`：按日期获取日志列表
- `GET /api/logs/dates`：获取可用日志日期
- `GET /api/logs/config`：获取日志配置
- `GET /api/logs/check-cleanup`：检查是否存在可清理日志
- `POST /api/logs/cleanup`：执行日志清理
- `GET /api/log-retention-options`：获取日志保留天数选项

### 目录与监控

- `GET /api/directories`：浏览可选目录
- `GET /api/watch-folders`：获取监控文件夹列表
- `POST /api/watch-folders`：添加监控文件夹
- `DELETE /api/watch-folders/:id`：删除监控文件夹
- `PATCH /api/watch-folders/:id/toggle`：切换启用状态
- `PATCH /api/watch-folders/:id`：更新递归监控或下载目录标记
- `POST /api/watch-folders/:id/validate-download`：验证已配置监控目录是否为下载目录
- `GET /api/watch-folders/:id/download-status`：检查下载目录当前状态
- `POST /api/watch-folders/validate-path`：验证指定路径是否为下载目录

### 文件名清理规则

- `GET /api/filename-cleanup-rules`：获取规则列表
- `POST /api/filename-cleanup-rules`：添加规则并立即执行一次扫描处理
- `DELETE /api/filename-cleanup-rules/:rule`：删除规则
- `POST /api/filename-cleanup-rules/validate`：验证规则影响范围

### 文件移除规则

- `GET /api/file-removal-rules`：获取规则列表
- `POST /api/file-removal-rules`：添加规则并立即执行一次扫描处理
- `DELETE /api/file-removal-rules/:rule`：删除规则
- `POST /api/file-removal-rules/validate`：验证规则影响范围

## 适用场景

- 自动整理下载目录
- 批量清理文件名中的广告、字幕组或站点标记
- 自动移除临时文件、样本文件或指定命名规则的无用目录
- 为 NAS 文件处理场景提供可视化管理入口

## License

本项目采用 [MIT License](./LICENSE)。
