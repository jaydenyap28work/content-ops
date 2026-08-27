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
import { AnalyticsPage } from './pages/AnalyticsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { ResourcePage } from './pages/ResourcePage'
import { SettingsPage } from './pages/SettingsPage'
import { BrandHubPage } from './pages/BrandHubPage'
import { I18nProvider } from './features/i18n/i18n'

export default function App() {
  return (
    <I18nProvider>
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
                  element={route.path === '/' ? <DashboardPage /> : route.path === '/calendar' ? <CalendarPage /> : route.path === '/brand/lksoft' ? <BrandHubPage /> : route.path === '/settings' ? <SettingsPage /> : route.path === '/assets' ? <ResourcePage type="assets" /> : route.path === '/music' ? <ResourcePage type="music" /> : route.path === '/editing-playbook' ? <ResourcePage type="playbook" /> : route.path === '/clients' ? <ClientsPage /> : route.path === '/team' ? <TeamPage /> : route.path === '/references' ? <ReferencesPage /> : route.path === '/ideas' ? <IdeasPage /> : route.path === '/content' ? <ContentPage /> : route.path === '/analytics' ? <AnalyticsPage /> : <PlaceholderPage route={route} />}
                />
              ))}
              <Route path="content/:contentId" element={<ContentDetailPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </I18nProvider>
  )
}
