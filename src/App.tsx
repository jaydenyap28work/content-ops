import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { AppShell } from './layouts/AppShell'
import { routeDefinitions } from './lib/navigation'
import { LoginPage } from './pages/LoginPage'
import { ClientsPage } from './pages/ClientsPage'
import { TeamPage } from './pages/TeamPage'
import { ReferencesPage } from './pages/ReferencesPage'
import { IdeasPage } from './pages/IdeasPage'
import { ContentPage } from './pages/ContentPage'
import { ContentDetailPage } from './pages/ContentDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              {routeDefinitions.map((route) => (
                <Route
                  key={route.path}
                  index={route.path === '/'}
                  path={route.path === '/' ? undefined : route.path.slice(1)}
                  element={route.path === '/clients' ? <ClientsPage /> : route.path === '/team' ? <TeamPage /> : route.path === '/references' ? <ReferencesPage /> : route.path === '/ideas' ? <IdeasPage /> : route.path === '/content' ? <ContentPage /> : <PlaceholderPage route={route} />}
                />
              ))}
              <Route path="content/:contentId" element={<ContentDetailPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
