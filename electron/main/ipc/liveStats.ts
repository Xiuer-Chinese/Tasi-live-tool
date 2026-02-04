/**
 * 直播数据导出 IPC 处理
 */

import { app, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import * as XLSX from 'xlsx'
import { typedIpcMainHandle } from '#/utils'

// 导出数据结构（与渲染进程保持一致）
interface LiveStatsExportData {
  accountName: string
  startTime: number | null
  endTime: number
  duration: number
  stats: {
    likeCount: number
    commentCount: number
    enterCount: number
    followCount: number
    fansClubCount: number
    orderCount: number
    paidOrderCount: number
    brandVipCount: number
  }
  danmuList: Array<{
    nickName: string
    content: string
    time: string
  }>
  fansClubChanges: Array<{
    id: string
    nickName: string
    userId?: string
    content?: string
    time: string
  }>
  events: Array<{
    id: string
    type: string
    nickName: string
    content?: string
    time: string
    extra?: Record<string, unknown>
  }>
}

// 获取导出目录
function getExportFolder(): string {
  const documentsPath = app.getPath('documents')
  const exportFolder = path.join(documentsPath, 'TASI直播数据')

  // 确保目录存在
  if (!fs.existsSync(exportFolder)) {
    fs.mkdirSync(exportFolder, { recursive: true })
  }

  return exportFolder
}

// 格式化日期时间用于文件名
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

// 格式化时长文本
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}小时${minutes}分${secs}秒`
  }
  if (minutes > 0) {
    return `${minutes}分${secs}秒`
  }
  return `${secs}秒`
}

// 获取事件类型中文名
function getEventTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    comment: '评论',
    wechat_channel_live_msg: '评论',
    xiaohongshu_comment: '评论',
    taobao_comment: '评论',
    room_enter: '进入直播间',
    room_like: '点赞',
    room_follow: '关注',
    ecom_fansclub_participate: '加入粉丝团',
    subscribe_merchant_brand_vip: '加入品牌会员',
    live_order: '下单',
  }
  return typeMap[type] || type
}

// 导出数据到 Excel
async function exportToExcel(data: LiveStatsExportData): Promise<string> {
  const exportFolder = getExportFolder()
  const dateTimeStr = formatDateTime(data.endTime)
  const safeAccountName = (data.accountName || '未知账号').replace(/[<>:"/\\|?*]/g, '_')
  const fileName = `直播数据_${safeAccountName}_${dateTimeStr}.xlsx`
  const filePath = path.join(exportFolder, fileName)

  // 创建工作簿
  const workbook = XLSX.utils.book_new()

  // Sheet 1: 统计概览
  const overviewData = [
    ['直播数据统计报告'],
    [],
    ['基本信息'],
    ['账号名称', data.accountName || '未知'],
    ['开始时间', data.startTime ? new Date(data.startTime).toLocaleString('zh-CN') : '未记录'],
    ['结束时间', new Date(data.endTime).toLocaleString('zh-CN')],
    ['监控时长', formatDuration(data.duration)],
    [],
    ['数据统计'],
    ['指标', '数量'],
    ['点赞数', data.stats.likeCount],
    ['弹幕数', data.stats.commentCount],
    ['进入直播间', data.stats.enterCount],
    ['新增关注', data.stats.followCount],
    ['加入粉丝团', data.stats.fansClubCount],
    ['订单数（已下单）', data.stats.orderCount],
    ['订单数（已付款）', data.stats.paidOrderCount],
    ['品牌会员', data.stats.brandVipCount],
  ]
  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData)

  // 设置列宽
  overviewSheet['!cols'] = [{ wch: 20 }, { wch: 30 }]

  // 合并标题单元格
  overviewSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]

  XLSX.utils.book_append_sheet(workbook, overviewSheet, '统计概览')

  // Sheet 2: 弹幕列表
  const danmuHeader = ['用户昵称', '评论内容', '时间']
  const danmuRows = data.danmuList.map(item => [item.nickName, item.content, item.time])
  const danmuData = [danmuHeader, ...danmuRows]
  const danmuSheet = XLSX.utils.aoa_to_sheet(danmuData)
  danmuSheet['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(workbook, danmuSheet, '弹幕列表')

  // Sheet 3: 粉丝团变化
  const fansHeader = ['用户昵称', '时间']
  const fansRows = data.fansClubChanges.map(item => [item.nickName, item.time])
  const fansData = [fansHeader, ...fansRows]
  const fansSheet = XLSX.utils.aoa_to_sheet(fansData)
  fansSheet['!cols'] = [{ wch: 20 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(workbook, fansSheet, '粉丝团变化')

  // Sheet 4: 事件时间线
  const eventsHeader = ['事件类型', '用户昵称', '内容', '时间']
  const eventsRows = data.events.map(item => [
    getEventTypeName(item.type),
    item.nickName,
    item.content || '',
    item.time,
  ])
  const eventsData = [eventsHeader, ...eventsRows]
  const eventsSheet = XLSX.utils.aoa_to_sheet(eventsData)
  eventsSheet['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(workbook, eventsSheet, '事件时间线')

  // 写入文件 - 使用 buffer 方式，兼容 Electron 环境
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  fs.writeFileSync(filePath, buffer)

  return filePath
}

export function setupLiveStatsIpcHandlers() {
  // 导出数据
  typedIpcMainHandle(IPC_CHANNELS.liveStats.exportData, async (_, data: LiveStatsExportData) => {
    try {
      const filePath = await exportToExcel(data)
      return { success: true, filePath }
    } catch (error) {
      console.error('[LiveStats] Export failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败',
      }
    }
  })

  // 打开导出目录
  typedIpcMainHandle(IPC_CHANNELS.liveStats.openExportFolder, () => {
    const exportFolder = getExportFolder()
    shell.openPath(exportFolder)
  })
}
