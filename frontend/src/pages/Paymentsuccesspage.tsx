import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../services/api'

interface ReservationDetail {
  id: string
  status: string
  counselor_name: string
  slot: { start_time: string; end_time: string }
}

export default function PaymentSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()

  const [reservation, setReservation] = useState<ReservationDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const reservationId  = searchParams.get('reservationId') ?? ''
  const counselorName  = searchParams.get('counselorName')  ? decodeURIComponent(searchParams.get('counselorName')!)  : ''
  const startTime      = searchParams.get('startTime')      ? decodeURIComponent(searchParams.get('startTime')!)      : ''
  const endTime        = searchParams.get('endTime')        ? decodeURIComponent(searchParams.get('endTime')!)        : ''
  const amount         = searchParams.get('amount') ?? '50000'

  useEffect(() => {
    if (!reservationId && !startTime) { navigate('/'); return }
    if (reservationId) {
      api.get('/reservations/me')
        .then(res => {
          const found = res.data.data?.find((r: ReservationDetail) => r.id === reservationId)
          if (found) setReservation(found)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const fmt = (iso: string) => new Date(iso)
  // URL 파라미터에서 + 가 공백으로 변환되는 문제 방지 + UTC 명시
  const parseISO = (iso: string) => {
    if (!iso) return new Date(NaN)
    const fixed = iso.replace(/ /g, '+')  // 공백 → + 복원
    const normalized = /[Zz]|[+-]\d{2}:?\d{2}$/.test(fixed) ? fixed : fixed + '+00:00'
    return new Date(normalized)
  }
  const fmtDate = (iso: string) => {
    const d = parseISO(iso)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' })
  }
  const fmtTime = (iso: string) => {
    const d = parseISO(iso)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })
  }
  const fmtAmt  = (v: string)   => Number(v).toLocaleString('ko-KR') + '원'

  const name  = reservation?.counselor_name ?? counselorName
  const start = reservation?.slot?.start_time ?? startTime
  const end   = reservation?.slot?.end_time   ?? endTime
  const rid   = reservation?.id ?? reservationId

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        @keyframes checkIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes fadeUp  { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      {loading ? (
        <p style={{ color: '#9E8E84' }}>불러오는 중...</p>
      ) : (
        <div style={{ width: '100%', maxWidth: '480px' }}>

          {/* 헤더 */}
          <div style={{ textAlign: 'center', marginBottom: '32px', animation: 'fadeUp 0.5s ease' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #2C2420, #5a3e38)',
              margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'checkIn 0.4s ease', boxShadow: '0 8px 24px rgba(44,36,32,0.2)',
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M7 16.5L13 22.5L25 10" stroke="#FAF8F5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882', marginBottom: '6px' }}>Payment Complete</p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 400, color: '#2C2420', margin: 0 }}>
              결제가 완료되었습니다
            </h1>
          </div>

          {/* 상세 카드 */}
          <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #EDE8E0', overflow: 'hidden', animation: 'fadeUp 0.5s ease 0.1s both' }}>
            <div style={{ background: '#2C2420', padding: '18px 24px' }}>
              <p style={{ fontSize: '11px', color: '#C4A882', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>예약 확정</p>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: '#FAF8F5', margin: 0, fontWeight: 400 }}>{name} 상담사</p>
            </div>

            <div style={{ padding: '0 24px' }}>
              {[
                { label: '상담 날짜', value: start ? fmtDate(start) : '-', icon: '📅' },
                { label: '상담 시간', value: start && end ? `${fmtTime(start)} — ${fmtTime(end)}` : '-', icon: '🕐' },
                { label: '담당 상담사', value: name, icon: '👤' },
                { label: '예약자', value: user?.name ?? '-', icon: '✍️' },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ padding: '16px 0', borderBottom: i < arr.length - 1 ? '1px solid #F5F0E8' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>{item.icon}</span>
                    <span className="text-sm font-light" style={{ color: '#9E8E84' }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#2C2420', textAlign: 'right', maxWidth: '60%' }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: '#FAF8F5', padding: '16px 24px', borderTop: '1px solid #EDE8E0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="text-sm font-light" style={{ color: '#9E8E84' }}>결제 금액</span>
                <span style={{ fontSize: '20px', fontWeight: 500, color: '#2C2420' }}>{fmtAmt(amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-sm font-light" style={{ color: '#9E8E84' }}>결제 수단</span>
                <span className="text-sm" style={{ color: '#2C2420' }}>신용카드 (토스페이먼츠)</span>
              </div>
              <p style={{ fontSize: '11px', color: '#C4A882', margin: '8px 0 0', textAlign: 'right' }}>예약금은 상담 후 전액 환급됩니다</p>
            </div>
          </div>

          {/* 예약 번호 */}
          {rid && (
            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '12px', background: '#F5F0E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeUp 0.5s ease 0.2s both' }}>
              <span className="text-sm font-light" style={{ color: '#9E8E84' }}>예약 번호</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#2C2420', letterSpacing: '0.05em' }}>#{rid.slice(0, 8).toUpperCase()}</span>
            </div>
          )}

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', animation: 'fadeUp 0.5s ease 0.3s both' }}>
            <button onClick={() => navigate('/')}
              className="flex-1 py-3 rounded-full text-sm font-medium"
              style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2C2420')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#DDD5C8')}>
              홈으로
            </button>
            <button onClick={() => navigate('/my-reservations')}
              className="flex-1 py-3 rounded-full text-sm font-medium"
              style={{ background: '#2C2420', color: '#FAF8F5', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#C4A882')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#2C2420')}>
              내 예약 확인
            </button>
          </div>

          <p className="text-xs font-light" style={{ color: '#9E8E84', textAlign: 'center', marginTop: '20px' }}>
            예약 관련 문의는 상담사에게 직접 연락하거나 고객센터를 이용해주세요.
          </p>
        </div>
      )}
    </div>
  )
}