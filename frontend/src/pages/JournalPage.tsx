
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

// ── 로컬 타입 ─────────────────────────────────────────────
interface ReservationInfo {
  id: string
  client_name: string
  counselor_name: string
  date: string
  time: string
  topic: string
}

interface JournalForm {
  title: string
  content: string
  assessment: string
  next_steps: string
}

// ── Mock 데이터 (API 연동 시 API 요청으로 교체) ───────────
const MOCK_RESERVATION: ReservationInfo = {
  id: 'r-101',
  client_name: '김민지',
  counselor_name: '이수현',
  date: '2026-05-06',
  time: '14:00 - 15:00',
  topic: '최근 직장 내 대인관계 스트레스 및 불안감 호소',
}

// ── 공통 스타일 ───────────────────────────────────────────
const S = {
  label: {
    display: 'block', fontSize: 13, fontWeight: 500,
    color: '#6B5B4E', marginBottom: 8,
  },
  input: {
    width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 14,
    border: '1px solid #EDE8E0', background: '#fff', color: '#2C2420',
    fontFamily: "'DM Sans', sans-serif", outline: 'none', transition: 'all 0.2s',
  },
  textarea: {
    width: '100%', padding: '16px', borderRadius: 12, fontSize: 14,
    border: '1px solid #EDE8E0', background: '#fff', color: '#2C2420',
    fontFamily: "'DM Sans', sans-serif", outline: 'none', transition: 'all 0.2s',
    minHeight: 120, resize: 'vertical' as const, lineHeight: 1.6,
  },
}

// ─────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────
export default function JournalPage() {
  const { reservationId } = useParams()
  const navigate = useNavigate()
  
  // 상태 관리
  const [reservation, setReservation] = useState<ReservationInfo | null>(null)
  const [form, setForm] = useState<JournalForm>({
    title: '',
    content: '',
    assessment: '',
    next_steps: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 초기 데이터 불러오기 (Mock)
  useEffect(() => {
    // TODO: API 연동 시 → getReservationDetail(reservationId) 로 호출하여 정보 세팅
    setReservation(MOCK_RESERVATION)
  }, [reservationId])

  // 폼 입력 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // 제출 핸들러
  const handleSubmit = async () => {
    if (!form.title || !form.content) {
      alert('일지 제목과 주요 내용을 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      // TODO: API 연동 시 → saveJournal(reservationId, form)
      console.log('저장할 일지 데이터:', form)
      
      // 임시 딜레이 (저장 중 UI 확인용)
      await new Promise(resolve => setTimeout(resolve, 800))
      
      alert('상담 일지가 성공적으로 저장되었습니다.')
      navigate('/dashboard') // 저장 후 대시보드로 이동
    } catch (error) {
      console.error('일지 저장 실패:', error)
      alert('일지 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!reservation) return <div style={{ padding: 40, textAlign: 'center' }}>데이터를 불러오는 중입니다...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
      
      {/* 상단 헤더바 */}
      <div style={{
        height: 68, background: '#fff', borderBottom: '1px solid #EDE8E0',
        display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ maxWidth: 900, width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9E8E84', display: 'flex', alignItems: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#2C2420', fontWeight: 500 }}>
            상담 일지 작성
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '40px auto 0', display: 'flex', flexDirection: 'column', gap: 24, padding: '0 20px' }}>
        
        {/* 내담자 및 예약 정보 요약 카드 */}
        <div style={{ background: '#F5F0E8', borderRadius: 20, padding: '24px 32px', border: '1px solid #E8DFD1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: '#2C2420', color: '#FAF8F5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500
              }}>
                {reservation.client_name[0]}
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 500, color: '#2C2420' }}>{reservation.client_name} 내담자</p>
                <p style={{ fontSize: 13, color: '#8B6F47' }}>예약 번호: {reservation.id}</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#2C2420' }}>{reservation.date}</p>
              <p style={{ fontSize: 13, color: '#8B6F47' }}>{reservation.time}</p>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 20px', borderRadius: 12, fontSize: 14, color: '#6B5B4E', lineHeight: 1.5 }}>
            <strong style={{ color: '#C4A882', marginRight: 8 }}>사전 접수 내용</strong>
            {reservation.topic}
          </div>
        </div>

        {/* 일지 작성 폼 */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '36px 40px', border: '1px solid #EDE8E0' }}>
          <p style={{ fontSize: 18, fontWeight: 500, color: '#2C2420', marginBottom: 32, fontFamily: "'Playfair Display', serif" }}>
            Session Details
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 제목 */}
            <div>
              <label style={S.label}>상담 핵심 주제 (Title) <span style={{ color: '#A32D2D' }}>*</span></label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="예: 직장 내 스트레스로 인한 불안감 다루기"
                style={S.input}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 주요 상담 내용 */}
            <div>
              <label style={S.label}>주요 상담 내용 (Content) <span style={{ color: '#A32D2D' }}>*</span></label>
              <textarea
                name="content"
                value={form.content}
                onChange={handleChange}
                placeholder="내담자가 호소한 주요 문제와 상담 과정에서의 핵심 대화 내용을 기록해주세요."
                style={{ ...S.textarea, minHeight: 180 }}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 상담사 소견 */}
            <div>
              <label style={S.label}>상담사 소견 및 평가 (Assessment)</label>
              <textarea
                name="assessment"
                value={form.assessment}
                onChange={handleChange}
                placeholder="내담자의 현재 심리 상태, 태도, 문제 해결 가능성 등에 대한 전문가적 소견을 기록해주세요."
                style={S.textarea}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 다음 회차 목표 */}
            <div>
              <label style={S.label}>다음 회차 목표 및 계획 (Next Steps)</label>
              <textarea
                name="next_steps"
                value={form.next_steps}
                onChange={handleChange}
                placeholder="다음 상담에서 다룰 주제나 내담자에게 부여한 과제가 있다면 기록해주세요."
                style={{ ...S.textarea, minHeight: 100 }}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>
          </div>

          {/* 하단 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 40, paddingTop: 24, borderTop: '1px solid #EDE8E0' }}>
            <button 
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '12px 24px', borderRadius: 100, fontSize: 14, cursor: 'pointer',
                border: '1px solid #EDE8E0', background: 'transparent', color: '#6B5B4E',
                fontFamily: "'DM Sans', sans-serif", fontWeight: 500
              }}
            >
              취소
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                padding: '12px 32px', borderRadius: 100, fontSize: 14, 
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                border: 'none', background: isSubmitting ? '#9E8E84' : '#2C2420', color: '#FAF8F5',
                fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: 'background 0.2s'
              }}
            >
              {isSubmitting ? '저장 중...' : '일지 저장하기'}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  )
}