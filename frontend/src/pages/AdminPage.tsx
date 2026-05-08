import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAllUsers,
  toggleUserActive,
  deleteUser,
  updateUserRole,
  forceLogout,
} from '../services/adminService'

// ── 타입 ──────────────────────────────────────────────────
type Role = 'admin' | 'counselor' | 'client'

interface UserRow {
  id: string
  email: string
  name: string
  role: Role
  is_active: boolean
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
    padding: '3px 8px', borderRadius: 100, background: bg, color,
    width: 48, textAlign: 'center' as const,
  }),
}

// ── 로딩 스피너 ───────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2px solid #EDE8E0', borderTopColor: '#C4A882',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: 14, color: '#9E8E84' }}>불러오는 중...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── 에러 ─────────────────────────────────────────────────
function ErrorMsg({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: 16 }}>
      <p style={{ fontSize: 14, color: '#A32D2D' }}>{message}</p>
      <button onClick={onRetry} style={S.outlineBtn}>다시 시도</button>
    </div>
  )
}

// ── 역할 드롭다운 ─────────────────────────────────────────
function RoleDropdown({
  userId,
  currentRole,
  onChange,
}: {
  userId: string
  currentRole: Role
  onChange: (id: string, role: Role) => void
}) {
  const [changing, setChanging] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as Role
    if (newRole === currentRole) return
    try {
      setChanging(true)
      await onChange(userId, newRole)
    } finally {
      setChanging(false)
    }
  }

  return (
    <select
      value={currentRole}
      onChange={handleChange}
      disabled={changing}
      style={{
        padding: '3px 8px', borderRadius: 100, fontSize: 12,
        border: `1px solid ${ROLE_BADGE[currentRole].bg}`,
        background: ROLE_BADGE[currentRole].bg,
        color: ROLE_BADGE[currentRole].color,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500, cursor: changing ? 'not-allowed' : 'pointer',
        outline: 'none', appearance: 'none',
        paddingRight: 16,
        width: 72,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239E8E84' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        transition: 'all 0.15s',
        opacity: changing ? 0.6 : 1,
      }}
    >
      <option value="client">내담자</option>
      <option value="counselor">상담사</option>
      <option value="admin">관리자</option>
    </select>
  )
}

