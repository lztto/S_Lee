import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMySlots, createBulkSlots, toggleSlot } from '@/services/slotService'
import { getSlotReservations } from '@/services/ReservationService'
import { useAuthStore } from '@/store/auth'
import type { Slot, Reservation } from '@/types'

type DashTab = 'slots' | 'reservations'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 기본 시간대 라벨 (KST)
const TIME_BLOCKS = [
  { label: '10:00 — 12:00', startH: 10 },
  { label: '14:00 — 16:00', startH: 14 },
  { label: '16:00 — 18:00', startH: 16 },
  { label: '18:00 — 20:00', startH: 18 },
  { label: '20:00 — 22:00', startH: 20 },
]

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// UTC ISO → KST 시작 시간 (hour)
function toKSTHour(isoString: string): number {
  const d = new Date(isoString)
  return (d.getUTCHours() + 9) % 24
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CounselorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<DashTab>('slots')

  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [slotsError, setSlotsError] = useState<string | null>(null)

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationsLoading, setReservationsLoading] = useState(false)
  const [reservationsError, setReservationsError] = useState<string | null>(null)

  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => { fetchSlots() }, [])
  useEffect(() => {
    if (activeTab === 'reservations' && reservations.length === 0) fetchReservations()
  }, [activeTab])

  const fetchSlots = async () => {
    try {
      setSlotsLoading(true)
      setSlotsError(null)
      setSlots(await getMySlots())
    } catch { setSlotsError('슬롯 목록을 불러오지 못했습니다.') }
    finally { setSlotsLoading(false) }
  }

  const fetchReservations = async () => {
    try {
      setReservationsLoading(true)
      setReservationsError(null)
      setReservations(await getSlotReservations())
    } catch { setReservationsError('예약 목록을 불러오지 못했습니다.') }
    finally { setReservationsLoading(false) }
  }

  const handleBulkCreate = async () => {
    try {
      setBulkCreating(true)
      setBulkMsg(null)
      const result = await createBulkSlots(calYear, calMonth + 1)
      setBulkMsg(`${result.created}개 슬롯 생성 완료 (${result.skipped}개 중복 스킵)`)
      await fetchSlots()
    } catch { setBulkMsg('슬롯 생성에 실패했습니다.') }
    finally { setBulkCreating(false) }
  }

  const handleToggle = async (slot: Slot) => {
    try {
      setTogglingId(slot.id)
      await toggleSlot(slot.id, !slot.is_available)
      setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, is_available: !s.is_available } : s))
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '슬롯 상태 변경에 실패했습니다.')
    } finally { setTogglingId(null) }
  }

  // 슬롯을 날짜+시간으로 인덱싱
  const slotIndex = useMemo(() => {
    const map = new Map<string, Slot>() // key: "2026-05-11_10"
    for (const slot of slots) {
      const d = new Date(slot.start_time)
      const yyyy = d.getUTCFullYear()
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(d.getUTCDate() + (d.getUTCHours() + 9 >= 24 ? 1 : 0)).padStart(2, '0')
      const kstH = toKSTHour(slot.start_time)
      // KST 날짜 계산
      const kstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000)
      const key = `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, '0')}-${String(kstDate.getUTCDate()).padStart(2, '0')}_${kstH}`
      map.set(key, slot)
    }
    return map
  }, [slots])

  // 선택 날짜의 슬롯들
  const selectedDaySlots = useMemo(() => {
    if (!selectedDate) return []
    return TIME_BLOCKS.map(block => ({
      block,
      slot: slotIndex.get(`${selectedDate}_${block.startH}`) ?? null,
    }))
  }, [selectedDate, slotIndex])

  const calCells = buildCalendar(calYear, calMonth)
  const now = new Date()

  // 달력에서 슬롯 있는 날짜
  const datesWithSlots = useMemo(() => {
    const set = new Set<string>()
    for (const slot of slots) {
      const kstDate = new Date(new Date(slot.start_time).getTime() + 9 * 60 * 60 * 1000)
      set.add(`${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, '0')}-${String(kstDate.getUTCDate()).padStart(2, '0')}`)
    }
    return set
  }, [slots])

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return {
      date: d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
      time: d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }
  }
  const getDuration = (start: string, end: string) =>
    `${(new Date(end).getTime() - new Date(start).getTime()) / 60000}분`

  const availableCount = slots.filter(s => s.is_available && new Date(s.start_time) >= now).length
  const bookedCount = slots.filter(s => {
    // reservations에서 confirmed인 것 (is_available=false이면서 예약된 것)
    return !s.is_available && new Date(s.start_time) >= now
  }).length
  const upcomingCount = reservations.filter(
    r => r.status === 'confirmed' && new Date(r.slot?.start_time ?? '') >= now
  ).length

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* 헤더 */}
      <div style={{ background: 'rgba(250,248,245,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE8E0', height: '64px', padding: '0 32px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9E8E84', fontSize: '14px' }}>← 홈</button>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 400, color: '#2C2420', margin: '0 auto' }}>상담사 대시보드</h1>
        {user && <span className="text-sm font-light" style={{ color: '#9E8E84' }}>{user.name} 상담사님</span>}
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '36px 24px' }}>
        <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882', marginBottom: '6px' }}>Dashboard</p>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 400, color: '#2C2420', marginBottom: '28px' }}>일정 및 예약 관리</h2>

        {/* 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '32px' }}>
          {[
            { label: '예약 가능 슬롯', value: availableCount, unit: '개' },
            { label: '예약된 슬롯', value: bookedCount, unit: '개' },
            { label: '예정된 상담', value: upcomingCount, unit: '건' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '18px 22px' }}>
              <p className="text-sm font-light" style={{ color: '#9E8E84', margin: '0 0 6px' }}>{card.label}</p>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '30px', fontWeight: 400, color: '#2C2420' }}>{card.value}</span>
              <span className="text-sm font-light" style={{ color: '#9E8E84', marginLeft: '4px' }}>{card.unit}</span>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #EDE8E0', marginBottom: '24px' }}>
          {([['slots', '슬롯 관리'], ['reservations', '예약 확인']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{ padding: '10px 24px', border: 'none', borderBottom: activeTab === key ? '2px solid #2C2420' : '2px solid transparent', background: 'transparent', color: activeTab === key ? '#2C2420' : '#9E8E84', fontWeight: activeTab === key ? 500 : 400, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 슬롯 관리 탭 ── */}
        {activeTab === 'slots' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>

            {/* 왼쪽: 달력 */}
            <div>
              {/* 달력 헤더 + 일괄 생성 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) } else setCalMonth(m => m - 1); setSelectedDate(null) }}
                    disabled={calYear === today.getFullYear() && calMonth <= today.getMonth()}
                    style={{ background: 'none', border: '1px solid #EDE8E0', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', color: '#9E8E84', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (calYear === today.getFullYear() && calMonth <= today.getMonth()) ? 0.3 : 1 }}>‹</button>
                  <span style={{ fontSize: '15px', fontWeight: 500, color: '#2C2420', minWidth: '90px', textAlign: 'center' }}>{calYear}년 {calMonth + 1}월</span>
                  <button onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) } else setCalMonth(m => m + 1); setSelectedDate(null) }}
                    style={{ background: 'none', border: '1px solid #EDE8E0', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', color: '#9E8E84', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                </div>
                <button onClick={handleBulkCreate} disabled={bulkCreating}
                  className="px-4 py-2 rounded-full text-sm font-medium"
                  style={{ background: bulkCreating ? '#C4A882' : '#2C2420', color: '#FAF8F5', border: 'none', cursor: bulkCreating ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
                  {bulkCreating ? '생성 중...' : `${calMonth + 1}월 슬롯 일괄 생성`}
                </button>
              </div>

              {bulkMsg && (
                <p className="text-sm" style={{ color: bulkMsg.includes('실패') ? '#C0392B' : '#5A8A6A', marginBottom: '12px' }}>{bulkMsg}</p>
              )}

              {/* 달력 그리드 */}
              <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '8px' }}>
                  {WEEKDAYS.map(w => (
                    <div key={w} style={{ textAlign: 'center', fontSize: '11px', color: '#9E8E84', padding: '4px 0', fontWeight: 500 }}>{w}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                  {calCells.map((day, idx) => {
                    if (!day) return <div key={idx} />
                    const dk = dateKey(calYear, calMonth, day)
                    const hasSlots = datesWithSlots.has(dk)
                    const isSelected = selectedDate === dk
                    const isPast = new Date(dk) < new Date(today.toDateString())
                    const isToday = dk === today.toISOString().slice(0, 10)
                    return (
                      <div key={idx}
                        onClick={() => { if (!isPast) setSelectedDate(isSelected ? null : dk) }}
                        style={{
                          textAlign: 'center', padding: '8px 4px', borderRadius: '8px',
                          fontSize: '13px', cursor: isPast ? 'default' : 'pointer',
                          background: isSelected ? '#2C2420' : isPast ? 'transparent' : hasSlots ? '#F5F0E8' : 'transparent',
                          color: isSelected ? '#FAF8F5' : isPast ? '#DDD5C8' : '#2C2420',
                          fontWeight: isToday ? 600 : 400, transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!isPast && !isSelected) (e.currentTarget as HTMLDivElement).style.background = '#EDE8E0' }}
                        onMouseLeave={(e) => { if (!isPast && !isSelected) (e.currentTarget as HTMLDivElement).style.background = hasSlots ? '#F5F0E8' : 'transparent' }}
                      >
                        {day}
                        {hasSlots && !isSelected && (
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#C4A882', margin: '2px auto 0' }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <p className="text-xs font-light" style={{ color: '#9E8E84', marginTop: '10px' }}>
                ● 슬롯 있는 날짜 · 날짜를 클릭하면 오른쪽에서 시간대별 활성/비활성을 설정할 수 있습니다
              </p>
            </div>

            {/* 오른쪽: 선택 날짜 슬롯 토글 */}
            <div style={{ position: 'sticky', top: '80px' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 400, color: '#2C2420', marginBottom: '14px' }}>
                {selectedDate
                  ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
                  : '날짜를 선택하세요'}
              </h3>

              {!selectedDate ? (
                <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '32px 20px', textAlign: 'center', color: '#9E8E84' }}>
                  <p className="text-sm font-light">달력에서 날짜를 클릭하면<br />시간대를 관리할 수 있습니다</p>
                </div>
              ) : slotsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9E8E84' }}>불러오는 중...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* 점심시간 안내 */}
                  <div className="rounded-xl" style={{ background: '#F5F0E8', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#C4A882' }}>🍽</span>
                    <span style={{ fontSize: '12px', color: '#9E8E84' }}>12:00 — 14:00 점심시간 (고정 휴무)</span>
                  </div>

                  {selectedDaySlots.map(({ block, slot }) => {
                    const isToggling = togglingId === slot?.id
                    const isActive = slot?.is_available ?? false
                    const hasSlot = !!slot
                    const isPast = slot ? new Date(slot.start_time) < now : false

                    return (
                      <div key={block.startH} className="rounded-xl"
                        style={{ background: '#fff', border: `1px solid ${hasSlot && isActive ? '#C4A882' : '#EDE8E0'}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: isPast ? 0.5 : 1 }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: '#2C2420', margin: 0 }}>{block.label}</p>
                          {!hasSlot && (
                            <p style={{ fontSize: '11px', color: '#9E8E84', margin: '2px 0 0' }}>슬롯 없음 (일괄 생성 필요)</p>
                          )}
                        </div>

                        {hasSlot && !isPast ? (
                          <button
                            onClick={() => handleToggle(slot!)}
                            disabled={isToggling}
                            style={{
                              padding: '5px 14px', borderRadius: '100px', border: 'none',
                              background: isActive ? '#2C2420' : '#F5F0E8',
                              color: isActive ? '#FAF8F5' : '#9E8E84',
                              fontSize: '12px', fontWeight: 500, cursor: isToggling ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s', minWidth: '60px',
                            }}
                          >
                            {isToggling ? '...' : isActive ? '활성' : '비활성'}
                          </button>
                        ) : isPast ? (
                          <span style={{ fontSize: '11px', color: '#DDD5C8' }}>종료</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#DDD5C8' }}>—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 예약 확인 탭 ── */}
        {activeTab === 'reservations' && (
          <div>
            {reservationsLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#9E8E84' }}>불러오는 중...</div>
            ) : reservationsError ? (
              <div style={{ background: '#FFF5F5', border: '1px solid #FCD5D5', borderRadius: '12px', padding: '20px', color: '#C0392B', textAlign: 'center' }}>{reservationsError}</div>
            ) : reservations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#9E8E84' }}>
                <p style={{ fontSize: '15px' }}>아직 예약이 없습니다.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {reservations.map((reservation) => {
                  const startDt = reservation.slot ? formatDateTime(reservation.slot.start_time) : null
                  const duration = reservation.slot ? getDuration(reservation.slot.start_time, reservation.slot.end_time) : null
                  const isUpcoming = reservation.status === 'confirmed' && new Date(reservation.slot?.start_time ?? '') >= now
                  return (
                    <div key={reservation.id} className="rounded-2xl"
                      style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '22px 26px', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(44,36,32,0.08)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ display: 'inline-block', background: reservation.status === 'cancelled' ? '#FFF0EE' : isUpcoming ? '#F5F0E8' : '#F0F5EE', color: reservation.status === 'cancelled' ? '#C0392B' : isUpcoming ? '#C4A882' : '#5A8A6A', borderRadius: '100px', padding: '3px 12px', fontSize: '11px', fontWeight: 500, marginBottom: '10px' }}>
                            {reservation.status === 'cancelled' ? '취소됨' : isUpcoming ? '예정' : '완료'}
                          </span>
                          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', fontWeight: 400, color: '#2C2420', margin: '0 0 6px' }}>
                            {reservation.client_name ?? '내담자'}
                          </h3>
                          {startDt && (
                            <div>
                              <p className="text-sm" style={{ color: '#2C2420', margin: 0, fontWeight: 500 }}>{startDt.date}</p>
                              <p className="text-sm font-light" style={{ color: '#9E8E84', margin: '2px 0 0' }}>{startDt.time} · {duration}</p>
                            </div>
                          )}
                        </div>
                        {reservation.status === 'confirmed' && new Date(reservation.slot?.start_time ?? '') < now && (
                          <a href={`/journal/${reservation.id}`} className="px-4 py-2 rounded-full text-sm font-medium"
                            style={{ background: '#2C2420', color: '#FAF8F5', textDecoration: 'none', display: 'inline-block', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#C4A882' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#2C2420' }}>
                            {reservation.journal_id ? '일지 보기' : '일지 작성'}
                          </a>
                        )}
                      </div>
                      <div className="h-px" style={{ background: '#EDE8E0', margin: '14px 0 10px' }} />
                      <p className="text-xs font-light" style={{ color: '#9E8E84', margin: 0 }}>
                        예약 번호 #{reservation.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}