# S.LEE 프로젝트 기능 문서

## 1. 프로젝트 개요

**S.LEE Secret Counseling**은 프라이빗 심리/코칭 상담 예약 플랫폼입니다.

사용자는 상담사 목록을 탐색하고, 상담사별 예약 가능 시간대를 확인한 뒤 Toss Payments 결제를 거쳐 상담 예약을 확정할 수 있습니다. 상담사는 본인의 예약 목록을 확인하고 상담 불가 시간대를 차단하며, 상담 일지를 작성/수정할 수 있습니다. 관리자는 전체 사용자 계정의 활성화 상태와 역할을 관리합니다.

**팀: DevTriple**

| 이름 | 역할 | 브랜치 |
| --- | --- | --- |
| 이지은(조장) | 프로젝트 리더, 풀스택 | `feature/lztto` |
| 이명호 | 풀스택 | `feature/MH` |
| 이윤서 | 풀스택 | `feature/YS-YS` |

**배포**

| 서비스 | 플랫폼 | 비고 |
| --- | --- | --- |
| Backend API | Render.com | 무료 플랜 |
| Frontend | Vercel | 무료 플랜 |
| Database | Supabase PostgreSQL | 무료 플랜 |

## 2. 기술 스택

| 구분 | 스택 |
| --- | --- |
| Backend | FastAPI, Python, Uvicorn |
| API | REST API, FastAPI Router, Pydantic |
| ORM/DB | SQLAlchemy AsyncSession, PostgreSQL, asyncpg |
| Auth | JWT Bearer Token, python-jose, passlib/bcrypt |
| Frontend | React 19, TypeScript, Vite |
| Routing | react-router-dom |
| State | Zustand |
| HTTP Client | Axios |
| Payment | Toss Payments JavaScript SDK |
| Styling | CSS, Tailwind CSS/Vite plugin, inline style 일부 |
| Infra | Docker, Docker Compose, Nginx(frontend) |
| Test | pytest 기반 백엔드 테스트 |
| CI/CD | GitHub Actions 워크플로우(`ci.yml`, `deploy.yml`) |

## 3. DB 테이블 구조

아래 테이블은 `backend/app/db/schema.sql`에 정의된 구조 기준입니다.

### 테이블 관계

```text
users 1 ── N time_slots
users 1 ── N reservations
users 1 ── N journals
users 1 ── N reviews
users 1 ── N blocked_slots
time_slots 1 ── 0..1 reservations
reservations 1 ── 0..1 journals
reservations 1 ── 0..1 reviews
```

### 테이블 상세

