/**
 * Live Studio Toolkit Design System Tokens
 *
 * 设计系统令牌 - 统一管理所有视觉设计常量
 * 使用说明：
 * 1. 导入需要的令牌：import { designTokens } from '@/styles/design-tokens'
 * 2. 使用 Tailwind 类名：优先使用 Tailwind 工具类
 * 3. 仅在需要动态值时使用令牌对象
 */

export const designTokens = {
  /**
   * 颜色系统 (Color System)
   */
  colors: {
    primary: {
      DEFAULT: 'hsl(20, 90%, 48%)',
      hover: 'hsl(20, 90%, 45%)',
      light: 'hsl(20, 80%, 94%)',
      dark: 'hsl(20, 70%, 30%)',
    },
    semantic: {
      success: 'hsl(142, 71%, 45%)',
      warning: 'hsl(38, 92%, 50%)',
      error: 'hsl(0, 78%, 56%)',
      info: 'hsl(217, 91%, 60%)',
    },
    neutral: {
      background: 'hsl(210, 40%, 98%)',
      card: 'hsl(0, 0%, 100%)',
      muted: 'hsl(210, 35%, 94%)',
      foreground: 'hsl(222, 30%, 12%)',
      mutedForeground: 'hsl(220, 12%, 40%)',
      disabled: 'hsl(220, 12%, 60%)',
      border: 'hsl(214, 20%, 88%)',
      borderLight: 'hsl(214, 20%, 92%)',
    },
  },

  /**
   * 字体系统 (Typography)
   */
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    headings: {
      h1: 'text-3xl font-bold tracking-tight',
      h2: 'text-2xl font-semibold tracking-tight',
      h3: 'text-xl font-semibold',
      h4: 'text-lg font-semibold',
    },
    body: {
      large: 'text-base font-normal',
      default: 'text-sm font-normal',
      small: 'text-xs font-normal',
    },
    special: {
      caption: 'text-xs font-medium text-muted-foreground',
      label: 'text-sm font-medium',
    },
    lineHeight: {
      tight: 'leading-tight',
      normal: 'leading-normal',
      relaxed: 'leading-relaxed',
    },
  },

  /**
   * 间距系统 (Spacing)
   */
  spacing: {
    container: {
      padding: 'p-6',
      paddingX: 'px-6',
      paddingY: 'py-8',
    },
    section: {
      gap: 'space-y-6',
      gapSmall: 'space-y-4',
      gapLarge: 'space-y-8',
    },
    form: {
      fieldGap: 'space-y-4',
      labelInputGap: 'space-y-1.5',
      inputHeight: 'h-10',
      inputHeightLarge: 'h-11',
    },
    button: {
      height: 'h-10',
      heightLarge: 'h-11',
      padding: 'px-4 py-2',
      gap: 'gap-2',
    },
  },

  /**
   * 圆角系统 (Border Radius)
   */
  borderRadius: {
    none: 'rounded-none',
    small: 'rounded-md',
    medium: 'rounded-lg',
    large: 'rounded-xl',
    xlarge: 'rounded-2xl',
    full: 'rounded-full',
    component: {
      button: 'rounded-lg',
      input: 'rounded-md',
      inputLarge: 'rounded-xl',
      card: 'rounded-xl',
      cardLarge: 'rounded-2xl',
      modal: 'rounded-2xl',
      badge: 'rounded-full',
    },
  },

  /**
   * 阴影系统 (Shadow)
   */
  shadow: {
    none: 'shadow-none',
    xs: 'shadow-xs',
    sm: 'shadow-sm',
    md: 'shadow-md shadow-primary/15',
    lg: 'shadow-lg shadow-primary/25',
    xl: 'shadow-xl shadow-primary/30',
    component: {
      button: 'shadow-md shadow-primary/15',
      buttonHover: 'shadow-lg shadow-primary/25',
      card: 'shadow-sm',
      modal: 'shadow-xl',
      inputFocus: 'ring-2 ring-primary/20',
    },
  },

  /**
   * 过渡动画 (Transitions)
   */
  transitions: {
    fast: 'transition-all duration-150',
    normal: 'transition-all duration-200',
    slow: 'transition-all duration-300',
    default: 'transition-all',
  },

  /**
   * 组件尺寸 (Component Sizes)
   */
  sizes: {
    button: {
      sm: 'h-8 px-3 text-xs',
      default: 'h-10 px-4 text-sm',
      lg: 'h-11 px-8 text-base',
      icon: 'h-10 w-10',
    },
    input: {
      default: 'h-10',
      large: 'h-11',
    },
    modal: {
      small: 'max-w-sm',
      medium: 'max-w-md',
      large: 'max-w-lg',
      xlarge: 'max-w-xl',
      auth: 'max-w-[420px]',
    },
    layout: {
      header: 'h-16',
      sidebar: 'w-64',
      containerPadding: 'px-6',
      pagePadding: 'py-8',
    },
  },

  /**
   * 主题配置 (Theme Configuration)
   */
  theme: {
    light: {
      header: 'bg-gradient-to-r from-orange-50 via-white to-amber-50',
      sidebar: 'bg-gradient-to-b from-orange-50 via-white to-amber-50',
      modal: 'bg-white',
      backdrop: 'bg-black/40 backdrop-blur-sm',
    },
    dark: {
      header: 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900',
      sidebar: 'bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900',
      modal: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
      backdrop: 'bg-black/60 backdrop-blur-sm',
    },
  },
} as const

/**
 * Tailwind 类名组合 (常用组合)
 */
export const designTokensClasses = {
  /**
   * 按钮样式组合
   */
  button: {
    primary:
      'bg-primary text-primary-foreground shadow-md shadow-primary/15 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 rounded-lg transition-all',
    destructive:
      'bg-destructive text-destructive-foreground shadow-md shadow-destructive/15 hover:bg-destructive/90 rounded-lg transition-all',
    outline:
      'border border-input bg-background shadow-sm hover:border-primary/40 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all',
    ghost: 'hover:bg-accent hover:text-accent-foreground transition-all',
  },

  /**
   * 输入框样式组合
   */
  input: {
    default:
      'h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring',
    large:
      'h-11 rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring',
  },

  /**
   * 卡片样式组合
   */
  card: {
    default: 'bg-card rounded-xl shadow-sm border border-border',
    elevated: 'bg-card rounded-xl shadow-md border border-border',
  },

  /**
   * 模态框样式组合
   */
  modal: {
    backdrop:
      'fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4',
    container: 'w-full max-w-[420px] bg-white rounded-2xl shadow-xl p-6',
  },
} as const
