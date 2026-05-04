import { useEffect, useState } from 'react'
import { getMyReservations, cancelReservation } from '@/services/ReservationService'
import { useAuthStore } from '@/store/auth'
import type { Reservation } from '@/types'

type TabType = 'upcoming' | 'past' | 'cancelled'

export default function MyReservationsPage() {
  const { user } = useAuthStore()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

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
        prev.map((r) =>
          r.id === reservationId ? { ...r, status: 'cancelled' } : r
        )
      )
    } catch {
      alert('예약 취소에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setCancellingId(null)
    }
  }

  const now = new Date()

  const filteredReservations = reservations.filter((r) => {
    if (activeTab === 'cancelled') return r.status === 'cancelled'
    if (activeTab === 'upcoming')
      return r.status === 'confirmed' && new Date(r.slot?.start_time ?? '') >= now
    if (activeTab === 'past')
      return r.status === 'confirmed' && new Date(r.slot?.start_time ?? '') < now
    return false
  })

  const tabs: { key: TabType; label: string }[] = [
    { key: 'upcoming', label: '예정된 예약' },
    { key: 'past', label: '지난 예약' },
    { key: 'cancelled', label: '취소된 예약' },
  ]

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return {
      date: date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      }),
      time: date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
  }

  const getDuration = (start: string, end: string) => {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000
    return `${diff}분`
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5' }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Header */}
      <div
        style={{
          background: 'rgba(250,248,245,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #EDE8E0',
          height: '64px',
          padding: '0 40px',
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '20px',
            fontWeight: 400,
            color: '#2C2420',
            margin: 0,
          }}
        >
          내 예약 목록
        </h1>
        {user && (
          <span
            className="text-sm font-light"
            style={{ color: '#9E8E84', marginLeft: 'auto' }}
          >
            {user.name}님
          </span>
        )}
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Section Label */}
        <p
          className="text-xs font-medium tracking-widest uppercase"
          style={{ color: '#C4A882', marginBottom: '8px' }}
        >
          Reservations
        </p>
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '28px',
            fontWeight: 400,
            color: '#2C2420',
            marginBottom: '32px',
          }}
        >
          예약 관리
        </h2>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: '1px solid #EDE8E0',
            paddingBottom: '0',
          }}
        >
          {tabs.map((tab) => {
            const count = reservations.filter((r) => {
              if (tab.key === 'cancelled') return r.status === 'cancelled'
              if (tab.key === 'upcoming')
                return r.status === 'confirmed' && new Date(r.slot?.start_time ?? '') >= now
              if (tab.key === 'past')
                return r.status === 'confirmed' && new Date(r.slot?.start_time ?? '') < now
              return false
            }).length
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '0',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #2C2420' : '2px solid transparent',
                  background: 'transparent',
                  color: isActive ? '#2C2420' : '#9E8E84',
                  fontWeight: isActive ? 500 : 400,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {tab.label}
                <span
                  style={{
                    background: isActive ? '#2C2420' : '#F5F0E8',
                    color: isActive ? '#FAF8F5' : '#9E8E84',
                    borderRadius: '100px',
                    padding: '1px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9E8E84' }}>
            <p>불러오는 중...</p>
          </div>
        ) : error ? (
          <div
            style={{
              background: '#FFF5F5',
              border: '1px solid #FCD5D5',
              borderRadius: '12px',
              padding: '20px',
              color: '#C0392B',
              textAlign: 'center',
            }}
          >
            {error}
            <button
              onClick={fetchReservations}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{
                background: '#2C2420',
                color: '#FAF8F5',
                border: 'none',
                cursor: 'pointer',
                marginLeft: '12px',
              }}
            >
              다시 시도
            </button>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 0',
              color: '#9E8E84',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#F5F0E8',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}
            >
              📅
            </div>
            <p style={{ fontSize: '15px', marginBottom: '8px' }}>
              {activeTab === 'upcoming' && '예정된 예약이 없습니다.'}
              {activeTab === 'past' && '지난 예약이 없습니다.'}
              {activeTab === 'cancelled' && '취소된 예약이 없습니다.'}
            </p>
            {activeTab === 'upcoming' && (
              <a
                href="/counselors"
                className="text-sm font-medium"
                style={{ color: '#C4A882', textDecoration: 'none' }}
              >
                상담사 찾아보기 →
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredReservations.map((reservation) => {
              const startDt = reservation.slot
                ? formatDateTime(reservation.slot.start_time)
                : null
              const duration =
                reservation.slot
                  ? getDuration(reservation.slot.start_time, reservation.slot.end_time)
                  : null
              const isUpcoming =
                reservation.status === 'confirmed' &&
                new Date(reservation.slot?.start_time ?? '') >= now
              const isCancelling = cancellingId === reservation.id

              return (
                <div
                  key={reservation.id}
                  className="rounded-2xl"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #EDE8E0',
                    padding: '24px 28px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow =
                      '0 8px 24px rgba(44,36,32,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Left: Info */}
                    <div style={{ flex: 1 }}>
                      {/* Status Badge */}
                      <span
                        style={{
                          display: 'inline-block',
                          background:
                            reservation.status === 'cancelled'
                              ? '#FFF0EE'
                              : isUpcoming
                              ? '#F5F0E8'
                              : '#F0F5EE',
                          color:
                            reservation.status === 'cancelled'
                              ? '#C0392B'
                              : isUpcoming
                              ? '#C4A882'
                              : '#5A8A6A',
                          borderRadius: '100px',
                          padding: '3px 12px',
                          fontSize: '11px',
                          fontWeight: 500,
                          marginBottom: '12px',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {reservation.status === 'cancelled'
                          ? '취소됨'
                          : isUpcoming
                          ? '예정'
                          : '완료'}
                      </span>

                      {/* Counselor Name */}
                      <h3
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: '18px',
                          fontWeight: 400,
                          color: '#2C2420',
                          margin: '0 0 8px',
                        }}
                      >
                        {reservation.counselor_name ?? '상담사'}
                      </h3>

                      {/* Date & Time */}
                      {startDt && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <p
                            className="text-sm"
                            style={{ color: '#2C2420', margin: 0, fontWeight: 500 }}
                          >
                            {startDt.date}
                          </p>
                          <p
                            className="text-sm font-light"
                            style={{ color: '#9E8E84', margin: 0 }}
                          >
                            {startDt.time} · {duration}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: 'flex-end',
                      }}
                    >
                      {isUpcoming && (
                        <button
                          onClick={() => handleCancel(reservation.id)}
                          disabled={isCancelling}
                          className="px-4 py-2 rounded-full text-sm font-medium"
                          style={{
                            border: '1px solid #DDD5C8',
                            color: isCancelling ? '#C4A882' : '#6B5B4E',
                            background: 'transparent',
                            cursor: isCancelling ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isCancelling)
                              (e.currentTarget as HTMLButtonElement).style.borderColor =
                                '#2C2420'
                          }}
                          onMouseLeave={(e) => {
                            ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                              '#DDD5C8'
                          }}
                        >
                          {isCancelling ? '취소 중...' : '예약 취소'}
                        </button>
                      )}
                      {reservation.status === 'confirmed' &&
                        new Date(reservation.slot?.start_time ?? '') < now &&
                        !reservation.review_id && (
                          <a
                            href={`/reservations/${reservation.id}/review`}
                            className="px-4 py-2 rounded-full text-sm font-medium"
                            style={{
                              background: '#2C2420',
                              color: '#FAF8F5',
                              textDecoration: 'none',
                              display: 'inline-block',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              ;(e.currentTarget as HTMLAnchorElement).style.background =
                                '#C4A882'
                            }}
                            onMouseLeave={(e) => {
                              ;(e.currentTarget as HTMLAnchorElement).style.background =
                                '#2C2420'
                            }}
                          >
                            리뷰 작성
                          </a>
                        )}
                      {reservation.review_id && (
                        <span
                          className="text-xs font-light"
                          style={{ color: '#9E8E84' }}
                        >
                          리뷰 작성 완료
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Divider + Reservation ID */}
                  <div
                    className="h-px"
                    style={{ background: '#EDE8E0', margin: '16px 0 12px' }}
                  />
                  <p
                    className="text-xs font-light"
                    style={{ color: '#9E8E84', margin: 0 }}
                  >
                    예약 번호 #{reservation.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}