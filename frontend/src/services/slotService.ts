import api from '@/services/api'
import type { Slot, ApiResponse } from '@/types'

// 상담사: 내 슬롯 목록 조회
export const getMySlots = async (): Promise<Slot[]> => {
  const res = await api.get<ApiResponse<Slot[]>>('/slots/me')
  return res.data.data
}

// 상담사: 단일 슬롯 생성
export const createSlot = async (data: {
  start_time: string
  end_time: string
}): Promise<Slot> => {
  const res = await api.post<ApiResponse<Slot>>('/slots', data)
  return res.data.data
}

// 상담사: 월별 슬롯 일괄 생성
export const createBulkSlots = async (year: number, month: number): Promise<{ created: number; skipped: number }> => {
  const res = await api.post<ApiResponse<{ created: number; skipped: number }>>('/slots/bulk', { year, month })
  return res.data.data
}

// 상담사: 슬롯 활성/비활성 토글
export const toggleSlot = async (slotId: string, isActive: boolean): Promise<void> => {
  await api.patch(`/slots/${slotId}/toggle`, { is_active: isActive })
}

// 상담사: 슬롯 삭제
export const deleteSlot = async (slotId: string): Promise<void> => {
  await api.delete<ApiResponse<null>>(`/slots/${slotId}`)
}