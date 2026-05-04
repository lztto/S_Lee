import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../services/api'

interface Counselor {
  id: string
  name: string
  email: string
  available_slots: Slot[]
}

interface Slot {
  id: string
  start_time: string
  end_time: string
  is_available: boolean
}

const ReservationPage = () => {
  const { counselorId } = useParams<{ counselorId: string }>()
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const [counselor, setCounselor] = useState<Counselor | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [reserving, setReserving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCounselor = async () => {
      try {
        const res = await api.get(`/counselors/${counselorId}`)
        setCounselor(res.data.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchCounselor()
  }, [counselorId])

  // 날짜별로 슬롯 그룹화
  const groupSlotsByDate = (slots: Slot[]) => {
    const groups: { [date: string]: Slot[] } = {}
    slots.forEach(slot => {
      const date = new Date(slot.start_time).toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(slot)
    })
    return groups
  }

  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const handleReserve = async () => {
    if (!token) {
      navigate('/login')
      return
    }
    if (!selectedSlot) return

    setReserving(true)
    setError('')

    try {
      await api.post('/reservations/', { slot_id: selectedSlot.id })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || '예약에 실패했습니다')
    } finally {
      setReserving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF8F5' }}>
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full animate-bounce inline-block"
              style={{ background: '#DDD5C8', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!counselor) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF8F5' }}>
        <p style={{ color: '#9E8E84' }}>상담사를 찾을 수 없습니다</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>
        <div className="text-center max-w-sm px-8">
          <div className="text-5xl mb-6">✦</div>
          <h2 className="text-2xl mb-3 tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
            예약이 완료되었습니다
          </h2>
          <p className="text-sm mb-2 font-light" style={{ color: '#9E8E84' }}>
            {counselor.name} 상담사
          </p>
          <p className="text-sm mb-8 font-light" style={{ color: '#C4A882' }}>
            {formatTime(selectedSlot!.start_time)} — {formatTime(selectedSlot!.end_time)}
          </p>
          <button
            onClick={() => navigate('/my-reservations')}
            className="w-full h-11 rounded-xl text-sm font-medium"
            style={{ background: '#2C2420', color: '#FAF8F5' }}
          >
            내 예약 확인하기
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full h-11 rounded-xl text-sm font-medium mt-3"
            style={{ border: '1px solid #EDE8E0', color: '#9E8E84', background: 'transparent' }}
          >
            메인으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const slotGroups = groupSlotsByDate(counselor.available_slots)

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>

      {/* 네비게이션 */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 h-16"
        style={{ background: 'rgba(250,248,245,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE8E0' }}
      >
        <div className="cursor-pointer" onClick={() => navigate('/')}>
          <div className="font-medium tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontSize: '18px' }}>
            S<span style={{ color: '#C4A882' }}>.</span>LEE
          </div>
          <div className="tracking-widest uppercase" style={{ color: '#C4A882', fontSize: '9px' }}>
            Secret Counseling
          </div>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="text-sm px-4 py-1.5 rounded-full transition-all"
          style={{ border: '1px solid #EDE8E0', color: '#9E8E84', background: 'transparent' }}
        >
          ← 돌아가기
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-8 pt-32 pb-24">

        {/* 상담사 정보 */}
        <div className="flex items-start gap-6 mb-12 pb-10" style={{ borderBottom: '1px solid #EDE8E0' }}>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-semibold flex-shrink-0"
            style={{ background: '#F5EFE6', color: '#8B6F47', fontFamily: "'Playfair Display', serif" }}
          >
            {counselor.name.charAt(0)}
          </div>
          <div>
            <p className="text-xs tracking-widest uppercase mb-2" style={{ color: '#C4A882' }}>
              심리 · 코칭 상담
            </p>
            <h1 className="text-2xl mb-1 tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
              {counselor.name} 상담사
            </h1>
            <p className="text-sm font-light" style={{ color: '#9E8E84' }}>{counselor.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* 왼쪽 - 슬롯 캘린더 */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-medium mb-6 tracking-widest uppercase" style={{ color: '#C4A882' }}>
              예약 가능한 시간
            </h2>

            {Object.keys(slotGroups).length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                <p className="text-sm font-light" style={{ color: '#C4A882' }}>
                  현재 예약 가능한 시간이 없습니다
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {Object.entries(slotGroups).map(([date, slots]) => (
                  <div key={date}>
                    <p className="text-xs font-medium mb-3 px-1" style={{ color: '#9E8E84' }}>{date}</p>
                    <div className="flex flex-wrap gap-2">
                      {slots.map(slot => (
                        <button
                          key={slot.id}
                          onClick={() => slot.is_available && setSelectedSlot(slot)}
                          disabled={!slot.is_available}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                          style={{
                            background: !slot.is_available
                              ? '#F5F2EE'
                              : selectedSlot?.id === slot.id
                                ? '#2C2420'
                                : '#fff',
                            color: !slot.is_available
                              ? '#C4A882'
                              : selectedSlot?.id === slot.id
                                ? '#FAF8F5'
                                : '#2C2420',
                            border: selectedSlot?.id === slot.id
                              ? 'none'
                              : '1px solid #EDE8E0',
                            cursor: slot.is_available ? 'pointer' : 'not-allowed',
                            textDecoration: !slot.is_available ? 'line-through' : 'none',
                          }}
                        >
                          {formatTime(slot.start_time)} — {formatTime(slot.end_time)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 오른쪽 - 예약 확인 */}
          <div>
            <h2 className="text-sm font-medium mb-6 tracking-widest uppercase" style={{ color: '#C4A882' }}>
              예약 확인
            </h2>
            <div className="rounded-2xl p-6 sticky top-24" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>

              {selectedSlot ? (
                <>
                  <p className="text-xs font-medium mb-4 tracking-widest uppercase" style={{ color: '#C4A882' }}>
                    선택한 시간
                  </p>
                  <p className="text-base mb-1" style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
                    {new Date(selectedSlot.start_time).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </p>
                  <p className="text-sm mb-6 font-light" style={{ color: '#9E8E84' }}>
                    {formatTime(selectedSlot.start_time)} — {formatTime(selectedSlot.end_time)}
                  </p>

                  <div className="h-px mb-6" style={{ background: '#F5F0E8' }} />

                  <p className="text-xs mb-1" style={{ color: '#9E8E84' }}>상담사</p>
                  <p className="text-sm mb-6" style={{ color: '#2C2420' }}>{counselor.name} 상담사</p>

                  {error && (
                    <p className="text-xs px-3 py-2 rounded-lg mb-4" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                      {error}
                    </p>
                  )}

                  {!token ? (
                    <button
                      onClick={() => navigate('/login')}
                      className="w-full h-11 rounded-xl text-sm font-medium"
                      style={{ background: '#2C2420', color: '#FAF8F5' }}
                    >
                      로그인 후 예약하기
                    </button>
                  ) : user?.role !== 'client' ? (
                    <p className="text-xs text-center" style={{ color: '#C4A882' }}>
                      고객 계정으로만 예약할 수 있습니다
                    </p>
                  ) : (
                    <button
                      onClick={handleReserve}
                      disabled={reserving}
                      className="w-full h-11 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: reserving ? '#9E8E84' : '#2C2420',
                        color: '#FAF8F5',
                        cursor: reserving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {reserving ? '예약 중...' : '예약하기'}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm font-light" style={{ color: '#C4A882' }}>
                    왼쪽에서 원하는<br />시간을 선택해주세요
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReservationPage