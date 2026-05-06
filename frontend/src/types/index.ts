export type Role = 'admin' | 'counselor' | 'client'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  created_at: string
}

export interface Slot {
  id: string
  counselor_id: string
  start_time: string
  end_time: string
  is_available: boolean
}

export interface Reservation {
  id: string
  slot_id: string
  client_id: string
  status: 'confirmed' | 'cancelled'
  created_at: string
  counselor_name?: string
  client_name?: string
  journal_id?: string | null
  review_id?: string | null
  slot?: {
    start_time: string
    end_time: string
  }
}

export interface Journal {
  id: string
  reservation_id: string
  counselor_id: string
  content: string
  is_private: boolean
  created_at: string
}

export interface Review {
  id: string
  reservation_id: string
  client_id: string
  counselor_id: string
  rating: number
  content: string
  created_at: string
}

export interface ApiResponse<T> {
  data: T
  message: string
  total?: number
}