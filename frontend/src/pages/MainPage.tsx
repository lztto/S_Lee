import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../services/api'

interface Counselor {
  id: string
  name: string
  email: string
  created_at: string
}

const avatarColors = [
  { bg: '#F5EFE6', text: '#8B6F47' },
  { bg: '#EEF0F8', text: '#5B6BA0' },
  { bg: '#EFF5EE', text: '#4A7A55' },
  { bg: '#F5EEEE', text: '#8B4A4A' },
  { bg: '#F0EEF5', text: '#6B5B8B' },
]

const MainPage = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)

    const fetchCounselors = async () => {
      try {
        const res = await api.get('/counselors/')
        setCounselors(res.data.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchCounselors()
  }, [])

  const filtered = counselors.filter((c) => c.name.includes(search))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>

      {/* 네비게이션 */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 h-16"
        style={{
          background: 'rgba(250,248,245,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #EDE8E0',
        }}
      >
        <div className="cursor-pointer" onClick={() => navigate('/')}>
          <div className="font-medium tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontSize: '18px' }}>
            S<span style={{ color: '#C4A882' }}>.</span>LEE
          </div>
          <div className="tracking-widest uppercase" style={{ color: '#C4A882', fontSize: '9px' }}>
            Secret Counseling
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-sm px-2" style={{ color: '#9E8E84' }}>{user.name}님</span>
              
              {/* 상담사 전용 버튼 */}
              {user.role === 'counselor' && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-1.5 rounded-full text-sm transition-all hover:bg-gray-50"
                  style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
                >대시보드</button>
              )}

              {/* 🔥 추가된 관리자 전용 버튼 🔥 */}
              {user.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-1.5 rounded-full text-sm transition-all hover:bg-gray-50"
                  style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
                >관리자 페이지</button>
              )}

              <button
                onClick={() => navigate('/my-reservations')}
                className="px-4 py-1.5 rounded-full text-sm transition-all hover:bg-gray-50"
                style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
              >내 예약</button>
              <button
                onClick={handleLogout}
                className="px-4 py-1.5 rounded-full text-sm transition-all hover:opacity-90"
                style={{ background: '#2C2420', color: '#FAF8F5' }}
              >로그아웃</button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-1.5 rounded-full text-sm transition-all hover:bg-gray-50"
                style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
              >로그인</button>
              <button
                onClick={() => navigate('/signup')}
                className="px-4 py-1.5 rounded-full text-sm transition-all hover:opacity-90"
                style={{ background: '#2C2420', color: '#FAF8F5' }}
              >회원가입</button>
            </>
          )}
        </div>
      </nav>

      {/* 히어로 */}
      <div className="max-w-5xl mx-auto px-12 pt-40 pb-20">
        <p className="text-xs font-medium tracking-widest uppercase mb-6" style={{ color: '#C4A882' }}>
          ✦ 전문 심리 상담 플랫폼
        </p>
        <h1
          className="leading-tight mb-6"
          style={{
            fontFamily: "'Playfair Display', serif",
            color: '#2C2420',
            fontSize: 'clamp(36px, 5vw, 58px)',
            letterSpacing: '-1px',
            fontWeight: 400,
          }}
        >
          나에게 맞는<br />
          <em style={{ fontStyle: 'italic', color: '#C4A882' }}>상담사</em>를 찾아보세요
        </h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: '#9E8E84', fontWeight: 300, maxWidth: '360px' }}>
          검증된 전문 심리 상담사와 함께<br />더 나은 내일을 만들어보세요.
        </p>

        {/* 검색 */}
        <div
          className="flex items-center gap-3 px-5 h-12 rounded-xl"
          style={{ background: '#fff', border: '1px solid #EDE8E0', maxWidth: '420px' }}
        >
          <span style={{ color: '#C4A882', fontSize: '14px' }}>✦</span>
          <input
            className="flex-1 outline-none text-sm bg-transparent"
            style={{ color: '#2C2420' }}
            placeholder="상담사 이름으로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 구분선 */}
      <div className="max-w-5xl mx-auto px-12">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-xs tracking-widest uppercase font-medium" style={{ color: '#C4A882' }}>
            Our Counselors
          </span>
          <div className="flex-1 h-px" style={{ background: '#EDE8E0' }} />
          {!loading && <span className="text-xs" style={{ color: '#C4A882' }}>{filtered.length}명</span>}
        </div>
      </div>

      {/* 상담사 목록 */}
      <div className="max-w-5xl mx-auto px-12 pb-28">
        {loading ? (
          <div className="flex justify-center gap-2 py-20">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-2 h-2 rounded-full animate-bounce inline-block"
                style={{ background: '#DDD5C8', animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm font-light" style={{ color: '#C4A882' }}>검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((counselor, idx) => {
              const color = avatarColors[idx % avatarColors.length]
              return (
                <div
                  key={counselor.id}
                  onClick={() => navigate(`/reservation/${counselor.id}`)}
                  className="group rounded-2xl p-7 cursor-pointer transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
                  style={{
                    background: '#fff',
                    border: '1px solid #EDE8E0',
                    boxShadow: '0 2px 12px rgba(44,36,32,0.04)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 16px 48px rgba(44,36,32,0.10)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(44,36,32,0.04)')}
                >
                  {/* 상단 액센트 라인 */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                    style={{ background: 'linear-gradient(90deg, #C4A882, #D4B892)' }}
                  />

                  <div className="flex items-start justify-between mb-5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-semibold"
                      style={{ background: color.bg, color: color.text, fontFamily: "'Playfair Display', serif" }}
                    >
                      {counselor.name.charAt(0)}
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: '#F5F0E8', color: '#C4A882' }}
                    >
                      예약 가능
                    </span>
                  </div>

                  <p
                    className="mb-1 tracking-tight"
                    style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400, fontSize: '17px' }}
                  >
                    {counselor.name} 상담사
                  </p>
                  <p className="text-xs mb-5 font-light" style={{ color: '#C4A882' }}>
                    {counselor.email}
                  </p>

                  <div className="h-px mb-5" style={{ background: '#F5F0E8' }} />

                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#C4A882' }}>심리 · 코칭</span>
                    <button
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200"
                      style={{ background: '#2C2420', color: '#FAF8F5' }}
                    >
                      예약하기
                      <span className="group-hover:translate-x-0.5 inline-block transition-transform">→</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 푸터 */}
      <footer className="border-t py-10 text-center" style={{ borderColor: '#EDE8E0' }}>
        <p className="text-xs" style={{ color: '#C4A882' }}>© 2026 S.LEE — Secret Counseling</p>
      </footer>
    </div>
  )
}

export default MainPage