import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyReservations, cancelReservation } from '@/services/ReservationService'
import { useAuthStore } from '@/store/auth'
import api from '@/services/api'
import type { Reservation } from '@/types'

type TabType = 'upcoming' | 'past' | 'cancelled'

// ── 별점 컴포넌트 ──
function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width="24" height="24" viewBox="0 0 16 16"
          fill={(hovered || value) >= star ? '#C4A882' : '#EDE8E0'}
          style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          <path d="M8 1l1.9 3.8 4.2.6-3 2.9.7 4.2L8 10.4l-3.8 2 .7-4.2-3-2.9 4.2-.6z" />
        </svg>
      ))}
    </div>
  )
}

function StarRatingDisplay({ rating }: { rating: number }) {
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

// ── 인라인 리뷰 작성 폼 ──
function ReviewForm({
  reservationId,
  onSuccess,
}: {
  reservationId: string
  onSuccess: () => void
}) {
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (rating === 0) { setError('별점을 선택해주세요.'); return }
    if (content.trim().length < 1) { setError('후기 내용을 입력해주세요.'); return }
    try {
      setSubmitting(true)
      setError(null)
      await api.post('/reviews', { reservation_id: reservationId, rating, content: content.trim() })
      onSuccess()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '후기 작성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: '16px', padding: '20px', background: '#FAF8F5', borderRadius: '14px' }}>
      <p style={{ fontSize: '13px', fontWeight: 500, color: '#2C2420', marginBottom: '12px' }}>
        상담은 어떠셨나요?
      </p>

      {/* 별점 */}
      <div style={{ marginBottom: '12px' }}>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      {/* 내용 */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="상담 후기를 자유롭게 작성해주세요 (최대 1000자)"
        maxLength={1000}
        rows={4}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: '12px',
          border: '1px solid #EDE8E0', background: '#fff',
          fontSize: '13px', color: '#2C2420', lineHeight: 1.6,
          resize: 'none', outline: 'none', boxSizing: 'border-box',
          fontFamily: "'DM Sans', sans-serif",
        }}
      />
      <p style={{ fontSize: '11px', color: '#9E8E84', textAlign: 'right', margin: '4px 0 12px' }}>
        {content.length} / 1000
      </p>

      {error && (
        <p style={{ fontSize: '12px', color: '#C0392B', marginBottom: '10px' }}>{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: '100%', padding: '10px', borderRadius: '100px',
          background: submitting ? '#C4A882' : '#2C2420', color: '#FAF8F5',
          border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: 500, transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { if (!submitting) (e.currentTarget.style.background = '#C4A882') }}
        onMouseLeave={(e) => { if (!submitting) (e.currentTarget.style.background = '#2C2420') }}
      >
        {submitting ? '제출 중...' : '후기 제출'}
      </button>
    </div>
  )
}

export default function MyReservationsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // ── 리뷰 폼 열린 예약 ID ──
  const [reviewOpenId, setReviewOpenId] = useState<string | null>(null)

  useEffect(() => {
    fetchReservations()
  }, [])

  const fetchReservations = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getMyReservations()
      setReservations(data)
    } catch {
      setError('예약 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (reservationId: string) => {
    if (!confirm('예약을 취소하시겠습니까?')) return
    try {
      setCancellingId(reservationId)
      await cancelReservation(reservationId)
      setReservations((prev) =>
        prev.map((r) => r.id === reservationId ? { ...r, status: 'cancelled' } : r)
      )
    } catch {
      alert('예약 취소에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setCancellingId(null)
    }
  }

  // ── 리뷰 작성 완료 → review_id 업데이트 ──
  const handleReviewSuccess = (reservationId: string) => {
    setReservations((prev) =>
      prev.map((r) => r.id === reservationId ? { ...r, review_id: 'done' } : r)
    )
    setReviewOpenId(null)
  }

  const now = new Date()

  // DB에서 오는 ISO string을 안전하게 UTC로 파싱
  // "+00:00" suffix가 없으면 브라우저가 로컬타임으로 해석하는 문제 방지
  const parseUTC = (iso: string | undefined) => {
    if (!iso) return new Date(0)
    // 이미 timezone 정보 있으면 그대로, 없으면 +00:00 붙이기
    const normalized = /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + '+00:00'
    return new Date(normalized)
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'upcoming', label: '예정된 예약' },
    { key: 'past', label: '지난 예약' },
    { key: 'cancelled', label: '취소된 예약' },
  ]

  const getCount = (key: TabType) => reservations.filter((r) => {
    if (key === 'cancelled') return r.status === 'cancelled'
    if (key === 'upcoming') return r.status === 'confirmed' && parseUTC(r.slot?.start_time) >= now
    if (key === 'past') return r.status === 'confirmed' && parseUTC(r.slot?.start_time) < now
    return false
  }).length

  const filteredReservations = reservations.filter((r) => {
    if (activeTab === 'cancelled') return r.status === 'cancelled'
    if (activeTab === 'upcoming') return r.status === 'confirmed' && parseUTC(r.slot?.start_time) >= now
    if (activeTab === 'past') return r.status === 'confirmed' && parseUTC(r.slot?.start_time) < now
    return false
  })

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return {
      date: date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }),
      time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }),
    }
  }

  const formatTimeRange = (start: string, end: string) => {
    const s = new Date(start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })
    const e = new Date(end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000
    return `${s} — ${e} (${diff}분)`
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* 헤더 */}
      <div style={{ background: 'rgba(250,248,245,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE8E0', height: '64px', padding: '0 32px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10, gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', marginRight: '8px' }} onClick={() => navigate('/')}>
          <span style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontSize: '16px', lineHeight: 1.2 }}>
            S<span style={{ color: '#C4A882' }}>.</span>LEE
          </span>
          <span style={{ fontSize: '8px', color: '#C4A882', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Secret Counseling</span>
        </div>
        <div style={{ width: '1px', height: '20px', background: '#EDE8E0' }} />
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 400, color: '#2C2420', margin: 0 }}>
          내 예약
        </h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {user && (
            <span className="text-sm font-light" style={{ color: '#9E8E84' }}>{user.name}님</span>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-full text-sm font-medium"
            style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2C2420')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#DDD5C8')}
          >
            홈으로
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-full text-sm font-medium"
            style={{ background: '#2C2420', color: '#FAF8F5', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#C4A882')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#2C2420')}
          >
            상담사 찾기
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        {/* 상단 타이틀 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882', marginBottom: '6px' }}>
              Reservations
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 400, color: '#2C2420', margin: 0 }}>
              예약 관리
            </h2>
          </div>
          <button
            onClick={fetchReservations}
            className="text-sm font-light"
            style={{ background: 'none', border: 'none', color: '#9E8E84', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}
          >
            ↻ 새로고침
          </button>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #EDE8E0', marginBottom: '24px' }}>
          {tabs.map((tab) => {
            const count = getCount(tab.key)
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{ padding: '10px 20px', border: 'none', borderBottom: isActive ? '2px solid #2C2420' : '2px solid transparent', background: 'transparent', color: isActive ? '#2C2420' : '#9E8E84', fontWeight: isActive ? 500 : 400, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {tab.label}
                <span style={{ background: isActive ? '#2C2420' : '#F5F0E8', color: isActive ? '#FAF8F5' : '#9E8E84', borderRadius: '100px', padding: '1px 8px', fontSize: '11px', fontWeight: 500 }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* 콘텐츠 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9E8E84' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '12px' }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DDD5C8', display: 'inline-block', animation: 'bounce 1s infinite', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-sm font-light">불러오는 중...</p>
          </div>
        ) : error ? (
          <div style={{ background: '#FFF5F5', border: '1px solid #FCD5D5', borderRadius: '12px', padding: '20px', color: '#C0392B', textAlign: 'center' }}>
            {error}
            <button onClick={fetchReservations} className="px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: '#2C2420', color: '#FAF8F5', border: 'none', cursor: 'pointer', marginLeft: '12px' }}>
              다시 시도
            </button>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F5F0E8', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
              📅
            </div>
            <p style={{ fontSize: '15px', color: '#2C2420', marginBottom: '6px' }}>
              {activeTab === 'upcoming' && '예정된 예약이 없습니다.'}
              {activeTab === 'past' && '지난 예약이 없습니다.'}
              {activeTab === 'cancelled' && '취소된 예약이 없습니다.'}
            </p>
            <p className="text-sm font-light" style={{ color: '#9E8E84', marginBottom: '20px' }}>
              {activeTab === 'upcoming' && '마음에 드는 상담사를 찾아 예약해보세요.'}
              {activeTab === 'past' && '상담 이력이 여기에 표시됩니다.'}
              {activeTab === 'cancelled' && '취소된 예약 내역이 없습니다.'}
            </p>
            {activeTab === 'upcoming' && (
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2 rounded-full text-sm font-medium"
                style={{ background: '#2C2420', color: '#FAF8F5', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#C4A882')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#2C2420')}
              >
                상담사 찾아보기 →
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredReservations.map((reservation) => {
              const startDt = reservation.slot ? formatDateTime(reservation.slot.start_time) : null
              const isUpcoming = reservation.status === 'confirmed' && parseUTC(reservation.slot?.start_time) >= now
              const isPast = reservation.status === 'confirmed' && parseUTC(reservation.slot?.start_time) < now
              const isCancelling = cancellingId === reservation.id
              const isReviewOpen = reviewOpenId === reservation.id

              return (
                <div
                  key={reservation.id}
                  className="rounded-2xl"
                  style={{ background: '#FFFFFF', border: '1px solid #EDE8E0', padding: '24px 28px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(44,36,32,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {/* 왼쪽: 정보 */}
                    <div style={{ flex: 1 }}>
                      <span style={{
                        display: 'inline-block',
                        background: reservation.status === 'cancelled' ? '#FFF0EE' : isUpcoming ? '#F5F0E8' : '#F0F5EE',
                        color: reservation.status === 'cancelled' ? '#C0392B' : isUpcoming ? '#C4A882' : '#5A8A6A',
                        borderRadius: '100px', padding: '3px 12px', fontSize: '11px', fontWeight: 500, marginBottom: '12px',
                      }}>
                        {reservation.status === 'cancelled' ? '취소됨' : isUpcoming ? '예정' : '완료'}
                      </span>

                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 400, color: '#2C2420', margin: '0 0 8px' }}>
                        {reservation.counselor_name ?? '상담사'}
                      </h3>

                      {startDt && reservation.slot && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <p className="text-sm" style={{ color: '#2C2420', margin: 0, fontWeight: 500 }}>{startDt.date}</p>
                          <p className="text-sm font-light" style={{ color: '#9E8E84', margin: 0 }}>
                            {formatTimeRange(reservation.slot.start_time, reservation.slot.end_time)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 오른쪽: 액션 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      {isUpcoming && (
                        <button
                          onClick={() => handleCancel(reservation.id)}
                          disabled={isCancelling}
                          className="px-4 py-2 rounded-full text-sm font-medium"
                          style={{ border: '1px solid #DDD5C8', color: isCancelling ? '#C4A882' : '#6B5B4E', background: 'transparent', cursor: isCancelling ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                          onMouseEnter={(e) => { if (!isCancelling) (e.currentTarget as HTMLButtonElement).style.borderColor = '#C0392B' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#DDD5C8' }}
                        >
                          {isCancelling ? '취소 중...' : '예약 취소'}
                        </button>
                      )}

                      {/* ── 리뷰 버튼 ── */}
                      {isPast && !reservation.review_id && (
                        <button
                          onClick={() => setReviewOpenId(isReviewOpen ? null : reservation.id)}
                          className="px-4 py-2 rounded-full text-sm font-medium"
                          style={{
                            background: isReviewOpen ? '#F5F0E8' : '#2C2420',
                            color: isReviewOpen ? '#C4A882' : '#FAF8F5',
                            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => { if (!isReviewOpen) (e.currentTarget.style.background = '#C4A882') }}
                          onMouseLeave={(e) => { (e.currentTarget.style.background = isReviewOpen ? '#F5F0E8' : '#2C2420') }}
                        >
                          {isReviewOpen ? '닫기' : '후기 작성'}
                        </button>
                      )}

                      {/* ── 리뷰 작성 완료 ── */}
                      {reservation.review_id && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <StarRatingDisplay rating={5} />
                          <span className="text-xs font-light" style={{ color: '#9E8E84' }}>후기 완료</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── 인라인 리뷰 폼 ── */}
                  {isReviewOpen && !reservation.review_id && (
                    <ReviewForm
                      reservationId={reservation.id}
                      onSuccess={() => handleReviewSuccess(reservation.id)}
                    />
                  )}

                  <div className="h-px" style={{ background: '#EDE8E0', margin: '16px 0 12px' }} />

                  {/* 하단: 예약번호 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="text-xs font-light" style={{ color: '#9E8E84', margin: 0 }}>
                      예약 번호 #{reservation.id.slice(0, 8).toUpperCase()}
                    </p>
                    {reservation.status === 'cancelled' && (
                      <button
                        onClick={() => navigate('/')}
                        className="text-xs font-medium"
                        style={{ background: 'none', border: 'none', color: '#C4A882', cursor: 'pointer', padding: 0 }}
                      >
                        다시 예약하기 →
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}