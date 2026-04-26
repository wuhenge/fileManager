const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');

const app = express();
const PORT = process.env.PORT || 3300;

// 配置文件路径
function getConfigDir() {
  const pkgVar = process.env.TRIM_PKGVAR;
  if (pkgVar) {
    const shareDir = pkgVar.replace('@appdata', '@appshare');
    return path.join(shareDir, 'data');
  }
  return '/shares/fileManager/data';
}

const CONFIG_DIR = getConfigDir();
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 默认配置
const DEFAULT_CONFIG = {
  logRetentionDays: 7,
  watchFolders: [],
  filenameCleanupRules: [],  // 文件名清理规则列表，每个规则是要移除的字符串
  fileRemovalRules: []  // 文件移除规则列表，每个规则包含 { rule: string, action: 'trash' | 'delete' }
};

// 回收站路径
const TRASH_PATH = '/vol1/1000/.@#local/trash/';

// 确保回收站目录存在
async function ensureTrashDir() {
  try {
    await fs.ensureDir(TRASH_PATH);
    console.log(`[回收站] 回收站目录已确认: ${TRASH_PATH}`);
  } catch (error) {
    console.error(`[回收站] 创建回收站目录失败: ${TRASH_PATH}`, error.message);
  }
}

// 下载目录验证缓存
const downloadFolderCache = new Map();

// 全局配置对象
let appConfig = loadConfig();

// 文件夹监控实例存储
const watchers = new Map();

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    console.error('加载配置失败:', error.message);
  }
  return DEFAULT_CONFIG;
}

// 保存配置
function saveConfig(config) {
  try {
    fs.ensureDirSync(CONFIG_DIR);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('保存配置失败:', error.message);
    return false;
  }
}

// 获取日志目录
function getLogDir() {
  const pkgVar = process.env.TRIM_PKGVAR;
  if (pkgVar) {
    const shareDir = pkgVar.replace('@appdata', '@appshare');
    return path.join(shareDir, 'logs');
  }
  return '/shares/fileManager/logs';
}

const LOG_DIR = getLogDir();
fs.ensureDirSync(LOG_DIR);

// 获取当前日期的字符串格式 (YYYY-MM-DD)
function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取当前时间的字符串格式
function getTimeString(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// 获取当天的日志文件路径
function getLogFilePath(date = new Date()) {
  const dateStr = getDateString(date);
  return path.join(LOG_DIR, `operation-${dateStr}.log`);
}

// 清理过期日志文件
async function cleanupOldLogs() {
  try {
    const files = await fs.readdir(LOG_DIR);
    const now = new Date();
    const retentionDays = appConfig.logRetentionDays || 7;
    // 保留N天包括今天，例如保留3天 = 保留今天在内的3天 = 删除retentionDays天之前的日志
    const cutoffDate = new Date(now.getTime() - (retentionDays - 1) * 24 * 60 * 60 * 1000);
    
    console.log(`[日志清理] 开始清理日志，保留天数: ${retentionDays}天，截止日期: ${cutoffDate.toISOString().split('T')[0]}`);
    
    let deletedCount = 0;
    for (const file of files) {
      if (file.startsWith('operation-') && file.endsWith('.log')) {
        const filePath = path.join(LOG_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.remove(filePath);
          console.log(`[日志清理] 已删除过期日志: ${file}`);
          deletedCount++;
        }
      }
    }
    
    if (deletedCount === 0) {
      console.log(`[日志清理] 没有需要清理的过期日志`);
    } else {
      console.log(`[日志清理] 共删除 ${deletedCount} 个过期日志文件`);
    }
  } catch (error) {
    console.error('清理日志失败:', error.message);
  }
}

// 操作类型中文映射
const OPERATION_NAMES = {
  'SERVER_START': '服务启动',
  'SERVER_STOP': '服务停止',
  'WATCH_ERROR': '监控错误',
  'GET_LOGS': '查看日志',
  'UPDATE_CONFIG': '更新配置',
  'GET_CONFIG': '查看配置',
  'ADD_WATCH_FOLDER': '添加监控文件夹',
  'REMOVE_WATCH_FOLDER': '移除监控文件夹',
  'TOGGLE_WATCH_FOLDER': '切换监控状态',
  'ADD_FILENAME_CLEANUP_RULE': '添加文件名清理规则',
  'REMOVE_FILENAME_CLEANUP_RULE': '删除文件名清理规则',
  'ADD_FILE_REMOVAL_RULE': '添加文件移除规则',
  'REMOVE_FILE_REMOVAL_RULE': '删除文件移除规则',
  'FILENAME_CLEANUP': '文件名清理',
  'FILE_REMOVED': '文件移除',
  'VALIDATE_DOWNLOAD_FOLDER': '验证下载目录',
  'UPDATE_DOWNLOAD_FOLDER_STATUS': '更新下载目录状态'
};

// 日志记录函数
function writeLog(operation, details) {
  const now = new Date();
  const dateStr = getDateString(now);
  const timeStr = getTimeString(now);
  const logFile = getLogFilePath(now);

  const operationName = OPERATION_NAMES[operation] || operation;
  const logEntry = `[${dateStr} ${timeStr}] [${operationName}] ${JSON.stringify(details)}\n`;

  try {
    fs.appendFileSync(logFile, logEntry);
    console.log(`[LOG] ${operationName}:`, details);
  } catch (error) {
    console.error('写入日志失败:', error.message);
  }
}

// 检查文件夹是否为下载目录（只检查直接子文件夹中的.part文件）
async function checkIsDownloadFolder(folderPath) {
  try {
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      return { isDownloadFolder: false, error: '路径不是文件夹' };
    }

    // 读取直接子文件夹（一级）
    const firstLevelItems = await fs.readdir(folderPath, { withFileTypes: true });
    const firstLevelDirs = firstLevelItems.filter(item => item.isDirectory());

    if (firstLevelDirs.length === 0) {
      return { isDownloadFolder: false, reason: '没有子文件夹' };
    }

    // 检查直接子文件夹中的.part文件
    let hasPartFiles = false;
    let totalPartFiles = 0;
    const partFileDetails = [];

    for (const firstDir of firstLevelDirs) {
      const firstLevelPath = path.join(folderPath, firstDir.name);
      
      try {
        const firstLevelFiles = await fs.readdir(firstLevelPath);
        const firstLevelPartFiles = firstLevelFiles.filter(f => f.endsWith('.part'));
        
        if (firstLevelPartFiles.length > 0) {
          hasPartFiles = true;
          totalPartFiles += firstLevelPartFiles.length;
          partFileDetails.push({
            folder: firstDir.name,
            files: firstLevelPartFiles
          });
        }
      } catch (err) {
        console.error(`[下载目录检测] 读取子文件夹失败: ${firstLevelPath}`, err.message);
      }
    }

    return {
      isDownloadFolder: hasPartFiles,
      hasPartFiles,
      totalPartFiles,
      partFileDetails
    };
  } catch (error) {
    console.error(`[下载目录检测] 检查失败: ${folderPath}`, error.message);
    return { isDownloadFolder: false, error: error.message };
  }
}

