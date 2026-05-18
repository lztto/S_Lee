import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../services/api'

interface Counselor {
  id: string
  name: string
  email: string
  created_at: string
  profile_image: string | null
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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
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
        {/* 로고 */}
        <div className="cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
          <div className="font-medium tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontSize: '18px' }}>
            S<span style={{ color: '#C4A882' }}>.</span>LEE
          </div>
          <div className="tracking-widest uppercase" style={{ color: '#C4A882', fontSize: '9px' }}>
            Secret Counseling
          </div>
        </div>

        {/* 중앙 메뉴 */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: '소개', id: 'about' },
            { label: '상담 안내', id: 'guide' },
            { label: '상담사 소개', id: 'counselors' },
            { label: '오시는 길', id: 'location' },
          ].map((menu) => (
            <button
              key={menu.id}
              onClick={() => scrollTo(menu.id)}
              className="text-sm transition-all"
              style={{ color: '#6B5B4E', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.color = '#C4A882'}
              onMouseLeave={e => e.currentTarget.style.color = '#6B5B4E'}
            >
              {menu.label}
            </button>
          ))}
        </div>

        {/* 우측 유저 버튼 */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-sm px-2" style={{ color: '#9E8E84' }}>{user.name}님</span>

              {/* 상담사 전용 */}
              {user.role === 'counselor' && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-1.5 rounded-full text-sm transition-all"
                  style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
                >대시보드</button>
              )}

              {/* 관리자 전용 */}
              {user.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-1.5 rounded-full text-sm transition-all"
                  style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
                >관리자</button>
              )}

              {/* 내담자만 내 예약 버튼 표시 */}
              {user.role === 'client' && (
                <button
                  onClick={() => navigate('/my-reservations')}
                  className="px-4 py-1.5 rounded-full text-sm transition-all hover:bg-gray-50"
                  style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
                >내 예약</button>
              )}

              <button
                onClick={handleLogout}
                className="px-4 py-1.5 rounded-full text-sm transition-all"
                style={{ background: '#2C2420', color: '#FAF8F5' }}
              >로그아웃</button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-1.5 rounded-full text-sm transition-all"
                style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}
              >로그인</button>
              <button
                onClick={() => navigate('/signup')}
                className="px-4 py-1.5 rounded-full text-sm transition-all"
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
                  className="group rounded-2xl cursor-pointer transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
                  style={{
                    background: '#fff',
                    border: '1px solid #EDE8E0',
                    boxShadow: '0 2px 12px rgba(44,36,32,0.04)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 16px 48px rgba(44,36,32,0.10)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(44,36,32,0.04)')}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                    style={{ background: 'linear-gradient(90deg, #C4A882, #D4B892)' }}
                  />

                  {/* 카드 내용 */}
                  <div className="p-7">
                    {/* 프로필 이미지 - 원형 */}
                    <div className="flex flex-col items-center text-center mb-5">
                      {counselor.profile_image ? (
                        <div className="w-24 h-24 rounded-full overflow-hidden mb-4"
                          style={{ border: '3px solid #F5F0E8' }}>
                          <img
                            src={counselor.profile_image}
                            alt={counselor.name}
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              const parent = e.currentTarget.parentElement!
                              parent.style.background = color.bg
                              parent.style.display = 'flex'
                              parent.style.alignItems = 'center'
                              parent.style.justifyContent = 'center'
                              parent.innerHTML = `<span style="color:${color.text};font-size:32px;font-family:Playfair Display,serif;font-weight:600">${counselor.name.charAt(0)}</span>`
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-semibold mb-4"
                          style={{ background: color.bg, color: color.text, fontFamily: "'Playfair Display', serif", border: '3px solid #F5F0E8' }}
                        >
                          {counselor.name.charAt(0)}
                        </div>
                      )}

                      <p
                        className="tracking-tight mb-1"
                        style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400, fontSize: '17px' }}
                      >
                        {counselor.name} 상담사
                      </p>
                      <p className="text-xs font-light" style={{ color: '#C4A882' }}>
                        심리 · 코칭
                      </p>
                    </div>

                    <div className="h-px mb-5" style={{ background: '#F5F0E8' }} />

                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background: '#F5F0E8', color: '#C4A882' }}
                      >
                        예약 가능
                      </span>
                      <button
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200"
                        style={{ background: '#2C2420', color: '#FAF8F5' }}
                      >
                        예약하기
                        <span className="group-hover:translate-x-0.5 inline-block transition-transform">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── 소개 섹션 ─── */}
      <section id="about" className="py-24" style={{ background: '#F5F0E8' }}>
        <div className="max-w-5xl mx-auto px-12">
          <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: '#C4A882' }}>About</p>
          <h2 className="text-4xl mb-8 leading-snug"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
            마음을 나누는<br />
            <em style={{ fontStyle: 'italic', color: '#C4A882' }}>안전한 공간</em>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-base leading-relaxed mb-6" style={{ color: '#6B5B4E', fontWeight: 300 }}>
                S.LEE Secret Counseling은 당신의 이야기를 조용히 들어줄 프라이빗 심리 상담 공간입니다.
                바쁜 일상 속에서 잠시 멈추고, 나 자신을 돌아볼 수 있는 시간을 제공합니다.
              </p>
              <p className="text-base leading-relaxed" style={{ color: '#6B5B4E', fontWeight: 300 }}>
                검증된 전문 상담사와의 1:1 비밀 상담을 통해 더 나은 내일을 만들어보세요.
                모든 상담 내용은 철저히 비밀이 보장됩니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { num: '3+', label: '전문 상담사' },
                { num: '100%', label: '비밀 보장' },
                { num: '1:1', label: '개인 맞춤 상담' },
                { num: '24h', label: '온라인 예약' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl p-6 text-center"
                  style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                  <p className="text-3xl font-medium mb-1"
                    style={{ fontFamily: "'Playfair Display', serif", color: '#C4A882' }}>
                    {item.num}
                  </p>
                  <p className="text-xs font-light" style={{ color: '#9E8E84' }}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 상담 안내 섹션 ─── */}
      <section id="guide" className="py-24" style={{ background: '#FAF8F5' }}>
        <div className="max-w-5xl mx-auto px-12">
          <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: '#C4A882' }}>Guide</p>
          <h2 className="text-4xl mb-12 leading-snug"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
            상담 안내
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: '상담사 선택',
                desc: '메인 페이지에서 나에게 맞는 상담사를 찾아보세요. 전문 분야와 프로필을 확인할 수 있습니다.',
                icon: '✦'
              },
              {
                step: '02',
                title: '시간 예약',
                desc: '원하는 날짜와 시간을 선택해 간편하게 예약하세요. 실시간으로 가능한 시간을 확인할 수 있습니다.',
                icon: '◈'
              },
              {
                step: '03',
                title: '비밀 상담',
                desc: '예약한 시간에 상담사와 1:1로 만나세요. 모든 상담 내용은 철저히 비밀이 보장됩니다.',
                icon: '◎'
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl p-8"
                style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl" style={{ color: '#C4A882' }}>{item.icon}</span>
                  <span className="text-xs tracking-widest" style={{ color: '#C4A882' }}>STEP {item.step}</span>
                </div>
                <h3 className="text-lg mb-3"
                  style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed font-light" style={{ color: '#9E8E84' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* 상담 비용 */}
          <div className="mt-10 rounded-2xl p-8 flex items-center justify-between"
            style={{ background: '#F5F0E8', border: '1px solid #EDE8E0' }}>
            <div>
              <p className="text-xs tracking-widest uppercase mb-2" style={{ color: '#C4A882' }}>상담 비용</p>
              <p className="text-2xl"
                style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
                1회 50분 · <em style={{ color: '#C4A882', fontStyle: 'italic' }}>80,000원</em>
              </p>
            </div>
            <button
              onClick={() => scrollTo('counselors')}
              className="px-6 py-3 rounded-full text-sm font-medium transition-all"
              style={{ background: '#2C2420', color: '#FAF8F5' }}
            >
              지금 예약하기
            </button>
          </div>
        </div>
      </section>

      {/* ─── 상담사 소개 섹션 ─── */}
      <section id="counselors" className="py-24" style={{ background: '#F5F0E8' }}>
        <div className="max-w-5xl mx-auto px-12">
          <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: '#C4A882' }}>Our Counselors</p>
          <h2 className="text-4xl mb-4 leading-snug"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
            상담사 소개
          </h2>
          <p className="text-sm mb-12 font-light" style={{ color: '#9E8E84' }}>
            나에게 맞는 상담사를 찾아 예약해보세요
          </p>

          {/* 검색 */}
          <div
            className="flex items-center gap-3 px-5 h-12 rounded-xl mb-10"
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

          {loading ? (
            <div className="flex justify-center gap-2 py-20">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-2 h-2 rounded-full animate-bounce inline-block"
                  style={{ background: '#DDD5C8', animationDelay: `${i * 0.15}s` }} />
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
                    className="group rounded-2xl cursor-pointer transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
                    style={{
                      background: '#fff',
                      border: '1px solid #EDE8E0',
                      boxShadow: '0 2px 12px rgba(44,36,32,0.04)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 16px 48px rgba(44,36,32,0.10)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(44,36,32,0.04)')}
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                      style={{ background: 'linear-gradient(90deg, #C4A882, #D4B892)' }} />
                    <div className="p-7">
                      <div className="flex flex-col items-center text-center mb-5">
                        {counselor.profile_image ? (
                          <div className="w-24 h-24 rounded-full overflow-hidden mb-4"
                            style={{ border: '3px solid #F5F0E8' }}>
                            <img src={counselor.profile_image} alt={counselor.name}
                              className="w-full h-full object-cover object-top" />
                          </div>
                        ) : (
                          <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-semibold mb-4"
                            style={{ background: color.bg, color: color.text, fontFamily: "'Playfair Display', serif", border: '3px solid #F5F0E8' }}>
                            {counselor.name.charAt(0)}
                          </div>
                        )}
                        <p className="tracking-tight mb-1"
                          style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400, fontSize: '17px' }}>
                          {counselor.name} 상담사
                        </p>
                        <p className="text-xs font-light" style={{ color: '#C4A882' }}>심리 · 코칭</p>
                      </div>
                      <div className="h-px mb-5" style={{ background: '#F5F0E8' }} />
                      <div className="flex items-center justify-between">
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: '#F5F0E8', color: '#C4A882' }}>예약 가능</span>
                        <button className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium"
                          style={{ background: '#2C2420', color: '#FAF8F5' }}>
                          예약하기 →
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── 오시는 길 섹션 ─── */}
      <section id="location" className="py-24" style={{ background: '#FAF8F5' }}>
        <div className="max-w-5xl mx-auto px-12">
          <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: '#C4A882' }}>Location</p>
          <h2 className="text-4xl mb-12 leading-snug"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
            오시는 길
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            {/* 지도 자리 */}
            <div className="rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ background: '#F5F0E8', border: '1px solid #EDE8E0', height: '300px' }}>
              <div className="text-center">
                <p className="text-3xl mb-3">◎</p>
                <p className="text-sm font-light" style={{ color: '#C4A882' }}>서울특별시 강남구</p>
                <p className="text-xs font-light mt-1" style={{ color: '#9E8E84' }}>S.LEE Secret Counseling</p>
              </div>
            </div>

            {/* 주소 정보 */}
            <div className="flex flex-col gap-6">
              {[
                { label: '주소', value: '서울특별시 강남구 테헤란로 123\nS.LEE빌딩 5층' },
                { label: '운영시간', value: '평일 09:00 - 21:00\n주말 10:00 - 18:00' },
                { label: '전화', value: '02-000-0000' },
                { label: '이메일', value: 'contact@slee.kr' },
              ].map((item) => (
                <div key={item.label} className="flex gap-6 pb-6" style={{ borderBottom: '1px solid #EDE8E0' }}>
                  <p className="text-xs tracking-widest uppercase flex-shrink-0 pt-0.5 w-16" style={{ color: '#C4A882' }}>
                    {item.label}
                  </p>
                  <p className="text-sm font-light whitespace-pre-line" style={{ color: '#6B5B4E' }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t py-10 text-center" style={{ borderColor: '#EDE8E0' }}>
        <p className="text-xs" style={{ color: '#C4A882' }}>© 2026 S.LEE — Secret Counseling</p>
      </footer>
    </div>
  )
}

export default MainPage
