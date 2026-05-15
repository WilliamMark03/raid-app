# 游戏公会打本报名小程序 - 设计指南

## 品牌定位

- **应用定位**：游戏公会副本报名管理工具
- **设计风格**：活泼、清晰、高效
- **目标用户**：游戏公会成员、公会管理员

## 配色方案

### 主色板（游戏风格）

| 颜色名称 | Tailwind 类名 | 用途 |
|---------|--------------|------|
| 主色 | `bg-indigo-500` / `text-indigo-500` | 主要按钮、强调元素 |
| 主色深 | `bg-indigo-600` | 按钮悬停态 |
| 主色浅 | `bg-indigo-100` / `text-indigo-100` | 浅色背景、标签背景 |
| 辅助色 | `bg-emerald-500` / `text-emerald-500` | 成功状态、确认按钮 |
| 强调色 | `bg-amber-500` / `text-amber-500` | 警告、重要提示 |

### 中性色

| 颜色名称 | Tailwind 类名 | 用途 |
|---------|--------------|------|
| 深色文字 | `text-gray-900` | 标题、正文 |
| 次要文字 | `text-gray-500` | 说明文字、次要信息 |
| 浅色背景 | `bg-gray-50` | 页面背景 |
| 边框色 | `border-gray-200` | 分割线、边框 |

### 语义色

| 状态 | Tailwind 类名 |
|-----|--------------|
| 成功 | `text-emerald-600` / `bg-emerald-50` |
| 警告 | `text-amber-600` / `bg-amber-50` |
| 错误 | `text-red-600` / `bg-red-50` |
| 信息 | `text-blue-600` / `bg-blue-50` |

## 字体规范

- **页面标题**：`text-xl font-bold`
- **卡片标题**：`text-lg font-semibold`
- **正文**：`text-base`
- **辅助文字**：`text-sm text-gray-500`
- **标签**：`text-xs`

## 间距系统

- **页面边距**：`p-4`（16px）
- **卡片内边距**：`p-4`
- **组件间距**：`gap-3` / `gap-4`
- **列表项间距**：`gap-2`

## 组件使用原则

**通用 UI 组件优先来自 `@/components/ui/*`**

- **按钮**：使用 `@/components/ui/button` 的 Button
- **输入框**：使用 `@/components/ui/input` 的 Input
- **下拉选择**：使用 `@/components/ui/select` 的 Select
- **卡片**：使用 `@/components/ui/card` 的 Card、CardContent
- **标签**：使用 `@/components/ui/badge` 的 Badge
- **分割线**：使用 `@/components/ui/separator` 的 Separator
- **表单项**：使用 `@/components/ui/field` 的 Field
- **提示**：使用 `@/components/ui/toast` 的 toast
- **分组标签**：使用 `@/components/ui/tabs` 的 Tabs

## 容器样式

- **卡片圆角**：`rounded-xl`（12px）
- **按钮圆角**：`rounded-lg`（8px）
- **输入框圆角**：`rounded-lg`
- **卡片阴影**：`shadow-sm`

## 页面结构

### 首页（报名管理）

1. **顶部标题区**
   - 应用名称
   - 当前报名人数统计

2. **报名表单区**
   - ID 输入框
   - 流派选择（下拉）
   - 打本时间选择（日期+时段）
   - 提交按钮

3. **报名列表区**
   - 已报名成员列表
   - 每项显示：ID、流派、时间
   - 支持删除操作

4. **分组结果区**
   - 按时间自动分组
   - 每组最多10人
   - 显示组号、成员列表

## 流派选项（燕云十六声门派）

- 虹虹
- 影影
- 风风
- 尘尘
- 鸢鸢
- 威威
- 钧钧
- 玉玉
- 霖霖
- 翊翊
- 其它

## 时间选择

- 日期：选择具体日期
- 时段：
  - 上午 (9:00-12:00)
  - 下午 (14:00-18:00)
  - 晚上 (19:00-22:00)
  - 深夜 (22:00-次日2:00)

## 小程序约束

- 图片资源使用 TOS 对象存储
- 列表数据分页加载
- 避免大体积图片打包
- 注意表单输入体验
