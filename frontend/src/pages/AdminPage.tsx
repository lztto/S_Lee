// ─────────────────────────────────────────────────────────
// AdminPage.tsx
// 담당: 이명훈
// 기능: 전체 유저 관리 / 상담사 승인
// CLAUDE.md 규칙 준수
//   - 타입은 이 파일 내 로컬 타입으로 정의 (공통 타입은 types/ 에서 import)
//   - API 연동 시 services/adminService.ts 함수로 교체 (TODO 주석 참고)
//   - 컴포넌트 내 직접 axios 호출 금지
// ─────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// ── 로컬 타입 ─────────────────────────────────────────────
type AdminMenu = 'users' | 'counselors'

type Role = 'admin' | 'counselor' | 'client'

interface UserRow {
  id: string
  email: string
  name: string
  role: Role
  is_active: boolean
  created_at: string
}

interface CounselorRow {
  id: string
  email: string
  name: string
  spec: string
  career_years: number
  is_approved: boolean
  created_at: string
}

// ── 상수 ──────────────────────────────────────────────────
const ROLE_LABEL: Record<Role, string> = {
  admin:     '관리자',
  counselor: '상담사',
  client:    '내담자',
}

const ROLE_BADGE: Record<Role, { bg: string; color: string }> = {
  admin:     { bg: '#EDE8E0', color: '#2C2420' },
  counselor: { bg: '#F5F0E8', color: '#C4A882' },
  client:    { bg: '#EAF3DE', color: '#3B6D11' },
}

// ── 공통 스타일 ───────────────────────────────────────────
const S = {
  labelText: {
    fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
    textTransform: 'uppercase' as const, color: '#9E8E84',
  },
  primaryBtn: {
    padding: '8px 20px', borderRadius: 100, fontSize: 13, cursor: 'pointer',
    border: 'none', background: '#2C2420', color: '#FAF8F5',
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: 'all 0.15s',
  },
  outlineBtn: {
    padding: '7px 14px', borderRadius: 100, fontSize: 13, cursor: 'pointer',
    border: '1px solid #DDD5C8', background: 'transparent', color: '#6B5B4E',
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
  },
  dangerBtn: {
    padding: '7px 14px', borderRadius: 100, fontSize: 13, cursor: 'pointer',
    border: '1px solid #FCEBEB', background: 'transparent', color: '#A32D2D',
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
  },
  confirmBtn: {
    padding: '7px 14px', borderRadius: 100, fontSize: 13, cursor: 'pointer',
    border: 'none', background: '#FCEBEB', color: '#A32D2D',
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
  },
  cancelBtn: {
    padding: '7px 14px', borderRadius: 100, fontSize: 13, cursor: 'pointer',
    border: '1px solid #EDE8E0', background: 'transparent', color: '#9E8E84',
    fontFamily: "'DM Sans', sans-serif",
  },
  filterBtn: (active: boolean) => ({
    padding: '7px 14px', borderRadius: 100, fontSize: 13, cursor: 'pointer',
    border: '1px solid', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
    background:  active ? '#2C2420' : 'transparent',
    color:       active ? '#FAF8F5' : '#9E8E84',
    borderColor: active ? '#2C2420' : '#EDE8E0',
  }),
  statCard: {
    background: '#fff', border: '1px solid #EDE8E0',
    borderRadius: 20, padding: '22px 28px',
  },
  badge: (bg: string, color: string) => ({
    display: 'inline-block', fontSize: 11, fontWeight: 500,
    padding: '3px 10px', borderRadius: 100, background: bg, color,
  }),
}

