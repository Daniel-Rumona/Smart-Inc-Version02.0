import { Route, Routes } from 'react-router-dom'
import { appRoutes, publicRoutes } from '@/config/routes'
import { SystemLayout } from '@/layouts/SystemLayout'
import { NotFoundPage } from '@/pages/system/NotFoundPage'
import type { AppRoute } from '@/types/routes'
import type { ReactElement } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const renderRoutes = (routes: AppRoute[]): ReactElement[] =>
  routes.flatMap((route) => [
    <Route key={route.path} path={route.path} element={<ProtectedRoute route={route} />} />,
    ...(route.children ? renderRoutes(route.children) : []),
  ])

function App() {
  return (
    <Routes>
      {publicRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={<route.element />} />
      ))}
      <Route element={<SystemLayout />}>
        {renderRoutes(appRoutes)}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
