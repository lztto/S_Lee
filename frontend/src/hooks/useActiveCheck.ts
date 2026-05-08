import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../services/api'

export function useActiveCheck() {
  const { user, token, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user || !token) return

    const check = async () => {
      try {
        const res = await api.get('/auth/me')
        // 명시적으로 is_active가 false일 때만 로그아웃
        if (res.data.data.is_active === false) {
          logout()
          alert('계정이 비활성화되었습니다. 관리자에게 문의하세요.')
          navigate('/login')
        }
      } catch (error: any) {
        // 403 비활성화 에러일 때만 로그아웃
        if (error.response?.status === 403 &&
            error.response?.data?.detail === '비활성화된 계정입니다') {
          logout()
          alert('계정이 비활성화되었습니다. 관리자에게 문의하세요.')
          navigate('/login')
        }
        // 그 외 에러(네트워크 등)는 무시
      }
    }

    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [user, token])
}