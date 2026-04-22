# MindFlow UI Design Guidelines

> 状态：已更新 — 应用 "Digital Atelier" 设计系统
> 适用范围：`frontend/src/` 全部页面与组件
> 最后更新：2026-04-10

---

## 1. 设计系统：Digital Atelier

MindFlow 采用 **"Digital Atelier"** 设计系统，融合编辑感与功能性。

### 核心视觉语言

| 元素 | 规范 |
|------|------|
| **主色调** | `#0d4656` (深青色) |
| **背景色** | `#f9f9f7` (暖白) |
| **卡片色** | `#f4f4f2` (浅灰) |
| **强调色** | `#5d3813` (棕色) |
| **标题字体** | Newsreader (衬线体) |
| **正文字体** | Manrope (无衬线) |
| **图标库** | Material Symbols Outlined |

### 色彩系统

```css
/* 主色系 */
--color-primary: #0d4656;
--color-primary-container: #2c5e6e;

/* 表面层次 */
--color-surface-container-low: #f4f4f2;
--color-surface-container-high: #e8e8e6;
--color-surface-container-highest: #e2e3e1;

/* 功能色 */
--color-tertiary: #5d3813;
--color-tertiary-container: #784f28;
--color-error: #ba1a1a;
```

---

## 2. 产品定位

MindFlow 是一个面向个人私有化部署的 AI 简报工作台：

- 抓取用户选择的信息源
- 提炼有判断力的锚点内容
- 结合兴趣权重生成每日简报
- 通过显式与隐式反馈持续学习用户偏好

**MindFlow 应该像一份由私人编辑为你整理的每日世界观察，而不是一个拥挤的信息管理后台。**

---

## 3. 设计总原则

### 3.1 North Star

**Editorial Workbench** — 编辑工作台

关键词：编辑感、纸感、冷静、可信、有判断力、轻工具感

### 3.2 体验优先级

1. 阅读沉浸感
2. 信息层次清晰
3. 操作可信且克制
4. 个性化逻辑可感知
5. 管理能力完整

---

## 4. 布局结构

### 全站布局

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (固定)  │      Main Content Area          │
│  - Logo          │  ┌─────────────────────────┐   │
│  - Navigation    │  │     TopNav (粘性)       │   │
│  - New Insight   │  ├─────────────────────────┤   │
│  - User Profile  │  │                         │   │
│                  │  │     Page Content        │   │
│                  │  │                         │   │
│                  │  └─────────────────────────┘   │
│                  │                               │
│  Mobile: BottomNav (固定底部)                       │
└─────────────────────────────────────────────────────┘
```

### 响应式断点

- **Desktop** (≥1024px): 左侧固定 Sidebar + 主内容
- **Mobile** (<1024px): 底部固定 Navigation

---

## 5. 页面风格

### 5.1 简报页 `Newsletter`

页面结构：
- **Hero Header**: 日期、标题 "The Morning Briefing"、导语
- **Main Channel**: 主要洞察文章，带辩证分析展开
- **Exploration Zone**: 3列卡片网格
- **Surprise Box**: 强调色背景的惊喜内容区

关键组件：
- `InsightCard` — 洞察卡片，含辩证分析展开
- 日期选择器

### 5.2 兴趣页 `InterestSettings`

页面结构：
- **Bento Grid**: 左侧统计 + 右侧兴趣卡片
- **Active Interests**: 强度进度条展示
- **Emergent Patterns**: AI 推荐的潜在兴趣

关键组件：
- 兴趣强度进度条
- 冻结/解冻状态

### 5.3 新闻源页 `Sources`

页面结构：
- **Status Overview**: 健康链接数、延迟、关键问题
- **Sources Table**: 类型徽章、状态指示器
- **Quick Add**: 快速添加表单

### 5.4 设置页 `Settings`

页面结构：
- **Two-Column Layout**: 左侧配置表单 + 右侧状态卡片
- **System Vitality**: 内存使用、处理队列
- **Surprise Discovery**: AI 优化建议

---

## 6. 组件规范

### 导航组件

| 组件 | 用途 | 位置 |
|------|------|------|
| `Sidebar` | 主导航 | Desktop 左侧固定 |
| `TopNav` | 粘性顶栏 | 主内容区顶部 |
| `MobileNav` | 底部导航 | Mobile 底部固定 |

### 内容组件

| 组件 | 用途 |
|------|------|
| `InsightCard` | 洞察展示卡片，含辩证分析 |
| `InterestTagItem` | 兴趣标签项，含强度条 |

### 通用样式

```css
/* 卡片 */
.card {
  background: var(--color-surface-container-low);
  border-radius: 0.5rem;
}

/* 按钮 */
.btn-primary {
  background: linear-gradient(135deg, #0d4656, #2c5e6e);
  color: white;
}

/* 进度条 */
.progress-bar {
  background: var(--color-surface-container-highest);
}
.progress-bar-fill {
  background: var(--color-primary);
}
```

---

## 7. 动效原则

- 页面进入：fade + upward reveal
- 卡片 hover：背景色加深
- 导航 hover：translateX(4px)
- 图片 hover：grayscale → full color

---

## 8. 图标使用

使用 Material Symbols Outlined：

```html
<span class="material-symbols-outlined">auto_awesome</span>
<span class="material-symbols-outlined">label_important</span>
<span class="material-symbols-outlined">rss_feed</span>
<span class="material-symbols-outlined">settings_suggest</span>
```

---

## 9. 项目结构

```
frontend/src/
├── components/
│   ├── Sidebar.tsx          # 左侧导航栏
│   ├── TopNav.tsx           # 顶部导航
│   ├── MobileNav.tsx        # 移动端底部导航
│   ├── InsightCard.tsx       # 洞察卡片
│   └── InterestTagItem.tsx   # 兴趣标签项
├── pages/
│   ├── Newsletter.tsx        # 简报首页
│   ├── InterestSettings.tsx  # 兴趣管理
│   ├── Sources.tsx           # 新闻源管理
│   └── Settings.tsx          # 系统设置
├── styles/
│   └── tokens.css           # 设计令牌
└── index.css               # 全局样式
```
