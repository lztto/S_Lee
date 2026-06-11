# S.LEE Secret Counseling 프로젝트 정리

## 1. 프로젝트 개요

**S.LEE Secret Counseling**은 프라이빗 심리/코칭 상담 예약 플랫폼입니다.

내담자는 상담사 목록을 확인하고, 상담사별 예약 가능 시간을 선택해 상담을 예약할 수 있습니다. 예약 과정에서는 Toss Payments 결제를 거친 뒤 예약이 확정됩니다. 상담사는 본인에게 들어온 예약 목록을 확인하고 상담 불가 시간을 차단할 수 있으며, 상담 이후 상담 일지를 작성하거나 수정할 수 있습니다. 관리자는 전체 사용자 계정의 활성 상태와 권한을 관리합니다.

### 팀

| 이름 | 역할 | 브랜치 |
| --- | --- | --- |
| 이지성 | 프로젝트 리더, 풀스택 | `feature/lztto` |
| 이명훈 | 풀스택 | `feature/MH` |
| 이윤성 | 풀스택 | `feature/YS-YS` |

### 배포

| 서비스 | 플랫폼 | 비고 |
| --- | --- | --- |
| Frontend | Vercel | React/Vite 앱 배포 |
| Backend API | Render | FastAPI 서버 배포 |
| Database | Supabase PostgreSQL | 운영 DB |

> 현재 실제 배포 흐름은 프론트엔드 Vercel, 백엔드 Render, DB Supabase 구조입니다. Docker Compose는 로컬 개발 환경에서 PostgreSQL과 백엔드를 함께 실행하기 위한 용도이며, 프론트엔드 Dockerfile과 `docker-compose.prod.yml`은 현재 실제 배포에 사용하지 않습니다.

## 2. 기술 스택

| 구분 | 기술 |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Routing | react-router-dom |
| State | Zustand |
| HTTP Client | Axios |
| Payment | Toss Payments JavaScript SDK |
| Backend | FastAPI, Python, Uvicorn |
| API | REST API, FastAPI Router, Pydantic |
| ORM/DB | SQLAlchemy AsyncSession, PostgreSQL, asyncpg |
| Auth | JWT Bearer Token, python-jose, passlib/bcrypt |
| Infra | Vercel, Render, Supabase, Docker(백엔드/로컬 개발), Docker Compose(로컬 개발) |
| Test | pytest |

## 3. 주요 기능

### 내담자 기능

- 회원가입 및 로그인
- JWT 기반 인증
- 상담사 목록 조회
- 상담사 상세 정보 및 예약 가능 시간 조회
- 상담 예약 생성
- Toss Payments 결제 후 예약 확정
- 내 예약 목록 조회
- 예약 취소
- 상담 리뷰 작성 및 조회

### 상담사 기능

- 상담사 대시보드
- 본인에게 들어온 예약 목록 조회
- 상담 불가 시간 차단 및 해제
- 상담 일지 작성, 조회, 수정
- 프로필 이미지 및 소개글 관리

### 관리자 기능

- 전체 사용자 목록 조회
- 사용자 활성/비활성 상태 변경
- 사용자 역할 변경
- 사용자 삭제
- 사용자 강제 로그아웃 처리

## 4. 서비스 흐름

### 예약 흐름

1. 사용자가 메인 페이지에서 상담사 목록을 조회합니다.
2. 상담사를 선택하면 상담사 상세 페이지에서 30일치 예약 가능 시간이 표시됩니다.
3. 사용자가 날짜와 시간을 선택합니다.
4. Toss Payments 결제를 진행합니다.
5. 결제 성공 후 예약 생성 API를 호출합니다.
6. 백엔드에서 예약 가능 여부를 다시 확인한 뒤 예약을 확정합니다.
7. 예약된 시간 슬롯은 예약 불가 상태로 변경됩니다.

### 상담사 업무 흐름

1. 상담사가 로그인 후 대시보드에 접근합니다.
2. 본인에게 배정된 예약 목록을 확인합니다.
3. 상담이 불가능한 날짜와 시간대를 차단합니다.
4. 상담 이후 예약 건에 대해 상담 일지를 작성합니다.
5. 필요한 경우 일지를 수정합니다.

## 5. 화면 구성

| Path | 화면 | 설명 | 접근 권한 |
| --- | --- | --- | --- |
| `/` | MainPage | 메인 화면, 상담사 목록 및 검색 | 공개 |
| `/login` | LoginPage | 로그인 | 공개 |
| `/signup` | SignupPage | 회원가입 | 공개 |
| `/reservation/:counselorId` | ReservationPage | 상담사 상세, 날짜/시간 선택, 결제 진행 | 공개 진입, 예약 시 로그인 필요 |
| `/payment-success` | PaymentSuccessPage | 결제 성공 후 예약 확정 | 로그인 필요 |
| `/my-reservations` | MyReservationsPage | 내 예약 목록, 취소, 리뷰/일지 이동 | 로그인 필요 |
| `/journal/:reservationId` | JournalPage | 상담 일지 작성 및 조회 | 로그인 필요 |
| `/dashboard` | CounselorDashboard | 상담사 예약, 차단 시간, 프로필, 일지 관리 | counselor/admin |
| `/admin` | AdminPage | 관리자 사용자 관리 | admin |

