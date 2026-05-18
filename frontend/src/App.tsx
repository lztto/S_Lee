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
import { useActiveCheck } from './hooks/useActiveCheck'

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

// BrowserRouter 안에서 훅 실행하는 내부 컴포넌트.
function AppInner() {
  useActiveCheck()
  return (
    <Routes>
      {/* 공개 라우터 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* 메인 페이지 - 누구나 접근 가능 */}
      <Route path="/" element={<MainPage />} />

      {/* 로그인 필요 */}
      <Route path="/reservation/:counselorId" element={<ReservationPage />} />
      
      <Route path="/my-reservations" element={
        <PrivateRoute><MyReservationsPage /></PrivateRoute>
      } />
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
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}

export default App