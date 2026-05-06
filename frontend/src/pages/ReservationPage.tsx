import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../services/api'

interface CounselorDetail {
  id: string
  name: string
  email: string
}

interface SlotItem {
  id: string
  start_time: string
  end_time: string
  is_available: boolean
}

export default function ReservationPage() {
  const { counselorId } = useParams<{ counselorId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [counselor, setCounselor] = useState<CounselorDetail | null>(null)
  const [slots, setSlots] = useState<SlotItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [reserving, setReserving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchData()
  }, [counselorId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [counselorRes, slotsRes] = await Promise.all([
        api.get(`/counselors/${counselorId}`),
        api.get(`/counselors/${counselorId}/slots`),
      ])
      setCounselor(counselorRes.data.data)
      setSlots(slotsRes.data.data)
    } catch {
      setError('상담사 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleReserve = async () => {
    if (!selectedSlotId) return
    if (!user) {
      navigate('/login')
      return
    }
    try {
      setReserving(true)
      setError(null)
      await api.post('/reservations', { slot_id: selectedSlotId })
      setSuccess(true)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '예약에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setReserving(false)
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

  const availableSlots = slots.filter(
    (s) => s.is_available && new Date(s.start_time) >= new Date()
  )

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF8F5' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
        <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '48px 40px', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F0F5EE', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>✓</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 400, color: '#2C2420', marginBottom: '12px' }}>예약 완료</h2>
          <p className="text-sm font-light" style={{ color: '#9E8E84', marginBottom: '28px' }}>
            {counselor?.name} 상담사와의 예약이 확정되었습니다.
          </p>
          <button
            onClick={() => navigate('/my-reservations')}
            className="px-6 py-2 rounded-full text-sm font-medium"
            style={{ background: '#2C2420', color: '#FAF8F5', border: 'none', cursor: 'pointer' }}
          >
            내 예약 확인하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      {/* 헤더 */}
      <div style={{ background: 'rgba(250,248,245,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE8E0', height: '64px', padding: '0 40px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9E8E84', fontSize: '14px' }}
        >
          ← 목록으로
        </button>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 400, color: '#2C2420', margin: '0 auto' }}>
          상담사 예약
        </h1>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9E8E84' }}>불러오는 중...</div>
        ) : error && !counselor ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#C0392B' }}>{error}</div>
        ) : (
          <>
            {/* 상담사 프로필 카드 */}
            {counselor && (
              <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '28px', marginBottom: '28px' }}>
                <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882', marginBottom: '6px' }}>Counselor</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", fontSize: '20px', color: '#C4A882', flexShrink: 0 }}>
                    {counselor.name.charAt(0)}
                  </div>
                  <div>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 400, color: '#2C2420', margin: '0 0 4px' }}>
                      {counselor.name} 상담사
                    </h2>
                    <p className="text-sm font-light" style={{ color: '#9E8E84', margin: 0 }}>{counselor.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 슬롯 선택 */}
            <div>
              <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882', marginBottom: '8px' }}>Available Slots</p>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 400, color: '#2C2420', marginBottom: '16px' }}>
                예약 가능한 시간
              </h3>

              {availableSlots.length === 0 ? (
                <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', padding: '40px', textAlign: 'center', color: '#9E8E84' }}>
                  <p style={{ fontSize: '15px', marginBottom: '6px' }}>현재 예약 가능한 슬롯이 없습니다.</p>
                  <p className="text-sm font-light">나중에 다시 확인해주세요.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                  {availableSlots.map((slot) => {
                    const { date, time } = formatDateTime(slot.start_time)
                    const duration = getDuration(slot.start_time, slot.end_time)
                    const isSelected = selectedSlotId === slot.id

                    return (
                      <div
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className="rounded-2xl"
                        style={{
                          background: '#fff',
                          border: isSelected ? '1.5px solid #2C2420' : '1px solid #EDE8E0',
                          padding: '18px 22px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = '#C4A882'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = '#EDE8E0'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSelected ? '#2C2420' : '#C4A882', flexShrink: 0 }} />
                          <div>
                            <p style={{ fontWeight: 500, color: '#2C2420', margin: '0 0 2px', fontSize: '14px' }}>{date}</p>
                            <p className="text-sm font-light" style={{ color: '#9E8E84', margin: 0 }}>{time} · {duration}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <span style={{ background: '#F5F0E8', color: '#C4A882', borderRadius: '100px', padding: '3px 12px', fontSize: '11px', fontWeight: 500 }}>
                            선택됨
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 에러 */}
              {error && (
                <p className="text-sm" style={{ color: '#C0392B', marginBottom: '12px' }}>{error}</p>
              )}

              {/* 예약 버튼 */}
              {availableSlots.length > 0 && (
                <button
                  onClick={handleReserve}
                  disabled={!selectedSlotId || reserving}
                  className="rounded-full text-sm font-medium"
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: !selectedSlotId ? '#EDE8E0' : reserving ? '#C4A882' : '#2C2420',
                    color: !selectedSlotId ? '#9E8E84' : '#FAF8F5',
                    border: 'none',
                    cursor: !selectedSlotId || reserving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedSlotId && !reserving) (e.currentTarget.style.background = '#C4A882')
                  }}
                  onMouseLeave={(e) => {
                    if (selectedSlotId && !reserving) (e.currentTarget.style.background = '#2C2420')
                  }}
                >
                  {reserving ? '예약 중...' : !selectedSlotId ? '시간을 선택해주세요' : '예약 확정하기'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}