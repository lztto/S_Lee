import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBlockedSlots, blockSlot, unblockSlot } from '@/services/slotService'
import type { BlockedSlot } from '@/services/slotService'
import { getSlotReservations } from '@/services/ReservationService'
import { useAuthStore } from '@/store/auth'
import type { Reservation } from '@/types'
import api from '@/services/api'

type DashTab = 'slots' | 'reservations' | 'journal'
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const TIME_BLOCKS: { label: string; startH: number; endH: number }[] = [
  { label: '10:00 — 12:00', startH: 10, endH: 12 },
  { label: '14:00 — 16:00', startH: 14, endH: 16 },
  { label: '16:00 — 18:00', startH: 16, endH: 18 },
  { label: '18:00 — 20:00', startH: 18, endH: 20 },
  { label: '20:00 — 22:00', startH: 20, endH: 22 },
]

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ── 일지 타입 ─────────────────────────────────────────────
interface JournalItem {
  id: string
  reservation_id: string
  content: string
  is_private: boolean
  created_at: string
}

export default function CounselorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<DashTab>('slots')

  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationsLoading, setReservationsLoading] = useState(false)
  const [reservationsError, setReservationsError] = useState<string | null>(null)

  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // ── 일지 상태 ─────────────────────────────────────────────
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [journalContent, setJournalContent]           = useState('')
  const [journalPrivate, setJournalPrivate]           = useState(true)
  const [existingJournal, setExistingJournal]         = useState<JournalItem | null>(null)
  const [journalLoading, setJournalLoading]           = useState(false)
  const [journalSaving, setJournalSaving]             = useState(false)
  const [journalMsg, setJournalMsg]                   = useState<string | null>(null)

  useEffect(() => { fetchBlocked() }, [])
  useEffect(() => {
    if ((activeTab === 'reservations' || activeTab === 'journal') && reservations.length === 0) {
      fetchReservations()
    }
  }, [activeTab])

  // 예약 선택 시 기존 일지 조회
  useEffect(() => {
    if (!selectedReservation) return
    fetchJournal(selectedReservation.id)
  }, [selectedReservation])

  const fetchBlocked = async () => {
    try {
      setSlotsLoading(true)
      setBlockedSlots(await getBlockedSlots())
    } catch { /* 조용히 처리 */ }
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

  const fetchJournal = async (reservationId: string) => {
    try {
      setJournalLoading(true)
      setExistingJournal(null)
      setJournalContent('')
      setJournalMsg(null)
      const res = await api.get(`/journals/reservation/${reservationId}`)
      const journal = res.data.data
      if (journal) {
        setExistingJournal(journal)
        setJournalContent(journal.content)
        setJournalPrivate(journal.is_private)
      }
    } catch {
      setExistingJournal(null)
      setJournalContent('')
    } finally {
      setJournalLoading(false)
    }
  }

  const handleSaveJournal = async () => {
    if (!selectedReservation || !journalContent.trim()) {
      setJournalMsg('내용을 입력해주세요.')
      return
    }
    try {
      setJournalSaving(true)
      setJournalMsg(null)
      if (existingJournal) {
        await api.put(`/journals/${existingJournal.id}`, {
          content: journalContent,
          is_private: journalPrivate,
        })
        setJournalMsg('일지가 수정되었습니다.')
      } else {
        const res = await api.post('/journals', {
          reservation_id: selectedReservation.id,
          content: journalContent,
          is_private: journalPrivate,
        })
        setExistingJournal(res.data.data)
        setJournalMsg('일지가 저장되었습니다.')
      }
    } catch (e: any) {
      setJournalMsg(e?.response?.data?.detail ?? '저장에 실패했습니다.')
    } finally {
      setJournalSaving(false)
    }
  }

  // 차단 세트
  const blockedSet = useMemo(() => {
    const s = new Set<string>()
    for (const b of blockedSlots) s.add(`${b.blocked_date}_${b.start_hour}`)
    return s
  }, [blockedSlots])

  const blockedDates = useMemo(() => {
    const s = new Set<string>()
    for (const b of blockedSlots) s.add(b.blocked_date)
    return s
  }, [blockedSlots])

  const handleToggle = async (dateKey: string, startH: number) => {
    const key = `${dateKey}_${startH}`
    const isBlocked = blockedSet.has(key)
    try {
      setTogglingKey(key)
      if (isBlocked) {
        await unblockSlot(dateKey, startH)
        setBlockedSlots(prev => prev.filter(b => !(b.blocked_date === dateKey && b.start_hour === startH)))
      } else {
        await blockSlot(dateKey, startH)
        setBlockedSlots(prev => [...prev, { id: key, blocked_date: dateKey, start_hour: startH }])
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '변경에 실패했습니다.')
    } finally {
      setTogglingKey(null)
    }
  }

  const calCells = buildCalendar(calYear, calMonth)
  const now = new Date()

  const upcomingCount = reservations.filter(
    r => r.status === 'confirmed' && new Date(r.slot?.start_time ?? '') >= now
  ).length

  // 일지 작성 가능한 완료된 예약
  const completedReservations = reservations.filter(
    r => r.status === 'confirmed' && new Date(r.slot?.start_time ?? '') < now
  )

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
    setSelectedDate(null)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
    setSelectedDate(null)
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return {
      date: d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
      time: d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }
  }
  const getDuration = (s: string, e: string) =>
    `${(new Date(e).getTime() - new Date(s).getTime()) / 60000}분`

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');* { font-family: 'DM Sans', sans-serif; }`}</style>

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
            { label: '차단된 시간대', value: blockedSlots.length, unit: '개',  desc: '비활성화됨' },
            { label: '예정된 상담',   value: upcomingCount,       unit: '건',  desc: '확정 예약' },
            { label: '기본 운영 시간', value: '10 — 22',          unit: 'KST', desc: '점심 12~14 제외' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '18px 22px' }}>
              <p className="text-sm font-light" style={{ color: '#9E8E84', margin: '0 0 4px' }}>{card.label}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 400, color: '#2C2420' }}>{card.value}</span>
                <span className="text-sm font-light" style={{ color: '#9E8E84' }}>{card.unit}</span>
              </div>
              <p style={{ fontSize: '11px', color: '#C4A882', margin: 0 }}>{card.desc}</p>
            </div>
          ))}
        </div>

        {/* 안내 배너 */}
        <div className="rounded-xl" style={{ background: '#F5F0E8', padding: '12px 18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>💡</span>
          <p style={{ fontSize: '13px', color: '#6B5B4E', margin: 0 }}>
            기본적으로 <strong>모든 시간대가 예약 가능</strong>합니다. 상담이 불가한 날짜/시간만 선택해서 차단하세요.
          </p>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #EDE8E0', marginBottom: '24px' }}>
          {([
            ['slots',        '휴무 관리'],
            ['reservations', '예약 확인'],
            ['journal',      '일지 작성'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{
                padding: '10px 24px', border: 'none',
                borderBottom: activeTab === key ? '2px solid #2C2420' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === key ? '#2C2420' : '#9E8E84',
                fontWeight: activeTab === key ? 500 : 400,
                fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 휴무 관리 탭 ── */}
        {activeTab === 'slots' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 400, color: '#2C2420', margin: 0 }}>날짜 선택</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button onClick={prevMonth}
                    disabled={calYear === today.getFullYear() && calMonth <= today.getMonth()}
                    style={{ background: 'none', border: '1px solid #EDE8E0', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', color: '#9E8E84', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (calYear === today.getFullYear() && calMonth <= today.getMonth()) ? 0.3 : 1 }}>‹</button>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#2C2420', minWidth: '80px', textAlign: 'center' }}>{calYear}년 {calMonth + 1}월</span>
                  <button onClick={nextMonth}
                    style={{ background: 'none', border: '1px solid #EDE8E0', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', color: '#9E8E84', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                </div>
              </div>

              <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '8px' }}>
                  {WEEKDAYS.map(w => (
                    <div key={w} style={{ textAlign: 'center', fontSize: '11px', color: '#9E8E84', padding: '4px 0', fontWeight: 500 }}>{w}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                  {calCells.map((day, idx) => {
                    if (!day) return <div key={idx} />
                    const dk = toDateKey(calYear, calMonth, day)
                    const isSelected = selectedDate === dk
                    const isPast = new Date(dk) < new Date(today.toDateString())
                    const isToday = dk === today.toISOString().slice(0, 10)
                    const hasBlock = blockedDates.has(dk)
                    return (
                      <div key={idx}
                        onClick={() => { if (!isPast) setSelectedDate(isSelected ? null : dk) }}
                        style={{
                          textAlign: 'center', padding: '8px 4px', borderRadius: '8px',
                          fontSize: '13px', cursor: isPast ? 'default' : 'pointer',
                          background: isSelected ? '#2C2420' : 'transparent',
                          color: isSelected ? '#FAF8F5' : isPast ? '#DDD5C8' : '#2C2420',
                          fontWeight: isToday ? 600 : 400, transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!isPast && !isSelected) (e.currentTarget as HTMLDivElement).style.background = '#F5F0E8' }}
                        onMouseLeave={(e) => { if (!isPast && !isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        {day}
                        {hasBlock && !isSelected && (
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#C0392B', margin: '2px auto 0' }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C0392B' }} />
                  <span style={{ fontSize: '11px', color: '#9E8E84' }}>차단된 날짜</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5A8A6A' }} />
                  <span style={{ fontSize: '11px', color: '#9E8E84' }}>예약 가능 (기본)</span>
                </div>
              </div>
            </div>

            {/* 오른쪽: 시간대 토글 */}
            <div style={{ position: 'sticky', top: '80px' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 400, color: '#2C2420', marginBottom: '14px' }}>
                {selectedDate
                  ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
                  : '날짜를 선택하세요'}
              </h3>
              {!selectedDate ? (
                <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '32px 20px', textAlign: 'center', color: '#9E8E84' }}>
                  <p style={{ fontSize: '13px', marginBottom: '4px' }}>달력에서 날짜를 클릭하면</p>
                  <p style={{ fontSize: '13px' }}>시간대를 관리할 수 있습니다</p>
                </div>
              ) : slotsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9E8E84' }}>불러오는 중...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="rounded-xl" style={{ background: '#FAF8F5', border: '1px solid #EDE8E0', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '13px', color: '#9E8E84', margin: 0 }}>12:00 — 14:00</p>
                      <p style={{ fontSize: '11px', color: '#C4A882', margin: '2px 0 0' }}>점심시간 (고정 휴무)</p>
                    </div>
                    <span style={{ fontSize: '11px', color: '#DDD5C8', fontWeight: 500 }}>휴무</span>
                  </div>
                  {TIME_BLOCKS.map(block => {
                    const key = `${selectedDate}_${block.startH}`
                    const isBlocked = blockedSet.has(key)
                    const isToggling = togglingKey === key
                    return (
                      <div key={block.startH} className="rounded-xl"
                        style={{ background: '#fff', border: `1px solid ${isBlocked ? '#FCD5D5' : '#C4A882'}`, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: isBlocked ? '#9E8E84' : '#2C2420', margin: 0 }}>{block.label}</p>
                          <p style={{ fontSize: '11px', color: isBlocked ? '#C0392B' : '#5A8A6A', margin: '2px 0 0' }}>
                            {isBlocked ? '차단됨 (예약 불가)' : '예약 가능'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleToggle(selectedDate, block.startH)}
                          disabled={isToggling}
                          style={{ padding: '5px 14px', borderRadius: '100px', border: 'none', background: isBlocked ? '#FFF0EE' : '#2C2420', color: isBlocked ? '#C0392B' : '#FAF8F5', fontSize: '12px', fontWeight: 500, cursor: isToggling ? 'not-allowed' : 'pointer', transition: 'all 0.2s', minWidth: '60px' }}>
                          {isToggling ? '...' : isBlocked ? '차단 해제' : '차단'}
                        </button>
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
                {reservations.map(reservation => {
                  const startDt = reservation.slot ? formatDateTime(reservation.slot.start_time) : null
                  const duration = reservation.slot ? getDuration(reservation.slot.start_time, reservation.slot.end_time) : null
                  const isUpcoming = reservation.status === 'confirmed' && new Date(reservation.slot?.start_time ?? '') >= now
                  return (
                    <div key={reservation.id} className="rounded-2xl"
                      style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '22px 26px', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(44,36,32,0.08)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
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
                        {/* 완료된 상담만 일지 버튼 표시 */}
                        {reservation.status === 'confirmed' && new Date(reservation.slot?.start_time ?? '') < now && (
                          <button
                            onClick={() => { setActiveTab('journal'); setSelectedReservation(reservation) }}
                            style={{ padding: '8px 18px', borderRadius: '100px', border: 'none', background: '#2C2420', color: '#FAF8F5', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#C4A882' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2C2420' }}>
                            {reservation.journal_id ? '일지 보기' : '일지 작성'}
                          </button>
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

        {/* ── 일지 작성 탭 ── */}
        {activeTab === 'journal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', alignItems: 'start' }}>

            {/* 왼쪽: 완료된 예약 목록 */}
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#2C2420', marginBottom: '12px' }}>
                상담 완료 목록
              </p>
              {reservationsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9E8E84', fontSize: '14px' }}>불러오는 중...</div>
              ) : completedReservations.length === 0 ? (
                <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '32px 20px', textAlign: 'center' }}>
                  <p className="text-sm font-light" style={{ color: '#9E8E84' }}>완료된 상담이 없습니다.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {completedReservations.map(r => {
                    const startDt = r.slot ? formatDateTime(r.slot.start_time) : null
                    const isSelected = selectedReservation?.id === r.id
                    return (
                      <div key={r.id}
                        onClick={() => setSelectedReservation(r)}
                        className="rounded-xl"
                        style={{
                          background: isSelected ? '#2C2420' : '#fff',
                          border: `1px solid ${isSelected ? '#2C2420' : '#EDE8E0'}`,
                          padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = '#C4A882' }}
                        onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = '#EDE8E0' }}
                      >
                        <p style={{ fontSize: '14px', fontWeight: 500, color: isSelected ? '#FAF8F5' : '#2C2420', margin: '0 0 4px' }}>
                          {r.client_name ?? '내담자'}
                        </p>
                        {startDt && (
                          <p style={{ fontSize: '12px', color: isSelected ? '#C4A882' : '#9E8E84', margin: 0 }}>
                            {startDt.date} {startDt.time}
                          </p>
                        )}
                        {r.journal_id && (
                          <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '100px', background: isSelected ? '#C4A882' : '#F5F0E8', color: isSelected ? '#FAF8F5' : '#C4A882' }}>
                            일지 작성됨
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 오른쪽: 일지 작성 폼 */}
            <div>
              {!selectedReservation ? (
                <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '60px 40px', textAlign: 'center' }}>
                  <p style={{ fontSize: '15px', color: '#9E8E84', fontWeight: 300 }}>
                    왼쪽에서 상담을 선택하면<br />일지를 작성할 수 있습니다.
                  </p>
                </div>
              ) : journalLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#9E8E84' }}>불러오는 중...</div>
              ) : (
                <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '28px' }}>

                  {/* 예약 정보 */}
                  <div style={{ marginBottom: '20px' }}>
                    <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882', marginBottom: '6px' }}>
                      {existingJournal ? '일지 수정' : '일지 작성'}
                    </p>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 400, color: '#2C2420', margin: '0 0 4px' }}>
                      {selectedReservation.client_name ?? '내담자'} 님
                    </h3>
                    {selectedReservation.slot && (
                      <p className="text-sm font-light" style={{ color: '#9E8E84', margin: 0 }}>
                        {formatDateTime(selectedReservation.slot.start_time).date} · {formatDateTime(selectedReservation.slot.start_time).time}
                      </p>
                    )}
                  </div>

                  <div className="h-px" style={{ background: '#EDE8E0', marginBottom: '20px' }} />

                  {/* 일지 내용 */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#9E8E84', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      상담 내용
                    </label>
                    <textarea
                      value={journalContent}
                      onChange={(e) => setJournalContent(e.target.value)}
                      placeholder="이번 상담에서 있었던 내용, 내담자의 상태, 다음 상담 방향 등을 자유롭게 기록해주세요."
                      rows={10}
                      style={{
                        width: '100%', padding: '14px 16px', borderRadius: '12px',
                        border: '1px solid #EDE8E0', background: '#FAF8F5',
                        fontSize: '14px', color: '#2C2420', lineHeight: 1.7,
                        fontFamily: "'DM Sans', sans-serif", resize: 'vertical',
                        outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#C4A882' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#EDE8E0' }}
                    />
                  </div>

                  {/* 비공개 설정 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px 16px', borderRadius: '12px', background: '#FAF8F5', border: '1px solid #EDE8E0' }}>
                    <input
                      type="checkbox"
                      id="journal-private"
                      checked={journalPrivate}
                      onChange={(e) => setJournalPrivate(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#2C2420', cursor: 'pointer' }}
                    />
                    <label htmlFor="journal-private" style={{ fontSize: '13px', color: '#2C2420', cursor: 'pointer', userSelect: 'none' }}>
                      비공개 일지 (내담자에게 공개하지 않음)
                    </label>
                  </div>

                  {/* 메세지 */}
                  {journalMsg && (
                    <p style={{ fontSize: '13px', marginBottom: '12px', color: journalMsg.includes('실패') || journalMsg.includes('입력') ? '#C0392B' : '#5A8A6A' }}>
                      {journalMsg}
                    </p>
                  )}

                  {/* 저장 버튼 */}
                  <button
                    onClick={handleSaveJournal}
                    disabled={journalSaving}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '100px',
                      background: journalSaving ? '#C4A882' : '#2C2420',
                      color: '#FAF8F5', border: 'none',
                      cursor: journalSaving ? 'not-allowed' : 'pointer',
                      fontSize: '14px', fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!journalSaving) (e.currentTarget.style.background = '#C4A882') }}
                    onMouseLeave={(e) => { if (!journalSaving) (e.currentTarget.style.background = '#2C2420') }}
                  >
                    {journalSaving ? '저장 중...' : existingJournal ? '일지 수정' : '일지 저장'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}