import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RequireAuth } from '@/components/RequireAuth'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth'
import { AuditPage } from '@/pages/audit'
import { FleetPage } from '@/pages/fleet'
import { LoginPage } from '@/pages/login'
import { ReportsPage } from '@/pages/reports'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<FleetPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="audit" element={<AuditPage />} />
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
