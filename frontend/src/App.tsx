import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Library from './pages/Library'
import PlatformPage from './pages/PlatformPage'
import GameDetailPage from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Library />} />
        <Route path="platform/:platformId" element={<PlatformPage />} />
        <Route path="game/:gameId" element={<GameDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
