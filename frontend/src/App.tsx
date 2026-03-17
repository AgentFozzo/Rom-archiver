import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Library from './pages/Library'
import PlatformPage from './pages/PlatformPage'
import GameDetailPage from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'
import DownloadsPage from './pages/DownloadsPage'
import CollectionsPage from './pages/CollectionsPage'
import SystemFilesPage from './pages/SystemFilesPage'
import GameGrid from './components/GameGrid'

function FavoritesPage() {
  return <GameGrid title="Favorites" favoritesOnly={true} />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Library />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="system-files" element={<SystemFilesPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="platform/:platformId" element={<PlatformPage />} />
        <Route path="game/:gameId" element={<GameDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
