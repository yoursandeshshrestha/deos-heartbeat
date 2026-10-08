import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RequireAuth, RequireRole } from '@/components/RequireAuth'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth'
import { AuditPage } from '@/pages/audit'
import { FleetPage } from '@/pages/fleet'
import { EngagementPage } from '@/pages/engagement'
import { FleetMapPage } from '@/pages/fleet-map'
import { VanPage, VansPage } from '@/pages/vans'
import { LoginPage } from '@/pages/login'
import { TicketsPage } from '@/pages/tickets'
import { ReportHistoryPage } from '@/pages/report-history'
import { ReportsPage } from '@/pages/reports'
import { UsersPage } from '@/pages/users'

function VanHistoryRedirect() {
  const { instance = '' } = useParams()
  return <Navigate to={`/vans/${encodeURIComponent(instance)}`} replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<FleetPage />} />
              <Route path="fleet-map" element={<FleetMapPage />} />
              <Route path="insights/van/:instance" element={<VanHistoryRedirect />} />
              <Route path="vans" element={<VansPage />} />
              <Route path="vans/:instance" element={<VanPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="engagement" element={<EngagementPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="report-history" element={<ReportHistoryPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route element={<RequireRole allow={['admin']} />}>
                <Route path="users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  )
}

export default App
