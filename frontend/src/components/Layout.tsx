import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import BottomBar from './BottomBar'

export default function Layout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-steam-bg">
      {/* Top navigation bar */}
      <TopNav />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - game list */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-steam-surface to-steam-bg">
          <Outlet />
        </main>
      </div>

      {/* Bottom download bar */}
      <BottomBar />
    </div>
  )
}