// 检查下载目录是否准备好（没有.part文件）
async function checkDownloadFolderReady(folderPath) {
  const result = await checkIsDownloadFolder(folderPath);

  if (!result.isDownloadFolder) {
    return { ready: true, reason: '不是下载目录' };
  }

  return {
    ready: !result.hasPartFiles,
    hasPartFiles: result.hasPartFiles,
    totalPartFiles: result.totalPartFiles,
    partFileDetails: result.partFileDetails
  };
}

// 检查指定子文件夹是否包含.part文件（用于操作时的细粒度判断）
async function checkSubFolderHasPartFiles(folderPath, subFolderName) {
  const subFolderPath = path.join(folderPath, subFolderName);
  try {
    const files = await fs.readdir(subFolderPath);
    const partFiles = files.filter(f => f.endsWith('.part'));
    return {
      hasPartFiles: partFiles.length > 0,
      partFileCount: partFiles.length,
      partFiles: partFiles
    };
  } catch (error) {
    console.error(`[下载目录检测] 检查子文件夹失败: ${subFolderPath}`, error.message);
    return { hasPartFiles: false, partFileCount: 0, partFiles: [] };
  }
}

// 获取文件所在的直接子文件夹名称
function getDirectSubFolder(folderPath, filePath) {
  const relativePath = path.relative(folderPath, filePath);
  const parts = relativePath.split(path.sep);
  return parts.length > 0 ? parts[0] : null;
}

// 检测并清理文件名（支持递归/非递归模式，与验证逻辑一致）
function cleanupFilename(filePath, folderConfig) {
  const rules = appConfig.filenameCleanupRules || [];
  if (rules.length === 0) return null;

  // 检查文件是否在监控范围内（根据recursive配置）
  if (folderConfig) {
    const isRecursive = folderConfig.recursive === true;
    const folderPath = folderConfig.path;
    const relativePath = path.relative(folderPath, filePath);
    const depth = relativePath.split(path.sep).length - 1;

    // 非递归模式下，只处理直接子文件（depth === 0）
    if (!isRecursive && depth > 0) {
      return null;
    }
  }

  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  let newBasename = basename;
  let matchedRule = null;

  for (const rule of rules) {
    if (basename.includes(rule)) {
      newBasename = newBasename.split(rule).join('');
      matchedRule = rule;
    }
  }

  if (newBasename !== basename && newBasename.length > 0) {
    const newPath = path.join(dir, newBasename);
    return { originalPath: filePath, newPath, newBasename, matchedRule };
  }

  return null;
}

// 执行文件重命名
async function renameFile(originalPath, newPath) {
  try {
    await fs.rename(originalPath, newPath);
    return true;
  } catch (error) {
    console.error(`[文件名清理] 重命名失败: ${originalPath} -> ${newPath}`, error.message);
    return false;
  }
}

// 检查文件是否需要移除（支持递归/非递归模式，与验证逻辑一致）
function checkFileRemoval(filePath, folderConfig) {
  const rules = appConfig.fileRemovalRules || [];
  if (rules.length === 0) return null;

  // 检查文件是否在监控范围内（根据recursive配置）
  if (folderConfig) {
    const isRecursive = folderConfig.recursive === true;
    const folderPath = folderConfig.path;
    const relativePath = path.relative(folderPath, filePath);
    const depth = relativePath.split(path.sep).length - 1;

    // 非递归模式下，只处理直接子文件/文件夹（depth === 0）
    if (!isRecursive && depth > 0) {
      return null;
    }
  }

  const basename = path.basename(filePath);

  for (const ruleObj of rules) {
    const rule = typeof ruleObj === 'string' ? ruleObj : ruleObj.rule;
    const action = typeof ruleObj === 'string' ? 'delete' : (ruleObj.action || 'trash');
    
    if (matchWildcard(basename, rule)) {
      return { rule: rule, action: action };
    }
  }

  return null;
}

// 执行文件移除
async function removeFile(filePath) {
  try {
    await fs.remove(filePath);
    return true;
  } catch (error) {
    console.error(`[文件移除] 删除文件失败: ${filePath}`, error.message);
    return false;
  }
}

// 执行文件夹移除
async function removeFolder(folderPath) {
  try {
    await fs.remove(folderPath);
    return true;
  } catch (error) {
    console.error(`[文件移除] 删除文件夹失败: ${folderPath}`, error.message);
    return false;
  }
}

// 移动文件到回收站（按源文件相对路径保存）
async function moveFileToTrash(filePath, watchFolderPath = null) {
  try {
    let relativePath;
    
    // 计算相对于 /vol1/1000/ 的路径
    const baseVolumePath = '/vol1/1000/';
    if (filePath.startsWith(baseVolumePath)) {
      relativePath = filePath.substring(baseVolumePath.length);
    } else if (watchFolderPath && filePath.startsWith(watchFolderPath)) {
      // 如果提供了监控文件夹路径，使用相对于监控文件夹的路径
      const watchFolderName = path.basename(watchFolderPath);
      relativePath = path.join(watchFolderName, path.relative(watchFolderPath, filePath));
    } else {
      // 默认使用文件名
      relativePath = path.basename(filePath);
    }
    
    const trashTargetPath = path.join(TRASH_PATH, relativePath);
    const trashTargetDir = path.dirname(trashTargetPath);
    
    // 确保目标目录存在
    await fs.ensureDir(trashTargetDir);
    
    // 如果回收站中已存在同名文件，添加时间戳后缀
    let finalTrashPath = trashTargetPath;
    if (await fs.pathExists(finalTrashPath)) {
      const ext = path.extname(relativePath);
      const nameWithoutExt = path.basename(relativePath, ext);
      const dir = path.dirname(trashTargetPath);
      const timestamp = Date.now();
      finalTrashPath = path.join(dir, `${nameWithoutExt}_${timestamp}${ext}`);
    }
    
    await fs.move(filePath, finalTrashPath);
    return { success: true, trashPath: finalTrashPath };
  } catch (error) {
    console.error(`[文件移至回收站] 移动文件失败: ${filePath}`, error.message);
    return { success: false, error: error.message };
  }
}

