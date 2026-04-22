import React, { useState, useEffect } from 'react'
import {
  Layout,
  Button,
  Space,
  Modal,
  Message,
  Card,
  Typography,
  Spin,
  Tabs,
  Table,
  Tag,
  Select,
  Form,
  Input,
  InputNumber,
  Switch,
  Empty,
  List,
  Tooltip,
  Popconfirm
} from '@arco-design/web-react'
import {
  IconRefresh,
  IconHome,
  IconHistory,
  IconSettings,
  IconFolderAdd,
  IconDelete,
  IconEye,
  IconFolder,
  IconArrowLeft,
  IconArrowRight,
  IconFile,
  IconPlus,
  IconCheckCircle,
  IconCloseCircle,
  IconLoading,
  IconMoon,
  IconSun,
  IconInfoCircle
} from '@arco-design/web-react/icon'
import axios from 'axios'
import dayjs from 'dayjs'
import './App.css'

const { Header, Content } = Layout
const { Title, Text } = Typography
const TabPane = Tabs.TabPane
const Option = Select.Option
const FormItem = Form.Item

const api = axios.create({
  baseURL: '/api'
})

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('activeTab')
    return saved || 'watch'
  })
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logDates, setLogDates] = useState([])
  const [selectedLogDate, setSelectedLogDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [logConfig, setLogConfig] = useState({ retentionDays: 7, logDir: '' })

  const [appConfig, setAppConfig] = useState({ logRetentionDays: 7, watchFolders: [] })
  const [watchFolders, setWatchFolders] = useState([])
  const [addFolderModalVisible, setAddFolderModalVisible] = useState(false)
  const [addFolderForm] = Form.useForm()
  const [pathSelectorVisible, setPathSelectorVisible] = useState(false)
  const [currentPath, setCurrentPath] = useState('/vol1')
  const [directories, setDirectories] = useState([])
  const [directoriesLoading, setDirectoriesLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState('')
  const [logRetentionOptions, setLogRetentionOptions] = useState([])
  const [filenameCleanupRules, setFilenameCleanupRules] = useState([])
  const [addRuleModalVisible, setAddRuleModalVisible] = useState(false)
  const [addRuleForm] = Form.useForm()
  const [ruleValidationResult, setRuleValidationResult] = useState(null)
  const [validatingRule, setValidatingRule] = useState(false)
  const [fileRemovalRules, setFileRemovalRules] = useState([])
  const [addRemovalRuleModalVisible, setAddRemovalRuleModalVisible] = useState(false)
  const [addRemovalRuleForm] = Form.useForm()
  const [removalRuleValidationResult, setRemovalRuleValidationResult] = useState(null)
  const [validatingRemovalRule, setValidatingRemovalRule] = useState(false)
  const [downloadFolderValidating, setDownloadFolderValidating] = useState(false)
  const [logDetailVisible, setLogDetailVisible] = useState(false)
  const [currentLogDetail, setCurrentLogDetail] = useState(null)

  const fetchLogs = async (date = selectedLogDate) => {
    setLogsLoading(true)
    try {
      const response = await api.get('/logs', { params: { date } })
      if (response.data.success) {
        setLogs(response.data.data)
      } else {
        Message.error(response.data.error || '获取日志失败')
      }
    } catch (error) {
      Message.error('获取日志失败: ' + error.message)
    } finally {
      setLogsLoading(false)
    }
  }

  const fetchLogDates = async () => {
    try {
      const response = await api.get('/logs/dates')
      if (response.data.success) {
        setLogDates(response.data.data)
      }
    } catch (error) {
      console.error('获取日志日期失败:', error)
    }
  }

  const fetchLogConfig = async () => {
    try {
      const response = await api.get('/logs/config')
      if (response.data.success) {
        setLogConfig(response.data.data)
      }
    } catch (error) {
      console.error('获取日志配置失败:', error)
    }
  }

  const fetchAppConfig = async () => {
    try {
      const response = await api.get('/config')
      if (response.data.success) {
        setAppConfig(response.data.data)
      }
    } catch (error) {
      console.error('获取应用配置失败:', error)
    }
  }

  const fetchWatchFolders = async () => {
    try {
      const response = await api.get('/watch-folders')
      if (response.data.success) {
        setWatchFolders(response.data.data)
      }
    } catch (error) {
      console.error('获取监控文件夹失败:', error)
    }
  }

  const fetchLogRetentionOptions = async () => {
    try {
      const response = await api.get('/log-retention-options')
      if (response.data.success) {
        setLogRetentionOptions(response.data.data)
      }
    } catch (error) {
      console.error('获取日志保留天数选项失败:', error)
    }
  }

  const fetchFilenameCleanupRules = async () => {
    try {
      const response = await api.get('/filename-cleanup-rules')
      if (response.data.success) {
        setFilenameCleanupRules(response.data.data)
      }
    } catch (error) {
      console.error('获取文件名清理规则失败:', error)
    }
  }

  const addFilenameCleanupRule = async (values) => {
    try {
      const response = await api.post('/filename-cleanup-rules', { rule: values.rule })
      if (response.data.success) {
        Message.success('规则添加成功')
        setAddRuleModalVisible(false)
        addRuleForm.resetFields()
        setRuleValidationResult(null)
        fetchFilenameCleanupRules()
      } else {
        Message.error(response.data.error || '添加失败')
      }
    } catch (error) {
      Message.error('添加失败: ' + error.message)
    }
  }

  const removeFilenameCleanupRule = async (rule) => {
    try {
      const response = await api.delete(`/filename-cleanup-rules/${encodeURIComponent(rule)}`)
      if (response.data.success) {
        Message.success('规则删除成功')
        fetchFilenameCleanupRules()
      } else {
        Message.error(response.data.error || '删除失败')
      }
    } catch (error) {
      Message.error('删除失败: ' + error.message)
    }
  }

  const validateRule = async (rule) => {
    if (!rule || rule.trim().length === 0) {
      Message.warning('请输入规则')
      return
    }
    setValidatingRule(true)
    try {
      const response = await api.post('/filename-cleanup-rules/validate', { rule: rule.trim() })
      if (response.data.success) {
        const result = response.data.data
        if (result.totalMatchingFiles === 0) {
          // 验证失败：没有匹配的文件
          Message.info('当前规则在监控文件夹中未匹配到任何文件')
        } else {
          // 验证成功：有匹配的文件，显示弹窗
          Message.success(`验证成功，将影响 ${result.totalMatchingFiles} 个文件`)
          setRuleValidationResult(result)
        }
      }
    } catch (error) {
      Message.error('验证失败: ' + error.message)
    } finally {
      setValidatingRule(false)
    }
  }

  const fetchFileRemovalRules = async () => {
    try {
      const response = await api.get('/file-removal-rules')
      if (response.data.success) {
        setFileRemovalRules(response.data.data)
      }
    } catch (error) {
      console.error('获取文件移除规则失败:', error)
    }
  }

  const addFileRemovalRule = async (values) => {
    try {
      const response = await api.post('/file-removal-rules', {
        rule: values.rule?.trim(),
        action: values.action || 'trash'
      })
      if (response.data.success) {
        Message.success('规则添加成功')
        setAddRemovalRuleModalVisible(false)
        addRemovalRuleForm.resetFields()
        setRemovalRuleValidationResult(null)
        fetchFileRemovalRules()
      } else {
        Message.error(response.data.error || '添加失败')
      }
    } catch (error) {
      Message.error('添加失败: ' + (error.response?.data?.error || error.message))
    }
  }

  const removeFileRemovalRule = async (rule) => {
    try {
      const response = await api.delete(`/file-removal-rules/${encodeURIComponent(rule)}`)
      if (response.data.success) {
        Message.success('规则删除成功')
        fetchFileRemovalRules()
      } else {
        Message.error(response.data.error || '删除失败')
      }
    } catch (error) {
      Message.error('删除失败: ' + error.message)
    }
  }

  const validateRemovalRule = async (rule) => {
    if (!rule || rule.trim().length === 0) {
      Message.warning('请输入规则')
      return
    }
    setValidatingRemovalRule(true)
    try {
      const response = await api.post('/file-removal-rules/validate', { rule: rule.trim() })
      if (response.data.success) {
        const result = response.data.data
        if (result.totalMatches === 0) {
          Message.info('当前规则在监控文件夹中未匹配到任何文件或文件夹')
        } else {
          Message.success(`验证成功，将影响 ${result.totalMatches} 个项目（${result.totalMatchingFiles} 个文件，${result.totalMatchingFolders} 个文件夹）`)
          setRemovalRuleValidationResult(result)
        }
      }
    } catch (error) {
      Message.error('验证失败: ' + error.message)
    } finally {
      setValidatingRemovalRule(false)
    }
  }

  const fetchDirectories = async (path = currentPath) => {
    setDirectoriesLoading(true)
    try {
      const response = await api.get('/directories', { params: { path } })
      if (response.data.success) {
        setDirectories(response.data.data)
        setCurrentPath(response.data.currentPath)
      }
    } catch (error) {
      Message.error('获取目录列表失败: ' + error.message)
    } finally {
      setDirectoriesLoading(false)
    }
  }

  const updateAppConfig = async (values) => {
    // 如果是更新日志保留天数，先检查是否有需要清理的日志
    if (values.logRetentionDays !== undefined) {
      try {
        const checkResponse = await api.get('/logs/check-cleanup', { 
          params: { days: values.logRetentionDays } 
        })
        
        if (checkResponse.data.success && checkResponse.data.data.hasExpiredLogs) {
          // 存在过期日志，提示用户是否清理
          const expiredCount = checkResponse.data.data.count
          
          return new Promise((resolve) => {
            Modal.confirm({
              title: '发现过期日志',
              content: `检测到 ${expiredCount} 个超过 ${values.logRetentionDays} 天的日志文件，是否立即清理？`,
              okText: '立即清理',
              cancelText: '暂不清理',
              onOk: async () => {
                try {
                  // 先更新配置
                  const configResponse = await api.post('/config', values)
                  if (configResponse.data.success) {
                    setAppConfig(configResponse.data.data)
                    fetchLogConfig()
                    Message.success('配置更新成功')
                  } else {
                    Message.error(configResponse.data.error || '配置更新失败')
                    resolve()
                    return
                  }
                  
                  // 再清理日志
                  const cleanupResponse = await api.post('/logs/cleanup', { 
                    days: values.logRetentionDays 
                  })
                  if (cleanupResponse.data.success) {
                    Message.success(cleanupResponse.data.message)
                    fetchLogs()
                  }
                } catch (error) {
                  Message.error('操作失败: ' + error.message)
                }
                resolve()
              },
              onCancel: async () => {
                try {
                  const configResponse = await api.post('/config', values)
                  if (configResponse.data.success) {
                    setAppConfig(configResponse.data.data)
                    fetchLogConfig()
                    Message.success('配置更新成功')
                  } else {
                    Message.error(configResponse.data.error || '配置更新失败')
                  }
                } catch (error) {
                  Message.error('配置更新失败: ' + error.message)
                }
                resolve()
              }
            })
          })
        }
      } catch (error) {
        console.error('检查日志失败:', error)
      }
    }
    
    // 普通更新流程
    try {
      const response = await api.post('/config', values)
      if (response.data.success) {
        Message.success('配置更新成功')
        setAppConfig(response.data.data)
        fetchLogConfig()
      } else {
        Message.error(response.data.error || '配置更新失败')
      }
    } catch (error) {
      Message.error('配置更新失败: ' + error.message)
    }
  }

  const addWatchFolder = async (values) => {
    try {
      const response = await api.post('/watch-folders', values)
      if (response.data.success) {
        Message.success('添加监控文件夹成功')
        setAddFolderModalVisible(false)
        addFolderForm.resetFields()
        fetchWatchFolders()
        fetchAppConfig()
      } else {
        Message.error(response.data.error || '添加失败')
      }
    } catch (error) {
      Message.error('添加失败: ' + error.message)
    }
  }

  const removeWatchFolder = async (id) => {
    try {
      const response = await api.delete(`/watch-folders/${id}`)
      if (response.data.success) {
        Message.success('删除成功')
        fetchWatchFolders()
        fetchAppConfig()
      } else {
        Message.error(response.data.error || '删除失败')
      }
    } catch (error) {
      Message.error('删除失败: ' + error.message)
    }
  }

  const toggleWatchFolder = async (id) => {
    try {
      const response = await api.patch(`/watch-folders/${id}/toggle`)
      if (response.data.success) {
        Message.success('状态更新成功')
        fetchWatchFolders()
        fetchAppConfig()
      } else {
        Message.error(response.data.error || '状态更新失败')
      }
    } catch (error) {
      Message.error('状态更新失败: ' + error.message)
    }
  }

  const toggleRecursiveFolder = async (id, recursive) => {
    try {
      const response = await api.patch(`/watch-folders/${id}`, { recursive })
      if (response.data.success) {
        Message.success(recursive ? '已开启递归监控' : '已关闭递归监控')
        fetchWatchFolders()
        fetchAppConfig()
      } else {
        Message.error(response.data.error || '更新失败')
      }
    } catch (error) {
      Message.error('更新失败: ' + error.message)
    }
  }

  const toggleDownloadFolder = async (id, isDownloadFolder) => {
    try {
      const response = await api.patch(`/watch-folders/${id}`, { isDownloadFolder })
      if (response.data.success) {
        Message.success(isDownloadFolder ? '已设为下载目录' : '已取消下载目录')
        fetchWatchFolders()
        fetchAppConfig()
      } else {
        Message.error(response.data.error || '更新失败')
      }
    } catch (error) {
      Message.error('更新失败: ' + error.message)
    }
  }

  const validateDownloadFolder = async (folderPath) => {
    setDownloadFolderValidating(true)
    try {
      // 使用临时API验证路径，不需要id
      const response = await api.post('/watch-folders/validate-path', { path: folderPath })
      if (response.data.success) {
        const result = response.data.data

        if (result.isDownloadFolder) {
          Message.success('是下载目录')
        } else {
          Message.info('不是下载目录')
        }
      } else {
        Message.error(response.data.error || '验证失败')
      }
    } catch (error) {
      Message.error('验证失败: ' + error.message)
    } finally {
      setDownloadFolderValidating(false)
    }
  }

  const checkDownloadStatus = async (id) => {
    try {
      const response = await api.get(`/watch-folders/${id}/download-status`)
      if (response.data.success) {
        setDownloadFolderStatus(prev => ({ ...prev, [id]: response.data.data }))
      }
    } catch (error) {
      console.error('检查下载状态失败:', error)
    }
  }

  const openPathSelector = () => {
    setPathSelectorVisible(true)
    setCurrentPath('/vol1')
    setSelectedPath('')
    fetchDirectories('/vol1')
  }

  const selectPath = (path) => {
    setSelectedPath(path)
  }

  const confirmPathSelection = () => {
    const pathToSelect = selectedPath || currentPath
    addFolderForm.setFieldValue('path', pathToSelect)
    setPathSelectorVisible(false)
  }

  const navigateToDirectory = (dirPath) => {
    fetchDirectories(dirPath)
    setSelectedPath('')
  }

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
    if (activeTab === 'logs') {
      fetchLogs()
      fetchLogDates()
      fetchLogConfig()
      fetchLogRetentionOptions()
      fetchAppConfig()  // 确保加载应用配置以获取最新的 logRetentionDays
    } else if (activeTab === 'watch') {
      fetchWatchFolders()
      fetchAppConfig()
    } else if (activeTab === 'cleanup') {
      fetchFilenameCleanupRules()
    } else if (activeTab === 'removal') {
      fetchFileRemovalRules()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs(selectedLogDate)
    }
  }, [selectedLogDate])

  useEffect(() => {
    if (isDarkMode) {
      document.body.setAttribute('arco-theme', 'dark')
    } else {
      document.body.removeAttribute('arco-theme')
    }
  }, [isDarkMode])

  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved) {
      const dark = JSON.parse(saved)
      setIsDarkMode(dark)
      if (dark) {
        document.body.setAttribute('arco-theme', 'dark')
      }
    }
  }, [])

  const logColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 90,
      align: 'center',
      ellipsis: true,
      render: (timestamp) => timestamp ? timestamp.split(' ')[1] || timestamp : '-'
    },
    {
      title: '操作类型',
      dataIndex: 'operation',
      width: 180,
      align: 'center',
      ellipsis: true,
      render: (operation) => (
        <Tag color={{
          '服务启动': 'blue',
          '服务停止': 'red',
          '监控错误': 'red',
          '查看日志': 'lime',
          '查看配置': 'pink',
          '更新配置': 'purple',
          '添加监控文件夹': 'blue',
          '移除监控文件夹': 'red',
          '切换监控状态': 'orange',
          '添加文件名清理规则': 'cyan',
          '删除文件名清理规则': 'magenta',
          '添加文件移除规则': 'red',
          '删除文件移除规则': 'orangered',
          '文件名清理': 'green',
          '文件移除': 'crimson',
          '验证下载目录': 'arcoblue',
          '更新下载目录状态': 'gold'
        }[operation] || 'default'}>
          {operation}
        </Tag>
      )
    },
    {
      title: '结果',
      dataIndex: 'details',
      width: 80,
      align: 'center',
      ellipsis: true,
      render: (details) => {
        const result = details?.result
        if (!result) return '-'
        return (
          <Tag color={result === '成功' ? 'green' : 'red'} size="small">
            {result}
          </Tag>
        )
      }
    },
    {
      title: '路径',
      dataIndex: 'details',
      ellipsis: true,
      render: (details) => details?.path || details?.originalPath || details?.newPath || details?.watchPath || '-'
    },
    {
      title: '类型',
      dataIndex: 'details',
      width: 80,
      align: 'center',
      ellipsis: true,
      render: (details) => {
        const type = details?.type
        if (!type) return '-'
        return type === 'file' ? '文件' : '文件夹'
      }
    },
    {
      title: '规则',
      dataIndex: 'details',
      width: 120,
      ellipsis: true,
      render: (details) => details?.rule || '-'
    },
    {
      title: '处理方式',
      dataIndex: 'details',
      width: 90,
      align: 'center',
      ellipsis: true,
      render: (details) => {
        const action = details?.action
        if (!action) return '-'
        return (
          <Tag color={action === 'delete' ? 'red' : 'green'} size="small">
            {action === 'delete' ? '彻底删除' : '回收站'}
          </Tag>
        )
      }
    },
    {
      title: '触发',
      dataIndex: 'details',
      width: 140,
      ellipsis: true,
      render: (details) => {
        const trigger = details?.trigger
        if (!trigger) return '-'
        return trigger === '下载完处理' ? '下载完成处理' : trigger
      }
    },
    {
      title: '操作',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<IconEye />}
          onClick={() => {
            setCurrentLogDetail(record)
            setLogDetailVisible(true)
          }}
        >
          详情
        </Button>
      )
    }
  ]

  const watchFolderColumns = [
    {
      title: '文件夹路径',
      dataIndex: 'path',
      render: (path, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Text>{path}</Text>
          {record.isDownloadFolder && (
            <Tag color="orange" size="small" style={{ marginLeft: 8 }}>
              下载目录
            </Tag>
          )}
        </div>
      )
    },
    {
      title: '递归监控',
      dataIndex: 'recursive',
      width: 100,
      align: 'center',
      render: (recursive, record) => (
        <Switch
          checked={recursive}
          onChange={(checked) => toggleRecursiveFolder(record.id, checked)}
        />
      )
    },
    {
      title: '下载目录',
      dataIndex: 'isDownloadFolder',
      width: 100,
      align: 'center',
      render: (isDownloadFolder, record) => (
        <Switch
          checked={isDownloadFolder}
          onChange={(checked) => toggleDownloadFolder(record.id, checked)}
        />
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      align: 'center',
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={() => toggleWatchFolder(record.id)}
          checkedText="启用"
          uncheckedText="禁用"
        />
      )
    },
    {
      title: '操作',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Popconfirm
          title="确认删除"
          content="确定要删除此监控文件夹吗？"
          onOk={() => removeWatchFolder(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button
            type="text"
            status="danger"
            size="small"
            icon={<IconDelete />}
          >
            删除
          </Button>
        </Popconfirm>
      )
    }
  ]

  return (
    <Layout style={{
      minHeight: '100vh',
      background: 'var(--color-bg-1)'
    }}>
      {/* 顶部导航栏 */}
      <Header style={{
        padding: '0 32px',
        background: 'var(--color-bg-2)',
        borderBottom: '1px solid var(--color-bg-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ maxWidth: 1400, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img 
              src="images/ICON.PNG" 
              alt="Logo" 
              style={{ width: 36, height: 36, objectFit: 'contain' }} 
            />
            <Title heading={4} style={{ margin: 0, color: 'var(--color-text-1)', lineHeight: 1.2, fontWeight: 600 }}>飞牛文件管家</Title>
          </div>
          <Button
            type="text"
            icon={isDarkMode ? <IconSun /> : <IconMoon />}
            onClick={() => {
              const newMode = !isDarkMode
              setIsDarkMode(newMode)
              localStorage.setItem('darkMode', JSON.stringify(newMode))
            }}
          />
        </div>
      </Header>

      {/* 主内容区 */}
      <Content style={{ padding: '32px 5vw', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: 1400, width: '100%' }}>
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            type="line"
            style={{ width: '100%' }}
            tabBarStyle={{
              marginBottom: 16
            }}
          >
          <TabPane 
            key="watch" 
            title={
              <span>
                <IconEye style={{ marginRight: 6 }} />
                监控管理
              </span>
            }
          >
            {/* 监控文件夹列表 */}
            <Card 
              title="监控文件夹列表"
              extra={
                <Button type="primary" icon={<IconFolderAdd />} onClick={() => setAddFolderModalVisible(true)}>
                  添加目录
                </Button>
              }
            >
              {watchFolders.length === 0 ? (
                <Empty description="暂无监控文件夹，请点击右上角按钮添加" style={{ padding: 60 }} />
              ) : (
                <Table
                  columns={watchFolderColumns}
                  data={watchFolders}
                  pagination={{ pageSize: 13 }}
                  rowKey="id"
                  scroll={{ x: 600 }}
                />
              )}
            </Card>
          </TabPane>

          <TabPane
            key="cleanup"
            title={
              <span>
                <IconFile style={{ marginRight: 6 }} />
                文件名清理
              </span>
            }
          >
            {/* 文件名清理规则列表 */}
            <Card
              title="文件名清理规则"
              extra={
                <Button type="primary" icon={<IconPlus />} onClick={() => setAddRuleModalVisible(true)}>
                  添加规则
                </Button>
              }
            >
              {filenameCleanupRules.length === 0 ? (
                <Empty description="暂无清理规则，请点击右上角按钮添加" style={{ padding: 60 }} />
              ) : (
                <Table
                  columns={[
                    {
                      title: '规则',
                      dataIndex: 'rule'
                    },
                    {
                      title: '操作',
                      width: 100,
                      align: 'center',
                      render: (_, record) => (
                        <Popconfirm
                          title="确认删除"
                          content="确定要删除此清理规则吗？"
                          onOk={() => removeFilenameCleanupRule(record.rule)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button
                            type="text"
                            status="danger"
                            size="small"
                            icon={<IconDelete />}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      )
                    }
                  ]}
                  data={filenameCleanupRules.map(rule => ({ rule }))}
                  pagination={{ pageSize: 13 }}
                  rowKey="rule"
                  scroll={{ x: 400 }}
                />
              )}
            </Card>
          </TabPane>

          <TabPane
            key="removal"
            title={
              <span>
                <IconDelete style={{ marginRight: 6 }} />
                文件移除
              </span>
            }
          >
            {/* 文件移除规则列表 */}
            <Card
              title="文件移除规则"
              extra={
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  onClick={() => {
                    addRemovalRuleForm.setFieldsValue({ action: 'trash' })
                    setAddRemovalRuleModalVisible(true)
                  }}
                >
                  添加规则
                </Button>
              }
            >
              {fileRemovalRules.length === 0 ? (
                <Empty description="暂无移除规则，请点击右上角按钮添加" style={{ padding: 60 }} />
              ) : (
                <Table
                  columns={[
                    {
                      title: '规则',
                      dataIndex: 'rule'
                    },
                    {
                      title: '处理方式',
                      dataIndex: 'action',
                      width: 120,
                      align: 'center',
                      render: (action) => (
                        <Tag color={action === 'delete' ? 'red' : 'green'} size="small">
                          {action === 'delete' ? '彻底删除' : '移至回收站'}
                        </Tag>
                      )
                    },
                    {
                      title: '操作',
                      width: 100,
                      align: 'center',
                      render: (_, record) => (
                        <Popconfirm
                          title="确认删除"
                          content="确定要删除此移除规则吗？"
                          onOk={() => removeFileRemovalRule(record.rule)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button
                            type="text"
                            status="danger"
                            size="small"
                            icon={<IconDelete />}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      )
                    }
                  ]}
                  data={fileRemovalRules.map((rule, index) => ({
                    ...rule,
                    key: index
                  }))}
                  pagination={{ pageSize: 13 }}
                  rowKey="key"
                  scroll={{ x: 500 }}
                />
              )}
            </Card>
          </TabPane>

          <TabPane
            key="logs"
            title={
              <span>
                <IconHistory style={{ marginRight: 6 }} />
                应用日志
              </span>
            }
            >
            <Card
              title="应用日志"
              extra={
                <Space size={16} align="center">
                  <Space size={8}>
                    <Select
                      value={selectedLogDate}
                      onChange={setSelectedLogDate}
                      style={{ width: 150 }}
                      placeholder="选择日期"
                    >
                      {logDates.map(date => (
                        <Option key={date} value={date}>
                          {date}
                        </Option>
                      ))}
                    </Select>
                  </Space>
                  <Text type="secondary" style={{ margin: '0 8px' }}>|</Text>
                  <Space size={8}>
                    <Text>日志保留：</Text>
                    <Select
                      value={String(appConfig.logRetentionDays)}
                      onChange={(value) => updateAppConfig({ logRetentionDays: Number(value) })}
                      style={{ width: 100 }}
                    >
                      {logRetentionOptions.map(option => (
                        <Option key={option.value} value={String(option.value)}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>
                  </Space>
                  <Button
                    type="primary"
                    icon={<IconRefresh />}
                    onClick={() => {
                      fetchLogs()
                      Message.success('日志已刷新')
                    }}
                  >
                    刷新日志
                  </Button>
                </Space>
              }
            >
              <Spin loading={logsLoading} style={{ width: '100%' }}>
{logs.length === 0 ? (
  <Empty
    description={`${selectedLogDate} 暂无日志记录`}
    style={{ padding: 60 }}
  />
) : (
  <Table
    columns={logColumns.filter((_, index) => index !== 5)}
    data={logs}
    pagination={{ pageSize: 13 }}
    rowKey={(record, index) => index}
    scroll={{ x: 940 }}
  />
)}
              </Spin>
            </Card>
          </TabPane>

          <TabPane
            key="about"
            title={
              <span>
                <IconInfoCircle style={{ marginRight: 6 }} />
                关于应用
              </span>
            }
          >
            <Card title="关于">
              <div style={{ marginBottom: 24 }}>
                <Title heading={5} style={{ marginBottom: 12 }}>技术栈</Title>
                <Space wrap size={8}>
                  <Tag color="blue" size="large">React 18</Tag>
                  <Tag color="purple" size="large">Vite 5</Tag>
                  <Tag color="arcoblue" size="large">Arco Design</Tag>
                  <Tag color="green" size="large">Node.js</Tag>
                  <Tag color="gray" size="large">Express</Tag>
                  <Tag color="red" size="large">Chokidar</Tag>
                </Space>
              </div>
              <div>
                <Title heading={5} style={{ marginBottom: 12 }}>功能特性</Title>
                <List
                  size="small"
                  dataSource={[
                    '文件夹实时监控，支持递归监控子目录',
                    '文件名自动清理，移除指定字符串',
                    '文件/文件夹自动移除，支持通配符匹配',
                    '下载目录智能检测，避免处理未完成下载',
                    '操作日志记录，支持日志保留配置',
                    '深色/浅色主题切换'
                  ]}
                  render={(item) => (
                    <List.Item style={{ padding: '8px 0' }}>
                      <IconCheckCircle style={{ color: 'rgb(var(--success-6))', marginRight: 8, marginLeft: 8 }} />
                      {item}
                    </List.Item>
                  )}
                />
              </div>
            </Card>
          </TabPane>
        </Tabs>
        </div>
      </Content>

      {/* 添加监控文件夹弹窗 */}
      <Modal
        title="添加监控文件夹"
        visible={addFolderModalVisible}
        onOk={() => addFolderForm.submit()}
        onCancel={() => {
          setAddFolderModalVisible(false)
          addFolderForm.resetFields()
        }}
        okText="添加"
        cancelText="取消"
        style={{ width: 480 }}
      >
        <Form
          form={addFolderForm}
          onSubmit={addWatchFolder}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ recursive: false, enabled: true, isDownloadFolder: false }}
        >
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 12 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>文件夹路径</span>
                <Tooltip content="选择需要监控的文件夹路径">
                  <IconInfoCircle style={{ fontSize: 14, cursor: 'pointer' }} />
                </Tooltip>
              </div>
            </div>
            <FormItem
              field="path"
              rules={[{ required: true, message: '请选择文件夹路径' }]}
              style={{ marginBottom: 0 }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <Input 
                  placeholder="点击选择文件夹"
                  readOnly
                  style={{ flex: 1 }}
                  value={addFolderForm.getFieldValue('path')}
                />
                <Button type="primary" onClick={openPathSelector}>
                  选择
                </Button>
              </div>
            </FormItem>
          </div>
          
          <div style={{ marginTop: 16 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 12 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>递归监控</span>
                <Tooltip content="递归监控子文件夹内容">
                  <IconInfoCircle style={{ fontSize: 14, cursor: 'pointer' }} />
                </Tooltip>
              </div>
              <FormItem field="recursive" triggerPropName="checked" style={{ marginBottom: 0, width: 'auto', display: 'inline-block' }}>
                <Switch />
              </FormItem>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 12 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>下载目录</span>
                <Tooltip content="通过检测.part文件判断文件夹是否为下载目录">
                  <IconInfoCircle style={{ fontSize: 14, cursor: 'pointer' }} />
                </Tooltip>
                <Button
                  type="text"
                  size="small"
                  loading={downloadFolderValidating}
                  onClick={() => {
                    const path = addFolderForm.getFieldValue('path')
                    if (path) {
                      validateDownloadFolder(path)
                    } else {
                      Message.warning('请先选择文件夹路径')
                    }
                  }}
                  style={{ marginLeft: 4, padding: '0 8px', fontSize: 12 }}
                >
                  验证
                </Button>
              </div>
              <FormItem field="isDownloadFolder" triggerPropName="checked" style={{ marginBottom: 0, width: 'auto', display: 'inline-block' }}>
                <Switch />
              </FormItem>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 0 
            }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>立即启用</span>
              <FormItem field="enabled" triggerPropName="checked" style={{ marginBottom: 0, width: 'auto', display: 'inline-block' }}>
                <Switch />
              </FormItem>
            </div>
          </div>
        </Form>
      </Modal>

      {/* 添加文件名清理规则弹窗 */}
      <Modal
        title="添加文件名清理规则"
        visible={addRuleModalVisible}
        onOk={() => addRuleForm.submit()}
        onCancel={() => {
          setAddRuleModalVisible(false)
          addRuleForm.resetFields()
          setRuleValidationResult(null)
        }}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={addRuleForm}
          onSubmit={addFilenameCleanupRule}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 12 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>规则字符串</span>
                <Tooltip content="当文件名包含此字符串时会自动移除该字符串">
                  <IconInfoCircle style={{ fontSize: 14, cursor: 'pointer' }} />
                </Tooltip>
                <Button
                  type="text"
                  size="small"
                  loading={validatingRule}
                  onClick={() => {
                    const rule = addRuleForm.getFieldValue('rule')
                    if (rule && rule.trim().length > 0) {
                      validateRule(rule)
                    } else {
                      Message.warning('请输入规则字符串')
                    }
                  }}
                  style={{ marginLeft: 4, padding: '0 8px', fontSize: 12 }}
                >
                  验证
                </Button>
              </div>
            </div>
            <FormItem
              field="rule"
              rules={[{ required: true, message: '请输入规则字符串' }]}
              style={{ marginBottom: 0 }}
            >
              <Input
                placeholder="例如：副本、copy、 - 副本"
              />
            </FormItem>
          </div>
        </Form>
      </Modal>

      {/* 验证结果弹窗 */}
      <Modal
        title="验证结果"
        visible={!!ruleValidationResult}
        onOk={() => setRuleValidationResult(null)}
        onCancel={() => setRuleValidationResult(null)}
        okText="关闭"
        hideCancel={true}
        style={{ width: 700 }}
      >
        {ruleValidationResult && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">规则：</Text>
              <Tag color="blue" style={{ marginLeft: 8 }}>{ruleValidationResult.rule}</Tag>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">匹配结果：</Text>
              <Tag color={ruleValidationResult.totalMatchingFiles > 0 ? 'orange' : 'green'} style={{ marginLeft: 8 }}>
                将影响 {ruleValidationResult.totalMatchingFiles} 个文件
              </Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                （涉及 {ruleValidationResult.affectedFolders} 个监控文件夹）
              </Text>
            </div>
            {ruleValidationResult.details.length > 0 && (
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  受影响的文件列表：
                </Text>
                {ruleValidationResult.details.map((detail, index) => (
                  <Card key={index} size="small" style={{ marginBottom: 12 }} title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13 }}>{detail.folderPath}</Text>
                      <Tag color={detail.recursive ? 'blue' : 'default'} size="small">
                        {detail.recursive ? '递归监控' : '非递归监控'}
                      </Tag>
                    </div>
                  }>
                    <div style={{ maxHeight: 200, overflow: 'auto' }}>
                      {detail.matchingFiles.map((file, idx) => (
                        <div key={idx} style={{ padding: '4px 0', fontSize: 12 }}>
                          {file.split(ruleValidationResult.rule).map((part, partIdx, arr) => (
                            <span key={partIdx}>
                              {part}
                              {partIdx < arr.length - 1 && (
                                <span style={{ backgroundColor: '#ffeb3b', padding: '0 2px', fontWeight: 'bold' }}>
                                  {ruleValidationResult.rule}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      ))}
                      {detail.matchingCount > detail.matchingFiles.length && (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
                          ... 还有 {detail.matchingCount - detail.matchingFiles.length} 个文件
                        </Text>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 添加文件移除规则弹窗 */}
      <Modal
        title="添加文件移除规则"
        visible={addRemovalRuleModalVisible}
        onOk={() => addRemovalRuleForm.submit()}
        onCancel={() => {
          setAddRemovalRuleModalVisible(false)
          addRemovalRuleForm.resetFields()
          addRemovalRuleForm.setFieldsValue({ action: 'trash' })
          setRemovalRuleValidationResult(null)
        }}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={addRemovalRuleForm}
          onSubmit={addFileRemovalRule}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ action: 'trash' }}
        >
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 12 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>规则字符串</span>
                <Tooltip content="支持通配符：* 匹配任意字符，? 匹配单个字符。例如：*.tmp、temp?、test*。同时匹配文件和文件夹">
                  <IconInfoCircle style={{ fontSize: 14, cursor: 'pointer' }} />
                </Tooltip>
                <Button
                  type="text"
                  size="small"
                  loading={validatingRemovalRule}
                  onClick={() => {
                    const rule = addRemovalRuleForm.getFieldValue('rule')
                    if (rule && rule.trim().length > 0) {
                      validateRemovalRule(rule)
                    } else {
                      Message.warning('请输入规则字符串')
                    }
                  }}
                  style={{ marginLeft: 4, padding: '0 8px', fontSize: 12 }}
                >
                  验证
                </Button>
              </div>
            </div>
            <FormItem
              field="rule"
              rules={[{ required: true, message: '请输入规则字符串' }]}
              style={{ marginBottom: 0 }}
            >
              <Input
                placeholder="例如：*.tmp、temp?、test*"
              />
            </FormItem>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 12 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>处理方式</span>
                <Tooltip content="移至回收站可恢复，彻底删除无法恢复">
                  <IconInfoCircle style={{ fontSize: 14, cursor: 'pointer' }} />
                </Tooltip>
              </div>
            </div>
            <FormItem
              field="action"
              rules={[{ required: true, message: '请选择处理方式' }]}
              style={{ marginBottom: 0 }}
            >
              <Select placeholder="请选择处理方式">
                <Option value="trash">移至回收站</Option>
                <Option value="delete">彻底删除</Option>
              </Select>
            </FormItem>
          </div>
        </Form>
      </Modal>

      {/* 文件移除验证结果弹窗 */}
      <Modal
        title="验证结果"
        visible={!!removalRuleValidationResult}
        onOk={() => setRemovalRuleValidationResult(null)}
        onCancel={() => setRemovalRuleValidationResult(null)}
        okText="关闭"
        hideCancel={true}
        style={{ width: '100%', maxWidth: 700 }}
      >
        {removalRuleValidationResult && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">规则：</Text>
              <Tag color="blue" style={{ marginLeft: 8 }}>{removalRuleValidationResult.rule}</Tag>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">匹配结果：</Text>
              <Tag color={removalRuleValidationResult.totalMatches > 0 ? 'orange' : 'green'} style={{ marginLeft: 8 }}>
                将影响 {removalRuleValidationResult.totalMatches} 个项目
              </Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                （{removalRuleValidationResult.totalMatchingFiles} 个文件，{removalRuleValidationResult.totalMatchingFolders} 个文件夹，涉及 {removalRuleValidationResult.affectedFolders} 个监控文件夹）
              </Text>
            </div>
            {removalRuleValidationResult.details.length > 0 && (
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  受影响的项目列表：
                </Text>
                {removalRuleValidationResult.details.map((detail, index) => (
                  <Card key={index} size="small" style={{ marginBottom: 12 }} title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13 }}>{detail.folderPath}</Text>
                      <Tag color={detail.recursive ? 'blue' : 'default'} size="small">
                        {detail.recursive ? '递归监控' : '非递归监控'}
                      </Tag>
                    </div>
                  }>
                    <div style={{ maxHeight: 200, overflow: 'auto' }}>
                      {/* 文件列表 */}
                      {detail.matchingFiles && detail.matchingFiles.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>文件：</Text>
                          {detail.matchingFiles.map((file, idx) => (
                            <div key={`file-${idx}`} style={{ padding: '2px 0', fontSize: 12 }}>
                              <Tag size="small" color="blue" style={{ marginRight: 8 }}>文件</Tag>
                              {file.split(removalRuleValidationResult.rule).map((part, partIdx, arr) => (
                                <span key={partIdx}>
                                  {part}
                                  {partIdx < arr.length - 1 && (
                                    <span style={{ backgroundColor: '#ffeb3b', padding: '0 2px', fontWeight: 'bold' }}>
                                      {removalRuleValidationResult.rule}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* 文件夹列表 */}
                      {detail.matchingFolders && detail.matchingFolders.length > 0 && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 11 }}>文件夹：</Text>
                          {detail.matchingFolders.map((folder, idx) => (
                            <div key={`folder-${idx}`} style={{ padding: '2px 0', fontSize: 12 }}>
                              <Tag size="small" color="orange" style={{ marginRight: 8 }}>文件夹</Tag>
                              {folder.split(removalRuleValidationResult.rule).map((part, partIdx, arr) => (
                                <span key={partIdx}>
                                  {part}
                                  {partIdx < arr.length - 1 && (
                                    <span style={{ backgroundColor: '#ffeb3b', padding: '0 2px', fontWeight: 'bold' }}>
                                      {removalRuleValidationResult.rule}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {detail.matchingCount > (detail.matchingFiles?.length || 0) + (detail.matchingFolders?.length || 0) && (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
                          ... 还有 {detail.matchingCount - (detail.matchingFiles?.length || 0) - (detail.matchingFolders?.length || 0)} 个项目
                        </Text>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 路径选择弹窗 */}
      <Modal
        title="选择文件夹"
        visible={pathSelectorVisible}
        onOk={confirmPathSelection}
        onCancel={() => setPathSelectorVisible(false)}
        okText="选择"
        cancelText="取消"
        style={{ width: 560 }}
      >
        {/* 当前路径导航 */}
        <div style={{
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'var(--color-fill-1)',
          border: '1px solid var(--color-border)'
        }}>
          <IconFolder style={{ fontSize: 16, color: 'var(--color-text-3)' }} />
          {/* 路径面包屑 */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            overflow: 'hidden'
          }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>/</span>
            {currentPath.split('/').filter(Boolean).map((item, index, arr) => {
              const itemPath = '/' + arr.slice(0, index + 1).join('/')
              const isLast = index === arr.length - 1
              return (
                <span key={itemPath} style={{ display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      cursor: isLast ? 'default' : 'pointer',
                      fontWeight: isLast ? 500 : 400,
                      fontSize: 13,
                      padding: '4px 8px',
                      transition: 'all 0.2s',
                      color: isLast ? 'var(--color-text-1)' : 'var(--color-text-2)',
                      backgroundColor: isLast ? 'var(--color-fill-2)' : 'transparent'
                    }}
                    onClick={() => !isLast && navigateToDirectory(itemPath)}
                  >
                    {item}
                  </span>
                  {!isLast && (
                    <span style={{ margin: '0 4px', color: 'var(--color-text-4)' }}>/</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>

        {/* 文件夹列表 */}
        <List
          style={{
            maxHeight: 360,
            overflow: 'auto',
            border: '1px solid var(--color-border)'
          }}
          loading={directoriesLoading}
          dataSource={directories}
          locale={{ empty: '此目录为空' }}
          render={(item) => (
            <List.Item
              key={item.path}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor: selectedPath === item.path ? 'var(--color-fill-2)' : 'transparent',
                borderLeft: selectedPath === item.path ? '3px solid rgb(var(--primary-6))' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
              onClick={() => selectPath(item.path)}
              onDoubleClick={() => navigateToDirectory(item.path)}
            >
              <List.Item.Meta
                avatar={
                  <IconFolder
                    style={{
                      fontSize: 20,
                      color: selectedPath === item.path ? 'rgb(var(--primary-6))' : 'var(--color-text-3)'
                    }}
                  />
                }
                title={
                  <Text style={{
                    fontSize: 14,
                    fontWeight: selectedPath === item.path ? 500 : 400,
                    color: selectedPath === item.path ? 'rgb(var(--primary-6))' : 'var(--color-text-1)'
                  }}>
                    {item.name}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      {/* 日志详情弹窗 */}
      <Modal
        title="日志详情"
        visible={logDetailVisible}
        onOk={() => setLogDetailVisible(false)}
        onCancel={() => setLogDetailVisible(false)}
        okText="关闭"
        hideCancel={true}
        style={{ width: 600 }}
      >
        {currentLogDetail && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">时间：</Text>
              <Text>{currentLogDetail.timestamp}</Text>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">操作：</Text>
              <Tag color={{
                '服务启动': 'blue',
                '服务停止': 'red',
                '监控错误': 'red',
                '查看日志': 'lime',
                '查看配置': 'pink',
                '更新配置': 'purple',
                '添加监控文件夹': 'blue',
                '移除监控文件夹': 'red',
                '切换监控状态': 'orange',
                '添加文件名清理规则': 'cyan',
                '删除文件名清理规则': 'magenta',
                '添加文件移除规则': 'red',
                '删除文件移除规则': 'orangered',
                '文件名清理': 'green',
                '文件移除': 'crimson',
                '验证下载目录': 'arcoblue',
                '更新下载目录状态': 'gold'
              }[currentLogDetail.operation] || 'default'}>
                {currentLogDetail.operation}
              </Tag>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">结果：</Text>
              <Tag color={currentLogDetail.details?.result === '成功' ? 'green' : 'red'} size="small">
                {currentLogDetail.details?.result || '-'}
              </Tag>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">详细信息：</Text>
              <div style={{ 
                marginTop: 8, 
                padding: 12, 
                backgroundColor: 'var(--color-fill-1)', 
                borderRadius: 4,
                maxHeight: 300,
                overflow: 'auto'
              }}>
                {Object.entries(currentLogDetail.details || {}).map(([key, value]) => {
                  const keyNameMap = {
                    'type': '类型',
                    'path': '路径',
                    'name': '名称',
                    'rule': '规则',
                    'action': '处理方式',
                    'result': '结果',
                    'ip': 'IP',
                    'port': '端口',
                    'logDir': '日志目录',
                    'configDir': '配置目录',
                    'logRetentionDays': '日志保留天数',
                    'watchFoldersCount': '监控文件夹数',
                    'recursive': '递归监控',
                    'enabled': '启用状态',
                    'isDownloadFolder': '下载目录',
                    'hasPartFiles': '存在分片文件',
                    'totalPartFiles': '分片文件数',
                    'watchPath': '监控路径',
                    'originalPath': '原路径',
                    'newPath': '新路径',
                    'originalName': '原文件名',
                    'newName': '新文件名',
                    'matchedRule': '匹配规则',
                    'trigger': '触发方式',
                    'trashPath': '回收站路径',
                    'matchingFiles': '匹配文件数',
                    'affectedFolders': '影响文件夹数',
                    'processedFiles': '已处理文件数',
                    'successCount': '成功数',
                    'totalMatchingFiles': '总匹配文件数',
                    'totalMatchingFolders': '总匹配文件夹数',
                    'totalMatches': '总匹配数',
                    'processedCount': '已处理数',
                    'successFiles': '成功文件数',
                    'successFolders': '成功文件夹数',
                    'totalProcessedFiles': '总处理文件数',
                    'totalSuccessFiles': '总成功文件数',
                    'totalProcessedFolders': '总处理文件夹数',
                    'totalSuccessFolders': '总成功文件夹数',
                    'totalProcessed': '总处理数',
                    'totalSuccess': '总成功数',
                    'error': '错误信息',
                    'folderPath': '文件夹路径',
                    'partFileDetails': '分片文件详情',
                    'files': '文件列表',
                    'folder': '文件夹',
                    'config': '配置'
                  }
                  const displayKey = keyNameMap[key] || key
                  let displayValue = value
                  if (key === 'type') {
                    displayValue = value === 'file' ? '文件' : '文件夹'
                  } else if (key === 'action') {
                    displayValue = value === 'delete' ? '彻底删除' : '移至回收站'
                  } else if (key === 'recursive') {
                    displayValue = value ? '是' : '否'
                  } else if (key === 'enabled') {
                    displayValue = value ? '启用' : '禁用'
                  } else if (key === 'isDownloadFolder') {
                    displayValue = value ? '是' : '否'
                  } else if (key === 'hasPartFiles') {
                    displayValue = value ? '是' : '否'
                  } else if (key === 'trigger') {
                    displayValue = value === '下载完处理' ? '下载完成处理' : value
                  }
                  return (
                    <div key={key} style={{ marginBottom: 8, display: 'flex' }}>
                      <Text type="secondary" style={{ minWidth: 100 }}>{displayKey}：</Text>
                      <Text style={{ flex: 1, wordBreak: 'break-all' }}>
                        {typeof displayValue === 'object' ? JSON.stringify(displayValue) : String(displayValue)}
                      </Text>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}

export default App
