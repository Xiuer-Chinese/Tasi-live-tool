import './lib/wdyr'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { ElectronErrorBoundary } from './components/common/ElectronErrorBoundary'
import { router } from './router'
import './index.css'

// 应用持久化主题，避免首屏闪烁
const stored = localStorage.getItem('theme')
if (stored === 'dark' || stored === 'light') {
  document.documentElement.dataset.theme = stored
} else {
  document.documentElement.dataset.theme = 'light'
}

ReactDOM.createRoot(document.getElementById('root') ?? document.createElement('div')).render(
  <React.StrictMode>
    <ElectronErrorBoundary>
      <RouterProvider router={router} />
    </ElectronErrorBoundary>
  </React.StrictMode>,
)

postMessage({ payload: 'removeLoading' }, '*')
