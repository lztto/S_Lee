import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'

import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MainPage from './pages/MainPage'
import ReservationPage from './pages/ReservationPage'
import CounselorDashboard from './pages/CounselorDashboard'
import JournalPage from './pages/JournalPage'
import AdminPage from './pages/AdminPage'
import MyReservationsPage from './pages/MyReservationsPage'

// ─── 인증이 필요한 라우터 ───
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuthStore()
  return token ? <>{children}</> : <Navigate to="/login" />
}

// ─── 상담사만 접근 가능한 라우터 ───
const CounselorRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" />
  if (user.role !== 'counselor' && user.role !== 'admin') return <Navigate to="/" />
  return <>{children}</>
}

// ─── 관리자만 접근 가능한 라우터 ───
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" />
  if (user.role !== 'admin') return <Navigate to="/" />
  return <>{children}</>
}

// ─── 내담자만 접근 가능한 라우터 (상담사는 접근 불가) ───
const ClientRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, token } = useAuthStore()
  if (!token) return <Navigate to="/login" />
  if (user?.role === 'counselor') return <Navigate to="/dashboard" />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 라우터 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* 메인 페이지 - 누구나 접근 가능 */}
        <Route path="/" element={<MainPage />} />

        {/* 예약 페이지 - 누구나 접근 가능 (로그인은 예약 확정 시 요구) */}
        <Route path="/reservation/:counselorId" element={<ReservationPage />} />

        {/* 내담자 전용 */}
        <Route path="/my-reservations" element={
          <ClientRoute><MyReservationsPage /></ClientRoute>
        } />

        {/* 로그인 필요 */}
        <Route path="/journal/:reservationId" element={
          <PrivateRoute><JournalPage /></PrivateRoute>
        } />

        {/* 상담사 전용 */}
        <Route path="/dashboard" element={
          <CounselorRoute><CounselorDashboard /></CounselorRoute>
        } />

        {/* 관리자 전용 */}
        <Route path="/admin" element={
          <AdminRoute><AdminPage /></AdminRoute>
        } />

        {/* 없는 페이지 → 메인으로 */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App