// ─────────────────────────────────────────────────────────
// 사이드바
// ─────────────────────────────────────────────────────────
function Sidebar({
  activeMenu,
  onNavigate,
}: {
  activeMenu: AdminMenu
  onNavigate: (m: AdminMenu) => void
}) {
  const navigate = useNavigate()

  const menus: { key: AdminMenu; label: string; icon: React.ReactNode }[] = [
    {
      key: 'users',
      label: '전체 유저 관리',
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="5" r="3" />
          <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" />
        </svg>
      ),
    },
    {
      key: 'counselors',
      label: '상담사 승인',
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6" cy="5" r="2.5" />
          <path d="M1 13c0-2.76 2.24-5 5-5" />
          <circle cx="11" cy="5" r="2.5" />
          <path d="M11 8c2.76 0 5 2.24 5 5" />
        </svg>
      ),
    },
  ]

  return (
    <aside
      style={{
        width: 260, minWidth: 260,
        background: '#fff',
        borderRight: '1px solid #EDE8E0',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0,
        height: '100vh', zIndex: 10,
      }}
    >
      {/* 로고 */}
      <div 
        onClick={() => navigate('/')} 
        style={{ 
          padding: '32px 28px 24px', 
          borderBottom: '1px solid #EDE8E0',
          cursor: 'pointer' 
        }}
      >
        <span style={{
          display: 'inline-block', fontSize: 11, fontWeight: 500,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: '#C4A882', background: '#F5F0E8',
          padding: '3px 10px', borderRadius: 100, marginBottom: 10,
        }}>Admin</span>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20, fontWeight: 400, color: '#2C2420', lineHeight: 1.35,
        }}>
          Private<br />Counseling
        </h2>
      </div>

      {/* 메뉴 */}
      <div style={{ padding: '20px 16px', flex: 1 }}>
        <p style={{
          fontSize: 11, fontWeight: 500, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: '#C4A882',
          padding: '0 10px', marginBottom: 8,
        }}>관리</p>

        {menus.map(({ key, label, icon }) => {
          const on = activeMenu === key
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
                color: on ? '#2C2420' : '#9E8E84',
                fontSize: 15, fontWeight: on ? 500 : 400,
                background: on ? '#F5F0E8' : 'transparent',
                border: 'none', width: '100%', textAlign: 'left',
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: 2, transition: 'all 0.15s',
              }}
            >
              <span style={{ color: on ? '#C4A882' : 'inherit', opacity: on ? 1 : 0.65 }}>
                {icon}
              </span>
              {label}
            </button>
          )
        })}
      </div>

      {/* 관리자 프로필 */}
      <div style={{ padding: '20px 16px', borderTop: '1px solid #EDE8E0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: '#2C2420', color: '#FAF8F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 500, flexShrink: 0,
          }}>이</div>
          <div>
            <p style={{ fontSize: 14, color: '#2C2420', fontWeight: 500 }}>이명훈</p>
            <span style={{ fontSize: 12, color: '#9E8E84' }}>관리자</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────
// 탑바
// ─────────────────────────────────────────────────────────
function Topbar({ activeMenu }: { activeMenu: AdminMenu }) {
  const titles: Record<AdminMenu, string> = {
    users:      '전체 유저 관리',
    counselors: '상담사 승인',
  }
  return (
    <div style={{
      height: 68, minHeight: 68,
      background: 'rgba(250,248,245,0.95)',
      borderBottom: '1px solid #EDE8E0',
      display: 'flex', alignItems: 'center',
      padding: '0 40px',
      position: 'sticky', top: 0, zIndex: 5,
      backdropFilter: 'blur(8px)',
    }}>
      <h1 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 22, fontWeight: 400, color: '#2C2420',
      }}>
        {titles[activeMenu]}
      </h1>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 전체 유저 관리
