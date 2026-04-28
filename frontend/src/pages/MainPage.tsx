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
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
  'bg-violet-100 text-violet-800',
  'bg-sky-100 text-sky-800',
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

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>

      {/* 네비게이션 */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-10 h-16"
        style={{ background: 'rgba(250,248,245,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE8E0' }}>
        <span
          onClick={() => navigate('/')}
          className="cursor-pointer text-lg tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420' }}
        >
          마음<span style={{ color: '#C4A882' }}>.</span>예약
        </span>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-sm px-2" style={{ color: '#9E8E84' }}>{user.name}님</span>
              {user.role === 'counselor' && (
                <button onClick={() => navigate('/dashboard')}
                  className="px-4 py-1.5 rounded-full text-sm transition-all"
                  style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#2C2420')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#DDD5C8')}
                >대시보드</button>
              )}
              <button onClick={() => navigate('/my-reservations')}
                className="px-4 py-1.5 rounded-full text-sm transition-all"
                style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
              >내 예약</button>
              <button onClick={() => { logout(); navigate('/login') }}
                className="px-4 py-1.5 rounded-full text-sm"
                style={{ background: '#2C2420', color: '#FAF8F5' }}
              >로그아웃</button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/login')}
                className="px-4 py-1.5 rounded-full text-sm"
                style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
              >로그인</button>
              <button onClick={() => navigate('/signup')}
                className="px-4 py-1.5 rounded-full text-sm"
                style={{ background: '#2C2420', color: '#FAF8F5' }}
              >시작하기</button>
            </>
          )}
        </div>
      </nav>

      {/* 히어로 */}
      <div className="max-w-5xl mx-auto px-10 pt-40 pb-20">
        <p className="text-xs font-medium tracking-widest uppercase mb-6" style={{ color: '#C4A882' }}>
          Private Counseling Platform
        </p>
        <h1 className="text-5xl leading-tight mb-6" style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', letterSpacing: '-1px', fontWeight: 400 }}>
          지금 이 순간,<br />
          당신 곁의 <em style={{ fontStyle: 'italic', color: '#C4A882' }}>상담사</em>를<br />
          찾아보세요
        </h1>
        <p className="text-base leading-relaxed mb-10 max-w-xs" style={{ color: '#9E8E84', fontWeight: 300 }}>
          편안한 공간에서 마음을 나눌<br />전문 심리 상담사를 연결해드립니다.
        </p>

        {/* 검색 */}
        <div className="flex items-center gap-3 px-5 h-12 rounded-xl max-w-sm"
          style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
          <span style={{ color: '#C4A882' }}>✦</span>
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
      <div className="max-w-5xl mx-auto px-10">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-xs tracking-widest uppercase" style={{ color: '#C4A882' }}>Our Counselors</span>
          <div className="flex-1 h-px" style={{ background: '#EDE8E0' }} />
          {!loading && <span className="text-xs" style={{ color: '#C4A882' }}>{filtered.length}명</span>}
        </div>
      </div>

      {/* 상담사 목록 */}
      <div className="max-w-5xl mx-auto px-10 pb-28">
        {loading ? (
          <div className="flex justify-center gap-2 py-20">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full animate-bounce inline-block"
                style={{ background: '#DDD5C8', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: '#C4A882' }}>검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((counselor, idx) => (
              <div
                key={counselor.id}
                onClick={() => navigate(`/reservation/${counselor.id}`)}
                className="group rounded-2xl p-7 cursor-pointer transition-all duration-300 hover:-translate-y-1"
                style={{ background: '#fff', border: '1px solid #EDE8E0', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 12px 40px rgba(44,36,32,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.03)')}
              >
                {/* 상단 */}
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-semibold ${avatarColors[idx % avatarColors.length]}`}
                    style={{ fontFamily: "'Playfair Display', serif" }}>
                    {counselor.name.charAt(0)}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#F5F0E8', color: '#C4A882' }}>
                    예약 가능
                  </span>
                </div>

                {/* 정보 */}
                <p className="text-lg mb-1 tracking-tight" style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
                  {counselor.name} 상담사
                </p>
                <p className="text-xs mb-5" style={{ color: '#C4A882' }}>{counselor.email}</p>

                <div className="h-px mb-5" style={{ background: '#F5F0E8' }} />

                {/* 하단 */}
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
            ))}
          </div>
        )}
      </div>

      {/* 푸터 */}
      <footer className="border-t py-10 text-center" style={{ borderColor: '#EDE8E0' }}>
        <p className="text-xs" style={{ color: '#C4A882' }}>마음.예약 — Private Counseling Platform</p>
      </footer>
    </div>
  )
}

export default MainPage