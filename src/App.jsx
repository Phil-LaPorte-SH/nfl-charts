import { lazy, Suspense } from 'react'
import { useHashRoute } from './useHashRoute.js'
import DebugPage from './ui/DebugPage.jsx'

const ChatPage = lazy(() => import('./ui/ChatPage.jsx'))
const GalleryPage = lazy(() => import('./ui/GalleryPage.jsx'))
const EvalPage = lazy(() => import('./eval/EvalPage.jsx'))

export default function App() {
  const route = useHashRoute()
  let page
  if (route.startsWith('/debug')) page = <DebugPage />
  else if (route.startsWith('/dev/gallery')) page = <GalleryPage />
  else if (route.startsWith('/dev/eval')) page = <EvalPage />
  else page = <ChatPage />
  return <Suspense fallback={<div className="page-loading">Loading…</div>}>{page}</Suspense>
}