## 6. API 구성

기본 API prefix는 `/api/v1`입니다. 인증이 필요한 API는 `Authorization: Bearer <JWT>` 헤더를 사용합니다.

| 구분 | Method | Path | 설명 |
| --- | --- | --- | --- |
| Health | GET | `/` | API 상태 확인 |
| Auth | POST | `/api/v1/auth/signup` | 회원가입 |
| Auth | POST | `/api/v1/auth/login` | 로그인 및 JWT 발급 |
| Auth | GET | `/api/v1/auth/me` | 현재 로그인 사용자 조회 |
| Auth | PATCH | `/api/v1/auth/profile` | 상담사/관리자 프로필 수정 |
| Counselors | GET | `/api/v1/counselors/` | 활성 상담사 목록 조회 |
| Counselors | GET | `/api/v1/counselors/{counselor_id}` | 상담사 상세 및 예약 가능 시간 조회 |
| Reservations | POST | `/api/v1/reservations` | 예약 생성 |
| Reservations | GET | `/api/v1/reservations/me` | 내담자 본인 예약 목록 조회 |
| Reservations | GET | `/api/v1/reservations/counselor` | 상담사 본인 예약 목록 조회 |
| Reservations | PATCH | `/api/v1/reservations/{reservation_id}/cancel` | 예약 취소 |
| Slots | GET | `/api/v1/slots/blocked` | 차단 시간 목록 조회 |
| Slots | POST | `/api/v1/slots/block` | 상담 불가 시간 차단 |
| Slots | DELETE | `/api/v1/slots/block` | 상담 불가 시간 해제 |
| Journals | POST | `/api/v1/journals` | 상담 일지 작성 |
| Journals | GET | `/api/v1/journals/me` | 본인 상담 일지 목록 조회 |
| Journals | GET | `/api/v1/journals/{journal_id}` | 상담 일지 단건 조회 |
| Journals | PATCH | `/api/v1/journals/{journal_id}` | 상담 일지 수정 |
| Reviews | POST | `/api/v1/reviews` | 상담 리뷰 작성 |
| Reviews | GET | `/api/v1/reviews/counselor/{counselor_id}` | 상담사별 공개 리뷰 조회 |
| Reviews | GET | `/api/v1/reviews/me/{reservation_id}` | 내 예약의 리뷰 조회 |
| Admin | GET | `/api/v1/admin/users` | 전체 사용자 조회 |
| Admin | PATCH | `/api/v1/admin/users/{user_id}` | 사용자 활성 상태 변경 |
| Admin | PATCH | `/api/v1/admin/users/{user_id}/role` | 사용자 권한 변경 |
| Admin | DELETE | `/api/v1/admin/users/{user_id}` | 사용자 삭제 |

## 7. DB 테이블 구조

### 테이블 관계

```text
users 1 : N time_slots
users 1 : N reservations
users 1 : N journals
users 1 : N reviews
users 1 : N blocked_slots
time_slots 1 : 0..1 reservations
reservations 1 : 0..1 journals
reservations 1 : 0..1 reviews
```

### 주요 테이블

| 테이블 | 설명 |
| --- | --- |
| `users` | 사용자 계정 정보. `admin`, `counselor`, `client` 역할 구분 |
| `time_slots` | 상담사의 실제 예약 시간 슬롯 |
| `reservations` | 예약 정보. 하나의 슬롯에는 하나의 예약만 생성 가능 |
| `journals` | 상담사가 작성하는 상담 일지 |
| `reviews` | 내담자가 작성하는 상담 리뷰 |
| `blocked_slots` | 상담사가 차단한 상담 불가 시간 |

### 주요 제약 조건

| 위치 | 제약 | 목적 |
| --- | --- | --- |
| `users.email` | UNIQUE | 이메일 중복 가입 방지 |
| `users.role` | CHECK | 사용자 역할 값 제한 |
| `time_slots` | CHECK `end_time > start_time` | 잘못된 시간 슬롯 방지 |
| `reservations.slot_id` | UNIQUE | 하나의 슬롯에 하나의 예약만 허용 |
| `journals.reservation_id` | UNIQUE | 하나의 예약에 하나의 상담 일지만 허용 |
| `reviews.reservation_id` | UNIQUE | 하나의 예약에 하나의 리뷰만 허용 |
| `reviews.rating` | CHECK 1~5 | 리뷰 평점 범위 제한 |
| `blocked_slots` | UNIQUE `(counselor_id, blocked_date, start_hour)` | 같은 상담사의 동일 시간 중복 차단 방지 |

## 8. 핵심 구현 포인트

### 역할 기반 접근 제어

사용자를 `client`, `counselor`, `admin` 역할로 구분했습니다. 백엔드에서는 JWT를 검증한 뒤 `require_role` 로직을 통해 API 접근 권한을 제한했습니다. 프론트엔드에서도 `PrivateRoute`, `CounselorRoute`, `AdminRoute`를 사용해 역할에 맞는 화면 접근을 제어했습니다.

