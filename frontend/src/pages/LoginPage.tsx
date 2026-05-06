import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../services/api'

const LoginPage = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.post('/auth/login', { email, password })
      const { access_token, user } = res.data.data

      setAuth(user, access_token)

      // 역할에 따라 다른 페이지로 이동
      if (user.role === 'counselor') navigate('/dashboard')
      else navigate('/') // 관리자(admin)와 내담자(client)는 모두 메인 화면으로 이동

    } catch (err: any) {
      setError(err.response?.data?.detail || '로그인에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* 왼쪽 - 브랜딩 */}
      <div
        className="hidden lg:flex flex-col justify-between p-16 w-2/5"
        style={{ background: '#F0EBE3' }}
      >
        <div
          className="cursor-pointer"
          onClick={() => navigate('/')}
        >
          <div className="text-2xl font-medium tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420' }}>
            S<span style={{ color: '#C4A882' }}>.</span>LEE
          </div>
          <div className="text-xs tracking-widest uppercase mt-0.5" style={{ color: '#C4A882' }}>
            Secret Counseling
          </div>
        </div>

        <div>
          <p className="text-4xl leading-snug mb-6"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
            "마음을 나누는<br />
            <em style={{ fontStyle: 'italic', color: '#C4A882' }}>첫 걸음</em>을<br />
            함께합니다"
          </p>
          <p className="text-sm font-light" style={{ color: '#9E8E84' }}>
            전문 심리 상담사와 함께<br />더 나은 내일을 만들어보세요.
          </p>
        </div>

        <p className="text-xs" style={{ color: '#C4A882' }}>
          © 2026 S.LEE Secret Counseling
        </p>
      </div>

      {/* 오른쪽 - 로그인 폼 */}
      <div className="flex-1 flex flex-col justify-center items-center px-8">
        <div className="w-full max-w-sm">

          {/* 모바일 로고 */}
          <div
            className="lg:hidden mb-10 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="text-xl font-medium tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420' }}>
              S<span style={{ color: '#C4A882' }}>.</span>LEE
            </div>
            <div className="text-xs tracking-widest uppercase mt-0.5" style={{ color: '#C4A882' }}>
              Secret Counseling
            </div>
          </div>

          <h2 className="text-2xl mb-1 tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
            다시 오셨군요
          </h2>
          <p className="text-sm mb-8 font-light" style={{ color: '#9E8E84' }}>
            계정에 로그인하세요
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">

            {/* 이메일 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B5B4E' }}>
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                required
                className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: '#fff',
                  border: '1px solid #EDE8E0',
                  color: '#2C2420',
                }}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B5B4E' }}>
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: '#fff',
                  border: '1px solid #EDE8E0',
                  color: '#2C2420',
                }}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <p className="text-xs px-3 py-2 rounded-lg"
                style={{ background: '#FEF2F2', color: '#DC2626' }}>
                {error}
              </p>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-medium transition-all mt-1"
              style={{
                background: loading ? '#9E8E84' : '#2C2420',
                color: '#FAF8F5',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 구분선 */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: '#EDE8E0' }} />
            <span className="text-xs" style={{ color: '#C4A882' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#EDE8E0' }} />
          </div>

          {/* 회원가입 링크 */}
          <p className="text-center text-sm" style={{ color: '#9E8E84' }}>
            아직 계정이 없으신가요?{' '}
            <Link
              to="/signup"
              className="font-medium transition-colors"
              style={{ color: '#2C2420' }}
            >
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage