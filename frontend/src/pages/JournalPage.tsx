import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../services/api'

// ── 타입 ──────────────────────────────────────────────────
interface Journal {
  id: string
  reservation_id: string
  title: string
  content: string
  assessment: string | null
  next_steps: string | null
  is_private: boolean
  created_at: string
  updated_at: string
  client_name: string
  slot_start_time: string | null
}

interface ReservationOption {
  id: string
  client_name: string
  slot_start_time: string
  journal_id: string | null
}

interface JournalForm {
  title: string
  content: string
  assessment: string
  next_steps: string
  is_private: boolean
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
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%', padding: '16px', borderRadius: 12, fontSize: 14,
    border: '1px solid #EDE8E0', background: '#fff', color: '#2C2420',
    fontFamily: "'DM Sans', sans-serif", outline: 'none', transition: 'all 0.2s',
    minHeight: 120, resize: 'vertical' as const, lineHeight: 1.6,
    boxSizing: 'border-box' as const,
  },
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

// ─────────────────────────────────────────────────────────
// 일지 상세 모달
// ─────────────────────────────────────────────────────────
function JournalDetailModal({
  journal,
  onClose,
  onEdit,
}: {
  journal: Journal
  onClose: () => void
  onEdit: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(44,36,32,0.45)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, width: '100%', maxWidth: 680,
        maxHeight: '85vh', overflowY: 'auto', padding: '40px',
        border: '1px solid #EDE8E0',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C4A882', marginBottom: 6 }}>
              Journal
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 400, color: '#2C2420', margin: 0 }}>
              {journal.title}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9E8E84', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* 메타 정보 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: '#F5F0E8', color: '#C4A882' }}>
            {journal.client_name} 내담자
          </span>
          {journal.slot_start_time && (
            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: '#F5F0E8', color: '#6B5B4E' }}>
              {formatDate(journal.slot_start_time)} {formatTime(journal.slot_start_time)}
            </span>
          )}
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: journal.is_private ? '#FCEBEB' : '#EAF3DE', color: journal.is_private ? '#A32D2D' : '#3B6D11' }}>
            {journal.is_private ? '🔒 비공개' : '공개'}
          </span>
        </div>

        <div style={{ height: 1, background: '#EDE8E0', marginBottom: 24 }} />

        {/* 내용 섹션 */}
        {[
          { label: '주요 상담 내용', value: journal.content },
          { label: '상담사 소견 및 평가', value: journal.assessment },
          { label: '다음 회차 목표 및 계획', value: journal.next_steps },
        ].map((section) => section.value && (
          <div key={section.label} style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9E8E84', marginBottom: 10 }}>
              {section.label}
            </p>
            <p style={{ fontSize: 14, color: '#2C2420', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
              {section.value}
            </p>
          </div>
        ))}

        <div style={{ height: 1, background: '#EDE8E0', margin: '24px 0' }} />

        {/* 하단 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 12, color: '#9E8E84' }}>
            작성일 {formatDate(journal.created_at)}
            {journal.updated_at !== journal.created_at && ` · 수정됨 ${formatDate(journal.updated_at)}`}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 100, fontSize: 13, cursor: 'pointer', border: '1px solid #EDE8E0', background: 'transparent', color: '#6B5B4E', fontFamily: "'DM Sans', sans-serif" }}>
              닫기
            </button>
            <button onClick={onEdit} style={{ padding: '8px 20px', borderRadius: 100, fontSize: 13, cursor: 'pointer', border: 'none', background: '#2C2420', color: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}>
              수정하기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────
export default function JournalPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // ── 탭 상태 ──
  const [tab, setTab] = useState<'list' | 'write'>('list')

  // ── 일지 목록 ──
  const [journals, setJournals] = useState<Journal[]>([])
  const [journalsLoading, setJournalsLoading] = useState(true)
  const [journalsError, setJournalsError] = useState<string | null>(null)

  // ── 상세 모달 ──
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null)

  // ── 예약 목록 (작성용) ──
  const [reservations, setReservations] = useState<ReservationOption[]>([])
  const [reservationsLoading, setReservationsLoading] = useState(false)
  const [selectedReservationId, setSelectedReservationId] = useState<string>('')

  // ── 폼 상태 ──
  const [form, setForm] = useState<JournalForm>({
    title: '', content: '', assessment: '', next_steps: '', is_private: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ── 수정 모드 ──
  const [editingId, setEditingId] = useState<string | null>(null)

  // ── 일지 목록 불러오기 ──
  const fetchJournals = async () => {
    try {
      setJournalsLoading(true)
      setJournalsError(null)
      const res = await api.get('/journals/me')
      setJournals(res.data.data)
    } catch {
      setJournalsError('일지 목록을 불러오지 못했습니다.')
    } finally {
      setJournalsLoading(false)
    }
  }

  // ── 예약 목록 불러오기 (일지 없는 완료된 예약만) ──
  const fetchReservations = async () => {
    try {
      setReservationsLoading(true)
      const res = await api.get('/reservations/counselor')
      const past = res.data.data.filter((r: any) => {
        const isPast = new Date(r.slot?.start_time) < new Date()
        const noJournal = !r.journal_id
        return isPast && noJournal && r.status === 'confirmed'
      })
      setReservations(past.map((r: any) => ({
        id: r.id,
        client_name: r.client_name,
        slot_start_time: r.slot?.start_time,
        journal_id: r.journal_id,
      })))
    } catch {
      // 조용히 처리
    } finally {
      setReservationsLoading(false)
    }
  }

  useEffect(() => {
    fetchJournals()
  }, [])

  useEffect(() => {
    if (tab === 'write' && !editingId) {
      fetchReservations()
    }
  }, [tab])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // ── 작성 / 수정 제출 ──
  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('제목과 주요 내용을 입력해주세요.')
      return
    }
    if (!editingId && !selectedReservationId) {
      setFormError('예약을 선택해주세요.')
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)

      if (editingId) {
        await api.patch(`/journals/${editingId}`, {
          title: form.title,
          content: form.content,
          assessment: form.assessment || null,
          next_steps: form.next_steps || null,
          is_private: form.is_private,
        })
      } else {
        await api.post('/journals', {
          reservation_id: selectedReservationId,
          title: form.title,
          content: form.content,
          assessment: form.assessment || null,
          next_steps: form.next_steps || null,
          is_private: form.is_private,
        })
      }

      setForm({ title: '', content: '', assessment: '', next_steps: '', is_private: false })
      setSelectedReservationId('')
      setEditingId(null)
      setTab('list')
      fetchJournals()
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      if (Array.isArray(detail)) {
        setFormError(detail.map((d: any) => d.msg).join(', '))
      } else {
        setFormError(detail ?? '저장 중 오류가 발생했습니다.')
      }
    } finally {
      setIsSubmitting(false)  // ← 이게 빠져 있었어요
    }
  }

  // ── 수정 버튼 클릭 ──
  const handleEditClick = (journal: Journal) => {
    setEditingId(journal.id)
    setForm({
      title: journal.title,
      content: journal.content,
      assessment: journal.assessment ?? '',
      next_steps: journal.next_steps ?? '',
      is_private: journal.is_private,
    })
    setSelectedJournal(null)
    setTab('write')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      {/* 상세 모달 */}
      {selectedJournal && (
        <JournalDetailModal
          journal={selectedJournal}
          onClose={() => setSelectedJournal(null)}
          onEdit={() => handleEditClick(selectedJournal)}
        />
      )}

      {/* 헤더 */}
      <div style={{ height: 68, background: '#fff', borderBottom: '1px solid #EDE8E0', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, width: '100%', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9E8E84', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#2C2420', fontWeight: 400, margin: 0 }}>
              상담 일지
            </h1>
          </div>
          {user && (
            <span style={{ fontSize: 13, color: '#9E8E84' }}>{user.name} 상담사</span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #EDE8E0', marginBottom: 32 }}>
          {[
            { key: 'list', label: '일지 목록' },
            { key: 'write', label: editingId ? '일지 수정' : '새 일지 작성' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                if (t.key === 'list') {
                  setEditingId(null)
                  setForm({ title: '', content: '', assessment: '', next_steps: '', is_private: false })
                  setFormError(null)
                }
                setTab(t.key as 'list' | 'write')
              }}
              style={{
                padding: '10px 24px', border: 'none', cursor: 'pointer',
                borderBottom: tab === t.key ? '2px solid #2C2420' : '2px solid transparent',
                background: 'transparent',
                color: tab === t.key ? '#2C2420' : '#9E8E84',
                fontWeight: tab === t.key ? 500 : 400,
                fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 일지 목록 탭 ── */}
        {tab === 'list' && (
          <div>
            {journalsLoading ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#9E8E84' }}>불러오는 중...</div>
            ) : journalsError ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <p style={{ color: '#A32D2D', marginBottom: 12 }}>{journalsError}</p>
                <button onClick={fetchJournals} style={{ padding: '8px 20px', borderRadius: 100, border: '1px solid #EDE8E0', background: 'transparent', color: '#6B5B4E', cursor: 'pointer', fontSize: 13 }}>
                  다시 시도
                </button>
              </div>
            ) : journals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5F0E8', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📋</div>
                <p style={{ fontSize: 15, color: '#2C2420', marginBottom: 6 }}>작성된 일지가 없습니다.</p>
                <p style={{ fontSize: 13, color: '#9E8E84', marginBottom: 20 }}>상담 후 일지를 작성해보세요.</p>
                <button
                  onClick={() => setTab('write')}
                  style={{ padding: '10px 24px', borderRadius: 100, border: 'none', background: '#2C2420', color: '#FAF8F5', cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}
                >
                  첫 일지 작성하기
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {journals.map((journal) => (
                  <div
                    key={journal.id}
                    onClick={() => setSelectedJournal(journal)}
                    style={{
                      background: '#fff', border: '1px solid #EDE8E0', borderRadius: 20,
                      padding: '24px 28px', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(44,36,32,0.07)'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 400, color: '#2C2420', margin: 0 }}>
                            {journal.title}
                          </h3>
                          {journal.is_private && (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: '#FCEBEB', color: '#A32D2D' }}>비공개</span>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: '#9E8E84', margin: '0 0 10px' }}>
                          {journal.client_name} 내담자
                          {journal.slot_start_time && ` · ${formatDate(journal.slot_start_time)}`}
                        </p>
                        <p style={{ fontSize: 13, color: '#6B5B4E', margin: 0, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                          {journal.content}
                        </p>
                      </div>
                      <div style={{ marginLeft: 16, textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 11, color: '#9E8E84', margin: 0 }}>
                          {formatDate(journal.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 작성 / 수정 탭 ── */}
        {tab === 'write' && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '36px 40px', border: '1px solid #EDE8E0' }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 400, color: '#2C2420', marginBottom: 32 }}>
              {editingId ? 'Edit Journal' : 'New Journal'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* 예약 선택 (신규 작성 시만) */}
              {!editingId && (
                <div>
                  <label style={S.label}>상담 예약 선택 <span style={{ color: '#A32D2D' }}>*</span></label>
                  {reservationsLoading ? (
                    <p style={{ fontSize: 13, color: '#9E8E84' }}>불러오는 중...</p>
                  ) : reservations.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9E8E84', padding: '12px 16px', background: '#FAF8F5', borderRadius: 12 }}>
                      일지를 작성할 수 있는 완료된 예약이 없습니다.
                    </p>
                  ) : (
                    <select
                      value={selectedReservationId}
                      onChange={(e) => setSelectedReservationId(e.target.value)}
                      style={{ ...S.input, appearance: 'none', cursor: 'pointer' }}
                      onFocus={(e) => (e.target.style.borderColor = '#C4A882')}
                      onBlur={(e) => (e.target.style.borderColor = '#EDE8E0')}
                    >
                      <option value="">예약을 선택해주세요</option>
                      {reservations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.client_name} · {r.slot_start_time ? formatDate(r.slot_start_time) : '-'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* 제목 */}
              <div>
                <label style={S.label}>상담 핵심 주제 (Title) <span style={{ color: '#A32D2D' }}>*</span></label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="예: 직장 내 스트레스로 인한 불안감 다루기"
                  style={S.input}
                  onFocus={(e) => (e.target.style.borderColor = '#C4A882')}
                  onBlur={(e) => (e.target.style.borderColor = '#EDE8E0')}
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
                  onFocus={(e) => (e.target.style.borderColor = '#C4A882')}
                  onBlur={(e) => (e.target.style.borderColor = '#EDE8E0')}
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
                  onFocus={(e) => (e.target.style.borderColor = '#C4A882')}
                  onBlur={(e) => (e.target.style.borderColor = '#EDE8E0')}
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
                  onFocus={(e) => (e.target.style.borderColor = '#C4A882')}
                  onBlur={(e) => (e.target.style.borderColor = '#EDE8E0')}
                />
              </div>

              {/* 비공개 토글 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  onClick={() => setForm(prev => ({ ...prev, is_private: !prev.is_private }))}
                  style={{
                    width: 44, height: 24, borderRadius: 100, cursor: 'pointer', transition: 'all 0.2s',
                    background: form.is_private ? '#2C2420' : '#EDE8E0', position: 'relative',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, transition: 'all 0.2s',
                    left: form.is_private ? 23 : 3,
                  }} />
                </div>
                <label style={{ fontSize: 13, color: '#6B5B4E', cursor: 'pointer' }}
                  onClick={() => setForm(prev => ({ ...prev, is_private: !prev.is_private }))}>
                  비공개로 설정
                </label>
              </div>
            </div>

            {formError && (
              <p style={{ fontSize: 13, color: '#A32D2D', marginTop: 16 }}>{formError}</p>
            )}

            {/* 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 40, paddingTop: 24, borderTop: '1px solid #EDE8E0' }}>
              <button
                onClick={() => {
                  setTab('list')
                  setEditingId(null)
                  setForm({ title: '', content: '', assessment: '', next_steps: '', is_private: false })
                  setFormError(null)
                }}
                style={{ padding: '12px 24px', borderRadius: 100, fontSize: 14, cursor: 'pointer', border: '1px solid #EDE8E0', background: 'transparent', color: '#6B5B4E', fontFamily: "'DM Sans', sans-serif" }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ padding: '12px 32px', borderRadius: 100, fontSize: 14, cursor: isSubmitting ? 'not-allowed' : 'pointer', border: 'none', background: isSubmitting ? '#9E8E84' : '#2C2420', color: '#FAF8F5', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: 'background 0.2s' }}
                onMouseEnter={(e) => { if (!isSubmitting) (e.currentTarget.style.background = '#C4A882') }}
                onMouseLeave={(e) => { if (!isSubmitting) (e.currentTarget.style.background = '#2C2420') }}
              >
                {isSubmitting ? '저장 중...' : editingId ? '수정 완료' : '일지 저장하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}