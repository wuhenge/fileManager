# 飞牛文件管家

基于 React + Node.js 的飞牛文件管理器应用。

## 功能特性

- 文件夹监控 - 实时监控指定文件夹的文件变化
- 文件名自动清理 - 自动移除文件名中的指定字符串
- 文件自动移除 - 支持通配符规则匹配并自动删除或移至回收站
- 下载目录检测 - 自动识别 BT/PT 下载目录，检测下载完成状态
- 操作日志 - 记录所有文件操作历史

## 技术栈

- **前端**: React 18, Vite 5, Arco Design, react-router-dom
- **后端**: Express 4, chokidar, fs-extra

## 项目结构

```
fileManager/
├── app/
│   ├── backend/      # Express 后端服务
│   ├── server/      # 服务端代码
│   ├── ui/         # UI 组件
│   └── www/        # 静态资源
├── frontend/       # React 前端
├── config/         # 配置文件
├── images/         # 图片资源
└── wizard/       # 安装向导
```

## 快速开始

### 安装依赖

```bash
# 安装后端依赖
cd app/backend
npm install

# 安装前端依赖
cd frontend
npm install
```

### 启动开发服务器

```bash
# 启动后端 (端口 3300)
cd app/backend
npm run dev

# 启动前端 (端口 5173)
cd frontend
npm run dev
```

### 构建生产版本

```bash
cd frontend
npm run build
```

## API 文档

### 监控文件夹

- `GET /api/watch-folders` - 获取监控文件夹列表
- `POST /api/watch-folders` - 添加监控文件夹
- `DELETE /api/watch-folders/:id` - 删除监控文件夹
- `PATCH /api/watch-folders/:id/toggle` - 切换监控状态

### 文件名清理规则

- `GET /api/filename-cleanup-rules` - 获取规则列表
- `POST /api/filename-cleanup-rules` - 添加规则
- `DELETE /api/filename-cleanup-rules/:rule` - 删除规则

### 文件移除规则

- `GET /api/file-removal-rules` - 获取规则列表
- `POST /api/file-removal-rules` - 添加规则
- `DELETE /api/file-removal-rules/:rule` - 删除规则

### 日志

- `GET /api/logs` - 获取日志列表
- `GET /api/logs/dates` - 获取可用日志日期

## 许可

MIT License