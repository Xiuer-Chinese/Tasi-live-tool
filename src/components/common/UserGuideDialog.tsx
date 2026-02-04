import { BookOpen, X } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// 用户使用手册内容
const USER_GUIDE_CONTENT = `# 🎯 TASI 直播超级工具 - 用户使用手册

欢迎使用 TASI 直播超级工具！本工具旨在帮助主播和运营人员提升直播效率，实现自动化运营。

---

## 🌐 支持平台

| 平台 | 自动回复 | 自动发言 | 自动弹窗 | 数据监控 |
|-----|---------|---------|---------|---------|
| **抖音** | ✅ | ✅ | ✅ | ✅ |
| **抖音百应** | ✅ | ✅ | ✅ | ✅ |
| **视频号** | ✅ | ✅ | ✅ | ✅ |
| **小红书** | ✅ | ✅ | - | ✅ |
| **淘宝** | ✅ | ✅ | - | ✅ |
| **快手** | - | ✅ | - | - |
| **抖店 EOS** | - | ✅ | - | - |

---

## 🚀 快速开始

### 第一步：安装并启动

1. 下载并安装 TASI 直播超级工具
2. 启动应用程序
3. 首次使用需要注册/登录账号

### 第二步：连接直播中控台

1. 在左侧菜单点击 **「直播中控台」**
2. 选择您使用的直播平台
3. 点击 **「连接中控台」** 按钮
4. 在弹出的浏览器窗口中登录您的直播账号
5. 等待连接成功，状态显示为 **「已连接」**

### 第三步：开启所需功能

连接成功后，您可以根据需要开启以下功能：
- 自动回复 - 自动回复观众评论
- 自动发言 - 定时发送预设消息
- 自动弹窗 - 自动弹出商品卡片
- 数据监控 - 实时统计直播数据

---

## 📦 功能模块

### 1. 直播中控台

**功能说明**：连接各平台的直播中控台，是使用其他功能的前提。

**使用步骤**：
1. 选择直播平台（抖音、视频号、小红书等）
2. 点击「连接中控台」
3. 在浏览器中完成登录
4. 等待状态变为「已连接」

**状态说明**：
- 🟢 **已连接** - 可正常使用所有功能
- 🟡 **连接中** - 正在连接，请稍候
- 🔴 **已断开** - 需要重新连接
- 🟠 **直播中** - 检测到正在直播

---

### 2. 自动回复

**功能说明**：根据预设规则自动回复观众的评论和互动。

**使用步骤**：
1. 进入「自动回复」页面
2. 点击右上角「设置」配置回复规则
3. 点击「开始任务」启动自动回复

**设置项说明**：
- **关键词回复** - 设置关键词触发的自动回复内容
- **AI 智能回复** - 使用 AI 自动生成回复内容
- **监听来源** - 选择监听评论的数据源
- **用户屏蔽** - 设置不回复的用户列表

**监听来源选择**：
- **电商罗盘大屏**（推荐）：可获取评论、点赞、进入直播间等全部消息
- **中控台**：仅能获取评论消息

---

### 3. 自动发言

**功能说明**：按照设定的时间间隔，自动在直播间发送预设消息。

**使用步骤**：
1. 进入「自动发言」页面
2. 添加需要发送的消息内容
3. 设置发送间隔时间
4. 点击「开始任务」

**使用技巧**：
- 可以设置产品介绍、优惠信息等常用话术
- 建议间隔时间不要太短，避免刷屏
- 支持一键批量发送功能

---

### 4. 自动弹窗

**功能说明**：自动弹出商品讲解卡片，提升商品曝光。

**适用平台**：抖音、抖音百应、视频号

**使用步骤**：
1. 进入「自动弹窗」页面
2. 系统会自动获取您的商品列表
3. 设置弹窗间隔和商品顺序
4. 点击「开始任务」

**快捷键功能**：
- 可为每个商品设置独立的快捷键
- 按下快捷键即可立即弹出对应商品
- 支持 F1-F12、数字键等

---

### 5. AI 助手

**功能说明**：智能 AI 对话助手，可帮助您撰写文案、回答问题等。

**使用步骤**：
1. 进入「AI 助手」页面
2. 在输入框输入您的问题或需求
3. AI 将自动生成回复

**配置方法**：
1. 进入「应用设置」→「AI 设置」
2. 选择 AI 服务商
3. 填入您的 API Key
4. 测试连接是否正常

---

### 6. 数据监控

**功能说明**：实时统计直播间各项数据，支持导出 Excel 报告。

**核心功能**：
- 📊 **实时统计**：点赞、弹幕、进入、关注、粉丝团、订单等
- 💬 **弹幕监控**：查看所有弹幕内容，支持搜索
- 👥 **粉丝团变化**：记录新加入粉丝团的用户
- 📈 **事件时间线**：所有事件的时间顺序记录
- 📥 **数据导出**：一键导出 Excel 报告
- 💾 **自动保存**：停止监控时自动保存数据

**数据保存位置**：\`我的文档/TASI直播数据/\`

---

## ⚙️ 应用设置

进入「应用设置」页面，可以配置以下内容：

- **账号设置** - 查看登录状态、切换账号、退出登录
- **浏览器设置** - 设置 Chrome/Edge 浏览器路径
- **更新设置** - 检查新版本、自动更新
- **其他设置** - 开机自启动、最小化到托盘

---

## ❓ 常见问题

**Q: 连接中控台失败怎么办？**
- 确保已安装 Chrome 或 Edge 浏览器
- 检查浏览器路径设置是否正确
- 尝试重启应用后重新连接

**Q: 自动回复没有生效？**
- 确认已点击「开始任务」按钮
- 检查监听来源设置是否正确
- 确认关键词规则配置正确

**Q: 数据导出失败？**
- 确认有数据可以导出
- 检查导出目录是否有写入权限
- 关闭已打开的同名 Excel 文件

**Q: 直播结束后功能自动停止了？**
- 这是正常行为，系统检测到直播结束后会自动停止所有任务
- 数据会自动保存，无需担心丢失

---

感谢您使用 TASI 直播超级工具，祝您直播顺利！ 🎉
`

interface UserGuideDialogProps {
  trigger?: React.ReactNode
  className?: string
}

export function UserGuideDialog({ trigger, className }: UserGuideDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
            <BookOpen className="h-3.5 w-3.5" />
            使用教程
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              使用教程
            </DialogTitle>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-table:my-2">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold text-foreground border-b pb-2 mb-4">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-foreground mt-6 mb-3 flex items-center gap-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-medium text-foreground mt-4 mb-2">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                hr: () => <hr className="my-4 border-border" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full text-sm border-collapse border border-border rounded-lg overflow-hidden">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                th: ({ children }) => (
                  <th className="border border-border px-3 py-2 text-left font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-3 py-2">{children}</td>
                ),
                code: ({ children }) => (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                    {children}
                  </code>
                ),
              }}
            >
              {USER_GUIDE_CONTENT}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