// 移动文件夹到回收站（按源文件夹相对路径保存）
async function moveFolderToTrash(folderPath, watchFolderPath = null) {
  try {
    let relativePath;
    
    // 计算相对于 /vol1/1000/ 的路径
    const baseVolumePath = '/vol1/1000/';
    if (folderPath.startsWith(baseVolumePath)) {
      relativePath = folderPath.substring(baseVolumePath.length);
    } else if (watchFolderPath && folderPath.startsWith(watchFolderPath)) {
      // 如果提供了监控文件夹路径，使用相对于监控文件夹的路径
      const watchFolderName = path.basename(watchFolderPath);
      relativePath = path.join(watchFolderName, path.relative(watchFolderPath, folderPath));
    } else {
      // 默认使用文件夹名
      relativePath = path.basename(folderPath);
    }
    
    const trashTargetPath = path.join(TRASH_PATH, relativePath);
    const trashTargetDir = path.dirname(trashTargetPath);
    
    // 确保目标目录存在
    await fs.ensureDir(trashTargetDir);
    
    // 如果回收站中已存在同名文件夹，添加时间戳后缀
    let finalTrashPath = trashTargetPath;
    if (await fs.pathExists(finalTrashPath)) {
      const dir = path.dirname(trashTargetPath);
      const basename = path.basename(relativePath);
      const timestamp = Date.now();
      finalTrashPath = path.join(dir, `${basename}_${timestamp}`);
    }
    
    await fs.move(folderPath, finalTrashPath);
    return { success: true, trashPath: finalTrashPath };
  } catch (error) {
    console.error(`[文件夹移至回收站] 移动文件夹失败: ${folderPath}`, error.message);
    return { success: false, error: error.message };
  }
}

// 启动文件夹监控
function startWatching() {
  // 停止所有现有监控
  stopAllWatching();
  
  // 启动新的监控
  for (const folder of appConfig.watchFolders) {
    if (folder.enabled) {
      startWatchingFolder(folder);
    }
  }
}

// 启动单个文件夹监控
function startWatchingFolder(folder) {
  const { id, path: folderPath, recursive, isDownloadFolder } = folder;
  const debounceTimers = new Map();

  try {
    const watcher = chokidar.watch(folderPath, {
      persistent: true,
      ignoreInitial: false,
      depth: recursive ? undefined : 0
    });

    watcher
      .on('all', async (event, itemPath) => {
        if (!['add', 'addDir', 'unlink', 'unlinkDir'].includes(event)) return;

        if (isDownloadFolder) {
          const subFolderName = getDirectSubFolder(folderPath, itemPath);
          if (subFolderName) {
            const hasPart = await checkSubFolderHasPartFiles(folderPath, subFolderName);
            if (hasPart.hasPartFiles) return;

            const key = `scan_${subFolderName}`;
            if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key));

            debounceTimers.set(key, setTimeout(async () => {
              debounceTimers.delete(key);
              console.log(`[下载完成] 子文件夹 ${subFolderName} 下载完成，重新处理文件`);
              await processSubFolderFiles(folderPath, subFolderName, folder, recursive, isDownloadFolder);
            }, 2000));
          }
        } else {
          const itemType = ['add', 'addDir'].includes(event)
            ? (event === 'add' ? 'file' : 'folder')
            : null;
          if (itemType) {
            await processItem(itemPath, itemType, folder, folderPath, recursive, isDownloadFolder, '实时监控');
          }
        }
      })
      .on('error', error => {
        writeLog('WATCH_ERROR', {
          path: folderPath,
          error: error.message,
          ip: 'system',
          result: '失败'
        });
      });

    watchers.set(id, watcher);
    console.log(`[监控] 已启动: ${folderPath} (递归: ${recursive}, 下载目录: ${isDownloadFolder || false})`);
  } catch (error) {
    console.error(`[监控错误] ${folderPath}:`, error.message);
    writeLog('WATCH_ERROR', {
      path: folderPath,
      error: error.message,
      ip: 'system',
      result: '失败'
    });
  }
}

// 停止所有监控
function stopAllWatching() {
  for (const [id, watcher] of watchers) {
    watcher.close();
    console.log(`[监控] 已停止: ${id}`);
  }
  watchers.clear();
}

