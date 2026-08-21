import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { routeDefinitions } from './lib/navigation'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {routeDefinitions.map((route) => (
            <Route
              key={route.path}
              index={route.path === '/'}
              path={route.path === '/' ? undefined : route.path.slice(1)}
              element={<PlaceholderPage route={route} />}
            />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