// ─────────────────────────────────────────────────────────
// 사이드바
// ─────────────────────────────────────────────────────────
function Sidebar() {
  const navigate = useNavigate()

  return (
    <aside style={{
      width: 260, minWidth: 260, background: '#fff',
      borderRight: '1px solid #EDE8E0', display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 10,
    }}>
      {/* 로고 */}
      <div style={{ padding: '32px 28px 24px', borderBottom: '1px solid #EDE8E0' }}>
        <span style={{
          display: 'inline-block', fontSize: 11, fontWeight: 500,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: '#C4A882', background: '#F5F0E8',
          padding: '3px 10px', borderRadius: 100, marginBottom: 10,
        }}>Admin</span>
        <h2
          onClick={() => navigate('/')}
          style={{
            fontFamily: "'Playfair Display', serif", fontSize: 20,
            fontWeight: 400, color: '#2C2420', lineHeight: 1.35, cursor: 'pointer',
          }}
        >
          Private<br />Counseling
        </h2>
      </div>

      {/* 메뉴 */}
      <div style={{ padding: '20px 16px', flex: 1 }}>
        <p style={{
          fontSize: 11, fontWeight: 500, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: '#C4A882', padding: '0 10px', marginBottom: 8,
        }}>관리</p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 12px', borderRadius: 12, background: '#F5F0E8',
        }}>
          <span style={{ color: '#C4A882' }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" />
            </svg>
          </span>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#2C2420', fontFamily: "'DM Sans', sans-serif" }}>
            전체 유저 관리
          </span>
        </div>
      </div>

      {/* 하단 — 홈 버튼 + 관리자 프로필 */}
      <div style={{ padding: '20px 16px', borderTop: '1px solid #EDE8E0' }}>

        {/* 홈으로 버튼 */}
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 12, marginBottom: 8,
            cursor: 'pointer', color: '#9E8E84', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#FAF8F5'
            e.currentTarget.style.color = '#2C2420'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#9E8E84'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" />
            <path d="M6 15V9h4v6" />
          </svg>
          <span style={{ fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}>홈으로</span>
        </div>

        {/* 관리자 프로필 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: '#2C2420', color: '#FAF8F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, flexShrink: 0,
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
function Topbar() {
  return (
    <div style={{
      height: 68, minHeight: 68, background: 'rgba(250,248,245,0.95)',
      borderBottom: '1px solid #EDE8E0', display: 'flex', alignItems: 'center',
      padding: '0 40px', position: 'sticky', top: 0, zIndex: 5, backdropFilter: 'blur(8px)',
    }}>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 400, color: '#2C2420' }}>
        전체 유저 관리
      </h1>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 유저 관리 패널
// ─────────────────────────────────────────────────────────
function UserManagePanel() {
  const [users, setUsers]               = useState<UserRow[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [filterRole, setFilterRole]     = useState<'all' | Role>('all')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [search, setSearch]             = useState('')
  const [confirmId, setConfirmId]       = useState<string | null>(null)

  async function fetchUsers() {
    try {
      setLoading(true)
      setError(null)
      const res = await getAllUsers()
      setUsers(res.data)
    } catch {
      setError('유저 목록을 불러오지 못했어요.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  async function handleRoleChange(id: string, newRole: Role) {
    try {
      await updateUserRole(id, newRole)
      setUsers((p) => p.map((u) => u.id === id ? { ...u, role: newRole } : u))
    } catch {
      alert('역할 변경 중 오류가 발생했어요.')
    }
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggleUserActive(id, !current)
      setUsers((p) => p.map((u) => u.id === id ? { ...u, is_active: !current } : u))
     if (current) {
  await forceLogout(id)
    } else {
      alert('활성화 되었습니다.')
    }
    } catch {
      alert('처리 중 오류가 발생했어요.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteUser(id)
      setUsers((p) => p.filter((u) => u.id !== id))
      setConfirmId(null)
    } catch {
      alert('삭제 중 오류가 발생했어요.')
    }
  }

  const filtered = users.filter((u) => {
    if (filterRole !== 'all' && u.role !== filterRole) return false
    if (filterActive === 'active'   && !u.is_active) return false
    if (filterActive === 'inactive' &&  u.is_active) return false
    if (search && !u.name.includes(search) && !u.email.includes(search)) return false
    return true
  })

  const total    = users.length
  const inactive = users.filter((u) => !u.is_active).length

  return (
    <div style={{ padding: '36px 40px' }}>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: '전체 유저',   value: total,                                              color: '#2C2420' },
          { label: '내담자',      value: users.filter((u) => u.role === 'client').length,    color: '#3B6D11' },
          { label: '상담사',      value: users.filter((u) => u.role === 'counselor').length, color: '#C4A882' },
          { label: '비활성 유저', value: inactive,                                           color: '#A32D2D' },
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
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'client', 'counselor', 'admin'] as const).map((r) => (
            <button key={r} onClick={() => setFilterRole(r)} style={S.filterBtn(filterRole === r)}>
              {r === 'all' ? '전체' : ROLE_LABEL[r as Role]}
            </button>
          ))}
        </div>
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
          display: 'grid', gridTemplateColumns: '160px 1fr 100px 80px 120px 180px',
          padding: '12px 24px', background: '#FAF8F5', borderBottom: '1px solid #EDE8E0',
        }}>
          {['이름', '이메일', '역할', '상태', '가입일', '관리'].map((h) => (
            <p key={h} style={S.labelText}>{h}</p>
          ))}
        </div>

        {/* 바디 */}
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMsg message={error} onRetry={fetchUsers} />
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9E8E84', fontSize: 14 }}>
            {search ? '검색 결과가 없어요.' : '등록된 유저가 없어요.'}
          </div>
        ) : filtered.map((u, i) => (
          <div
            key={u.id}
            style={{
              display: 'grid', gridTemplateColumns: '160px 1fr 100px 80px 120px 180px',
              padding: '15px 24px', alignItems: 'center',
              borderBottom: i < filtered.length - 1 ? '1px solid #EDE8E0' : 'none',
              transition: 'background 0.1s',
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

            {/* 역할 드롭다운 */}
            <RoleDropdown
              userId={u.id}
              currentRole={u.role}
              onChange={handleRoleChange}
            />

            {/* 활성 상태 */}
            <span style={S.badge(
              u.is_active ? '#EAF3DE' : '#FCEBEB',
              u.is_active ? '#3B6D11' : '#A32D2D',
            )}>
              {u.is_active ? '활성' : '비활성'}
            </span>

            {/* 가입일 */}
            <span style={{ fontSize: 13, color: '#9E8E84' }}>
              {u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}
            </span>

            {/* 관리 버튼 */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => handleToggle(u.id, u.is_active)} style={S.outlineBtn}>
                {u.is_active ? '비활성화' : '활성화'}
              </button>
              {confirmId === u.id ? (
                <>
                  <button onClick={() => handleDelete(u.id)} style={S.confirmBtn}>확인</button>
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
// AdminPage — 최종 export
// ─────────────────────────────────────────────────────────
export default function AdminPage() {
  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif",
    }}>
      <Sidebar />
      <main style={{ marginLeft: 260, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Topbar />
        <UserManagePanel />
      </main>
    </div>
  )
}