| 테이블 | 컬럼 | 타입/제약 | 설명 |
| --- | --- | --- | --- |
| `users` | `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | 사용자 ID |
| `users` | `email` | `VARCHAR(255) UNIQUE NOT NULL` | 로그인 이메일 |
| `users` | `password_hash` | `TEXT NOT NULL` | 비밀번호 해시 |
| `users` | `name` | `VARCHAR(100) NOT NULL` | 사용자 이름 |
| `users` | `role` | `VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'counselor', 'client'))` | 사용자 역할 |
| `users` | `is_active` | `BOOLEAN NOT NULL DEFAULT TRUE` | 계정 활성화 여부 |
| `users` | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 생성일 |
| `time_slots` | `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | 상담 시간 슬롯 ID |
| `time_slots` | `counselor_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | 상담사 ID |
| `time_slots` | `start_time` | `TIMESTAMPTZ NOT NULL` | 상담 시작 시간 |
| `time_slots` | `end_time` | `TIMESTAMPTZ NOT NULL` | 상담 종료 시간 |
| `time_slots` | `is_available` | `BOOLEAN NOT NULL DEFAULT TRUE` | 예약 가능 여부 |
| `time_slots` | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 생성일 |
| `time_slots` | `CHECK` | `end_time > start_time` | 종료 시간이 시작 시간보다 늦어야 함 |
| `reservations` | `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | 예약 ID |
| `reservations` | `slot_id` | `UUID NOT NULL UNIQUE REFERENCES time_slots(id) ON DELETE CASCADE` | 예약된 슬롯 ID |
| `reservations` | `client_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | 내담자 ID |
| `reservations` | `status` | `VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled'))` | 예약 상태 |
| `reservations` | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 생성일 |
| `journals` | `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | 상담 일지 ID |
| `journals` | `reservation_id` | `UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE` | 연결 예약 ID |
| `journals` | `counselor_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | 작성 상담사 ID |
| `journals` | `content` | `TEXT NOT NULL` | 상담 일지 내용 |
| `journals` | `is_private` | `BOOLEAN NOT NULL DEFAULT TRUE` | 비공개 여부 |
| `journals` | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 생성일 |
| `reviews` | `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | 리뷰 ID |
| `reviews` | `reservation_id` | `UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE` | 연결 예약 ID |
| `reviews` | `client_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | 작성 내담자 ID |
| `reviews` | `counselor_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | 대상 상담사 ID |
| `reviews` | `rating` | `INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5)` | 평점 |
| `reviews` | `content` | `TEXT` | 리뷰 내용 |
| `reviews` | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 생성일 |
| `blocked_slots` | `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | 차단 시간 ID |
| `blocked_slots` | `counselor_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | 상담사 ID |
| `blocked_slots` | `blocked_date` | `DATE NOT NULL` | 차단 날짜 |
| `blocked_slots` | `start_hour` | `INTEGER NOT NULL CHECK (start_hour IN (10, 14, 16, 18, 20))` | 차단 시작 시각 |
| `blocked_slots` | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 생성일 |
| `blocked_slots` | `UNIQUE` | `(counselor_id, blocked_date, start_hour)` | 동일 시간 중복 차단 방지 |

### 주요 인덱스

| 인덱스 | 대상 |
| --- | --- |
| `idx_blocked_slots_counselor_date` | `blocked_slots(counselor_id, blocked_date)` |
| `idx_time_slots_counselor_id` | `time_slots(counselor_id)` |
| `idx_time_slots_start_time` | `time_slots(start_time)` |
| `idx_reservations_client_id` | `reservations(client_id)` |
| `idx_reservations_slot_id` | `reservations(slot_id)` |
| `idx_journals_reservation_id` | `journals(reservation_id)` |
| `idx_reviews_counselor_id` | `reviews(counselor_id)` |

### 스키마 동기화 확인 필요 항목

API 코드에서는 `schema.sql`에 없는 컬럼을 일부 사용합니다. 실제 Supabase DB에 해당 컬럼이 이미 존재한다면 문제 없지만, `schema.sql`만으로 새 DB를 만들면 API 실행 중 오류가 날 수 있습니다.

| 사용 위치 | 코드에서 사용하는 컬럼 | 현재 `schema.sql` 반영 여부 |
| --- | --- | --- |
| `auth.py` 회원가입/로그인 | `hashed_password` | 없음. `schema.sql`은 `password_hash` |
| `auth.py` 회원가입 | `phone`, `birth_date`, `gender` | 없음 |
| `auth.py` 프로필 수정 | `profile_image`, `bio` | 없음 |
| `admin.py` 강제 로그아웃 | `refresh_token` | 없음 |
| `journals.py` 일지 생성/조회 | `client_id`, `title`, `assessment`, `next_steps`, `updated_at` | 없음 |

## 4. API 엔드포인트 목록

기본 API prefix는 `/api/v1`입니다. 인증이 필요한 API는 `Authorization: Bearer <JWT>` 헤더를 사용합니다.

### 4.1 헬스체크/인증/계정

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/` | API 헬스체크 및 서비스 상태 조회 | 불필요 |
| POST | `/api/v1/auth/signup` | 회원가입. 기본 역할은 `client` | 불필요 |
| POST | `/api/v1/auth/login` | 로그인 및 JWT 발급 | 불필요 |
| GET | `/api/v1/auth/me` | 현재 로그인 사용자 정보 조회 | 필요 |
| PATCH | `/api/v1/auth/profile` | 프로필 이미지 URL/소개글 수정 | 필요: counselor/admin |
| PATCH | `/api/v1/auth/profile/upload` | 프로필 이미지 파일 업로드 및 소개글 수정 | 필요: counselor/admin |

### 4.2 상담사

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/v1/counselors/` | 활성 상담사 목록 조회 | 불필요 |
| GET | `/api/v1/counselors/{counselor_id}` | 상담사 상세 정보와 30일 예약 가능 슬롯 조회 | 불필요 |

### 4.3 예약

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/v1/reservations` | 예약 생성. `virtual_` 슬롯이면 실제 슬롯 자동 생성 | 필요: client/admin |
| GET | `/api/v1/reservations/me` | 내담자 본인 예약 목록 조회 | 필요: client/admin |
| GET | `/api/v1/reservations/counselor` | 상담사 본인에게 들어온 예약 목록 조회 | 필요: counselor/admin |
| PATCH | `/api/v1/reservations/{reservation_id}/cancel` | 예약 취소 및 슬롯 재오픈 | 필요: client/admin |