// ─────────────────────────────────────────────────────────
function UserManagePanel() {
  const [users, setUsers]           = useState<UserRow[]>([]) // 🔥 빈 배열로 초기화
  const [filterRole, setFilterRole] = useState<'all' | Role>('all')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [search, setSearch]         = useState('')
  const [confirmId, setConfirmId]   = useState<string | null>(null)

  // 🔥 API 연동을 위한 useEffect 세팅
  useEffect(() => {
    // TODO: 마운트 시 API 호출하여 전체 유저 데이터 셋업
    // 예시: 
    // adminService.getAllUsers().then(data => setUsers(data)).catch(console.error)
  }, [])

  const filtered = users.filter((u) => {
    if (filterRole !== 'all' && u.role !== filterRole) return false
    if (filterActive === 'active'   && !u.is_active) return false
    if (filterActive === 'inactive' &&  u.is_active) return false
    if (search && !u.name.includes(search) && !u.email.includes(search)) return false
    return true
  })

  function toggleActive(id: string) {
    // TODO: API 연동 시 → toggleUserActive(id, !user.is_active)
    setUsers((p) => p.map((u) => u.id === id ? { ...u, is_active: !u.is_active } : u))
  }

  function deleteUser(id: string) {
    // TODO: API 연동 시 → deleteUser(id)
    setUsers((p) => p.filter((u) => u.id !== id))
    setConfirmId(null)
  }

  const total    = users.length
  const active   = users.filter((u) => u.is_active).length
  const inactive = users.filter((u) => !u.is_active).length

  return (
    <div style={{ padding: '36px 40px' }}>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: '전체 유저',  value: total,    color: '#2C2420' },
          { label: '활성 유저',  value: active,   color: '#3B6D11' },
          { label: '비활성 유저', value: inactive, color: '#A32D2D' },
        ].map((s) => (
          <div key={s.label} style={S.statCard}>
            <p style={{ ...S.labelText, marginBottom: 12 }}>{s.label}</p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 400, color: s.color }}>
              {s.value}<span style={{ fontSize: 16, color: '#9E8E84', marginLeft: 4 }}>명</span>
            </p>
          </div>
        ))}
      </div>

      {/* 필터 + 검색 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="이름 또는 이메일 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '9px 16px', borderRadius: 12, fontSize: 14,
            border: '1px solid #EDE8E0', background: '#fff', color: '#2C2420',
            fontFamily: "'DM Sans', sans-serif", outline: 'none', width: 220,
          }}
        />

        {/* 역할 필터 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'client', 'counselor', 'admin'] as const).map((r) => (
            <button key={r} onClick={() => setFilterRole(r)} style={S.filterBtn(filterRole === r)}>
              {r === 'all' ? '전체' : ROLE_LABEL[r as Role]}
            </button>
          ))}
        </div>

        {/* 활성 필터 */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button key={f} onClick={() => setFilterActive(f)} style={S.filterBtn(filterActive === f)}>
              {f === 'all' ? '전체' : f === 'active' ? '활성' : '비활성'}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div style={{ background: '#fff', border: '1px solid #EDE8E0', borderRadius: 20, overflow: 'hidden' }}>

        {/* 헤더 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 2.5fr 1fr 1fr 1.4fr 1.6fr',
          padding: '12px 24px', background: '#FAF8F5', borderBottom: '1px solid #EDE8E0',
        }}>
          {['이름', '이메일', '역할', '상태', '가입일', '관리'].map((h) => (
            <p key={h} style={S.labelText}>{h}</p>
          ))}
        </div>

        {/* 행 */}
        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9E8E84', fontSize: 14 }}>
            유저 데이터가 없습니다.
          </div>
        ) : filtered.map((u, i) => (
          <div
            key={u.id}
            style={{
              display: 'grid', gridTemplateColumns: '2fr 2.5fr 1fr 1fr 1.4fr 1.6fr',
              padding: '15px 24px', alignItems: 'center',
              borderBottom: i < filtered.length - 1 ? '1px solid #EDE8E0' : 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF8F5')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {/* 이름 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#F5F0E8', color: '#C4A882',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 500, flexShrink: 0,
              }}>{u.name[0]}</div>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#2C2420' }}>{u.name}</span>
            </div>

            {/* 이메일 */}
            <span style={{ fontSize: 13, color: '#9E8E84' }}>{u.email}</span>

            {/* 역할 */}
            <span style={S.badge(ROLE_BADGE[u.role].bg, ROLE_BADGE[u.role].color)}>
              {ROLE_LABEL[u.role]}
            </span>

            {/* 활성 상태 */}
            <span style={S.badge(
              u.is_active ? '#EAF3DE' : '#FCEBEB',
              u.is_active ? '#3B6D11' : '#A32D2D',
            )}>
              {u.is_active ? '활성' : '비활성'}
            </span>

            {/* 가입일 */}
            <span style={{ fontSize: 13, color: '#9E8E84' }}>{u.created_at}</span>

            {/* 관리 */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => toggleActive(u.id)} style={S.outlineBtn}>
                {u.is_active ? '비활성화' : '활성화'}
              </button>

              {confirmId === u.id ? (
                <>
                  <button onClick={() => deleteUser(u.id)} style={S.confirmBtn}>확인</button>
                  <button onClick={() => setConfirmId(null)} style={S.cancelBtn}>취소</button>
                </>
              ) : (
                <button onClick={() => setConfirmId(u.id)} style={S.dangerBtn}>삭제</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: '#9E8E84', marginTop: 12 }}>
        총 {filtered.length}명 표시 중
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 상담사 승인
// ─────────────────────────────────────────────────────────
function CounselorApprovePanel() {
  const [counselors, setCounselors] = useState<CounselorRow[]>([]) // 🔥 빈 배열로 초기화
  const [filter, setFilter]         = useState<'all' | 'pending' | 'approved'>('all')
  const [search, setSearch]         = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)

  // 🔥 API 연동을 위한 useEffect 세팅
  useEffect(() => {
    // TODO: 마운트 시 API 호출하여 상담사 승인 대기/완료 목록 세팅
    // 예시: 
    // adminService.getAllCounselors().then(data => setCounselors(data)).catch(console.error)
  }, [])

  const filtered = counselors.filter((c) => {
    if (filter === 'approved' && !c.is_approved) return false
    if (filter === 'pending'  &&  c.is_approved) return false
    if (search && !c.name.includes(search) && !c.email.includes(search)) return false
    return true
  })

  const total    = counselors.length
  const approved = counselors.filter((c) => c.is_approved).length
  const pending  = counselors.filter((c) => !c.is_approved).length

  function approve(id: string) {
    // TODO: API 연동 시 → approveCounselor(id)
    setCounselors((p) => p.map((c) => c.id === id ? { ...c, is_approved: true } : c))
  }

  function revoke(id: string) {
    // TODO: API 연동 시 → revokeCounselor(id)
    setCounselors((p) => p.map((c) => c.id === id ? { ...c, is_approved: false } : c))
    setConfirmRevoke(null)
  }

  return (
    <div style={{ padding: '36px 40px' }}>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '전체 상담사', value: total,    color: '#2C2420' },
          { label: '승인 완료',   value: approved, color: '#3B6D11' },
          { label: '승인 대기',   value: pending,  color: '#A32D2D' },
        ].map((s) => (
          <div key={s.label} style={S.statCard}>
            <p style={{ ...S.labelText, marginBottom: 12 }}>{s.label}</p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 400, color: s.color }}>
              {s.value}<span style={{ fontSize: 16, color: '#9E8E84', marginLeft: 4 }}>명</span>
            </p>
          </div>
        ))}
      </div>

      {/* 승인 대기 알림 배너 */}
      {pending > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', borderRadius: 14, marginBottom: 24,
          background: '#FFF8F0', border: '1px solid #F5D9A8',
        }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#C4A882" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" /><path d="M8 5v3M8 10.5v.5" />
          </svg>
          <p style={{ fontSize: 14, color: '#2C2420', fontWeight: 500 }}>
            승인 대기 중인 상담사가 <span style={{ color: '#C4A882' }}>{pending}명</span> 있어요.
          </p>
        </div>
      )}

      {/* 필터 + 검색 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="이름 또는 이메일 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '9px 16px', borderRadius: 12, fontSize: 14,
            border: '1px solid #EDE8E0', background: '#fff', color: '#2C2420',
            fontFamily: "'DM Sans', sans-serif", outline: 'none', width: 220,
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'pending', 'approved'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={S.filterBtn(filter === f)}>
              {f === 'all' ? '전체' : f === 'pending' ? '승인 대기' : '승인 완료'}
            </button>
          ))}
        </div>
      </div>

      {/* 상담사 카드 목록 */}
      {filtered.length === 0 ? (
        <div style={{
          padding: '60px', textAlign: 'center', color: '#9E8E84',
          fontSize: 14, background: '#fff', borderRadius: 20, border: '1px solid #EDE8E0',
        }}>
          상담사 데이터가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((c) => (
            <div
              key={c.id}
              style={{
                background: '#fff',
                border: `1px solid ${!c.is_approved ? '#F5D9A8' : '#EDE8E0'}`,
                borderRadius: 20, padding: '22px 28px',
                display: 'flex', alignItems: 'center', gap: 20,
              }}
            >
              {/* 아바타 */}
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: c.is_approved ? '#2C2420' : '#F5F0E8',
                color: c.is_approved ? '#FAF8F5' : '#C4A882',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 500,
              }}>{c.name[0]}</div>

              {/* 정보 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <p style={{ fontSize: 16, fontWeight: 500, color: '#2C2420' }}>{c.name}</p>
                  <span style={S.badge(
                    c.is_approved ? '#EAF3DE' : '#FFF3E0',
                    c.is_approved ? '#3B6D11' : '#C4A882',
                  )}>
                    {c.is_approved ? '승인 완료' : '승인 대기'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#9E8E84', marginBottom: 8 }}>{c.email}</p>
                <div style={{ display: 'flex', gap: 20 }}>
                  <span style={{ fontSize: 12, color: '#6B5B4E' }}>
                    <span style={{ color: '#C4A882', marginRight: 4 }}>전문분야</span>{c.spec}
                  </span>
                  <span style={{ fontSize: 12, color: '#6B5B4E' }}>
                    <span style={{ color: '#C4A882', marginRight: 4 }}>경력</span>{c.career_years}년
                  </span>
                  <span style={{ fontSize: 12, color: '#9E8E84' }}>신청일 {c.created_at}</span>
                </div>
              </div>

              {/* 승인/취소 버튼 */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {c.is_approved ? (
                  confirmRevoke === c.id ? (
                    <>
                      <button onClick={() => revoke(c.id)} style={S.confirmBtn}>취소 확인</button>
                      <button onClick={() => setConfirmRevoke(null)} style={S.cancelBtn}>닫기</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmRevoke(c.id)} style={S.outlineBtn}>승인 취소</button>
                  )
                ) : (
                  <button onClick={() => approve(c.id)} style={S.primaryBtn}>승인하기</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: '#9E8E84', marginTop: 16 }}>
        총 {filtered.length}명 표시 중
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// AdminPage — 최종 export
// ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('users')

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* 사이드바 (fixed) */}
      <Sidebar activeMenu={activeMenu} onNavigate={setActiveMenu} />

      {/* 메인 */}
      <main style={{ marginLeft: 260, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Topbar activeMenu={activeMenu} />

        {activeMenu === 'users'      && <UserManagePanel />}
        {activeMenu === 'counselors' && <CounselorApprovePanel />}
      </main>
    </div>
  )
}