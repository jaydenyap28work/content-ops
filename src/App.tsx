import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { RouteAccessGuard } from './features/auth/RouteAccessGuard'
import { AppShell } from './layouts/AppShell'
import { routeDefinitions } from './lib/navigation'
import { LoginPage } from './pages/LoginPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { ClientsPage } from './pages/ClientsPage'
import { TeamPage } from './pages/TeamPage'
import { ReferencesPage } from './pages/ReferencesPage'
import { IdeasPage } from './pages/IdeasPage'
import { IdeaDetailPage } from './pages/IdeaDetailPage'
import { ContentPage } from './pages/ContentPage'
import { ContentDetailPage } from './pages/ContentDetailPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { TeamReportsPage } from './pages/TeamReportsPage'
import { TasksPage } from './pages/TasksPage'
import { EquipmentProposalsPage } from './pages/EquipmentProposalsPage'
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
          <Route path="/admin-login" element={<AdminLoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              {routeDefinitions.map((route) => (
                <Route
                  key={route.path}
                  index={route.path === '/'}
                  path={route.path === '/' ? undefined : route.path.slice(1)}
                  element={<RouteAccessGuard path={route.path}>{route.path === '/' ? <DashboardPage /> : route.path === '/calendar' ? <CalendarPage /> : route.path === '/brand/lksoft' ? <BrandHubPage /> : route.path === '/settings' ? <SettingsPage /> : route.path === '/assets' ? <ResourcePage type="assets" /> : route.path === '/music' ? <ResourcePage type="music" /> : route.path === '/editing-playbook' ? <ResourcePage type="playbook" /> : route.path === '/clients' ? <ClientsPage /> : route.path === '/team' ? <TeamPage /> : route.path === '/references' ? <ReferencesPage /> : route.path === '/ideas' ? <IdeasPage /> : route.path === '/content' ? <ContentPage /> : route.path === '/analytics' ? <AnalyticsPage /> : route.path === '/team-reports' ? <TeamReportsPage /> : route.path === '/tasks' ? <TasksPage /> : route.path === '/equipment-proposals' ? <EquipmentProposalsPage /> : <PlaceholderPage route={route} />}</RouteAccessGuard>}
                />
              ))}
              <Route path="ideas/:ideaId" element={<RouteAccessGuard path="/ideas"><IdeaDetailPage /></RouteAccessGuard>} />
              <Route path="content/:contentId" element={<RouteAccessGuard path="/content"><ContentDetailPage /></RouteAccessGuard>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </I18nProvider>
  )
}