### 4.4 시간 차단

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/v1/slots/blocked` | 상담사 본인의 미래 차단 시간 목록 조회 | 필요: counselor/admin |
| POST | `/api/v1/slots/block` | 특정 날짜/시간대 예약 차단 | 필요: counselor/admin |
| DELETE | `/api/v1/slots/block` | 특정 날짜/시간대 차단 해제 | 필요: counselor/admin |

### 4.5 상담 일지

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/v1/journals` | 예약에 대한 상담 일지 작성 | 필요: counselor/admin |
| GET | `/api/v1/journals/me` | 상담사 본인이 작성한 일지 목록 조회 | 필요: counselor/admin |
| GET | `/api/v1/journals/{journal_id}` | 상담 일지 단건 조회. 비공개 일지는 작성 상담사/관리자만 조회 | 필요 |
| PATCH | `/api/v1/journals/{journal_id}` | 상담 일지 수정 | 필요: counselor/admin |

### 4.6 리뷰

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/v1/reviews` | 내담자가 본인 예약에 리뷰 작성 | 필요: client/admin |
| GET | `/api/v1/reviews/counselor/{counselor_id}` | 상담사별 공개 리뷰 목록 및 평균 평점 조회 | 불필요 |
| GET | `/api/v1/reviews/me/{reservation_id}` | 내담자 본인의 특정 예약 리뷰 조회 | 필요: client/admin |

### 4.7 관리자

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/users` | 전체 사용자 목록 조회 | 필요: admin |
| PATCH | `/api/v1/admin/users/{user_id}` | 사용자 활성/비활성 상태 변경 | 필요: admin |
| PATCH | `/api/v1/admin/users/{user_id}/role` | 사용자 역할 변경 | 필요: admin |
| DELETE | `/api/v1/admin/users/{user_id}` | 사용자 삭제 | 필요: admin |
| POST | `/api/v1/admin/users/{user_id}/logout` | 사용자 강제 로그아웃 처리 | 필요: admin |

## 5. 화면 라우트 목록

`frontend/src/App.tsx` 기준입니다.

| Path | 화면 | 설명 | 접근 |
| --- | --- | --- | --- |
| `/` | `MainPage` | 메인, 상담사 목록/검색, 서비스 소개 | 공개 |
| `/login` | `LoginPage` | 로그인 | 공개 |
| `/signup` | `SignupPage` | 회원가입 | 공개 |
| `/reservation/:counselorId` | `ReservationPage` | 상담사 상세, 날짜/시간 선택, Toss 결제 후 예약 생성 | 공개 진입, 예약 시 로그인 필요 |
| `/my-reservations` | `MyReservationsPage` | 내담자 예약 목록, 취소/리뷰/일지 이동 | 로그인 필요 |
| `/journal/:reservationId` | `JournalPage` | 상담 일지 작성/조회 관련 화면 | 로그인 필요 |
| `/dashboard` | `CounselorDashboard` | 상담사 예약/시간 차단/프로필/일지 관리 | counselor/admin |
| `/admin` | `AdminPage` | 관리자 사용자 관리 | admin |
| `/payment-success` | `PaymentSuccessPage` | 결제/예약 완료 화면 | 로그인 필요 |
| `*` | `Navigate("/")` | 미정의 경로 메인 리다이렉트 | 공개 |

## 6. 데이터 모델

백엔드 `models` 폴더의 파일은 현재 실제 SQLAlchemy 모델 정의가 아니라 문서용 스텁 수준입니다. 실제 데이터 모델은 DB 테이블, API 요청 스키마, 프론트 타입 정의를 함께 기준으로 봐야 합니다.

