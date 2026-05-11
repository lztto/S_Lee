-- ─── DevTriple 프라이빗 심리/코칭 예약 플랫폼 DB 스키마 ───

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 유저 테이블 ───
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'counselor', 'client')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 타임슬롯 테이블 ───
CREATE TABLE IF NOT EXISTS time_slots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    counselor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time    TIMESTAMPTZ NOT NULL,
    end_time      TIMESTAMPTZ NOT NULL,
    is_available  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_time > start_time)
);

-- ─── 예약 테이블 ───
CREATE TABLE IF NOT EXISTS reservations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id    UUID NOT NULL UNIQUE REFERENCES time_slots(id) ON DELETE CASCADE,
    client_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 상담 일지 테이블 ───
CREATE TABLE IF NOT EXISTS journals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    counselor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content        TEXT NOT NULL,
    is_private     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 리뷰 테이블 ───
CREATE TABLE IF NOT EXISTS reviews (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    client_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    counselor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content        TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_slots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    counselor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_date  DATE NOT NULL,
    start_hour    INTEGER NOT NULL CHECK (start_hour IN (10, 14, 16, 18, 20)),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (counselor_id, blocked_date, start_hour)
);
 
CREATE INDEX IF NOT EXISTS idx_blocked_slots_counselor_date
    ON blocked_slots(counselor_id, blocked_date);
-- ─── 인덱스 ───
CREATE INDEX IF NOT EXISTS idx_time_slots_counselor_id ON time_slots(counselor_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_start_time   ON time_slots(start_time);
CREATE INDEX IF NOT EXISTS idx_reservations_client_id  ON reservations(client_id);
CREATE INDEX IF NOT EXISTS idx_reservations_slot_id    ON reservations(slot_id);
CREATE INDEX IF NOT EXISTS idx_journals_reservation_id ON journals(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_counselor_id    ON reviews(counselor_id);