// 停止单个文件夹监控
function stopWatchingFolder(id) {
  const watcher = watchers.get(id);
  if (watcher) {
    watcher.close();
    watchers.delete(id);
    console.log(`[监控] 已停止: ${id}`);
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../ui')));

// 获取日志列表（支持按日期筛选）
app.get('/api/logs', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || getDateString();
    const logFile = getLogFilePath(new Date(targetDate));
    
    const exists = await fs.pathExists(logFile);
    if (!exists) {
      return res.json({ success: true, data: [], date: targetDate });
    }
    
    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim()).reverse();
    
    const logs = lines.map(line => {
      const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(.+?)\] (.+)$/);
      if (match) {
        return {
          timestamp: match[1],
          operation: match[2],
          details: JSON.parse(match[3])
        };
      }
      return { raw: line };
    });
    
    res.json({ success: true, data: logs, date: targetDate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取可用的日志日期列表
app.get('/api/logs/dates', async (req, res) => {
  try {
    const files = await fs.readdir(LOG_DIR);
    const dates = files
      .filter(file => file.startsWith('operation-') && file.endsWith('.log'))
      .map(file => {
        const match = file.match(/operation-(\d{4}-\d{2}-\d{2})\.log/);
        return match ? match[1] : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
    
    res.json({ success: true, data: dates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取日志配置
app.get('/api/logs/config', (req, res) => {
  res.json({
    success: true,
    data: {
      retentionDays: appConfig.logRetentionDays,
      logDir: LOG_DIR
    }
  });
});

// 获取应用配置
app.get('/api/config', (req, res) => {
  res.json({ success: true, data: appConfig });
});

// 允许的日志保留天数选项
const LOG_RETENTION_OPTIONS = [3, 5, 7, 15, 30];

// 检查是否有需要清理的日志文件
app.get('/api/logs/check-cleanup', async (req, res) => {
  const { days } = req.query;
  const targetDays = parseInt(days) || appConfig.logRetentionDays || 7;
  
  try {
    const files = await fs.readdir(LOG_DIR);
    const now = new Date();
    // 保留N天包括今天
    const cutoffDate = new Date(now.getTime() - (targetDays - 1) * 24 * 60 * 60 * 1000);
    
    const expiredLogs = [];
    for (const file of files) {
      if (file.startsWith('operation-') && file.endsWith('.log')) {
        const filePath = path.join(LOG_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          expiredLogs.push({
            name: file,
            date: file.replace('operation-', '').replace('.log', ''),
            mtime: stats.mtime.toISOString().split('T')[0]
          });
        }
      }
    }
    
    res.json({ 
      success: true, 
      data: { 
        hasExpiredLogs: expiredLogs.length > 0,
        count: expiredLogs.length,
        files: expiredLogs
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清理过期日志文件
app.post('/api/logs/cleanup', async (req, res) => {
  const { days } = req.body;
  const targetDays = parseInt(days) || appConfig.logRetentionDays || 7;
  
  try {
    const files = await fs.readdir(LOG_DIR);
    const now = new Date();
    // 保留N天包括今天
    const cutoffDate = new Date(now.getTime() - (targetDays - 1) * 24 * 60 * 60 * 1000);
    
    let deletedCount = 0;
    const deletedFiles = [];
    
    for (const file of files) {
      if (file.startsWith('operation-') && file.endsWith('.log')) {
        const filePath = path.join(LOG_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.remove(filePath);
          deletedCount++;
          deletedFiles.push(file);
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `已清理 ${deletedCount} 个过期日志文件`,
      data: { deletedCount, deletedFiles }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新应用配置
app.post('/api/config', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const newConfig = req.body;
  let configChanged = false;

  if (newConfig.logRetentionDays !== undefined) {
    const days = parseInt(newConfig.logRetentionDays);
    if (!LOG_RETENTION_OPTIONS.includes(days)) {
      return res.status(400).json({ success: false, error: '日志保留天数必须是 3、5、7、15、30 中的一个' });
    }
    appConfig.logRetentionDays = days;
    configChanged = true;
  }

  if (newConfig.filenameCleanupRules !== undefined) {
    if (!Array.isArray(newConfig.filenameCleanupRules)) {
      return res.status(400).json({ success: false, error: '文件名清理规则必须是数组' });
    }
    appConfig.filenameCleanupRules = newConfig.filenameCleanupRules.filter(rule => typeof rule === 'string' && rule.length > 0);
    configChanged = true;
  }

  if (!configChanged) {
    return res.status(400).json({ success: false, error: '没有有效的配置项需要更新' });
  }

  if (saveConfig(appConfig)) {
    writeLog('UPDATE_CONFIG', {
      path: CONFIG_DIR,
      config: appConfig,
      ip: clientIp,
      result: '成功'
    });

    res.json({ success: true, message: '配置更新成功', data: appConfig });
  } else {
    res.status(500).json({ success: false, error: '配置保存失败' });
  }
});

// 获取目录列表（用于路径选择）
app.get('/api/directories', async (req, res) => {
  const { path: dirPath } = req.query;
  const targetPath = dirPath || '/vol1';
  
  try {
    const items = await fs.readdir(targetPath, { withFileTypes: true });
    const directories = items
      .filter(item => item.isDirectory())
      .map(item => ({
        name: item.name,
        path: path.join(targetPath, item.name),
        isDirectory: true
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // 添加返回上级选项
    if (targetPath !== '/') {
      const parentPath = path.dirname(targetPath);
      directories.unshift({
        name: '..',
        path: parentPath,
        isDirectory: true,
        isParent: true
      });
    }
    
    res.json({ 
      success: true, 
      data: directories,
      currentPath: targetPath
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取日志保留天数选项
app.get('/api/log-retention-options', (req, res) => {
  const options = [
    { label: '3天', value: 3 },
    { label: '5天', value: 5 },
    { label: '7天', value: 7 },
    { label: '15天', value: 15 },
    { label: '30天', value: 30 }
  ];
  res.json({ success: true, data: options });
});

// 获取监控文件夹列表
app.get('/api/watch-folders', (req, res) => {
  res.json({ success: true, data: appConfig.watchFolders || [] });
});

// 添加监控文件夹
app.post('/api/watch-folders', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { path: folderPath, recursive = false, enabled = true, isDownloadFolder = false } = req.body;
  
  if (!folderPath) {
    return res.status(400).json({ success: false, error: '文件夹路径不能为空' });
  }
  
  // 检查路径是否已存在
  const exists = appConfig.watchFolders.some(f => f.path === folderPath);
  if (exists) {
    return res.status(400).json({ success: false, error: '该文件夹已在监控列表中' });
  }
  
  const newFolder = {
    id: Date.now().toString(),
    path: folderPath,
    recursive,
    enabled,
    isDownloadFolder
  };
  
  appConfig.watchFolders.push(newFolder);
  
  if (saveConfig(appConfig)) {
    // 如果启用，立即开始监控
    if (enabled) {
      startWatchingFolder(newFolder);
    }
    
    writeLog('ADD_WATCH_FOLDER', {
      path: folderPath,
      recursive: recursive,
      ip: clientIp,
      result: '成功'
    });
    
    res.json({ success: true, message: '添加成功', data: newFolder });
  } else {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 删除监控文件夹
app.delete('/api/watch-folders/:id', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { id } = req.params;
  
  const folder = appConfig.watchFolders.find(f => f.id === id);
  if (!folder) {
    return res.status(404).json({ success: false, error: '监控文件夹不存在' });
  }
  
  // 停止监控
  stopWatchingFolder(id);
  
  // 从配置中移除
  appConfig.watchFolders = appConfig.watchFolders.filter(f => f.id !== id);
  
  if (saveConfig(appConfig)) {
    writeLog('REMOVE_WATCH_FOLDER', {
      path: folder.path,
      ip: clientIp,
      result: '成功'
    });
    
    res.json({ success: true, message: '删除成功' });
  } else {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 切换监控文件夹状态
app.patch('/api/watch-folders/:id/toggle', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { id } = req.params;
  
  const folder = appConfig.watchFolders.find(f => f.id === id);
  if (!folder) {
    return res.status(404).json({ success: false, error: '监控文件夹不存在' });
  }
  
  folder.enabled = !folder.enabled;
  
  if (folder.enabled) {
    startWatchingFolder(folder);
  } else {
    stopWatchingFolder(id);
  }
  
  if (saveConfig(appConfig)) {
    writeLog('TOGGLE_WATCH_FOLDER', {
      path: folder.path,
      enabled: folder.enabled,
      ip: clientIp,
      result: '成功'
    });
    
    res.json({ success: true, message: '状态更新成功', data: folder });
  } else {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 更新监控文件夹配置
app.patch('/api/watch-folders/:id', (req, res) => {
  const { id } = req.params;
  const { recursive, isDownloadFolder } = req.body;
  
  const folder = appConfig.watchFolders.find(f => f.id === id);
  if (!folder) {
    return res.status(404).json({ success: false, error: '监控文件夹不存在' });
  }
  
  if (recursive !== undefined) {
    folder.recursive = recursive;
    
    // 如果正在监控，需要重启
    if (folder.enabled) {
      stopWatchingFolder(id);
      startWatchingFolder(folder);
    }
  }
  
  if (isDownloadFolder !== undefined) {
    folder.isDownloadFolder = isDownloadFolder;
    
    // 清除缓存
    downloadFolderCache.delete(id);
    
    // 如果正在监控，需要重启
    if (folder.enabled) {
      stopWatchingFolder(id);
      startWatchingFolder(folder);
    }
    
    writeLog('UPDATE_DOWNLOAD_FOLDER_STATUS', {
      path: folder.path,
      isDownloadFolder: isDownloadFolder,
      ip: 'system',
      result: '成功'
    });
  }
  
  if (saveConfig(appConfig)) {
    res.json({ success: true, message: '更新成功', data: folder });
  } else {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 验证下载目录
app.post('/api/watch-folders/:id/validate-download', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { id } = req.params;
  
  const folder = appConfig.watchFolders.find(f => f.id === id);
  if (!folder) {
    return res.status(404).json({ success: false, error: '监控文件夹不存在' });
  }
  
  try {
    const result = await checkIsDownloadFolder(folder.path);
    
    // 更新缓存
    downloadFolderCache.set(id, {
      ...result,
      checkedAt: new Date().toISOString()
    });
    
    writeLog('VALIDATE_DOWNLOAD_FOLDER', {
      path: folder.path,
      isDownloadFolder: result.isDownloadFolder,
      hasPartFiles: result.hasPartFiles,
      ip: clientIp,
      result: '成功'
    });
    
    res.json({ 
      success: true, 
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 检查下载目录是否准备好（用于前端轮询）
app.get('/api/watch-folders/:id/download-status', async (req, res) => {
  const { id } = req.params;
  
  const folder = appConfig.watchFolders.find(f => f.id === id);
  if (!folder) {
    return res.status(404).json({ success: false, error: '监控文件夹不存在' });
  }
  
  // 如果不是下载目录，直接返回就绪
  if (!folder.isDownloadFolder) {
    return res.json({ 
      success: true, 
      data: { 
        ready: true, 
        isDownloadFolder: false,
        reason: '不是下载目录'
      }
    });
  }
  
  try {
    const result = await checkDownloadFolderReady(folder.path);
    
    // 更新缓存
    downloadFolderCache.set(id, {
      ...result,
      checkedAt: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      data: {
        ...result,
        isDownloadFolder: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 验证任意路径是否为下载目录（不需要id，用于添加前验证）
app.post('/api/watch-folders/validate-path', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { path: folderPath } = req.body;
  
  if (!folderPath) {
    return res.status(400).json({ success: false, error: '文件夹路径不能为空' });
  }
  
  try {
    const result = await checkIsDownloadFolder(folderPath);
    
    writeLog('VALIDATE_DOWNLOAD_FOLDER', {
      path: folderPath,
      isDownloadFolder: result.isDownloadFolder,
      hasPartFiles: result.hasPartFiles,
      ip: clientIp,
      result: '成功'
    });
    
    res.json({ 
      success: true, 
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取文件名清理规则
app.get('/api/filename-cleanup-rules', (req, res) => {
  res.json({ success: true, data: appConfig.filenameCleanupRules || [] });
});

// 处理单个文件（复用实时监控事件的逻辑）
async function processItem(itemPath, itemType, folder, folderPath, recursive, isDownloadFolder, triggerWay = '实时监控') {
  if (isDownloadFolder) {
    const subFolderName = getDirectSubFolder(folderPath, itemPath);
    if (subFolderName) {
      const subFolderCheck = await checkSubFolderHasPartFiles(folderPath, subFolderName);
      if (subFolderCheck.hasPartFiles) {
        //console.log(`[下载目录] 跳过${itemType === 'folder' ? '文件夹' : '文件'}处理，子文件夹存在未完成下载: ${itemPath}`);
        return { processed: false, reason: '下载目录未准备好' };
      }
    }
  }

  if (itemType === 'folder') {
    const removalResult = checkFileRemoval(itemPath, folder);
    if (removalResult) {
      // 检查文件夹是否存在
      const exists = await fs.pathExists(itemPath);
      if (!exists) {
        console.log(`[文件夹移除] 文件夹不存在，跳过处理：${itemPath}`);
        return { processed: false, reason: '文件夹不存在' };
      }
      
      let success = false;
      let trashPath = null;
      const action = removalResult.action || 'trash';
      
      if (action === 'trash') {
        const result = await moveFolderToTrash(itemPath, folderPath);
        success = result.success;
        trashPath = result.trashPath;
      } else {
        success = await removeFolder(itemPath);
      }
      
      writeLog('FILE_REMOVED', {
        type: 'folder',
        path: itemPath,
        name: path.basename(itemPath),
        rule: removalResult.rule,
        action: action,
        trashPath: trashPath,
        watchPath: folderPath,
        recursive: recursive,
        ip: 'system',
        result: success ? '成功' : '失败',
        trigger: triggerWay
      });
      if (success) {
        console.log(`[文件夹移除] 已${action === 'trash' ? '移至回收站' : '彻底删除'}: ${itemPath}`);
      }
      return { processed: true, operation: '文件夹移除', success };
    }
  } else {
    const removalResult = checkFileRemoval(itemPath, folder);
    if (removalResult) {
      // 检查文件是否存在
      const exists = await fs.pathExists(itemPath);
      if (!exists) {
        console.log(`[文件移除] 文件不存在，跳过处理：${itemPath}`);
        return { processed: false, reason: '文件不存在' };
      }
      
      let success = false;
      let trashPath = null;
      const action = removalResult.action || 'trash';
      
      if (action === 'trash') {
        const result = await moveFileToTrash(itemPath, folderPath);
        success = result.success;
        trashPath = result.trashPath;
      } else {
        success = await removeFile(itemPath);
      }
      
      writeLog('FILE_REMOVED', {
        type: 'file',
        path: itemPath,
        name: path.basename(itemPath),
        rule: removalResult.rule,
        action: action,
        trashPath: trashPath,
        watchPath: folderPath,
        recursive: recursive,
        ip: 'system',
        result: success ? '成功' : '失败',
        trigger: triggerWay
      });
      if (success) {
        console.log(`[文件移除] 已${action === 'trash' ? '移至回收站' : '彻底删除'}: ${itemPath}`);
      }
      return { processed: true, operation: '文件移除', success };
    }

    const cleanupResult = cleanupFilename(itemPath, folder);
    if (cleanupResult) {
      // 检查文件是否存在
      const exists = await fs.pathExists(cleanupResult.originalPath);
      if (!exists) {
        console.log(`[文件名清理] 文件不存在，跳过处理：${cleanupResult.originalPath}`);
        return { processed: false, reason: '文件不存在' };
      }
      
      const success = await renameFile(cleanupResult.originalPath, cleanupResult.newPath);
      writeLog('FILENAME_CLEANUP', {
        type: 'file',
        path: cleanupResult.originalPath,
        originalPath: cleanupResult.originalPath,
        newPath: cleanupResult.newPath,
        originalName: path.basename(cleanupResult.originalPath),
        newName: cleanupResult.newBasename,
        rule: cleanupResult.matchedRule,
        watchPath: folderPath,
        recursive: recursive,
        ip: 'system',
        result: success ? '成功' : '失败',
        trigger: triggerWay
      });
      if (success) {
        console.log(`[文件名清理] ${cleanupResult.originalPath} -> ${cleanupResult.newPath}`);
      }
      return { processed: true, operation: '文件名清理', success };
    }
  }

  return { processed: false, reason: '无匹配规则' };
}

async function processSubFolderFiles(folderPath, subFolderName, folder, recursive, isDownloadFolder) {
  const subFolderPath = path.join(folderPath, subFolderName);
  let processedCount = 0;
  let successCount = 0;

  try {
    const items = await fs.readdir(subFolderPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(subFolderPath, item.name);
      
      if (item.isFile()) {
        const result = await processItem(itemPath, 'file', folder, folderPath, recursive, isDownloadFolder, '下载完成处理');
        
        if (result.processed) {
          processedCount++;
          if (result.success) successCount++;
        }
      } else if (item.isDirectory()) {
        const result = await processItem(itemPath, 'folder', folder, folderPath, recursive, isDownloadFolder, '下载完成处理');
        
        if (result.processed) {
          processedCount++;
          if (result.success) successCount++;
        }
      }
    }
    
    if (processedCount > 0) {
      console.log(`[下载完成处理] 子文件夹 ${subFolderName} 处理完成: ${successCount}/${processedCount} 成功`);
    }
  } catch (error) {
    console.error(`[下载完成处理] 处理子文件夹失败: ${subFolderPath}`, error.message);
  }

  return { processedCount, successCount };
}

// 执行文件名清理操作（用于添加规则后立即执行）
async function executeFilenameCleanupForRule(rule) {
  let totalProcessed = 0;
  let totalSuccess = 0;

  for (const folder of appConfig.watchFolders || []) {
    if (!folder.enabled) continue;

    try {
      const scanResult = { files: [] };
      const isRecursive = folder.recursive === true;
      scanDirectoryForCleanup(folder.path, rule, folder.path, scanResult, isRecursive);

      for (const file of scanResult.files) {
        const result = await processItem(file.path, 'file', folder, folder.path, isRecursive, folder.isDownloadFolder, '规则添加后自动执行');
        if (result.processed) {
          totalProcessed++;
          if (result.success) totalSuccess++;
        }
      }
    } catch (error) {
      console.error(`[文件名清理执行] 处理文件夹失败: ${folder.path}`, error.message);
    }
  }

  return { totalProcessed, totalSuccess };
}

// 添加文件名清理规则
app.post('/api/filename-cleanup-rules', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { rule } = req.body;

  if (!rule || typeof rule !== 'string' || rule.length === 0) {
    return res.status(400).json({ success: false, error: '规则不能为空' });
  }

  // 检查规则是否已存在
  if (appConfig.filenameCleanupRules && appConfig.filenameCleanupRules.includes(rule)) {
    return res.status(400).json({ success: false, error: '规则已存在' });
  }

  // 验证规则是否对现有监控文件夹有效
  const validationResult = validateRuleAgainstWatchFolders(rule);

  if (!appConfig.filenameCleanupRules) {
    appConfig.filenameCleanupRules = [];
  }
  appConfig.filenameCleanupRules.push(rule);

  if (saveConfig(appConfig)) {
    // 添加规则后立即执行文件名清理操作
    const executionResult = await executeFilenameCleanupForRule(rule);

    writeLog('ADD_FILENAME_CLEANUP_RULE', {
      rule: rule,
      matchingFiles: validationResult.totalMatchingFiles,
      affectedFolders: validationResult.affectedFolders,
      processedFiles: executionResult.totalProcessed,
      successCount: executionResult.totalSuccess,
      ip: clientIp,
      result: '成功'
    });
    res.json({
      success: true,
      message: '规则添加成功',
      data: {
        rule,
        validationResult,
        executionResult
      }
    });
  } else {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 删除文件名清理规则
app.delete('/api/filename-cleanup-rules/:rule', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { rule } = req.params;

  if (!appConfig.filenameCleanupRules || !appConfig.filenameCleanupRules.includes(rule)) {
    return res.status(404).json({ success: false, error: '规则不存在' });
  }

  appConfig.filenameCleanupRules = appConfig.filenameCleanupRules.filter(r => r !== rule);

  if (saveConfig(appConfig)) {
    writeLog('REMOVE_FILENAME_CLEANUP_RULE', {
      rule: rule,
      ip: clientIp,
      result: '成功'
    });
    res.json({ success: true, message: '规则删除成功' });
  } else {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 验证规则是否对监控文件夹有效
app.post('/api/filename-cleanup-rules/validate', (req, res) => {
  const { rule } = req.body;

  if (!rule || typeof rule !== 'string' || rule.length === 0) {
    return res.status(400).json({ success: false, error: '规则不能为空' });
  }

  const validationResult = validateRuleAgainstWatchFolders(rule);
  res.json({ success: true, data: validationResult });
});

// 扫描文件夹并匹配文件名清理规则（支持递归/非递归模式）
function scanDirectoryForCleanup(dirPath, rule, basePath, result, recursive = true) {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      const relativePath = path.relative(basePath, itemPath);
      
      if (item.isFile()) {
        // 检查文件名是否包含规则字符串
        if (item.name.includes(rule)) {
          result.files.push({
            name: item.name,
            path: itemPath,
            relativePath: relativePath
          });
        }
      } else if (item.isDirectory()) {
        // 仅在递归模式下扫描子文件夹
        if (recursive) {
          scanDirectoryForCleanup(itemPath, rule, basePath, result, true);
        }
      }
    }
  } catch (error) {
    console.error(`[文件名清理验证] 扫描文件夹失败: ${dirPath}`, error.message);
  }
}

// 验证规则对监控文件夹的有效性
function validateRuleAgainstWatchFolders(rule) {
  const results = [];
  let totalMatchingFiles = 0;

  console.log(`[文件名清理验证] 开始验证规则: "${rule}"`);
  console.log(`[文件名清理验证] 监控文件夹数量: ${(appConfig.watchFolders || []).length}`);

  for (const folder of appConfig.watchFolders || []) {
    console.log(`[文件名清理验证] 检查文件夹: ${folder.path}, enabled: ${folder.enabled}, recursive: ${folder.recursive}`);
    if (!folder.enabled) {
      console.log(`[文件名清理验证] 跳过禁用文件夹: ${folder.path}`);
      continue;
    }

    try {
      // 根据文件夹的recursive选项决定是否递归扫描
      const scanResult = { files: [], folders: [] };
      const isRecursive = folder.recursive === true;
      scanDirectoryForCleanup(folder.path, rule, folder.path, scanResult, isRecursive);
      
      console.log(`[文件名清理验证] 文件夹 "${folder.path}" 扫描完成 (递归: ${isRecursive})`);
      console.log(`[文件名清理验证] 匹配文件数: ${scanResult.files.length}`);
      
      if (scanResult.files.length > 0) {
        results.push({
          folderPath: folder.path,
          recursive: isRecursive,
          matchingCount: scanResult.files.length,
          matchingFiles: scanResult.files.slice(0, 5).map(f => f.relativePath)
        });
        totalMatchingFiles += scanResult.files.length;
      }
    } catch (error) {
      console.error(`[文件名清理验证] 读取文件夹失败: ${folder.path}`, error.message);
    }
  }

  const result = {
    rule: rule,
    totalMatchingFiles,
    affectedFolders: results.length,
    details: results
  };
  
  console.log(`[文件名清理验证] 验证结果:`, JSON.stringify(result, null, 2));
  return result;
}

// 通配符匹配函数
function matchWildcard(filename, pattern) {
  // 将通配符模式转换为正则表达式
  // * 匹配任意字符（包括空字符）
  // ? 匹配单个字符
  
  // 先转义正则表达式中的特殊字符（除了 * 和 ?）
  let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  
  // 将通配符转换为正则表达式
  // 使用占位符避免重复替换
  regexPattern = regexPattern.replace(/\*/g, '\x00').replace(/\?/g, '\x01');
  regexPattern = regexPattern.replace(/\x00/g, '.*').replace(/\x01/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(filename);
}

// 获取文件移除规则
app.get('/api/file-removal-rules', (req, res) => {
  res.json({ success: true, data: appConfig.fileRemovalRules || [] });
});

// 执行文件移除操作（用于添加规则后立即执行）
async function executeFileRemovalForRule(rule) {
  let totalProcessedFiles = 0;
  let totalSuccessFiles = 0;
  let totalProcessedFolders = 0;
  let totalSuccessFolders = 0;

  for (const folder of appConfig.watchFolders || []) {
    if (!folder.enabled) continue;

    try {
      const scanResult = { files: [], folders: [] };
      const isRecursive = folder.recursive === true;
      scanDirectory(folder.path, rule, folder.path, scanResult, isRecursive);

      for (const file of scanResult.files) {
        const result = await processItem(file.path, 'file', folder, folder.path, isRecursive, folder.isDownloadFolder, '规则添加后自动执行');
        if (result.processed) {
          totalProcessedFiles++;
          if (result.success) totalSuccessFiles++;
        }
      }

      for (const subFolder of scanResult.folders) {
        const result = await processItem(subFolder.path, 'folder', folder, folder.path, isRecursive, folder.isDownloadFolder, '规则添加后自动执行');
        if (result.processed) {
          totalProcessedFolders++;
          if (result.success) totalSuccessFolders++;
        }
      }
    } catch (error) {
      console.error(`[文件移除执行] 处理文件夹失败: ${folder.path}`, error.message);
    }
  }

  return {
    totalProcessedFiles,
    totalSuccessFiles,
    totalProcessedFolders,
    totalSuccessFolders
  };
}

// 添加文件移除规则
app.post('/api/file-removal-rules', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const rule = typeof req.body?.rule === 'string' ? req.body.rule.trim() : '';
  const actionValue = typeof req.body?.action === 'string' ? req.body.action.trim() : '';
  const action = actionValue || 'trash';

  if (!rule) {
    return res.status(400).json({ success: false, error: '规则不能为空' });
  }

  // 验证action参数
  if (action !== 'trash' && action !== 'delete') {
    return res.status(400).json({ success: false, error: '处理方式必须是 trash 或 delete' });
  }

  // 检查规则是否已存在（兼容新旧格式）
  const ruleExists = appConfig.fileRemovalRules && appConfig.fileRemovalRules.some(r => {
    if (typeof r === 'string') return r === rule;
    return r.rule === rule;
  });
  if (ruleExists) {
    return res.status(400).json({ success: false, error: '规则已存在' });
  }

  // 验证规则是否对现有监控文件夹有效
  const validationResult = validateRemovalRule(rule);

  if (!appConfig.fileRemovalRules) {
    appConfig.fileRemovalRules = [];
  }
  // 存储为对象格式
  appConfig.fileRemovalRules.push({ rule, action });

  if (saveConfig(appConfig)) {
    // 添加规则后立即执行文件移除操作
    const executionResult = await executeFileRemovalForRule(rule);

    writeLog('ADD_FILE_REMOVAL_RULE', {
      rule: rule,
      action: action,
      matchingFiles: validationResult.totalMatchingFiles,
      matchingFolders: validationResult.totalMatchingFolders,
      affectedFolders: validationResult.affectedFolders,
      processedFiles: executionResult.totalProcessedFiles,
      successFiles: executionResult.totalSuccessFiles,
      processedFolders: executionResult.totalProcessedFolders,
      successFolders: executionResult.totalSuccessFolders,
      ip: clientIp,
      result: '成功'
    });
    res.json({
      success: true,
      message: '规则添加成功',
      data: {
        rule,
        action,
        validationResult,
        executionResult
      }
    });
  } else {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 删除文件移除规则
app.delete('/api/file-removal-rules/:rule', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { rule } = req.params;

  // 兼容新旧格式查找规则
  const ruleIndex = appConfig.fileRemovalRules && appConfig.fileRemovalRules.findIndex(r => {
    if (typeof r === 'string') return r === rule;
    return r.rule === rule;
  });
  
  if (ruleIndex === -1 || ruleIndex === undefined) {
    return res.status(404).json({ success: false, error: '规则不存在' });
  }

  appConfig.fileRemovalRules.splice(ruleIndex, 1);

  if (saveConfig(appConfig)) {
    writeLog('REMOVE_FILE_REMOVAL_RULE', {
      rule: rule,
      ip: clientIp,
      result: '成功'
    });
    res.json({ success: true, message: '规则删除成功' });
  } else {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 验证文件移除规则
app.post('/api/file-removal-rules/validate', (req, res) => {
  const { rule } = req.body;

  if (!rule || typeof rule !== 'string' || rule.length === 0) {
    return res.status(400).json({ success: false, error: '规则不能为空' });
  }

  const validationResult = validateRemovalRule(rule);
  res.json({ success: true, data: validationResult });
});

// 扫描文件夹并匹配规则（支持递归/非递归模式）
function scanDirectory(dirPath, rule, basePath, result, recursive = true) {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      const relativePath = path.relative(basePath, itemPath);
      
      if (item.isFile()) {
        // 检查文件是否匹配
        if (matchWildcard(item.name, rule)) {
          result.files.push({
            name: item.name,
            path: itemPath,
            relativePath: relativePath
          });
        }
      } else if (item.isDirectory()) {
        // 检查文件夹是否匹配
        if (matchWildcard(item.name, rule)) {
          result.folders.push({
            name: item.name,
            path: itemPath,
            relativePath: relativePath
          });
        }
        
        // 仅在递归模式下扫描子文件夹
        if (recursive) {
          scanDirectory(itemPath, rule, basePath, result, true);
        }
      }
    }
  } catch (error) {
    console.error(`[移除规则验证] 扫描文件夹失败: ${dirPath}`, error.message);
  }
}

// 验证文件移除规则对监控文件夹的有效性
function validateRemovalRule(rule) {
  const results = [];
  let totalMatchingFiles = 0;
  let totalMatchingFolders = 0;

  console.log(`[移除规则验证] 开始验证规则: "${rule}"`);
  console.log(`[移除规则验证] 监控文件夹数量: ${(appConfig.watchFolders || []).length}`);

  for (const folder of appConfig.watchFolders || []) {
    console.log(`[移除规则验证] 检查文件夹: ${folder.path}, enabled: ${folder.enabled}, recursive: ${folder.recursive}`);
    if (!folder.enabled) {
      console.log(`[移除规则验证] 跳过禁用文件夹: ${folder.path}`);
      continue;
    }

    try {
      // 根据文件夹的recursive选项决定是否递归扫描
      const scanResult = { files: [], folders: [] };
      const isRecursive = folder.recursive === true;
      scanDirectory(folder.path, rule, folder.path, scanResult, isRecursive);
      
      console.log(`[移除规则验证] 文件夹 "${folder.path}" 扫描完成 (递归: ${isRecursive})`);
      console.log(`[移除规则验证] 匹配文件数: ${scanResult.files.length}`);
      console.log(`[移除规则验证] 匹配文件夹数: ${scanResult.folders.length}`);
      
      if (scanResult.files.length > 0 || scanResult.folders.length > 0) {
        results.push({
          folderPath: folder.path,
          recursive: isRecursive,
          matchingCount: scanResult.files.length + scanResult.folders.length,
          matchingFiles: scanResult.files.slice(0, 5).map(f => f.relativePath),
          matchingFolders: scanResult.folders.slice(0, 5).map(f => f.relativePath),
          matchingItems: [
            ...scanResult.files.slice(0, 5).map(f => ({ name: f.relativePath, type: 'file' })),
            ...scanResult.folders.slice(0, 5).map(f => ({ name: f.relativePath, type: 'folder' }))
          ]
        });
        totalMatchingFiles += scanResult.files.length;
        totalMatchingFolders += scanResult.folders.length;
      }
    } catch (error) {
      console.error(`[移除规则验证] 读取文件夹失败: ${folder.path}`, error.message);
    }
  }

  const result = {
    rule: rule,
    totalMatchingFiles,
    totalMatchingFolders,
    totalMatches: totalMatchingFiles + totalMatchingFolders,
    affectedFolders: results.length,
    details: results
  };
  
  console.log(`[移除规则验证] 验证结果:`, JSON.stringify(result, null, 2));
  return result;
}

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// 启动时清理过期日志并启动监控
cleanupOldLogs();
ensureTrashDir();
startWatching();

// 设置每天0点自动清理日志
function scheduleDailyLogCleanup() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow - now;
  
  // 设置定时器在下一个0点执行
  setTimeout(() => {
    cleanupOldLogs();
    // 之后每24小时执行一次
    setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
  
  console.log(`[日志清理] 已设置每天0点自动清理，下次执行时间: ${tomorrow.toLocaleString()}`);
}

scheduleDailyLogCleanup();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  writeLog('SERVER_START', { 
    port: PORT, 
    logDir: LOG_DIR, 
    configDir: CONFIG_DIR,
    logRetentionDays: appConfig.logRetentionDays,
    watchFoldersCount: appConfig.watchFolders.length,
    ip: 'system',
    result: '成功'
  });
});

// 进程退出时停止所有监控
process.on('SIGINT', () => {
  stopAllWatching();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAllWatching();
  process.exit(0);
});
