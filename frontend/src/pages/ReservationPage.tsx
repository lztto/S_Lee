import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../services/api'

interface CounselorDetail {
  id: string
  name: string
  email: string
  profile_image: string | null
  available_slots: SlotItem[]
}

interface SlotItem {
  id: string
  start_time: string
  end_time: string
  is_available: boolean
  reason?: 'time_passed' | 'blocked' | 'reserved' | null
  is_virtual?: boolean
}

// ── 리뷰 타입 추가 ──
interface Review {
  id: string
  rating: number
  content: string
  client_name: string
  created_at: string
}

interface DayGroup {
  dateKey: string
  dateLabel: string
  slots: SlotItem[]
}

function groupByDate(slots: SlotItem[]): DayGroup[] {
  const map = new Map<string, SlotItem[]>()
  for (const slot of slots) {
    const d = new Date(slot.start_time)
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    const key = kst.toISOString().slice(0, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(slot)
  }
  return Array.from(map.entries()).map(([dateKey, slots]) => ({
    dateKey,
    dateLabel: new Date(dateKey + 'T12:00:00').toLocaleDateString('ko-KR', {
      month: 'long', day: 'numeric', weekday: 'short',
    }),
    slots: slots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
  }))
}

function buildCalendar(year: number, month: number, availableDates: Set<string>) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// ── 별점 컴포넌트 ──
function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width="14" height="14" viewBox="0 0 16 16" fill={star <= rating ? '#C4A882' : '#EDE8E0'}>
          <path d="M8 1l1.9 3.8 4.2.6-3 2.9.7 4.2L8 10.4l-3.8 2 .7-4.2-3-2.9 4.2-.6z" />
        </svg>
      ))}
    </div>
  )
}