| 모델/타입 | 위치 | 주요 필드 | 설명 |
| --- | --- | --- | --- |
| `User` | `frontend/src/types/index.ts`, `users` table | `id`, `email`, `name`, `role`, `created_at` | 사용자 계정. 역할은 `admin`, `counselor`, `client` |
| `SignupRequest` | `backend/app/api/v1/auth.py` | `email`, `password`, `name`, `phone`, `birth_date`, `gender` | 회원가입 요청 |
| `LoginRequest` | `backend/app/api/v1/auth.py` | `email`, `password` | 로그인 요청 |
| `ProfileUpdateRequest` | `backend/app/api/v1/auth.py` | `profile_image`, `bio` | 상담사/관리자 프로필 수정 요청 |
| `Slot` | `frontend/src/types/index.ts`, `time_slots` table | `id`, `counselor_id`, `start_time`, `end_time`, `is_available` | 예약 슬롯 |
| `BlockRequest` | `backend/app/api/v1/slots.py` | `blocked_date`, `start_hour` | 상담 불가 시간 등록 요청 |
| `Reservation` | `frontend/src/types/index.ts`, `reservations` table | `id`, `slot_id`, `client_id`, `status`, `created_at`, `slot` | 상담 예약 |
| `ReservationCreate` | `backend/app/api/v1/reservations.py` | `slot_id`, `counselor_id`, `start_time` | 예약 생성 요청. 가상 슬롯이면 실제 슬롯 자동 생성 |
| `Journal` | `frontend/src/types/index.ts`, `journals` table | `id`, `reservation_id`, `counselor_id`, `content`, `is_private`, `created_at` | 상담 일지 |
| `JournalCreate` | `backend/app/api/v1/journals.py` | `reservation_id`, `title`, `content`, `assessment`, `next_steps`, `is_private` | 상담 일지 생성 요청 |
| `JournalUpdate` | `backend/app/api/v1/journals.py` | `title`, `content`, `assessment`, `next_steps`, `is_private` | 상담 일지 수정 요청 |
| `Review` | `frontend/src/types/index.ts`, `reviews` table | `id`, `reservation_id`, `client_id`, `counselor_id`, `rating`, `content`, `created_at` | 상담 후기 |
| `ReviewCreate` | `backend/app/api/v1/reviews.py` | `reservation_id`, `rating`, `content` | 리뷰 생성 요청 |
| `ApiResponse<T>` | `frontend/src/types/index.ts` | `data`, `message`, `total` | 프론트 공통 API 응답 타입 |

## 7. 프로젝트 폴더 구조

`node_modules`, `__pycache__` 등 생성물은 제외한 요약 구조입니다.

```text
S_Lee/
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     └─ deploy.yml
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  │  └─ v1/
│  │  │     ├─ admin.py
│  │  │     ├─ auth.py
│  │  │     ├─ counselors.py
│  │  │     ├─ dependencies.py
│  │  │     ├─ journals.py
│  │  │     ├─ reservations.py
│  │  │     ├─ reviews.py
│  │  │     └─ slots.py
│  │  ├─ core/
│  │  │  ├─ config.py
│  │  │  ├─ permissions.py
│  │  │  └─ security.py
│  │  ├─ crud/
│  │  │  ├─ crud_journal.py
│  │  │  ├─ crud_reservation.py
│  │  │  ├─ crud_slot.py
│  │  │  └─ crud_user.py
│  │  ├─ db/
│  │  │  ├─ migrations/
│  │  │  ├─ schema.sql
│  │  │  └─ session.py
│  │  ├─ models/
│  │  │  ├─ journal.py
│  │  │  ├─ reservation.py
│  │  │  ├─ slot.py
│  │  │  └─ user.py
│  │  ├─ static/
│  │  │  └─ uploads/
│  │  │     └─ profiles/
│  │  ├─ tests/
│  │  │  ├─ test_concurrency.py
│  │  │  └─ test_reservations.py
│  │  └─ main.py
│  ├─ alembic.ini
│  ├─ Dockerfile
│  └─ requirements.txt
├─ frontend/
│  ├─ public/
│  │  ├─ favicon.svg
│  │  └─ icons.svg
│  ├─ src/
│  │  ├─ assets/
│  │  │  ├─ hero.png
│  │  │  ├─ react.svg
│  │  │  └─ vite.svg
│  │  ├─ components/
│  │  │  ├─ booking/
│  │  │  ├─ calendar/
│  │  │  └─ common/
│  │  ├─ hooks/
│  │  │  ├─ useActiveCheck.ts
│  │  │  └─ useSlots.ts
│  │  ├─ pages/
│  │  │  ├─ AdminPage.tsx
│  │  │  ├─ CounselorDashboard.tsx
│  │  │  ├─ JournalPage.tsx
│  │  │  ├─ LoginPage.tsx
│  │  │  ├─ MainPage.tsx
│  │  │  ├─ MyReservationsPage.tsx
│  │  │  ├─ Paymentsuccesspage.tsx
│  │  │  ├─ ReservationPage.tsx
│  │  │  └─ SignupPage.tsx
│  │  ├─ services/
│  │  │  ├─ adminService.ts
│  │  │  ├─ api.ts
│  │  │  ├─ authService.ts
│  │  │  ├─ ReservationService.ts
│  │  │  └─ slotService.ts
│  │  ├─ store/
│  │  │  ├─ auth.ts
│  │  │  └─ SignupPage.tsx
│  │  ├─ types/
│  │  │  └─ index.ts
│  │  ├─ App.css
│  │  ├─ App.tsx
│  │  ├─ index.css
│  │  └─ main.tsx
│  ├─ Dockerfile
│  ├─ eslint.config.js
│  ├─ index.html
│  ├─ nginx.conf
│  ├─ package.json
│  ├─ package-lock.json
│  ├─ tsconfig.app.json
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  └─ vite.config.ts
├─ docker-compose.yml
├─ docker-compose.prod.yml
├─ CLAUDE.md
├─ PROJECT_FEATURES.md
└─ README.md
```

