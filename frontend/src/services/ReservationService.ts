import api from './api'
import type { Reservation, ApiResponse } from '@/types'

// 내담자: 내 예약 목록 조회
export const getMyReservations = async (): Promise<Reservation[]> => {
  const res = await api.get<ApiResponse<Reservation[]>>('/reservations/me')
  return res.data.data
}

// 내담자: 예약 취소
export const cancelReservation = async (reservationId: string): Promise<void> => {
  await api.patch<ApiResponse<null>>(`/reservations/${reservationId}/cancel`)
}

// 상담사: 내 슬롯의 예약 목록 조회
export const getSlotReservations = async (): Promise<Reservation[]> => {
  const res = await api.get<ApiResponse<Reservation[]>>('/reservations/counselor')
  return res.data.data
}