export default function ReservationPage() {
  const { counselorId } = useParams<{ counselorId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token } = useAuthStore()

  const [counselor, setCounselor] = useState<CounselorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── 리뷰 상태 추가 ──
  const [reviews, setReviews] = useState<Review[]>([])
  const [avgRating, setAvgRating] = useState(0)
  const [reviewsLoading, setReviewsLoading] = useState(true)

  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [paying, setPaying] = useState(false)
  const [success, setSuccess] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get(`/counselors/${counselorId}`)
      setCounselor(res.data.data)
    } catch {
      setError('상담사 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [counselorId])

  // ── 리뷰 fetch ──
  const fetchReviews = useCallback(async () => {
    try {
      setReviewsLoading(true)
      const res = await api.get(`/reviews/counselor/${counselorId}`)
      setReviews(res.data.data)
      setAvgRating(res.data.avg_rating)
    } catch {
      // 리뷰 로딩 실패는 조용히 처리
    } finally {
      setReviewsLoading(false)
    }
  }, [counselorId])

  useEffect(() => {
    fetchData()
    fetchReviews()
  }, [fetchData, fetchReviews])

  useEffect(() => {
    if (token && counselor) {
      const saved = sessionStorage.getItem('pendingSlotId')
      if (saved) {
        const slot = counselor.available_slots.find(s => s.id === saved)
        if (slot) {
          setSelectedSlot(slot)
          setSelectedDate(new Date(slot.start_time).toISOString().slice(0, 10))
        }
        sessionStorage.removeItem('pendingSlotId')
      }
    }
  }, [token, counselor])

  const allSlots = counselor?.available_slots ?? []
  const dayGroups = groupByDate(allSlots)
  const availableDates = new Set(
    dayGroups.filter(g => g.slots.some(s => s.is_available)).map(g => g.dateKey)
  )
  const allDates = new Set(dayGroups.map(g => g.dateKey))
  const slotsForDate = selectedDate
    ? (dayGroups.find(g => g.dateKey === selectedDate)?.slots ?? [])
    : []

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  const getDuration = (start: string, end: string) => {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000
    return `${diff}분`
  }

  const handlePayAndReserve = async () => {
    if (!selectedSlot) return
    if (!token) {
      sessionStorage.setItem('pendingSlotId', selectedSlot.id)
      setShowLoginModal(true)
      return
    }
    try {
      setPaying(true)
      setError(null)

      // 토스페이먼츠 SDK 동적 로드
      const tossPayments = await loadTossPayments()

      await tossPayments.requestPayment('카드', {
        amount: 50000,
        orderId: `res-${Date.now()}`,   // 토스 규칙: 영문+숫자+-_ 6~64자
        orderName: `${counselor?.name} 상담사 상담 예약`,
        customerName: user?.name ?? '고객',
        // 토스가 successUrl에 paymentKey, orderId, amount를 자동으로 붙여줌
        successUrl: `${window.location.origin}/reservation/${counselorId}?slotId=${selectedSlot.id}&startTime=${encodeURIComponent(selectedSlot.start_time)}&isVirtual=${selectedSlot.id.startsWith('virtual_')}`,
        failUrl: `${window.location.origin}/reservation/${counselorId}?paymentFailed=true`,
      })
    } catch (e: any) {
      if (e?.code === 'USER_CANCEL') {
        setError(null)
      } else {
        setError('결제에 실패했습니다. 다시 시도해주세요.')
      }
      setPaying(false)
    }
  }

  const loadTossPayments = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).TossPayments) {
        resolve((window as any).TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY))
        return
      }
      const script = document.createElement('script')
      script.src = 'https://js.tosspayments.com/v1/payment'
      script.onload = () => {
        resolve((window as any).TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY))
      }
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)

    // 결제 실패 처리
    if (params.get('paymentFailed') === 'true') {
      setError('결제가 취소되었거나 실패했습니다.')
      navigate(`/reservation/${counselorId}`, { replace: true })
      return
    }

    // 토스가 successUrl에 자동으로 붙여주는 paymentKey 확인
    const paymentKey = params.get('paymentKey')
    const slotId = params.get('slotId')

    // 결제 성공 파라미터 없으면 무시
    if (!paymentKey || !slotId) return
    // 토큰 없으면 무시 (로그인 필요)
    if (!token) return
    // counselor 아직 로드 중이면 대기 (counselor 로드 후 재실행됨)
    if (!counselor) return

    ;(async () => {
      try {
        setPaying(true)
        setError(null)

        const isVirtualSlot = params.get('isVirtual') === 'true'
        const startTimeParam = params.get('startTime')
        const startTime = startTimeParam ? decodeURIComponent(startTimeParam) : null

        // 예약 생성 API 호출
        const res = await api.post('/reservations', {
          slot_id: slotId,
          ...(isVirtualSlot && counselorId && startTime
            ? { counselor_id: counselorId, start_time: startTime }
            : {}),
        })

        const reservationId = res.data.data?.id ?? ''
        const endTimeISO = startTime
          ? new Date(new Date(startTime).getTime() + 2 * 60 * 60 * 1000).toISOString()
          : ''

        // 결제 완료 페이지로 이동
        navigate(
          `/payment-success` +
          `?reservationId=${reservationId}` +
          `&counselorName=${encodeURIComponent(counselor.name)}` +
          `&startTime=${encodeURIComponent(startTime ?? '')}` +
          `&endTime=${encodeURIComponent(endTimeISO)}` +
          `&amount=50000`,
          { replace: true }
        )
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? '예약 처리에 실패했습니다.')
        navigate(`/reservation/${counselorId}`, { replace: true })
      } finally {
        setPaying(false)
      }
    })()
  }, [location.search, token, counselor])  // counselor 로드 완료 후 실행 보장

  const calCells = buildCalendar(calYear, calMonth, availableDates)

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
    setSelectedDate(null)
    setSelectedSlot(null)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  // ── 예약 완료 화면 ──
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF8F5' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');* { font-family: 'DM Sans', sans-serif; }`}</style>
        <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '48px 40px', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F0F5EE', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>✓</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 400, color: '#2C2420', marginBottom: '8px' }}>예약 완료</h2>
          <p className="text-sm font-light" style={{ color: '#9E8E84', marginBottom: '4px' }}>{counselor?.name} 상담사</p>
          {selectedSlot && (
            <p className="text-sm font-light" style={{ color: '#C4A882', marginBottom: '28px' }}>
              {new Date(selectedSlot.start_time).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
              {' '}{formatTime(selectedSlot.start_time)} — {formatTime(selectedSlot.end_time)}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={() => navigate('/')} className="px-5 py-2 rounded-full text-sm font-medium"
              style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent', cursor: 'pointer' }}>
              홈으로
            </button>
            <button onClick={() => navigate('/my-reservations')} className="px-5 py-2 rounded-full text-sm font-medium"
              style={{ background: '#2C2420', color: '#FAF8F5', border: 'none', cursor: 'pointer' }}>
              내 예약 확인
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');* { font-family: 'DM Sans', sans-serif; }`}</style>

      {/* 로그인 유도 모달 */}
      {showLoginModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,32,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '36px 32px', maxWidth: '360px', width: '90%', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F5F0E8', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🔒</div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 400, color: '#2C2420', marginBottom: '8px' }}>로그인이 필요합니다</h3>
            <p className="text-sm font-light" style={{ color: '#9E8E84', marginBottom: '24px' }}>
              예약하려면 로그인이 필요한 서비스입니다.<br />로그인 후 선택한 시간으로 돌아옵니다.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowLoginModal(false)}
                className="flex-1 py-2 rounded-full text-sm font-medium"
                style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent', cursor: 'pointer' }}>
                취소
              </button>
              <button
                onClick={() => {
                  setShowLoginModal(false)
                  navigate('/login', { state: { from: location.pathname } })
                }}
                className="flex-1 py-2 rounded-full text-sm font-medium"
                style={{ background: '#2C2420', color: '#FAF8F5', border: 'none', cursor: 'pointer' }}>
                로그인하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ background: 'rgba(250,248,245,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE8E0', height: '64px', padding: '0 32px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9E8E84', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← 목록으로
        </button>
        <div style={{ margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontSize: '16px' }}>
            S<span style={{ color: '#C4A882' }}>.</span>LEE
          </div>
        </div>
        {user && (
          <span className="text-sm font-light" style={{ color: '#9E8E84' }}>{user.name}님</span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '120px 0', color: '#9E8E84' }}>불러오는 중...</div>
      ) : error && !counselor ? (
        <div style={{ textAlign: 'center', padding: '120px 0' }}>
          <p style={{ color: '#C0392B', marginBottom: '16px' }}>{error}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-full text-sm font-medium"
            style={{ background: '#2C2420', color: '#FAF8F5', border: 'none', cursor: 'pointer' }}>
            다시 시도
          </button>
        </div>
      ) : counselor && (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 32px' }}>

          {/* 상담사 프로필 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            {counselor.profile_image ? (
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', overflow: 'hidden', flexShrink: 0, border: '2px solid #F5F0E8' }}>
                <img src={counselor.profile_image} alt={counselor.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
              </div>
            ) : (
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", fontSize: '22px', color: '#C4A882', flexShrink: 0 }}>
                {counselor.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882', marginBottom: '4px' }}>심리 · 코칭 상담</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 400, color: '#2C2420', margin: 0 }}>
                {counselor.name} 상담사
              </h2>
              <p className="text-sm font-light" style={{ color: '#9E8E84', margin: 0 }}>{counselor.email}</p>
            </div>
          </div>

          <div className="h-px" style={{ background: '#EDE8E0', margin: '20px 0 28px' }} />

          {/* 2컬럼: 달력+시간 / 예약 확인 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px', alignItems: 'start' }}>

            {/* 왼쪽: 달력 + 시간 선택 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 400, color: '#2C2420', margin: 0 }}>
                  예약 가능한 시간
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={prevMonth}
                    disabled={calYear === today.getFullYear() && calMonth <= today.getMonth()}
                    style={{ background: 'none', border: '1px solid #EDE8E0', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', color: '#9E8E84', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (calYear === today.getFullYear() && calMonth <= today.getMonth()) ? 0.3 : 1 }}>
                    ‹
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#2C2420', minWidth: '80px', textAlign: 'center' }}>
                    {calYear}년 {calMonth + 1}월
                  </span>
                  <button onClick={nextMonth}
                    style={{ background: 'none', border: '1px solid #EDE8E0', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', color: '#9E8E84', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ›
                  </button>
                </div>
              </div>

              {/* 달력 그리드 */}
              <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '8px' }}>
                  {WEEKDAYS.map(w => (
                    <div key={w} style={{ textAlign: 'center', fontSize: '11px', color: '#9E8E84', padding: '4px 0', fontWeight: 500 }}>{w}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                  {calCells.map((day, idx) => {
                    if (!day) return <div key={idx} />
                    const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const hasAvailable = availableDates.has(dateKey)
                    const hasAny = allDates.has(dateKey)
                    const isSelected = selectedDate === dateKey
                    const isPast = new Date(dateKey) < new Date(today.toDateString())
                    const isToday = dateKey === today.toISOString().slice(0, 10)
                    const isClickable = hasAny && !isPast
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (!isClickable) return
                          setSelectedDate(isSelected ? null : dateKey)
                          setSelectedSlot(null)
                        }}
                        style={{
                          textAlign: 'center', padding: '8px 4px', borderRadius: '8px', fontSize: '13px',
                          cursor: isClickable ? 'pointer' : 'default',
                          background: isSelected ? '#2C2420' : isClickable ? '#F5F0E8' : 'transparent',
                          color: isSelected ? '#FAF8F5' : isPast ? '#DDD5C8' : isClickable ? '#2C2420' : '#9E8E84',
                          fontWeight: isToday ? 600 : 400, transition: 'all 0.15s', position: 'relative',
                        }}
                        onMouseEnter={(e) => { if (isClickable && !isSelected) (e.currentTarget as HTMLDivElement).style.background = '#EDE8E0' }}
                        onMouseLeave={(e) => {
                          if (isClickable && !isSelected) (e.currentTarget as HTMLDivElement).style.background = '#F5F0E8'
                          else if (!isClickable) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                        }}
                      >
                        {day}
                        {hasAvailable && !isSelected && (
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#C4A882', margin: '2px auto 0' }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 시간 슬롯 */}
              {selectedDate && (
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#2C2420', marginBottom: '10px' }}>
                    {dayGroups.find(g => g.dateKey === selectedDate)?.dateLabel} 예약 가능 시간
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {slotsForDate.map((slot) => {
                      const isSelected = selectedSlot?.id === slot.id
                      const canSelect = slot.is_available
                      const reasonLabel: Record<string, string> = {
                        time_passed: '시간 초과', blocked: '상담 불가', reserved: '예약 완료',
                      }
                      return (
                        <button
                          key={slot.id}
                          onClick={() => canSelect && setSelectedSlot(isSelected ? null : slot)}
                          style={{
                            position: 'relative', padding: canSelect ? '8px 16px' : '6px 16px',
                            borderRadius: '100px',
                            border: isSelected ? '1.5px solid #2C2420' : canSelect ? '1px solid #EDE8E0' : '1px solid #E0E0E0',
                            background: isSelected ? '#2C2420' : canSelect ? '#fff' : '#F5F5F5',
                            color: isSelected ? '#FAF8F5' : canSelect ? '#2C2420' : '#BDBDBD',
                            fontSize: '13px', cursor: canSelect ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden',
                            minWidth: '130px', textAlign: 'center',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                          }}
                          onMouseEnter={(e) => {
                            if (canSelect && !isSelected) {
                              (e.currentTarget as HTMLButtonElement).style.borderColor = '#C4A882'
                              ;(e.currentTarget as HTMLButtonElement).style.color = '#C4A882'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (canSelect && !isSelected) {
                              (e.currentTarget as HTMLButtonElement).style.borderColor = '#EDE8E0'
                              ;(e.currentTarget as HTMLButtonElement).style.color = '#2C2420'
                            }
                          }}
                        >
                          {!canSelect && (
                            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: '100px' }}
                              xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                              <defs>
                                <pattern id={`h-${slot.id.slice(-6)}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                  <line x1="0" y1="0" x2="0" y2="8" stroke="#D0D0D0" strokeWidth="1.2" />
                                </pattern>
                              </defs>
                              <rect width="100%" height="100%" fill={`url(#h-${slot.id.slice(-6)})`} />
                            </svg>
                          )}
                          <span style={{ position: 'relative', zIndex: 1, fontSize: '13px' }}>
                            {formatTime(slot.start_time)} — {formatTime(slot.end_time)}
                          </span>
                          {!canSelect && slot.reason && (
                            <span style={{ position: 'relative', zIndex: 1, fontSize: '10px', color: '#BDBDBD' }}>
                              {reasonLabel[slot.reason] ?? '예약 불가'}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {!selectedDate && availableDates.size === 0 && (
                <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '40px', textAlign: 'center', color: '#9E8E84' }}>
                  <p style={{ fontSize: '15px', marginBottom: '6px' }}>현재 예약 가능한 시간이 없습니다.</p>
                  <p className="text-sm font-light">나중에 다시 확인해주세요.</p>
                </div>
              )}

              {!selectedDate && allSlots.length > 0 && (
                <p className="text-sm font-light" style={{ color: '#9E8E84', marginTop: '8px' }}>
                  📅 달력에서 날짜를 선택해주세요
                </p>
              )}
            </div>

            {/* 오른쪽: 예약 확인 패널 */}
            <div style={{ position: 'sticky', top: '80px' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 400, color: '#2C2420', marginBottom: '16px' }}>
                예약 확인
              </h3>
              <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '24px', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: selectedSlot ? 'flex-start' : 'center', alignItems: selectedSlot ? 'flex-start' : 'center' }}>
                {selectedSlot ? (
                  <>
                    <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882', marginBottom: '12px' }}>Selected</p>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: '#2C2420', marginBottom: '4px' }}>
                      {dayGroups.find(g => g.dateKey === selectedDate)?.dateLabel}
                    </p>
                    <p style={{ fontSize: '20px', fontWeight: 500, color: '#2C2420', marginBottom: '4px' }}>
                      {formatTime(selectedSlot.start_time)} — {formatTime(selectedSlot.end_time)}
                    </p>
                    <p className="text-xs font-light" style={{ color: '#9E8E84', marginBottom: '20px' }}>
                      {getDuration(selectedSlot.start_time, selectedSlot.end_time)}
                    </p>
                    <div className="h-px" style={{ background: '#EDE8E0', width: '100%', marginBottom: '16px' }} />
                    <div style={{ width: '100%', background: '#FAF8F5', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-sm font-light" style={{ color: '#9E8E84' }}>예약금</span>
                        <span style={{ fontSize: '15px', fontWeight: 500, color: '#2C2420' }}>50,000원</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#C4A882', margin: '4px 0 0' }}>상담 후 전액 환급됩니다</p>
                    </div>
                    {error && (
                      <p className="text-sm" style={{ color: '#C0392B', marginBottom: '12px', width: '100%' }}>{error}</p>
                    )}
                    <button
                      onClick={handlePayAndReserve}
                      disabled={paying}
                      className="rounded-full text-sm font-medium"
                      style={{ width: '100%', padding: '12px', background: paying ? '#C4A882' : '#2C2420', color: '#FAF8F5', border: 'none', cursor: paying ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { if (!paying) (e.currentTarget.style.background = '#C4A882') }}
                      onMouseLeave={(e) => { if (!paying) (e.currentTarget.style.background = '#2C2420') }}
                    >
                      {paying ? '처리 중...' : '결제 후 예약 확정'}
                    </button>
                    <p style={{ fontSize: '11px', color: '#9E8E84', textAlign: 'center', marginTop: '10px', width: '100%' }}>
                      토스페이먼츠 안전 결제
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-light" style={{ color: '#9E8E84', textAlign: 'center' }}>
                    날짜와 시간을<br />선택해주세요
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── 리뷰 섹션 ── */}
          <div style={{ marginTop: '56px' }}>
            <div className="h-px" style={{ background: '#EDE8E0', marginBottom: '32px' }} />

            {/* 리뷰 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 400, color: '#2C2420', margin: 0 }}>
                상담 후기
              </h3>
              {reviews.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StarRating rating={Math.round(avgRating)} />
                  <span style={{ fontSize: '15px', fontWeight: 500, color: '#2C2420' }}>{avgRating.toFixed(1)}</span>
                  <span style={{ fontSize: '13px', color: '#9E8E84' }}>({reviews.length}개)</span>
                </div>
              )}
            </div>

            {/* 리뷰 목록 */}
            {reviewsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9E8E84', fontSize: '14px' }}>
                불러오는 중...
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '48px', textAlign: 'center' }}>
                <p style={{ fontSize: '15px', color: '#9E8E84', marginBottom: '4px' }}>아직 작성된 후기가 없습니다.</p>
                <p className="text-sm font-light" style={{ color: '#C4A882' }}>첫 번째 후기를 남겨보세요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl"
                    style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '24px 28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* 아바타 */}
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: '#F5F0E8', color: '#C4A882',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '13px', fontWeight: 500, flexShrink: 0,
                        }}>
                          {review.client_name[0]}
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: '#2C2420', margin: 0 }}>
                            {review.client_name}
                          </p>
                          <p style={{ fontSize: '11px', color: '#9E8E84', margin: 0 }}>
                            {new Date(review.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <StarRating rating={review.rating} />
                    </div>
                    <p style={{ fontSize: '14px', color: '#6B5B4E', lineHeight: 1.7, margin: 0 }}>
                      {review.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}