## 8. 기능별 사용 기술 요약

| 기능 | 사용 기술 | 요약 |
| --- | --- | --- |
| 회원가입/로그인 | FastAPI, Pydantic, passlib/bcrypt, JWT | 이메일/비밀번호 기반으로 가입하고 로그인 시 JWT access token을 발급합니다. |
| 인증/권한 | HTTP Bearer, `get_current_user`, `require_role` | 요청 헤더의 JWT를 검증하고 `admin`, `counselor`, `client` 역할별 접근을 제한합니다. |
| 상담사 목록/검색 | React, Axios, FastAPI `/counselors/` | 메인 화면에서 활성 상담사 목록을 조회하고 이름으로 필터링합니다. |
| 상담사 상세/슬롯 계산 | FastAPI, PostgreSQL, KST/UTC 날짜 계산 | 실제 슬롯과 가상 슬롯을 합쳐 30일치 예약 가능 시간을 계산합니다. |
| 예약 생성 | FastAPI, PostgreSQL, `SELECT FOR UPDATE` | 슬롯 중복 예약을 방지하고 가상 슬롯은 예약 시 실제 `time_slots`로 자동 생성합니다. |
| 결제 후 예약 확정 | Toss Payments SDK, sessionStorage, FastAPI 예약 API | 결제 성공 콜백 이후 저장된 슬롯 정보를 읽어 예약 API를 호출합니다. |
| 예약 취소 | FastAPI, SQLAlchemy AsyncSession | 예약 상태를 `cancelled`로 변경하고 연결 슬롯을 다시 예약 가능 상태로 전환합니다. |
| 시간 차단 | FastAPI `/slots`, `blocked_slots` table | 상담사가 특정 날짜/시작 시간을 차단/해제하여 예약 가능 목록에서 제외합니다. |
| 내 예약 관리 | React protected route, Axios, `/reservations/me` | 로그인 사용자가 본인 예약을 조회하고 취소/리뷰/일지 화면으로 이동합니다. |
| 상담사 대시보드 | React role guard, `/reservations/counselor`, `/slots/*` | 상담사의 예약 목록, 차단 시간, 프로필/일지 관련 업무를 관리합니다. |
| 상담 일지 | FastAPI `/journals`, Pydantic, role check | 상담사가 예약별 일지를 작성/수정하며 비공개 일지는 접근 권한을 제한합니다. |
| 상담 후기 | FastAPI `/reviews`, Pydantic validation | 내담자가 예약별 리뷰를 작성하고 상담사 상세에서 공개 리뷰와 평균 평점을 조회합니다. |
| 관리자 사용자 관리 | React AdminPage, FastAPI `/admin/users` | 전체 사용자 조회, 활성화 토글, 역할 변경, 삭제, 강제 로그아웃 처리를 제공합니다. |
| 프로필 이미지 업로드 | FastAPI UploadFile, StaticFiles `/uploads` | 상담사/관리자가 프로필 이미지를 업로드하면 정적 업로드 경로로 제공합니다. |
| API 클라이언트 | Axios interceptor, Zustand auth store | 프론트 요청마다 Bearer 토큰을 자동 첨부하고 401 응답 시 로그아웃 흐름을 처리합니다. |
| 로컬 개발 환경 | Docker Compose, PostgreSQL 15, Uvicorn reload | DB와 백엔드를 컨테이너로 실행하고 백엔드는 hot reload로 구동합니다. |
| 배포 | Render.com, Vercel, Supabase, GitHub Actions | 백엔드/프론트/DB를 각각 외부 플랫폼에 배포하고 CI/CD 워크플로우를 사용합니다. |

