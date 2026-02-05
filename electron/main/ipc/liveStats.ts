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
    userId?: string
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

const COMMENT_TYPES = new Set([
  'comment',
  'wechat_channel_live_msg',
  'xiaohongshu_comment',
  'taobao_comment',
])

interface UserBehaviorRow {
  user_id: string
  enter_time: string
  has_comment: boolean
  comment_text: string
  comment_count: number
  has_follow: boolean
  has_order: boolean
  order_time: string
  comment_type: string
}

function buildUserBehaviorRows(events: LiveStatsExportData['events']): UserBehaviorRow[] {
  const userMap = new Map<
    string,
    {
      userId: string
      enterTime: string
      comments: { text: string; type: string }[]
      hasFollow: boolean
      hasOrder: boolean
      orderTime: string
    }
  >()

  for (const ev of events) {
    const key = ev.userId || ev.nickName
    let u = userMap.get(key)
    if (!u) {
      u = {
        userId: key,
        enterTime: '',
        comments: [],
        hasFollow: false,
        hasOrder: false,
        orderTime: '',
      }
      userMap.set(key, u)
    }

    if (ev.type === 'room_enter') {
      if (!u.enterTime || ev.time < u.enterTime) u.enterTime = ev.time
    } else if (COMMENT_TYPES.has(ev.type)) {
      u.comments.push({ text: ev.content || '', type: ev.type })
    } else if (ev.type === 'room_follow') {
      u.hasFollow = true
    } else if (ev.type === 'live_order') {
      u.hasOrder = true
      if (!u.orderTime) {
        const ts = ev.extra?.orderTs as number | undefined
        u.orderTime = typeof ts === 'number' ? new Date(ts).toLocaleString('zh-CN') : ev.time
      }
    }
  }

  return Array.from(userMap.entries()).map(([, u]) => ({
    user_id: u.userId,
    enter_time: u.enterTime,
    has_comment: u.comments.length > 0,
    comment_text: u.comments.map(c => c.text).join(' | '),
    comment_count: u.comments.length,
    has_follow: u.hasFollow,
    has_order: u.hasOrder,
    order_time: u.hasOrder ? u.orderTime : '',
    comment_type: u.comments[0]?.type ?? '',
  }))
}

// 导出数据到 Excel
async function exportToExcel(data: LiveStatsExportData): Promise<string> {
  const exportFolder = getExportFolder()
  const dateTimeStr = formatDateTime(data.endTime)
  const safeAccountName = (data.accountName || '未知账号').replace(/[<>:"/\\|?*]/g, '_')
  const fileName = `直播数据_${safeAccountName}_${dateTimeStr}.xlsx`
  const filePath = path.join(exportFolder, fileName)

  const allRows = buildUserBehaviorRows(data.events)
  const cols = [
    { wch: 18 },
    { wch: 20 },
    { wch: 10 },
    { wch: 40 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
    { wch: 20 },
  ]

  const workbook = XLSX.utils.book_new()
  const header = [
    'user_id',
    'enter_time',
    'has_comment',
    'comment_text',
    'comment_count',
    'has_follow',
    'has_order',
    'order_time',
    'comment_type',
  ]

  // Sheet1: 用户行为明细-全量
  const sheet1Data = [
    header,
    ...allRows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ]
  const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Data)
  sheet1['!cols'] = cols
  XLSX.utils.book_append_sheet(workbook, sheet1, '用户行为明细-全量')

  // Sheet2: 已下单用户
  const sheet2Rows = allRows.filter(r => r.has_order)
  const sheet2 = XLSX.utils.aoa_to_sheet([
    header,
    ...sheet2Rows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ])
  sheet2['!cols'] = cols
  XLSX.utils.book_append_sheet(workbook, sheet2, '已下单用户')

  // Sheet3: 有评论未下单
  const sheet3Rows = allRows.filter(r => r.has_comment && !r.has_order)
  const sheet3 = XLSX.utils.aoa_to_sheet([
    header,
    ...sheet3Rows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ])
  sheet3['!cols'] = cols
  XLSX.utils.book_append_sheet(workbook, sheet3, '有评论未下单')

  // Sheet4: 已关注未下单
  const sheet4Rows = allRows.filter(r => r.has_follow && !r.has_order)
  const sheet4 = XLSX.utils.aoa_to_sheet([
    header,
    ...sheet4Rows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ])
  sheet4['!cols'] = cols
  XLSX.utils.book_append_sheet(workbook, sheet4, '已关注未下单')

  // Sheet5: 高意向未成交（规则版）
  const sheet5Rows = allRows.filter(r => (r.comment_count >= 1 || r.has_follow) && !r.has_order)
  const sheet5 = XLSX.utils.aoa_to_sheet([
    header,
    ...sheet5Rows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ])
  sheet5['!cols'] = cols
  XLSX.utils.book_append_sheet(workbook, sheet5, '高意向未成交')

  // Sheet6: 行为构成汇总（仅进入=有进入且无评论/关注/成交；其他为各自维度计数）
  const onlyEnter = allRows.filter(
    r => r.enter_time && !r.has_comment && !r.has_follow && !r.has_order,
  ).length
  const hasComment = allRows.filter(r => r.has_comment).length
  const hasFollow = allRows.filter(r => r.has_follow).length
  const hasOrder = allRows.filter(r => r.has_order).length
  const sheet6Data = [
    ['行为类型', '用户数'],
    ['仅进入', onlyEnter],
    ['有评论', hasComment],
    ['有关注', hasFollow],
    ['有成交', hasOrder],
  ]
  const sheet6 = XLSX.utils.aoa_to_sheet(sheet6Data)
  sheet6['!cols'] = [{ wch: 15 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(workbook, sheet6, '行为构成汇总')

  // Sheet7: 评论 × 成交
  const ccOrder = allRows.filter(r => r.has_comment && r.has_order).length
  const ccNoOrder = allRows.filter(r => r.has_comment && !r.has_order).length
  const noCOrder = allRows.filter(r => !r.has_comment && r.has_order).length
  const noCNoOrder = allRows.filter(r => !r.has_comment && !r.has_order).length
  const sheet7Data = [
    ['has_comment \\ has_order', '已下单', '未下单'],
    ['有评论', ccOrder, ccNoOrder],
    ['无评论', noCOrder, noCNoOrder],
  ]
  const sheet7 = XLSX.utils.aoa_to_sheet(sheet7Data)
  sheet7['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(workbook, sheet7, '评论×成交')

  // Sheet8: 关注 × 成交
  const cfOrder = allRows.filter(r => r.has_follow && r.has_order).length
  const cfNoOrder = allRows.filter(r => r.has_follow && !r.has_order).length
  const noFOrder = allRows.filter(r => !r.has_follow && r.has_order).length
  const noFNoOrder = allRows.filter(r => !r.has_follow && !r.has_order).length
  const sheet8Data = [
    ['has_follow \\ has_order', '已下单', '未下单'],
    ['有关注', cfOrder, cfNoOrder],
    ['无关注', noFOrder, noFNoOrder],
  ]
  const sheet8 = XLSX.utils.aoa_to_sheet(sheet8Data)
  sheet8['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(workbook, sheet8, '关注×成交')

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
