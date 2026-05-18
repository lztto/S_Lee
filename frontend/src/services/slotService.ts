import api from '@/services/api'
import type { ApiResponse } from '@/types'

export interface BlockedSlot {
  id: string
  blocked_date: string  // "2026-05-11"
  start_hour: number    // 10, 14, 16, 18, 20
}

// 상담사: 내 차단 목록 조회
export const getBlockedSlots = async (): Promise<BlockedSlot[]> => {
  const res = await api.get<ApiResponse<BlockedSlot[]>>('/slots/blocked')
  return res.data.data
}

// 상담사: 특정 시간대 차단
export const blockSlot = async (blocked_date: string, start_hour: number): Promise<void> => {
  await api.post('/slots/block', { blocked_date, start_hour })
}

// 상담사: 차단 해제
export const unblockSlot = async (blocked_date: string, start_hour: number): Promise<void> => {
  await api.delete('/slots/block', { data: { blocked_date, start_hour } })
}