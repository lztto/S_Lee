// CLAUDE.md: 컴포넌트에서 직접 axios 호출 금지
import api from './api'

// ── 유저 관리 ─────────────────────────────────────────────

export async function getAllUsers() {
  const res = await api.get('/admin/users')
  return res.data
}

export async function toggleUserActive(userId: string, is_active: boolean) {
  const res = await api.patch(`/admin/users/${userId}`, { is_active })
  return res.data
}

/** 역할 변경 (내담자 ↔ 상담사 ↔ 관리자) */
export async function updateUserRole(userId: string, role: string) {
  const res = await api.patch(`/admin/users/${userId}/role`, { role })
  return res.data
}

export async function deleteUser(userId: string) {
  const res = await api.delete(`/admin/users/${userId}`)
  return res.data
}
/** 특정 유저 강제 로그아웃 (토큰 무효화) */
export async function forceLogout(userId: string) {
  const res = await api.post(`/admin/users/${userId}/logout`)
  return res.data
}

