import axios from 'axios'
import { useAuthStore } from '../store/auth'

// ─── Axios 인스턴스 생성 ───
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── 요청 인터셉터 ───
// 모든 요청에 JWT 토큰 자동 추가
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── 응답 인터셉터 ───
// 401: 토큰 만료 → 자동 로그아웃 (단, /auth/me는 useActiveCheck에서 직접 처리)
// 403 + 비활성화: 강제 로그아웃
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url ?? ''

    // 401 자동 로그아웃: auth/me, reservations 등 인증 확인 요청은 제외
    // 토스 리다이렉트 후 일시적 401로 로그아웃되는 문제 방지
    const isAuthCheck = url.includes('/auth/me')
    const isPaymentCallback = window.location.search.includes('paymentKey') ||
                              window.location.search.includes('paymentFailed')

    if (status === 401 && !isAuthCheck && !isPaymentCallback) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api