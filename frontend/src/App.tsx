import { Navigate, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Library from './pages/Library'
import PlatformPage from './pages/PlatformPage'
import GameDetailPage from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'
import DownloadsPage from './pages/DownloadsPage'
import CollectionsPage from './pages/CollectionsPage'
import SystemFilesPage from './pages/SystemFilesPage'
import LoginPage from './pages/LoginPage'
import GameGrid from './components/GameGrid'
import { useAuth } from './context/AuthContext'

function FavoritesPage() {
  return <GameGrid title="Favorites" favoritesOnly={true} />
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
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