### 가상 슬롯 기반 예약 처리

모든 예약 가능 시간을 미리 DB에 저장하지 않고, 사용자가 실제로 예약을 진행할 때 `virtual_` 슬롯 정보를 기반으로 `time_slots` 데이터를 생성하도록 구현했습니다.

이 방식으로 불필요한 슬롯 데이터를 대량으로 미리 생성하지 않으면서도, 사용자에게는 30일치 예약 가능 시간을 제공할 수 있었습니다.

### 상담 불가 시간 차단

상담사는 특정 날짜와 시간대를 차단할 수 있습니다. 차단된 시간은 예약 가능 시간 목록에서 제외되며, 예약 생성 시에도 차단 여부를 한 번 더 확인해 잘못된 예약이 생성되지 않도록 했습니다.

### 결제 이후 예약 확정

프론트엔드에서 Toss Payments 결제가 성공하면 결제 성공 페이지로 이동합니다. 이후 저장해 둔 상담사, 날짜, 시간 정보를 기반으로 백엔드 예약 API를 호출해 예약을 확정합니다.

## 9. 트러블슈팅: 동시성 문제 해결

### 문제 상황

예약 기능을 구현하는 과정에서 같은 상담사와 같은 시간대에 여러 사용자가 거의 동시에 예약을 시도하면 중복 예약이 발생할 수 있는 문제가 있었습니다.

예를 들어 두 명의 사용자가 같은 시간대를 보고 동시에 예약 버튼을 누르면, 두 요청이 모두 해당 슬롯을 “예약 가능” 상태로 읽을 수 있었습니다. 이 경우 하나의 상담 시간에 여러 예약이 생성될 위험이 생겼습니다.

### 원인

초기 예약 흐름은 다음과 같은 구조였습니다.

1. 요청한 시간 슬롯이 예약 가능한지 조회
2. 예약 가능하면 예약 데이터 생성
3. 해당 슬롯을 예약 불가 상태로 변경

이 구조에서는 1번과 2번 사이에 다른 요청이 끼어들 수 있습니다. 즉, 조회 시점에는 두 요청 모두 예약 가능하다고 판단하지만, 실제 저장 시점에는 같은 슬롯을 동시에 예약하려는 경쟁 상태가 발생할 수 있었습니다.

### 해결 방법

백엔드 로직과 DB 제약 조건을 함께 사용해 중복 예약을 방지했습니다.

1. `SELECT ... FOR UPDATE`로 기존 슬롯을 조회할 때 row lock을 적용했습니다.
2. `reservations.slot_id`에 UNIQUE 제약을 두어 같은 슬롯에는 하나의 예약만 생성되도록 했습니다.
3. 예약 생성 쿼리에 `ON CONFLICT (slot_id) DO NOTHING`을 적용해 중복 insert를 방지했습니다.
4. 예약이 완료되면 `time_slots.is_available = FALSE`로 변경했습니다.
5. 이미 예약된 슬롯이거나 차단된 시간대라면 `409 Conflict` 응답을 반환하도록 처리했습니다.

### 적용 코드 흐름

```sql
SELECT id, is_available
FROM time_slots
WHERE counselor_id = :counselor_id
  AND start_time = :start_time
FOR UPDATE;
```

```sql
INSERT INTO reservations (slot_id, client_id, status)
VALUES (:slot_id, :client_id, 'confirmed')
ON CONFLICT (slot_id) DO NOTHING
RETURNING id, slot_id, client_id, status, created_at;
```

### 결과

동시에 같은 시간대를 예약하더라도 DB 레벨에서 하나의 예약만 생성되도록 보장했습니다. 애플리케이션 로직만으로 중복 예약을 막는 것이 아니라 PostgreSQL의 row lock과 UNIQUE 제약 조건을 함께 사용해 예약 데이터의 정합성을 높였습니다.

### 배운 점

예약, 결제처럼 중복 처리가 치명적인 기능은 단순한 “조회 후 생성” 로직만으로는 안전하지 않다는 것을 배웠습니다. 특히 여러 요청이 동시에 들어오는 상황에서는 애플리케이션 레벨 검증뿐 아니라 DB 트랜잭션, lock, unique constraint 같은 데이터베이스 레벨의 안전장치가 필요하다는 점을 경험했습니다.

## 10. 프로젝트 회고

이번 프로젝트는 단순한 CRUD 서비스가 아니라 인증, 권한, 예약, 결제, 상담사 관리, 관리자 기능까지 포함한 서비스입니다.

특히 예약 기능을 구현하면서 시간대 계산, 상담 불가 시간 차단, 결제 이후 예약 확정, 동시성 문제까지 함께 고려해야 했습니다. 이 과정에서 실제 서비스에서는 화면에 보이는 예약 가능 상태와 DB에 저장되는 최종 상태 사이에 차이가 생길 수 있다는 점을 체감했습니다.

또한 프론트엔드, 백엔드, DB, 배포 플랫폼을 각각 분리해 구성하면서 서비스 전체 흐름을 이해하는 경험을 할 수 있었습니다.
