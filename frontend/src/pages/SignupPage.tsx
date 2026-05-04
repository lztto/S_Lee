import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'

const SignupPage = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    phone: '',
    birth_date: '',
    gender: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/signup', {
        email: form.email,
        password: form.password,
        name: form.name,
        role: 'client',
        phone: form.phone || null,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
      })
      navigate('/login', { state: { message: '회원가입이 완료되었습니다. 로그인해주세요.' } })
    } catch (err: any) {
      setError(err.response?.data?.detail || '회원가입에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: '#fff',
    border: '1px solid #EDE8E0',
    color: '#2C2420',
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* 왼쪽 브랜딩 */}
      <div
        className="hidden lg:flex flex-col justify-between p-16 w-2/5"
        style={{ background: '#F0EBE3' }}
      >
        <div className="cursor-pointer" onClick={() => navigate('/')}>
          <div className="font-medium tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontSize: '22px' }}>
            S<span style={{ color: '#C4A882' }}>.</span>LEE
          </div>
          <div className="tracking-widest uppercase mt-0.5" style={{ color: '#C4A882', fontSize: '10px' }}>
            Secret Counseling
          </div>
        </div>

        <div>
          <p className="text-4xl leading-snug mb-6"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
            "당신의 이야기를<br />
            <em style={{ fontStyle: 'italic', color: '#C4A882' }}>들어줄 사람</em>이<br />
            여기 있습니다"
          </p>
          <p className="text-sm font-light" style={{ color: '#9E8E84' }}>
            지금 가입하고 나에게 맞는<br />상담사를 만나보세요.
          </p>
        </div>

        <p className="text-xs" style={{ color: '#C4A882' }}>
          © 2026 S.LEE Secret Counseling
        </p>
      </div>

      {/* 오른쪽 폼 */}
      <div className="flex-1 flex flex-col justify-center items-center px-8 py-16">
        <div className="w-full max-w-sm">

          {/* 모바일 로고 */}
          <div className="lg:hidden mb-10 cursor-pointer" onClick={() => navigate('/')}>
            <div className="font-medium tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontSize: '20px' }}>
              S<span style={{ color: '#C4A882' }}>.</span>LEE
            </div>
            <div className="tracking-widest uppercase mt-0.5" style={{ color: '#C4A882', fontSize: '9px' }}>
              Secret Counseling
            </div>
          </div>

          <h2 className="text-2xl mb-1 tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
            처음 오셨군요
          </h2>
          <p className="text-sm mb-8 font-light" style={{ color: '#9E8E84' }}>
            새 계정을 만들어보세요
          </p>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">

            {/* 이름 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B5B4E' }}>이름</label>
              <input
                name="name" type="text" value={form.name} onChange={handleChange}
                placeholder="이름을 입력하세요" required
                className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B5B4E' }}>이메일</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="이메일을 입력하세요" required
                className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B5B4E' }}>전화번호</label>
              <input
                name="phone" type="tel" value={form.phone} onChange={handleChange}
                placeholder="010-0000-0000"
                className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 생년월일 + 성별 */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B5B4E' }}>생년월일</label>
                <input
                  name="birth_date" type="date" value={form.birth_date} onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#C4A882'}
                  onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B5B4E' }}>성별</label>
                <select
                  name="gender" value={form.gender} onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#C4A882'}
                  onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                >
                  <option value="">선택</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                  <option value="other">기타</option>
                </select>
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B5B4E' }}>비밀번호</label>
              <input
                name="password" type="password" value={form.password} onChange={handleChange}
                placeholder="6자 이상 입력하세요" required
                className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B5B4E' }}>비밀번호 확인</label>
              <input
                name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={handleChange}
                placeholder="비밀번호를 다시 입력하세요" required
                className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#C4A882'}
                onBlur={e => e.target.style.borderColor = '#EDE8E0'}
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                {error}
              </p>
            )}

            {/* 가입 버튼 */}
            <button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-medium transition-all mt-1"
              style={{ background: loading ? '#9E8E84' : '#2C2420', color: '#FAF8F5', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          {/* 구분선 */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: '#EDE8E0' }} />
            <span className="text-xs" style={{ color: '#C4A882' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#EDE8E0' }} />
          </div>

          {/* 로그인 링크 */}
          <p className="text-center text-sm" style={{ color: '#9E8E84' }}>
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-medium" style={{ color: '#2C2420' }}>로그인</Link>
          </p>

          {/* 상담사 신청 링크 */}
          <p className="text-center text-xs mt-4" style={{ color: '#C4A882' }}>
            상담사로 활동하고 싶으신가요?{' '}
            <Link to="/signup/counselor" className="underline" style={{ color: '#C4A882' }}>상담사 신청</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignupPage