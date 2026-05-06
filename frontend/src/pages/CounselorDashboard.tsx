import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMySlots, createSlot, deleteSlot } from '@/services/slotService'
import { getSlotReservations } from '@/services/ReservationService'
import { useAuthStore } from '@/store/auth'
import type { Slot, Reservation } from '@/types'

type DashTab = 'slots' | 'reservations'

interface SlotForm {
  start_time: string
  end_time: string
}

const INIT_FORM: SlotForm = { start_time: '', end_time: '' }

export default function CounselorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<DashTab>('slots')

  // 슬롯 상태
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 슬롯 등록 폼
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SlotForm>(INIT_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // 예약 상태
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationsLoading, setReservationsLoading] = useState(false)
  const [reservationsError, setReservationsError] = useState<string | null>(null)

  useEffect(() => {
    fetchSlots()
  }, [])

  useEffect(() => {
    if (activeTab === 'reservations' && reservations.length === 0) {
      fetchReservations()
    }
  }, [activeTab])

  const fetchSlots = async () => {
    try {
      setSlotsLoading(true)
      setSlotsError(null)
      const data = await getMySlots()
      setSlots(data)
    } catch {
      setSlotsError('슬롯 목록을 불러오지 못했습니다.')
    } finally {
      setSlotsLoading(false)
    }
  }

  const fetchReservations = async () => {
    try {
      setReservationsLoading(true)
      setReservationsError(null)
      const data = await getSlotReservations()
      setReservations(data)
    } catch {
      setReservationsError('예약 목록을 불러오지 못했습니다.')
    } finally {
      setReservationsLoading(false)
    }
  }

  const handleCreateSlot = async () => {
    setFormError(null)
    if (!form.start_time || !form.end_time) {
      setFormError('시작 시간과 종료 시간을 모두 입력해주세요.')
      return
    }
    if (new Date(form.start_time) >= new Date(form.end_time)) {
      setFormError('종료 시간은 시작 시간보다 늦어야 합니다.')
      return
    }
    if (new Date(form.start_time) < new Date()) {
      setFormError('과거 시간에는 슬롯을 만들 수 없습니다.')
      return
    }
    try {
      setCreating(true)
      const newSlot = await createSlot(form)
      setSlots((prev) =>
        [...prev, newSlot].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
      )
      setForm(INIT_FORM)
      setShowForm(false)
    } catch {
      setFormError('슬롯 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('이 슬롯을 삭제하시겠습니까?')) return
    try {
      setDeletingId(slotId)
      await deleteSlot(slotId)
      setSlots((prev) => prev.filter((s) => s.id !== slotId))
    } catch {
      alert('슬롯 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return {
      date: d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
      time: d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }
  }

  const getDuration = (start: string, end: string) => {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000
    return `${diff}분`
  }

  const now = new Date()
  const availableSlots = slots.filter((s) => s.is_available && new Date(s.start_time) >= now)
  const bookedSlots = slots.filter((s) => !s.is_available)
  const upcomingReservations = reservations.filter(
    (r) => r.status === 'confirmed' && new Date(r.slot?.start_time ?? '') >= now
  )

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#FFFFFF',
    border: '1px solid #EDE8E0',
    borderRadius: '12px',
    padding: '10px 14px',
    color: '#2C2420',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        input[type="datetime-local"] { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* 헤더 */}
      <div style={{ background: 'rgba(250,248,245,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE8E0', height: '64px', padding: '0 40px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 400, color: '#2C2420', margin: 0 }}>
          상담사 대시보드
        </h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user && (
            <span className="text-sm font-light" style={{ color: '#9E8E84' }}>
              {user.name} 상담사님
            </span>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-full text-sm font-medium"
            style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent', cursor: 'pointer' }}
          >
            메인으로
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
        <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882', marginBottom: '8px' }}>Dashboard</p>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 400, color: '#2C2420', marginBottom: '32px' }}>
          일정 및 예약 관리
        </h2>

        {/* 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '36px' }}>
          {[
            { label: '예약 가능 슬롯', value: availableSlots.length, unit: '개' },
            { label: '예약된 슬롯', value: bookedSlots.length, unit: '개' },
            { label: '예정된 상담', value: upcomingReservations.length, unit: '건' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid #EDE8E0', padding: '20px 24px' }}>
              <p className="text-sm font-light" style={{ color: '#9E8E84', margin: '0 0 8px' }}>{card.label}</p>
              <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', fontWeight: 400, color: '#2C2420', lineHeight: 1 }}>{card.value}</span>
                <span className="text-sm font-light" style={{ color: '#9E8E84' }}>{card.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #EDE8E0', marginBottom: '24px' }}>
          {([['slots', '슬롯 관리'], ['reservations', '예약 확인']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{ padding: '10px 24px', border: 'none', borderBottom: activeTab === key ? '2px solid #2C2420' : '2px solid transparent', background: 'transparent', color: activeTab === key ? '#2C2420' : '#9E8E84', fontWeight: activeTab === key ? 500 : 400, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 슬롯 관리 탭 ── */}
        {activeTab === 'slots' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <button
                onClick={() => { setShowForm((v) => !v); setFormError(null); setForm(INIT_FORM) }}
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{ background: showForm ? 'transparent' : '#2C2420', color: showForm ? '#6B5B4E' : '#FAF8F5', border: showForm ? '1px solid #DDD5C8' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {showForm ? '취소' : '+ 슬롯 추가'}
              </button>
            </div>

            {/* 슬롯 등록 폼 */}
            {showForm && (
              <div className="rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid #C4A882', padding: '24px 28px', marginBottom: '20px' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 400, color: '#2C2420', margin: '0 0 20px' }}>새 슬롯 등록</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="text-xs font-medium" style={{ color: '#9E8E84', display: 'block', marginBottom: '6px' }}>시작 시간</label>
                    <input type="datetime-local" value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#C4A882')}
                      onBlur={(e) => (e.target.style.borderColor = '#EDE8E0')} />
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: '#9E8E84', display: 'block', marginBottom: '6px' }}>종료 시간</label>
                    <input type="datetime-local" value={form.end_time} onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))} style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#C4A882')}
                      onBlur={(e) => (e.target.style.borderColor = '#EDE8E0')} />
                  </div>
                </div>
                {formError && <p className="text-sm" style={{ color: '#C0392B', marginBottom: '12px' }}>{formError}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-full text-sm font-medium" style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent', cursor: 'pointer' }}>취소</button>
                  <button onClick={handleCreateSlot} disabled={creating} className="px-4 py-2 rounded-full text-sm font-medium"
                    style={{ background: creating ? '#C4A882' : '#2C2420', color: '#FAF8F5', border: 'none', cursor: creating ? 'not-allowed' : 'pointer' }}>
                    {creating ? '등록 중...' : '슬롯 등록'}
                  </button>
                </div>
              </div>
            )}

            {/* 슬롯 목록 */}
            {slotsLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#9E8E84' }}>불러오는 중...</div>
            ) : slotsError ? (
              <div style={{ background: '#FFF5F5', border: '1px solid #FCD5D5', borderRadius: '12px', padding: '20px', color: '#C0392B', textAlign: 'center' }}>{slotsError}</div>
            ) : slots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#9E8E84' }}>
                <p style={{ fontSize: '15px', marginBottom: '8px' }}>등록된 슬롯이 없습니다.</p>
                <p className="text-sm font-light">위의 버튼으로 상담 가능 시간을 추가해보세요.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {slots.map((slot) => {
                  const { date, time } = formatDateTime(slot.start_time)
                  const duration = getDuration(slot.start_time, slot.end_time)
                  const isPast = new Date(slot.start_time) < now
                  const isDeleting = deletingId === slot.id
                  return (
                    <div key={slot.id} className="rounded-2xl"
                      style={{ background: '#FFFFFF', border: '1px solid #EDE8E0', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: isPast ? 0.6 : 1, transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { if (!isPast) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(44,36,32,0.06)' } }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isPast ? '#DDD5C8' : slot.is_available ? '#5A8A6A' : '#C4A882', flexShrink: 0 }} />
                        <div>
                          <p style={{ fontWeight: 500, color: '#2C2420', margin: '0 0 2px', fontSize: '14px' }}>{date} {time}</p>
                          <p className="text-sm font-light" style={{ color: '#9E8E84', margin: 0 }}>{duration}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ background: isPast ? '#F5F0E8' : slot.is_available ? '#F0F5EE' : '#F5F0E8', color: isPast ? '#9E8E84' : slot.is_available ? '#5A8A6A' : '#C4A882', borderRadius: '100px', padding: '3px 12px', fontSize: '11px', fontWeight: 500 }}>
                          {isPast ? '종료' : slot.is_available ? '예약 가능' : '예약됨'}
                        </span>
                        {slot.is_available && !isPast && (
                          <button onClick={() => handleDeleteSlot(slot.id)} disabled={isDeleting}
                            style={{ border: '1px solid #EDE8E0', color: isDeleting ? '#C4A882' : '#9E8E84', background: 'transparent', cursor: isDeleting ? 'not-allowed' : 'pointer', fontSize: '12px', padding: '4px 12px', borderRadius: '100px', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => { if (!isDeleting) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#C0392B'; (e.currentTarget as HTMLButtonElement).style.color = '#C0392B' } }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#EDE8E0'; (e.currentTarget as HTMLButtonElement).style.color = '#9E8E84' }}
                          >
                            {isDeleting ? '삭제 중...' : '삭제'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {reservations.map((reservation) => {
                  const startDt = reservation.slot ? formatDateTime(reservation.slot.start_time) : null
                  const duration = reservation.slot ? getDuration(reservation.slot.start_time, reservation.slot.end_time) : null
                  const isUpcoming = reservation.status === 'confirmed' && new Date(reservation.slot?.start_time ?? '') >= now
                  return (
                    <div key={reservation.id} className="rounded-2xl"
                      style={{ background: '#FFFFFF', border: '1px solid #EDE8E0', padding: '24px 28px', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(44,36,32,0.08)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ display: 'inline-block', background: reservation.status === 'cancelled' ? '#FFF0EE' : isUpcoming ? '#F5F0E8' : '#F0F5EE', color: reservation.status === 'cancelled' ? '#C0392B' : isUpcoming ? '#C4A882' : '#5A8A6A', borderRadius: '100px', padding: '3px 12px', fontSize: '11px', fontWeight: 500, marginBottom: '12px' }}>
                            {reservation.status === 'cancelled' ? '취소됨' : isUpcoming ? '예정' : '완료'}
                          </span>
                          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 400, color: '#2C2420', margin: '0 0 8px' }}>
                            {reservation.client_name ?? '내담자'}
                          </h3>
                          {startDt && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <p className="text-sm" style={{ color: '#2C2420', margin: 0, fontWeight: 500 }}>{startDt.date}</p>
                              <p className="text-sm font-light" style={{ color: '#9E8E84', margin: 0 }}>{startDt.time} · {duration}</p>
                            </div>
                          )}
                        </div>
                        {reservation.status === 'confirmed' && new Date(reservation.slot?.start_time ?? '') < now && (
                          <a href={`/journal/${reservation.id}`}
                            className="px-4 py-2 rounded-full text-sm font-medium"
                            style={{ background: '#2C2420', color: '#FAF8F5', textDecoration: 'none', display: 'inline-block', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#C4A882' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#2C2420' }}
                          >
                            {reservation.journal_id ? '일지 보기' : '일지 작성'}
                          </a>
                        )}
                      </div>
                      <div className="h-px" style={{ background: '#EDE8E0', margin: '16px 0 12px' }} />
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