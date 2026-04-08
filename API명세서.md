# 1. 회원가입 및 인증

> **⚠️ Supabase Auth 위임 (FastAPI 직접 구현 없음)**
>
> 회원가입·로그인·소셜 로그인·비밀번호 재설정·로그아웃 등 인증 관련 기능은  
> **Supabase Auth SDK를 통해 클라이언트에서 직접 처리**합니다.  
> FastAPI 백엔드는 별도의 `/api/auth/*` 엔드포인트를 노출하지 않으며,  
> 각 요청의 `Authorization: Bearer {supabase_access_token}` 헤더를 검증하는 역할만 수행합니다.
>
> | 기능            | Supabase Auth 메서드                          |
> | --------------- | --------------------------------------------- |
> | 이메일 회원가입 | `supabase.auth.signUp({ email, password })`   |
> | 이메일 로그인   | `supabase.auth.signInWithPassword()`          |
> | 소셜 로그인     | `supabase.auth.signInWithOAuth({ provider })` |
> | 로그아웃        | `supabase.auth.signOut()`                     |
> | 비밀번호 재설정 | `supabase.auth.resetPasswordForEmail()`       |
> | 토큰 갱신       | Supabase SDK 자동 처리                        |
>
> 회원가입 완료 시 Supabase `auth.users` 트리거를 통해 `public.profiles` 테이블에 자동으로 행이 생성됩니다.

---

## 1.1.1 ~ 1.4.2 모든 인증 기능 (Supabase Auth 처리)

> FastAPI 엔드포인트 없음. 위 표의 Supabase Auth 메서드 직접 사용.  
> 회원가입 후 `auth.users` → `public.profiles` INSERT는 DB 트리거로 자동 처리.

---

# 2. 사용자 관리

---

## 2.1.1 프로필 정보 조회

- **Method**: `GET`
- **Endpoint**: `/api/users/{userId}/profile`
- **설명**: 사용자 프로필 정보 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Response Body (성공)

| 필드            | 타입              | 설명                         | 예시                            |
| --------------- | ----------------- | ---------------------------- | ------------------------------- |
| userId          | String            | 사용자 ID                    | usr_abc123                      |
| name            | String            | 이름                         | 홍길동                          |
| email           | String            | 이메일                       | user@example.com                |
| role            | String            | 역할 (INSTRUCTOR \| STUDENT) | INSTRUCTOR                      |
| profileImageUrl | String \| null    | 프로필 이미지 URL            | https://cdn.example.com/img.jpg |
| title           | String \| null    | 직책                         | 교수                            |
| createdAt       | String (ISO 8601) | 가입일시                     | 2026-01-15T09:00:00Z            |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 2.1.2 프로필 정보 수정

- **Method**: `PUT`
- **Endpoint**: `/api/users/{userId}/profile`
- **설명**: 이름, 직책, 프로필 사진 등 설정

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |
| Content-Type  | multipart/form-data  |  Y   | 파일 포함 시  |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Request Body

| 필드         | 타입                         | 필수 | 설명                     | 예시   |
| ------------ | ---------------------------- | :--: | ------------------------ | ------ |
| name         | String                       |  N   | 이름 (2~30자)            | 홍길동 |
| title        | String                       |  N   | 직책                     | 교수   |
| profileImage | File (image/jpeg, image/png) |  N   | 프로필 이미지 (최대 5MB) | -      |

### Response Body (성공)

| 필드            | 타입              | 설명              | 예시                            |
| --------------- | ----------------- | ----------------- | ------------------------------- |
| userId          | String            | 사용자 ID         | usr_abc123                      |
| name            | String            | 이름              | 홍길동                          |
| title           | String            | 직책              | 교수                            |
| profileImageUrl | String            | 프로필 이미지 URL | https://cdn.example.com/img.jpg |
| updatedAt       | String (ISO 8601) | 수정일시          | 2026-04-06T10:00:00Z            |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

### Status Codes

| 코드 | 상태                  | 설명                            | 에러 코드 (code)   |
| ---- | --------------------- | ------------------------------- | ------------------ |
| 200  | OK                    | 수정 성공                       | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패    | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료        | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음    | ACCESS_DENIED      |
| 404  | Not Found             | 수정 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패       | VALIDATION_FAILED  |
| 500  | Internal Server Error | 서버 내부 오류                  | INTERNAL_ERROR     |

---

## 2.1.3 담당 과목 등록

- **Method**: `POST`
- **Endpoint**: `/api/users/{userId}/courses`
- **설명**: 강사진이 담당 강의 과목 등록

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Request Body

| 필드      | 타입     | 필수 | 설명                | 예시                    |
| --------- | -------- | :--: | ------------------- | ----------------------- |
| courseIds | String[] |  Y   | 등록할 과목 ID 배열 | `["crs_001","crs_002"]` |

### Response Body (성공)

| 필드            | 타입     | 설명             | 예시                                 |
| --------------- | -------- | ---------------- | ------------------------------------ |
| assignedCourses | Object[] | 등록된 과목 목록 | `[{courseId, courseName, semester}]` |
| totalCount      | Integer  | 총 담당 과목 수  | 2                                    |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 201  | Created               | 리소스 생성 성공             | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 409  | Conflict              | 이미 존재하는 리소스         | RESOURCE_CONFLICT  |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패    | VALIDATION_FAILED  |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 2.1.4 담당 과목 조회

- **Method**: `GET`
- **Endpoint**: `/api/users/{userId}/courses`
- **설명**: 담당 과목 목록 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Query Parameters

| 파라미터 | 타입   | 필수 | 기본값 | 설명      |
| -------- | ------ | :--: | ------ | --------- |
| semester | String |  N   | -      | 학기 필터 |

### Response Body (성공)

| 필드       | 타입     | 설명         | 예시                                               |
| ---------- | -------- | ------------ | -------------------------------------------------- |
| courses    | Object[] | 과목 목록    | `[{courseId, courseName, semester, studentCount}]` |
| totalCount | Integer  | 전체 과목 수 | 5                                                  |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 2.2.1 역할 수정

- **Method**: `PUT`
- **Endpoint**: `/api/users/{userId}/role`
- **설명**: 강사진/학생 역할 구분 및 권한 설정

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Request Body

| 필드 | 타입   | 필수 | 설명                                  | 예시       |
| ---- | ------ | :--: | ------------------------------------- | ---------- |
| role | String |  Y   | 역할 (INSTRUCTOR \| STUDENT \| ADMIN) | INSTRUCTOR |

### Response Body (성공)

| 필드      | 타입              | 설명        | 예시                 |
| --------- | ----------------- | ----------- | -------------------- |
| userId    | String            | 사용자 ID   | usr_abc123           |
| role      | String            | 변경된 역할 | INSTRUCTOR           |
| updatedAt | String (ISO 8601) | 수정일시    | 2026-04-06T10:00:00Z |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

### Status Codes

| 코드 | 상태                  | 설명                               | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------------- | ------------------ |
| 200  | OK                    | 역할 변경 성공                     | -                  |
| 400  | Bad Request           | 유효하지 않은 역할 값              | INVALID_ROLE       |
| 401  | Unauthorized          | 인증 실패                          | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 역할 변경 권한 없음 (ADMIN만 가능) | ADMIN_ONLY         |
| 404  | Not Found             | 사용자를 찾을 수 없음              | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류                     | INTERNAL_ERROR     |

# 3. 강의 관리

## 3.1.1 강의 생성

- **Method**: `POST`
- **Endpoint**: `/api/courses`
- **설명**: 강의명, 학기, 요일/시간, 수강 인원 등 기본 정보 입력

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

### Request Body

| 필드        | 타입     | 필수 | 설명                                | 예시                       |
| ----------- | -------- | ---- | ----------------------------------- | -------------------------- |
| courseName  | String   | Y    | 강의명 (2~100자)                    | 데이터구조론               |
| semester    | String   | Y    | 학기 (YYYY-N 형식)                  | 2026-1                     |
| dayOfWeek   | String[] | Y    | 요일 (MON\|TUE\|WED\|THU\|FRI\|SAT) | ["MON","WED"]              |
| startTime   | String   | Y    | 시작 시간 (HH:mm)                   | 09:00                      |
| endTime     | String   | Y    | 종료 시간 (HH:mm)                   | 10:30                      |
| maxStudents | Integer  | N    | 최대 수강 인원 (기본 50)            | 50                         |
| description | String   | N    | 강의 설명 (최대 1000자)             | 자료구조 기초부터 고급까지 |

### Response Body (성공)

| 필드       | 타입              | 설명         | 예시                 |
| ---------- | ----------------- | ------------ | -------------------- |
| courseId   | String            | 강의 고유 ID | crs_001              |
| courseName | String            | 강의명       | 데이터구조론         |
| semester   | String            | 학기         | 2026-1               |
| createdAt  | String (ISO 8601) | 생성일시     | 2026-03-01T09:00:00Z |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                    |
| --------- | ----------------- | ------------------------------------ | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 201  | Created               | 리소스 생성 성공             | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 409  | Conflict              | 이미 존재하는 리소스         | RESOURCE_CONFLICT  |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패    | VALIDATION_FAILED  |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 3.1.2 강의 목록 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses`
- **설명**: 전체 강의 목록 조회 (페이징, 필터)

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

### Query Parameters

| 파라미터 | 타입    | 필수 | 기본값         | 설명                        |
| -------- | ------- | ---- | -------------- | --------------------------- |
| page     | Integer | N    | 1              | 페이지 번호 (1부터 시작)    |
| size     | Integer | N    | 20             | 페이지당 항목 수 (최대 100) |
| semester | String  | N    | -              | 학기 필터                   |
| keyword  | String  | N    | -              | 강의명 검색 키워드          |
| sort     | String  | N    | createdAt,desc | 정렬 기준 (필드,asc\|desc)  |

### Response Body (성공)

| 필드       | 타입     | 설명           | 예시                                                         |
| ---------- | -------- | -------------- | ------------------------------------------------------------ |
| courses    | Object[] | 강의 목록      | [{courseId, courseName, semester, instructor, studentCount}] |
| totalCount | Integer  | 전체 항목 수   | 42                                                           |
| page       | Integer  | 현재 페이지    | 1                                                            |
| size       | Integer  | 페이지 크기    | 20                                                           |
| totalPages | Integer  | 전체 페이지 수 | 3                                                            |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 3.1.3 강의 상세 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}`
- **설명**: 강의 상세 정보 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Response Body (성공)

| 필드            | 타입              | 설명           | 예시                       |
| --------------- | ----------------- | -------------- | -------------------------- |
| courseId        | String            | 강의 ID        | crs_001                    |
| courseName      | String            | 강의명         | 데이터구조론               |
| semester        | String            | 학기           | 2026-1                     |
| dayOfWeek       | String[]          | 요일           | ["MON","WED"]              |
| startTime       | String            | 시작 시간      | 09:00                      |
| endTime         | String            | 종료 시간      | 10:30                      |
| maxStudents     | Integer           | 최대 인원      | 50                         |
| currentStudents | Integer           | 현재 수강 인원 | 35                         |
| description     | String            | 강의 설명      | 자료구조 기초부터 고급까지 |
| instructor      | Object            | 담당 교수 정보 | {userId, name, email}      |
| createdAt       | String (ISO 8601) | 생성일시       | 2026-03-01T09:00:00Z       |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 3.1.4 강의 수정

- **Method**: `PUT`
- **Endpoint**: `/api/courses/{courseId}`
- **설명**: 강의 기본 정보 수정

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Request Body

| 필드        | 타입     | 필수 | 설명           | 예시          |
| ----------- | -------- | ---- | -------------- | ------------- |
| courseName  | String   | N    | 강의명         | 데이터구조론  |
| dayOfWeek   | String[] | N    | 요일           | ["MON","WED"] |
| startTime   | String   | N    | 시작 시간      | 09:00         |
| endTime     | String   | N    | 종료 시간      | 10:30         |
| maxStudents | Integer  | N    | 최대 수강 인원 | 60            |
| description | String   | N    | 강의 설명      | -             |

### Response Body (성공)

| 필드       | 타입              | 설명     | 예시                 |
| ---------- | ----------------- | -------- | -------------------- |
| courseId   | String            | 강의 ID  | crs_001              |
| courseName | String            | 강의명   | 데이터구조론         |
| updatedAt  | String (ISO 8601) | 수정일시 | 2026-03-15T10:00:00Z |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                            | 에러 코드 (code)   |
| ---- | --------------------- | ------------------------------- | ------------------ |
| 200  | OK                    | 수정 성공                       | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패    | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료        | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음    | ACCESS_DENIED      |
| 404  | Not Found             | 수정 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패       | VALIDATION_FAILED  |
| 500  | Internal Server Error | 서버 내부 오류                  | INTERNAL_ERROR     |

---

## 3.1.5 강의 삭제

- **Method**: `DELETE`
- **Endpoint**: `/api/courses/{courseId}`
- **설명**: 강의 삭제 (연관된 스케줄, 퀴즈 등 함께 삭제)

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Response Body (성공)

- 204 No Content (응답 본문 없음)

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                            | 에러 코드 (code)   |
| ---- | --------------------- | ------------------------------- | ------------------ |
| 204  | No Content            | 삭제 성공 (응답 본문 없음)      | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료        | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음    | ACCESS_DENIED      |
| 404  | Not Found             | 삭제 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류                  | INTERNAL_ERROR     |

---

## 3.1.6 강의 스케줄 등록

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/schedules`
- **설명**: 주차별 강의 주제 및 일정 등록

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Request Body

| 필드        | 타입    | 필수 | 설명                   | 예시               |
| ----------- | ------- | ---- | ---------------------- | ------------------ |
| weekNumber  | Integer | Y    | 주차 (1~16)            | 1                  |
| topic       | String  | Y    | 주제 (2~200자)         | 배열과 연결 리스트 |
| date        | String  | Y    | 수업 날짜 (YYYY-MM-DD) | 2026-03-02         |
| description | String  | N    | 상세 설명              | 선형 자료구조 개요 |

### Response Body (성공)

| 필드       | 타입              | 설명           | 예시                 |
| ---------- | ----------------- | -------------- | -------------------- |
| scheduleId | String            | 스케줄 고유 ID | sch_001              |
| weekNumber | Integer           | 주차           | 1                    |
| topic      | String            | 주제           | 배열과 연결 리스트   |
| date       | String            | 수업 날짜      | 2026-03-02           |
| createdAt  | String (ISO 8601) | 생성일시       | 2026-03-01T09:00:00Z |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 201  | Created               | 리소스 생성 성공             | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 409  | Conflict              | 이미 존재하는 리소스         | RESOURCE_CONFLICT  |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패    | VALIDATION_FAILED  |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 3.1.7 강의 스케줄 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/schedules`
- **설명**: 주차별 강의 스케줄 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Response Body (성공)

| 필드      | 타입     | 설명        | 예시                                                 |
| --------- | -------- | ----------- | ---------------------------------------------------- |
| schedules | Object[] | 스케줄 목록 | [{scheduleId, weekNumber, topic, date, description}] |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 3.1.8 강의 스케줄 수정

- **Method**: `PUT`
- **Endpoint**: `/api/courses/{courseId}/schedules/{scheduleId}`
- **설명**: 강의 스케줄 수정

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

### Path Variables

| 변수명     | 타입   | 필수 | 설명           |
| ---------- | ------ | ---- | -------------- |
| courseId   | String | Y    | 강의 고유 ID   |
| scheduleId | String | Y    | 스케줄 고유 ID |

### Request Body

| 필드        | 타입   | 필수 | 설명      | 예시       |
| ----------- | ------ | ---- | --------- | ---------- |
| topic       | String | N    | 주제      | 스택과 큐  |
| date        | String | N    | 수업 날짜 | 2026-03-09 |
| description | String | N    | 상세 설명 | -          |

### Response Body (성공)

| 필드       | 타입              | 설명      | 예시                 |
| ---------- | ----------------- | --------- | -------------------- |
| scheduleId | String            | 스케줄 ID | sch_001              |
| updatedAt  | String (ISO 8601) | 수정일시  | 2026-03-10T09:00:00Z |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                            | 에러 코드 (code)   |
| ---- | --------------------- | ------------------------------- | ------------------ |
| 200  | OK                    | 수정 성공                       | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패    | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료        | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음    | ACCESS_DENIED      |
| 404  | Not Found             | 수정 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패       | VALIDATION_FAILED  |
| 500  | Internal Server Error | 서버 내부 오류                  | INTERNAL_ERROR     |

---

## 3.2.1 수강생 일괄 등록 (파일 또는 ID 배열)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/students`
- **설명**: 엑셀 파일 업로드 또는 studentIds 배열로 수강생 일괄 등록  
  _(변경: 기존 단일 엔드포인트를 역할별 3개로 분리 — 이 엔드포인트는 일괄 등록 전용)_

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | multipart/form-data  | Y    | 파일 업로드 시 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Request Body

| 필드       | 타입         | 필수 | 설명                              | 예시                  |
| ---------- | ------------ | ---- | --------------------------------- | --------------------- |
| file       | File (.xlsx) | N    | 수강생 명단 엑셀 파일 (최대 10MB) | -                     |
| studentIds | String[]     | N    | 수강생 ID 배열 (직접 추가 시)     | ["usr_s01","usr_s02"] |

_`file` 또는 `studentIds` 중 하나는 필수_

### Response Body (성공)

| 필드       | 타입     | 설명             | 예시            |
| ---------- | -------- | ---------------- | --------------- |
| addedCount | Integer  | 추가된 수강생 수 | 35              |
| errors     | Object[] | 처리 실패 항목   | [{row, reason}] |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                    | 에러 코드 (code)         |
| ---- | --------------------- | ----------------------- | ------------------------ |
| 201  | Created               | 수강생 등록 성공        | -                        |
| 400  | Bad Request           | 엑셀 파일 형식 오류     | INVALID_FILE_FORMAT      |
| 401  | Unauthorized          | 인증 실패               | AUTH_TOKEN_EXPIRED       |
| 403  | Forbidden             | 강의 관리 권한 없음     | ACCESS_DENIED            |
| 404  | Not Found             | 강의를 찾을 수 없음     | COURSE_NOT_FOUND         |
| 409  | Conflict              | 이미 등록된 수강생 포함 | STUDENT_ALREADY_ENROLLED |
| 500  | Internal Server Error | 서버 내부 오류          | INTERNAL_ERROR           |

---

## 3.2.1-B 초대 링크 생성

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/invites`
- **설명**: 학생이 자율 등록할 수 있는 초대 링크(토큰) 생성. 만료 시간 설정 가능.

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Request Body

| 필드      | 타입              | 필수 | 설명                              | 예시                 |
| --------- | ----------------- | ---- | --------------------------------- | -------------------- |
| expiresAt | String (ISO 8601) | N    | 초대 링크 만료 일시 (기본 7일 후) | 2026-04-15T23:59:00Z |

### Response Body (성공)

| 필드        | 타입              | 설명            | 예시                                      |
| ----------- | ----------------- | --------------- | ----------------------------------------- |
| inviteToken | String            | 초대 토큰       | inv_xyz789                                |
| inviteLink  | String            | 학생 공유용 URL | https://app.example.com/invite/inv_xyz789 |
| expiresAt   | String (ISO 8601) | 만료 일시       | 2026-04-15T23:59:00Z                      |
| createdAt   | String (ISO 8601) | 생성 일시       | 2026-04-08T09:00:00Z                      |

### Status Codes

| 코드 | 상태                  | 설명                | 에러 코드 (code)   |
| ---- | --------------------- | ------------------- | ------------------ |
| 201  | Created               | 초대 링크 생성 성공 | -                  |
| 401  | Unauthorized          | 인증 실패           | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 강의 관리 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 강의를 찾을 수 없음 | COURSE_NOT_FOUND   |
| 500  | Internal Server Error | 서버 내부 오류      | INTERNAL_ERROR     |

---

## 3.2.1-C 초대 링크로 수강 등록 (학생)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/invites/{token}/accept`
- **설명**: 학생이 초대 링크를 클릭하여 수강 등록. 로그인 필요.

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| token    | String | Y    | 초대 토큰    |

### Response Body (성공)

| 필드       | 타입              | 설명           | 예시                 |
| ---------- | ----------------- | -------------- | -------------------- |
| courseId   | String            | 강의 ID        | crs_001              |
| courseName | String            | 강의명         | 데이터구조론         |
| joinedAt   | String (ISO 8601) | 등록 완료 일시 | 2026-04-08T10:00:00Z |

### Status Codes

| 코드 | 상태                  | 설명                    | 에러 코드 (code)         |
| ---- | --------------------- | ----------------------- | ------------------------ |
| 201  | Created               | 수강 등록 성공          | -                        |
| 401  | Unauthorized          | 인증 실패               | AUTH_TOKEN_EXPIRED       |
| 404  | Not Found             | 유효하지 않은 초대 토큰 | INVITE_NOT_FOUND         |
| 409  | Conflict              | 이미 등록된 수강생      | STUDENT_ALREADY_ENROLLED |
| 410  | Gone                  | 만료된 초대 링크        | INVITE_EXPIRED           |
| 500  | Internal Server Error | 서버 내부 오류          | INTERNAL_ERROR           |

---

## 3.2.2 수강생 목록 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/students`
- **설명**: 수강생 목록 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Query Parameters

| 파라미터 | 타입    | 필수 | 기본값 | 설명             |
| -------- | ------- | ---- | ------ | ---------------- |
| page     | Integer | N    | 1      | 페이지 번호      |
| size     | Integer | N    | 50     | 페이지당 항목 수 |

### Response Body (성공)

| 필드       | 타입     | 설명           | 예시                              |
| ---------- | -------- | -------------- | --------------------------------- |
| students   | Object[] | 수강생 목록    | [{userId, name, email, joinedAt}] |
| totalCount | Integer  | 전체 수강생 수 | 35                                |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 3.2.3 수강생 삭제

- **Method**: `DELETE`
- **Endpoint**: `/api/courses/{courseId}/students/{studentId}`
- **설명**: 수강생 제거

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

### Path Variables

| 변수명    | 타입   | 필수 | 설명         |
| --------- | ------ | ---- | ------------ |
| courseId  | String | Y    | 강의 고유 ID |
| studentId | String | Y    | 학생 고유 ID |

### Response Body (성공)

- 204 No Content (응답 본문 없음)

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                            | 에러 코드 (code)   |
| ---- | --------------------- | ------------------------------- | ------------------ |
| 204  | No Content            | 삭제 성공 (응답 본문 없음)      | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료        | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음    | ACCESS_DENIED      |
| 404  | Not Found             | 삭제 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류                  | INTERNAL_ERROR     |

---

## 3.2.4 수강생 참여 현황 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/students/participation`
- **설명**: 학생별 퀴즈 참여율 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Response Body (성공)

| 필드          | 타입     | 설명      | 예시                                           |
| ------------- | -------- | --------- | ---------------------------------------------- |
| participation | Object[] | 참여 현황 | [{userId, name, quizCount, participationRate}] |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 3.3.1 LMS 과목 동기화

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/lms-syncs`
- **설명**: LMS에서 과목·수강생 정보 자동 동기화 [변경] /lms/sync → /lms-syncs (동사 sync 제거, 명사 복수형)

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

### Request Body

| 필드         | 타입    | 필수 | 설명                                      | 예시           |
| ------------ | ------- | ---- | ----------------------------------------- | -------------- |
| lmsType      | String  | Y    | LMS 유형 (MOODLE \| CANVAS \| BLACKBOARD) | MOODLE         |
| lmsCourseId  | String  | Y    | LMS 내 과목 ID                            | moodle_crs_123 |
| syncStudents | Boolean | N    | 수강생 동기화 여부 (기본 true)            | true           |

### Response Body (성공)

| 필드           | 타입              | 설명               | 예시                 |
| -------------- | ----------------- | ------------------ | -------------------- |
| syncId         | String            | 동기화 ID          | sync_001             |
| syncedStudents | Integer           | 동기화된 수강생 수 | 40                   |
| lastSyncAt     | String (ISO 8601) | 동기화 시각        | 2026-03-01T09:00:00Z |

### Error Response (실패)

| 필드      | 타입              | 설명                    | 예시                                                    |
| --------- | ----------------- | ----------------------- | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드          | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의) | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지             | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록          | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각          | 2026-04-06T12:00:00Z                                    |

### Status Codes

| 코드 | 상태                  | 설명                       | 에러 코드 (code)      |
| ---- | --------------------- | -------------------------- | --------------------- |
| 200  | OK                    | 동기화 성공                | -                     |
| 400  | Bad Request           | LMS 유형 또는 과목 ID 오류 | INVALID_LMS_CONFIG    |
| 401  | Unauthorized          | 인증 실패                  | AUTH_TOKEN_EXPIRED    |
| 502  | Bad Gateway           | LMS 서버 연결 실패         | LMS_CONNECTION_FAILED |
| 500  | Internal Server Error | 서버 내부 오류             | INTERNAL_ERROR        |

# 4. 스크립트 분석

### 4.1.1 스크립트 업로드

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/scripts`
- **설명**: 강의 스크립트 또는 슬라이드 노트를 시스템에 업로드

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |
| Content-Type | multipart/form-data | Y | 파일 업로드 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |

**[Request Body]**
| 필드 | 타입 | 필수 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
| file | File | Y | 스크립트 파일 (PDF\|PPTX\|DOCX\|TXT, 최대 50MB) | - |
| weekNumber | Integer | N | 해당 주차 (1~16) | 3 |
| title | String | N | 제목 (최대 200자) | 3주차 스택과 큐 |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| scriptId | String | 스크립트 고유 ID | scr_001 |
| fileName | String | 파일명 | 3week_stack_queue.pdf |
| fileSize | Integer | 파일 크기 (bytes) | 2048576 |
| mimeType | String | 파일 MIME 타입 | application/pdf |
| uploadedAt | String (ISO 8601) | 업로드 일시 | 2026-03-15T14:00:00Z |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 201 | Created | 업로드 성공 | - |
| 400 | Bad Request | 지원하지 않는 파일 형식 | UNSUPPORTED_FILE_FORMAT |
| 401 | Unauthorized | 인증 실패 | AUTH_TOKEN_EXPIRED |
| 413 | Payload Too Large | 파일 크기 초과 (50MB) | FILE_TOO_LARGE |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.1.2 스크립트 목록 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/scripts`
- **설명**: 업로드된 스크립트 목록 조회

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |

**[Query Parameters]**
| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| weekNumber | Integer | N | - | 주차 필터 |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| scripts | Object[] | 스크립트 목록 | `[{scriptId, title, fileName, weekNumber, uploadedAt}]` |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 200 | OK | 조회 성공 | - |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.1.3 스크립트 상세 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}`
- **설명**: 스크립트 상세 내용 조회

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |
| scriptId | String | Y | 스크립트 고유 ID |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| scriptId | String | 스크립트 ID | scr_001 |
| title | String | 제목 | 3주차 스택과 큐 |
| content | String | 추출된 텍스트 내용 | 스택은 LIFO 구조로... |
| slides | Object[] | 슬라이드별 내용 (PPTX인 경우) | `[{slideNumber, text, notes}]` |
| uploadedAt | String (ISO 8601) | 업로드 일시 | 2026-03-15T14:00:00Z |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 200 | OK | 조회 성공 | - |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.1.4 스크립트 삭제

- **Method**: `DELETE`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}`
- **설명**: 스크립트 삭제 (연관 분석 결과도 함께 삭제)

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |
| scriptId | String | Y | 스크립트 고유 ID |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 204 | No Content | 삭제 성공 (응답 본문 없음) | - |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 삭제 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.2.1 논리 흐름 분석

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}/analyses/logic`
- **설명**: 소형 LLM이 텍스트 구조를 분석하여 논리 흐름 공백 탐지 (비동기 요청 - Supabase Realtime 활용)

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |
| scriptId | String | Y | 스크립트 고유 ID |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| analysisId | String | 분석 고유 ID | anl_001 |
| status | String | 현재 분석 상태 (pending \| processing) | processing |
| message | String | 안내 메시지 | 분석이 시작되었습니다. 완료 시 실시간으로 반영됩니다. |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "scriptId", reason: "유효하지 않은 ID입니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 202 | Accepted | 요청 수락 및 백그라운드 분석 시작 | - |
| 400 | Bad Request | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.2.2 전문용어 미설명 탐지

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}/analyses/terminology`
- **설명**: 처음 등장하는 전문용어에 정의가 없는 경우 감지 (비동기 요청 - Supabase Realtime 활용)

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |
| scriptId | String | Y | 스크립트 고유 ID |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| analysisId | String | 분석 고유 ID | anl_002 |
| status | String | 현재 분석 상태 (pending \| processing) | processing |
| message | String | 안내 메시지 | 분석이 시작되었습니다. 완료 시 실시간으로 반영됩니다. |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "scriptId", reason: "유효하지 않은 ID입니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 202 | Accepted | 요청 수락 및 백그라운드 분석 시작 | - |
| 400 | Bad Request | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.2.3 전제 지식 누락 탐지

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}/analyses/prerequisites`
- **설명**: 설명에 필요한 사전 지식이 빠진 부분 감지 (비동기 요청 - Supabase Realtime 활용)

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |
| scriptId | String | Y | 스크립트 고유 ID |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| analysisId | String | 분석 고유 ID | anl_003 |
| status | String | 현재 분석 상태 (pending \| processing) | processing |
| message | String | 안내 메시지 | 분석이 시작되었습니다. 완료 시 실시간으로 반영됩니다. |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "scriptId", reason: "유효하지 않은 ID입니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 202 | Accepted | 요청 수락 및 백그라운드 분석 시작 | - |
| 400 | Bad Request | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.2.4 분석 결과 통합 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}/analyses`
- **설명**: 스크립트 분석 진행 상태 및 완료된 통합 결과 조회 (초기 로드용)

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |
| scriptId | String | Y | 스크립트 고유 ID |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| logic | Object | 논리 분석 상태 및 결과 | `{analysisId, status, result, error}` |
| terminology | Object | 용어 분석 상태 및 결과 | `{analysisId, status, result, error}` |
| prerequisites | Object | 전제지식 분석 상태 및 결과 | `{analysisId, status, result, error}` |
| lastUpdatedAt | String (ISO 8601) | 최근 상태 업데이트 시각 | 2026-03-15T15:00:00Z |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "scriptId", reason: "유효하지 않은 ID입니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 200 | OK | 조회 성공 | - |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.3.1 학습자 관점 난이도 설명

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}/suggestions/difficulty`
- **설명**: 대형 LLM이 학습자 관점에서 왜 어려운지 설명 제공 (비동기 요청)

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |
| scriptId | String | Y | 스크립트 고유 ID |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| suggestionId | String | 제안 고유 ID | sug_001 |
| status | String | 현재 제안 생성 상태 (pending \| processing) | processing |
| message | String | 안내 메시지 | 제안 생성이 시작되었습니다. 완료 시 실시간으로 반영됩니다. |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "scriptId", reason: "유효하지 않은 ID입니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 202 | Accepted | 요청 수락 및 제안 생성 시작 | - |
| 400 | Bad Request | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.3.2 보완 문장·예시·비유 제안

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}/suggestions/supplements`
- **설명**: 허점에 대한 보완 문장, 예시, 비유를 자동 생성 (비동기 요청)

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |
| scriptId | String | Y | 스크립트 고유 ID |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| suggestionId | String | 제안 고유 ID | sug_002 |
| status | String | 현재 제안 생성 상태 (pending \| processing) | processing |
| message | String | 안내 메시지 | 제안 생성이 시작되었습니다. 완료 시 실시간으로 반영됩니다. |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "scriptId", reason: "유효하지 않은 ID입니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 202 | Accepted | 요청 수락 및 제안 생성 시작 | - |
| 400 | Bad Request | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

---

### 4.3.3 슬라이드별 분석 리포트 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}/reports`
- **설명**: 슬라이드 단위 문제점과 개선안을 정리하여 리포트 제공 (완료된 결과물 조회)

**[Request Headers]**
| Header | Value | 필수 | 설명 |
| --- | --- | --- | --- |
| Authorization | Bearer {accessToken} | Y | JWT 인증 토큰 |

**[Path Variables]**
| 변수명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| courseId | String | Y | 강의 고유 ID |
| scriptId | String | Y | 스크립트 고유 ID |

**[Response Body (성공)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| reportId | String | 리포트 고유 ID | rpt_001 |
| slides | Object[] | 슬라이드별 리포트 | `[{slideNumber, issues, suggestions, score}]` |
| overallScore | Float | 전체 점수 (0.0~100.0) | 82.3 |
| generatedAt | String (ISO 8601) | 생성 일시 | 2026-03-15T16:00:00Z |

**[Error Response (실패)]**
| 필드 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| status | Integer | HTTP 상태 코드 | 400 |
| code | String | 에러 코드 (시스템 정의) | INVALID_PARAMETER |
| message | String | 에러 메시지 | 필수 파라미터가 누락되었습니다. |
| errors | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "scriptId", reason: "유효하지 않은 ID입니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각 | 2026-04-06T12:00:00Z |

**[Status Codes]**
| 코드 | 상태 | 설명 | 에러 코드 (code) |
| --- | --- | --- | --- |
| 200 | OK | 조회 성공 | - |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 | AUTH_TOKEN_EXPIRED |
| 403 | Forbidden | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED |
| 404 | Not Found | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500 | Internal Server Error | 서버 내부 오류 | INTERNAL_ERROR |

# 5. 수업 피드백 API 명세서

---

### 5.1.1 퀴즈 자동 생성 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/quizzes`
- **설명**: AI가 해당 강의 내용 기반으로 퀴즈를 비동기 생성. 즉시 문항을 반환하지 않고 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  [변경] `/quizzes/generate` → `POST /quizzes` (generate 동사 제거) + 동기 201 → 비동기 202

#### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

#### Request Body

| 필드            | 타입     | 필수 | 설명                                                  | 예시                             |
| --------------- | -------- | ---- | ----------------------------------------------------- | -------------------------------- |
| scheduleId      | String   | Y    | 대상 스케줄 ID                                        | sch_003                          |
| questionCount   | Integer  | N    | 문항 수 (기본 5, 최대 20)                             | 5                                |
| questionTypes   | String[] | N    | 문항 유형 (MULTIPLE_CHOICE\|TRUE_FALSE\|SHORT_ANSWER) | ["MULTIPLE_CHOICE","TRUE_FALSE"] |
| difficultyLevel | String   | N    | 난이도 (EASY\|MEDIUM\|HARD\|MIXED, 기본 MIXED)        | MIXED                            |

#### Response Body (성공 - 202 Accepted)

| 필드    | 타입   | 설명                   | 예시                                                                  |
| ------- | ------ | ---------------------- | --------------------------------------------------------------------- |
| quizId  | String | 퀴즈 고유 ID           | qz_001                                                                |
| status  | String | 생성 상태 (generating) | generating                                                            |
| message | String | 안내 메시지            | 퀴즈 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `quizzes` 채널에서 `status = DRAFT` 이벤트 수신 후  
> `GET /api/courses/{courseId}/quizzes/{quizId}` 로 문항 조회.

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                    |
| --------- | ----------------- | ------------------------------------ | ------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                     |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                       |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                         |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | [{field: "email", reason: "형식이 올바르지 않습니다."}] |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                    |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 202  | Accepted              | 퀴즈 생성 작업 수락 (비동기) | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 409  | Conflict              | 해당 스케줄에 이미 퀴즈 존재 | RESOURCE_CONFLICT  |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패    | VALIDATION_FAILED  |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

### 5.1.2 퀴즈 문항 난이도 조절

- **Method**: `PATCH`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}`
- **설명**: 퀴즈 문항의 난이도 등 부분 수정  
  [변경] `/quizzes/{quizId}/difficulty` → `PATCH /quizzes/{quizId}` (부분 수정은 PATCH)

#### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Request Body

| 필드            | 타입   | 필수 | 설명                               | 예시  |
| --------------- | ------ | ---- | ---------------------------------- | ----- |
| difficultyLevel | String | Y    | 난이도 (EASY\|MEDIUM\|HARD\|MIXED) | MIXED |

#### Response Body (성공)

| 필드      | 타입              | 설명               | 예시                                |
| --------- | ----------------- | ------------------ | ----------------------------------- |
| quizId    | String            | 퀴즈 ID            | qz_001                              |
| questions | Object[]          | 난이도 조정된 문항 | [{questionId, difficulty, content}] |
| updatedAt | String (ISO 8601) | 수정 일시          | 2026-03-15T11:30:00Z                |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

| 코드 | 상태                  | 설명                            | 에러 코드 (code)   |
| ---- | --------------------- | ------------------------------- | ------------------ |
| 200  | OK                    | 수정 성공                       | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패    | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료        | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음    | ACCESS_DENIED      |
| 404  | Not Found             | 수정 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패       | VALIDATION_FAILED  |
| 500  | Internal Server Error | 서버 내부 오류                  | INTERNAL_ERROR     |

---

### 5.1.3 퀴즈 목록 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/quizzes`
- **설명**: 강의별 퀴즈 목록 조회

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

#### Query Parameters

| 파라미터 | 타입    | 필수 | 기본값 | 설명                                      |
| -------- | ------- | ---- | ------ | ----------------------------------------- |
| status   | String  | N    | -      | 퀴즈 상태 필터 (DRAFT\|PUBLISHED\|CLOSED) |
| page     | Integer | N    | 1      | 페이지 번호                               |
| size     | Integer | N    | 20     | 페이지당 항목 수                          |

#### Response Body (성공)

| 필드       | 타입     | 설명      | 예시                                                                    |
| ---------- | -------- | --------- | ----------------------------------------------------------------------- |
| quizzes    | Object[] | 퀴즈 목록 | [{quizId, scheduleId, status, questionCount, responseCount, createdAt}] |
| totalCount | Integer  | 전체 수   | 12                                                                      |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

### 5.1.4 퀴즈 상세 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}`
- **설명**: 퀴즈 상세 정보 및 문항 조회

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Response Body (성공)

| 필드          | 타입              | 설명      | 예시                                                       |
| ------------- | ----------------- | --------- | ---------------------------------------------------------- |
| quizId        | String            | 퀴즈 ID   | qz_001                                                     |
| status        | String            | 상태      | DRAFT                                                      |
| questions     | Object[]          | 문항 목록 | [{questionId, type, difficulty, content, options, answer}] |
| responseCount | Integer           | 응답 수   | 28                                                         |
| createdAt     | String (ISO 8601) | 생성 일시 | 2026-03-15T11:00:00Z                                       |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

(5.1.3과 동일)

---

### 5.1.5 퀴즈 수정

- **Method**: `PUT`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}`
- **설명**: 퀴즈 문항 전체 수정

#### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Request Body

| 필드      | 타입     | 필수 | 설명             | 예시                                                 |
| --------- | -------- | ---- | ---------------- | ---------------------------------------------------- |
| questions | Object[] | Y    | 수정된 문항 목록 | [{questionId, content, options, answer, difficulty}] |

#### Response Body (성공)

| 필드      | 타입              | 설명      | 예시                 |
| --------- | ----------------- | --------- | -------------------- |
| quizId    | String            | 퀴즈 ID   | qz_001               |
| updatedAt | String (ISO 8601) | 수정 일시 | 2026-03-15T12:00:00Z |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

(5.1.2와 동일)

---

### 5.1.6 퀴즈 삭제

- **Method**: `DELETE`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}`
- **설명**: 퀴즈 삭제 (연관 응답 데이터 함께 삭제)

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Response Body (성공)

응답 본문 없음

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

| 코드 | 상태                  | 설명                            | 에러 코드 (code)   |
| ---- | --------------------- | ------------------------------- | ------------------ |
| 204  | No Content            | 삭제 성공 (응답 본문 없음)      | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료        | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음    | ACCESS_DENIED      |
| 404  | Not Found             | 삭제 대상 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류                  | INTERNAL_ERROR     |

---

### 5.1.7 퀴즈 상태 변경 (발행)

- **Method**: `PATCH`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}/status`
- **설명**: 퀴즈 상태를 변경하여 학생들에게 배포  
  [변경] `POST /publish` → `PATCH /status` (상태 리소스 부분 수정)

#### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Request Body

| 필드      | 타입              | 필수 | 설명                              | 예시                 |
| --------- | ----------------- | ---- | --------------------------------- | -------------------- |
| status    | String            | Y    | 변경할 상태 (PUBLISHED \| CLOSED) | PUBLISHED            |
| expiresAt | String (ISO 8601) | N    | 마감 시간 (PUBLISHED 시 필요)     | 2026-03-16T23:59:00Z |
| anonymous | Boolean           | N    | 익명 응시 여부 (기본 true)        | true                 |

#### Response Body (성공)

| 필드       | 타입   | 설명           | 예시                                |
| ---------- | ------ | -------------- | ----------------------------------- |
| quizId     | String | 퀴즈 ID        | qz_001                              |
| status     | String | 변경된 상태    | PUBLISHED                           |
| accessLink | String | 학생 접속 링크 | https://app.example.com/quiz/qz_001 |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

| 코드 | 상태                  | 설명                    | 에러 코드 (code)          |
| ---- | --------------------- | ----------------------- | ------------------------- |
| 200  | OK                    | 상태 변경 성공          | -                         |
| 400  | Bad Request           | 유효하지 않은 상태 전이 | INVALID_STATUS_TRANSITION |
| 401  | Unauthorized          | 인증 실패               | AUTH_TOKEN_EXPIRED        |
| 403  | Forbidden             | 권한 없음               | ACCESS_DENIED             |
| 404  | Not Found             | 퀴즈를 찾을 수 없음     | RESOURCE_NOT_FOUND        |
| 500  | Internal Server Error | 서버 내부 오류          | INTERNAL_ERROR            |

---

### 5.2.1 퀴즈 응시 (제출)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}/submissions`
- **설명**: 학생이 익명으로 퀴즈에 응시  
  [변경] `/submit` → `/submissions` (동사 제거, 명사 리소스 생성)

#### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Request Body

| 필드    | 타입     | 필수 | 설명      | 예시                           |
| ------- | -------- | ---- | --------- | ------------------------------ |
| answers | Object[] | Y    | 답변 목록 | [{questionId, selectedOption}] |

#### Response Body (성공)

| 필드         | 타입              | 설명             | 예시                 |
| ------------ | ----------------- | ---------------- | -------------------- |
| submissionId | String            | 제출 고유 ID     | sub_001              |
| score        | Float             | 점수 (0.0~100.0) | 80.0                 |
| correctCount | Integer           | 정답 수          | 4                    |
| totalCount   | Integer           | 전체 문항 수     | 5                    |
| submittedAt  | String (ISO 8601) | 제출 시각        | 2026-03-15T11:30:00Z |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

| 코드 | 상태                  | 설명                               | 에러 코드 (code)      |
| ---- | --------------------- | ---------------------------------- | --------------------- |
| 201  | Created               | 응시 제출 성공                     | -                     |
| 400  | Bad Request           | 답변 형식 오류 또는 문항 ID 불일치 | INVALID_ANSWER_FORMAT |
| 401  | Unauthorized          | 인증 실패                          | AUTH_TOKEN_EXPIRED    |
| 403  | Forbidden             | 퀴즈 응시 권한 없음                | NOT_ENROLLED          |
| 404  | Not Found             | 퀴즈를 찾을 수 없음                | RESOURCE_NOT_FOUND    |
| 409  | Conflict              | 이미 제출한 퀴즈                   | ALREADY_SUBMITTED     |
| 410  | Gone                  | 마감된 퀴즈                        | QUIZ_EXPIRED          |
| 500  | Internal Server Error | 서버 내부 오류                     | INTERNAL_ERROR        |

---

### 5.2.2 실시간 응답 집계

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}/responses`
- **설명**: 응답 결과를 실시간으로 집계  
  [변경] `/responses/realtime` → `/responses` (realtime은 기본 동작, Query로 분리 불필요)

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Response Body (성공)

| 필드           | 타입              | 설명            | 예시                                            |
| -------------- | ----------------- | --------------- | ----------------------------------------------- |
| totalResponses | Integer           | 총 응답 수      | 28                                              |
| averageScore   | Float             | 평균 점수       | 72.5                                            |
| questionStats  | Object[]          | 문항별 통계     | [{questionId, correctRate, optionDistribution}] |
| lastUpdatedAt  | String (ISO 8601) | 마지막 업데이트 | 2026-03-15T11:45:00Z                            |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

(5.1.3과 동일)

---

### 5.3.1 이해도 리포트 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}/comprehension`
- **설명**: 80% 이상 양호, 60~80% 부분 어려움, 60% 미만 난이도 판정

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Response Body (성공)

| 필드           | 타입     | 설명                             | 예시                   |
| -------------- | -------- | -------------------------------- | ---------------------- |
| overallRate    | Float    | 전체 정답률 (0.0~100.0)          | 72.5                   |
| level          | String   | 이해도 수준 (GOOD\|PARTIAL\|LOW) | PARTIAL                |
| topicBreakdown | Object[] | 토픽별 이해도                    | [{topic, rate, level}] |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

(5.1.3과 동일)

---

### 5.3.2-A 문항별 오답률 분석 트리거 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}/responses/analyses`
- **설명**: 오답률 분석 작업 시작. AI가 각 문항의 오답 패턴을 분석. 완료 시 Supabase Realtime 이벤트 발생.

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Response Body (성공 - 202)

| 필드       | 타입   | 설명         | 예시                                                             |
| ---------- | ------ | ------------ | ---------------------------------------------------------------- |
| analysisId | String | 분석 고유 ID | anl_r01                                                          |
| status     | String | 분석 상태    | processing                                                       |
| message    | String | 안내 메시지  | 분석이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

#### Status Codes

| 코드 | 상태                  | 설명                | 에러 코드 (code)   |
| ---- | --------------------- | ------------------- | ------------------ |
| 202  | Accepted              | 분석 작업 수락      | -                  |
| 401  | Unauthorized          | 인증 실패           | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 권한 없음           | ACCESS_DENIED      |
| 404  | Not Found             | 퀴즈를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류      | INTERNAL_ERROR     |

---

### 5.3.2-B 문항별 오답률 분석 결과 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}/responses/analyses`
- **설명**: 완료된 오답률 분석 결과 조회 (초기 로드 또는 Realtime 수신 후)  
  [변경] `/responses/analysis` → `/responses/analyses` (복수형)

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Response Body (성공)

| 필드         | 타입     | 설명           | 예시                                                     |
| ------------ | -------- | -------------- | -------------------------------------------------------- |
| analyses     | Object[] | 문항별 분석    | [{questionId, wrongRate, commonMistake, relatedConcept}] |
| weakConcepts | String[] | 취약 개념 목록 | ["스택 오버플로우","큐 순환"]                            |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

(5.1.3과 동일)

---

### 5.3.3-A 다음 수업 개선 제안 트리거 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}/improvement-suggestions`
- **설명**: 취약 토픽 기반 다음 수업 개선 제안 생성 작업 시작. 완료 시 Supabase Realtime 이벤트 발생.

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Response Body (성공 - 202)

| 필드         | 타입   | 설명         | 예시                                                                  |
| ------------ | ------ | ------------ | --------------------------------------------------------------------- |
| suggestionId | String | 제안 고유 ID | sug_r01                                                               |
| status       | String | 생성 상태    | processing                                                            |
| message      | String | 안내 메시지  | 제안 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

#### Status Codes

| 코드 | 상태                  | 설명                | 에러 코드 (code)   |
| ---- | --------------------- | ------------------- | ------------------ |
| 202  | Accepted              | 제안 생성 작업 수락 | -                  |
| 401  | Unauthorized          | 인증 실패           | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 권한 없음           | ACCESS_DENIED      |
| 404  | Not Found             | 퀴즈를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류      | INTERNAL_ERROR     |

---

### 5.3.3-B 다음 수업 개선 제안 결과 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/quizzes/{quizId}/improvement-suggestions`
- **설명**: 완료된 개선 제안 결과 조회. 취약 토픽에 대한 복습 슬라이드 추가 등 제안.

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |
| quizId   | String | Y    | 퀴즈 고유 ID |

#### Response Body (성공)

| 필드        | 타입     | 설명      | 예시                                  |
| ----------- | -------- | --------- | ------------------------------------- |
| suggestions | Object[] | 개선 제안 | [{type, topic, suggestion, priority}] |

#### Error Response (실패)

(5.1.1과 동일 포맷 적용)

#### Status Codes

(5.1.3과 동일)

# 6. 자료 자동 생성

## 6.1 예습 가이드

### 6.1.1 예습 가이드 생성 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/schedules/{scheduleId}/preview-guides`
- **설명**: 핵심 개념 요약 + 사전 읽기 자료 링크 포함 예습 가이드 AI 생성. 즉시 완료되지 않고 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  [변경] /preview-guide → /preview-guides (복수형) + 동기 201 → 비동기 202

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명     | 타입   | 필수 | 설명           |
| ---------- | ------ | ---- | -------------- |
| courseId   | String | Y    | 강의 고유 ID   |
| scheduleId | String | Y    | 스케줄 고유 ID |

#### Response Body (성공 - 202 Accepted)

| 필드    | 타입   | 설명                   | 예시                                                                         |
| ------- | ------ | ---------------------- | ---------------------------------------------------------------------------- |
| guideId | String | 가이드 고유 ID         | gd_001                                                                       |
| status  | String | 생성 상태 (generating) | generating                                                                   |
| message | String | 안내 메시지            | 예습 가이드 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `preview_guides` 채널에서 `status = completed` 수신 후  
> `GET /api/courses/{courseId}/schedules/{scheduleId}/preview-guides` 로 결과 조회.

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                                | 에러 코드 (code)   |
| ---- | --------------------- | ----------------------------------- | ------------------ |
| 202  | Accepted              | 예습 가이드 생성 작업 수락          | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패        | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료            | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음        | ACCESS_DENIED      |
| 409  | Conflict              | 해당 스케줄에 이미 예습 가이드 존재 | RESOURCE_CONFLICT  |
| 500  | Internal Server Error | 서버 내부 오류                      | INTERNAL_ERROR     |

---

### 6.1.2 예습 가이드 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/schedules/{scheduleId}/preview-guides`
- **설명**: 생성된 예습 가이드 조회

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명     | 타입   | 필수 | 설명           |
| ---------- | ------ | ---- | -------------- |
| courseId   | String | Y    | 강의 고유 ID   |
| scheduleId | String | Y    | 스케줄 고유 ID |

#### Response Body (성공)

| 필드   | 타입     | 설명             | 예시                                           |
| ------ | -------- | ---------------- | ---------------------------------------------- |
| guides | Object[] | 예습 가이드 목록 | `[{guideId, keyConcepts, summary, createdAt}]` |

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 6.2 복습 요약본

### 6.2.1 복습 요약본 생성 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/schedules/{scheduleId}/review-summaries`
- **설명**: 수업 후 복습 요약본 AI 생성. 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  [변경] /review-summary → /review-summaries (복수형) + 동기 201 → 비동기 202

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명     | 타입   | 필수 | 설명           |
| ---------- | ------ | ---- | -------------- |
| courseId   | String | Y    | 강의 고유 ID   |
| scheduleId | String | Y    | 스케줄 고유 ID |

#### Response Body (성공 - 202 Accepted)

| 필드      | 타입   | 설명                   | 예시                                                                         |
| --------- | ------ | ---------------------- | ---------------------------------------------------------------------------- |
| summaryId | String | 요약본 고유 ID         | sum_001                                                                      |
| status    | String | 생성 상태 (generating) | generating                                                                   |
| message   | String | 안내 메시지            | 복습 요약본 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `review_summaries` 채널에서 `status = completed` 수신 후  
> `GET /api/courses/{courseId}/schedules/{scheduleId}/review-summaries` 로 결과 조회.

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                                | 에러 코드 (code)   |
| ---- | --------------------- | ----------------------------------- | ------------------ |
| 202  | Accepted              | 복습 요약본 생성 작업 수락          | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패        | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료            | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음        | ACCESS_DENIED      |
| 409  | Conflict              | 해당 스케줄에 이미 복습 요약본 존재 | RESOURCE_CONFLICT  |
| 500  | Internal Server Error | 서버 내부 오류                      | INTERNAL_ERROR     |

---

### 6.2.2 복습 요약본 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/schedules/{scheduleId}/review-summaries`
- **설명**: 생성된 복습 요약본 조회

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명     | 타입   | 필수 | 설명           |
| ---------- | ------ | ---- | -------------- |
| courseId   | String | Y    | 강의 고유 ID   |
| scheduleId | String | Y    | 스케줄 고유 ID |

#### Response Body (성공)

| 필드      | 타입     | 설명        | 예시                                           |
| --------- | -------- | ----------- | ---------------------------------------------- |
| summaries | Object[] | 요약본 목록 | `[{summaryId, content, keyPoints, createdAt}]` |

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 6.3 공지문

### 6.3.1 공지문 생성 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/announcements`
- **설명**: 템플릿 기반 예습/복습 안내 공지문 AI 생성. 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  [변경] /announcements/generate → POST /announcements (generate 동사 제거) + 동기 201 → 비동기 202

#### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

#### Request Body

| 필드          | 타입   | 필수 | 설명                                   | 예시                           |
| ------------- | ------ | ---- | -------------------------------------- | ------------------------------ |
| templateType  | String | Y    | 템플릿 유형 (PREVIEW\|REVIEW\|GENERAL) | PREVIEW                        |
| scheduleId    | String | N    | 대상 스케줄 ID                         | sch_004                        |
| customMessage | String | N    | 추가 메시지 (최대 500자)               | 이번 주차 과제도 확인해주세요. |

#### Response Body (성공 - 202 Accepted)

| 필드           | 타입   | 설명                   | 예시                                                                    |
| -------------- | ------ | ---------------------- | ----------------------------------------------------------------------- |
| announcementId | String | 공지 고유 ID           | ann_001                                                                 |
| status         | String | 생성 상태 (generating) | generating                                                              |
| message        | String | 안내 메시지            | 공지문 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `announcements` 채널에서 `status = completed` 수신 후  
> `GET /api/courses/{courseId}/announcements` 로 결과 조회.

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 202  | Accepted              | 공지문 생성 작업 수락        | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

### 6.3.2 공지문 목록 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/announcements`
- **설명**: 공지문 목록 조회

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

#### Query Parameters

| 파라미터 | 타입    | 필수 | 기본값 | 설명             |
| -------- | ------- | ---- | ------ | ---------------- |
| page     | Integer | N    | 1      | 페이지 번호      |
| size     | Integer | N    | 20     | 페이지당 항목 수 |

#### Response Body (성공)

| 필드          | 타입     | 설명      | 예시                                                 |
| ------------- | -------- | --------- | ---------------------------------------------------- |
| announcements | Object[] | 공지 목록 | `[{announcementId, title, templateType, createdAt}]` |
| totalCount    | Integer  | 전체 수   | 8                                                    |

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 200  | OK                    | 조회 성공                    | -                  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

## 6.4 LMS 연동

> **변경 이유**: 기존 `/materials/{materialId}/distributions` 는 `materialId` 가 예습 가이드인지, 복습 요약본인지, 공지문인지 타입을 알 수 없는 모호한 설계였습니다.  
> 자료 유형별로 엔드포인트를 분리하여 경로만으로 타입을 명확히 식별합니다.

### 6.4.1-A 예습 가이드 LMS 배포

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/preview-guides/{guideId}/distributions`
- **설명**: 교수자 승인 후 예습 가이드를 LMS에 자동 업로드  
  [변경] `/materials/{materialId}/distributions` → 타입별 3개 엔드포인트로 분리

#### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명           |
| -------- | ------ | ---- | -------------- |
| courseId | String | Y    | 강의 고유 ID   |
| guideId  | String | Y    | 예습 가이드 ID |

#### Request Body

| 필드      | 타입   | 필수 | 설명                                  | 예시   |
| --------- | ------ | ---- | ------------------------------------- | ------ |
| targetLms | String | Y    | LMS 유형 (MOODLE\|CANVAS\|BLACKBOARD) | MOODLE |
| section   | String | N    | LMS 섹션/주차                         | week4  |

#### Response Body (성공)

| 필드           | 타입              | 설명            | 예시                                                    |
| -------------- | ----------------- | --------------- | ------------------------------------------------------- |
| distributionId | String            | 배포 고유 ID    | dist_001                                                |
| status         | String            | 배포 상태       | COMPLETED                                               |
| lmsUrl         | String            | LMS 내 자료 URL | https://moodle.example.com/mod/resource/view.php?id=123 |
| distributedAt  | String (ISO 8601) | 배포 시각       | 2026-03-15T10:00:00Z                                    |

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                  | 에러 코드 (code)      |
| ---- | --------------------- | --------------------- | --------------------- |
| 201  | Created               | 배포 성공             | -                     |
| 400  | Bad Request           | LMS 설정 오류         | INVALID_LMS_CONFIG    |
| 401  | Unauthorized          | 인증 실패             | AUTH_TOKEN_EXPIRED    |
| 404  | Not Found             | 가이드를 찾을 수 없음 | MATERIAL_NOT_FOUND    |
| 502  | Bad Gateway           | LMS 서버 연결 실패    | LMS_CONNECTION_FAILED |
| 500  | Internal Server Error | 서버 내부 오류        | INTERNAL_ERROR        |

---

### 6.4.1-B 복습 요약본 LMS 배포

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/review-summaries/{summaryId}/distributions`
- **설명**: 교수자 승인 후 복습 요약본을 LMS에 자동 업로드

#### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

#### Path Variables

| 변수명    | 타입   | 필수 | 설명           |
| --------- | ------ | ---- | -------------- |
| courseId  | String | Y    | 강의 고유 ID   |
| summaryId | String | Y    | 복습 요약본 ID |

#### Request Body / Response Body / Status Codes

_(6.4.1-A와 동일 구조. `targetLms`, `section` 요청, `distributionId`, `lmsUrl` 응답)_

---

### 6.4.1-C 공지문 LMS 배포

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/announcements/{announcementId}/distributions`
- **설명**: 교수자 승인 후 공지문을 LMS에 자동 업로드

#### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | ---- | -------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰  |
| Content-Type  | application/json     | Y    | 요청 본문 형식 |

#### Path Variables

| 변수명         | 타입   | 필수 | 설명         |
| -------------- | ------ | ---- | ------------ |
| courseId       | String | Y    | 강의 고유 ID |
| announcementId | String | Y    | 공지문 ID    |

#### Request Body / Response Body / Status Codes

_(6.4.1-A와 동일 구조. `targetLms`, `section` 요청, `distributionId`, `lmsUrl` 응답)_

---

## 6.5 오디오 및 스크립트

### 6.5.1 오디오 파일 업로드

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/audios`
- **설명**: 강사가 수업 오디오 파일 업로드 ([변경] /audio/upload → /audios (동사 upload 제거, 복수형))

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |
| Content-Type  | multipart/form-data  | Y    | 파일 업로드   |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| courseId | String | Y    | 강의 고유 ID |

#### Request Body

| 필드       | 타입                                    | 필수 | 설명                     | 예시    |
| ---------- | --------------------------------------- | ---- | ------------------------ | ------- |
| file       | File (audio/mpeg, audio/wav, audio/m4a) | Y    | 오디오 파일 (최대 500MB) | -       |
| scheduleId | String                                  | N    | 대상 스케줄 ID           | sch_003 |

#### Response Body (성공)

| 필드             | 타입    | 설명                                      | 예시       |
| ---------------- | ------- | ----------------------------------------- | ---------- |
| audioId          | String  | 오디오 고유 ID                            | aud_001    |
| status           | String  | 변환 상태 (PROCESSING\|COMPLETED\|FAILED) | PROCESSING |
| estimatedSeconds | Integer | 예상 처리 시간(초)                        | 120        |

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                      | 에러 코드 (code)         |
| ---- | --------------------- | ------------------------- | ------------------------ |
| 201  | Created               | 업로드 성공, 변환 시작    | -                        |
| 400  | Bad Request           | 지원하지 않는 오디오 형식 | UNSUPPORTED_AUDIO_FORMAT |
| 401  | Unauthorized          | 인증 실패                 | AUTH_TOKEN_EXPIRED       |
| 413  | Payload Too Large     | 파일 크기 초과 (500MB)    | FILE_TOO_LARGE           |
| 500  | Internal Server Error | 서버 내부 오류            | INTERNAL_ERROR           |

---

### 6.5.2 텍스트 변환 결과 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/audios/{audioId}/transcripts`
- **설명**: 변환된 텍스트 결과 조회 ([변경] /audio/{audioId}/transcript → /audios/{audioId}/transcripts (복수형 통일))

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명           |
| -------- | ------ | ---- | -------------- |
| courseId | String | Y    | 강의 고유 ID   |
| audioId  | String | Y    | 오디오 고유 ID |

#### Response Body (성공)

| 필드        | 타입              | 설명               | 예시                                |
| ----------- | ----------------- | ------------------ | ----------------------------------- |
| audioId     | String            | 오디오 ID          | aud_001                             |
| status      | String            | 변환 상태          | COMPLETED                           |
| transcript  | String            | 변환된 전체 텍스트 | 오늘 수업에서는 트리 구조에 대해... |
| segments    | Object[]          | 시간별 구간        | `[{startTime, endTime, text}]`      |
| completedAt | String (ISO 8601) | 변환 완료 시각     | 2026-03-15T14:30:00Z                |

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                  | 에러 코드 (code)          |
| ---- | --------------------- | --------------------- | ------------------------- |
| 200  | OK                    | 조회 성공             | -                         |
| 202  | Accepted              | 아직 변환 진행 중     | TRANSCRIPTION_IN_PROGRESS |
| 401  | Unauthorized          | 인증 실패             | AUTH_TOKEN_EXPIRED        |
| 404  | Not Found             | 오디오를 찾을 수 없음 | RESOURCE_NOT_FOUND        |
| 500  | Internal Server Error | 서버 내부 오류        | INTERNAL_ERROR            |

---

## 6.6 수업 사후 분석

### 6.6.1 수업 후 구조 분석 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}/post-analyses/structure`
- **설명**: 소형 LLM 통해 수업 흐름 구조도 분석. 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  [변경] /post-analysis/structure → /post-analyses/structure (복수형) + 동기 200 → 비동기 202

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| courseId | String | Y    | 강의 고유 ID     |
| scriptId | String | Y    | 스크립트 고유 ID |

#### Response Body (성공 - 202 Accepted)

| 필드       | 타입   | 설명                   | 예시                                                                  |
| ---------- | ------ | ---------------------- | --------------------------------------------------------------------- |
| analysisId | String | 분석 고유 ID           | panl_001                                                              |
| status     | String | 분석 상태 (processing) | processing                                                            |
| message    | String | 안내 메시지            | 구조 분석이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `script_post_analyses` 채널에서 `status = completed` 수신 후  
> 해당 analysisId로 결과 조회.

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 202  | Accepted              | 구조 분석 작업 수락          | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 대상 리소스를 찾을 수 없음   | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

---

### 6.6.2 개념어 체크 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/scripts/{scriptId}/post-analyses/concepts`
- **설명**: 소형 LLM 통해 필수 수업 내용 전달 확인. 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  [변경] /post-analysis/concepts → /post-analyses/concepts (복수형) + 동기 200 → 비동기 202

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Path Variables

| 변수명   | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| courseId | String | Y    | 강의 고유 ID     |
| scriptId | String | Y    | 스크립트 고유 ID |

#### Response Body (성공 - 202 Accepted)

| 필드       | 타입   | 설명                   | 예시                                                                    |
| ---------- | ------ | ---------------------- | ----------------------------------------------------------------------- |
| analysisId | String | 분석 고유 ID           | panl_002                                                                |
| status     | String | 분석 상태 (processing) | processing                                                              |
| message    | String | 안내 메시지            | 개념어 체크가 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

#### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | 400                                                       |
| code      | String            | 에러 코드 (시스템 정의)              | INVALID_PARAMETER                                         |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | 2026-04-06T12:00:00Z                                      |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)   |
| ---- | --------------------- | ---------------------------- | ------------------ |
| 202  | Accepted              | 개념어 체크 작업 수락        | -                  |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | INVALID_PARAMETER  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | AUTH_TOKEN_EXPIRED |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | ACCESS_DENIED      |
| 404  | Not Found             | 대상 리소스를 찾을 수 없음   | RESOURCE_NOT_FOUND |
| 500  | Internal Server Error | 서버 내부 오류               | INTERNAL_ERROR     |

# 7. 마감 리마인더 API 명세서

---

## 7.1.1 LMS 마감일 동기화

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/deadlines/lms-syncs`
- **설명**: LMS의 자료 업로드 마감일 자동 트래킹
  - [변경] `/deadlines/sync` → `/deadlines/lms-syncs` (동사→명사)

### Request Headers

| Header          | Value                  | 필수 | 설명           |
| --------------- | ---------------------- | :--: | -------------- |
| `Authorization` | `Bearer {accessToken}` |  Y   | JWT 인증 토큰  |
| `Content-Type`  | `application/json`     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명     | 타입   | 필수 | 설명         |
| ---------- | ------ | :--: | ------------ |
| `courseId` | String |  Y   | 강의 고유 ID |

### Request Body

| 필드      | 타입   | 필수 | 설명                                  | 예시     |
| --------- | ------ | :--: | ------------------------------------- | -------- |
| `lmsType` | String |  Y   | LMS 유형 (MOODLE\|CANVAS\|BLACKBOARD) | `MOODLE` |

### Response Body (성공)

| 필드          | 타입              | 설명               | 예시                                     |
| ------------- | ----------------- | ------------------ | ---------------------------------------- |
| `syncId`      | String            | 동기화 고유 ID     | `dsync_001`                              |
| `syncedCount` | Integer           | 동기화된 마감일 수 | `8`                                      |
| `deadlines`   | Object[]          | 마감일 목록        | `[{deadlineId, title, dueDate, status}]` |
| `syncedAt`    | String (ISO 8601) | 동기화 시각        | `2026-03-15T09:00:00Z`                   |

### Error Response (실패)

| 필드        | 타입              | 설명                                 | 예시                                                      |
| ----------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| `status`    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| `code`      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| `message`   | String            | 에러 메시지                          | `필수 파라미터가 누락되었습니다.`                         |
| `errors`    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| `timestamp` | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드  | 상태                  | 설명                         | 에러 코드 (code)        |
| ----- | --------------------- | ---------------------------- | ----------------------- |
| `200` | OK                    | 동기화 성공                  | -                       |
| `401` | Unauthorized          | 인증 실패                    | `AUTH_TOKEN_EXPIRED`    |
| `403` | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`         |
| `404` | Not Found             | 강의를 찾을 수 없음          | `RESOURCE_NOT_FOUND`    |
| `500` | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`        |
| `502` | Bad Gateway           | LMS 서버 연결 실패           | `LMS_CONNECTION_FAILED` |

---

## 7.1.2 마감일 목록 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/deadlines`
- **설명**: 마감일 목록 조회

### Request Headers

| Header          | Value                  | 필수 | 설명          |
| --------------- | ---------------------- | :--: | ------------- |
| `Authorization` | `Bearer {accessToken}` |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명     | 타입   | 필수 | 설명         |
| ---------- | ------ | :--: | ------------ |
| `courseId` | String |  Y   | 강의 고유 ID |

### Query Parameters

| 파라미터 | 타입   | 필수 | 기본값 | 설명                                     |
| -------- | ------ | :--: | :----: | ---------------------------------------- |
| `status` | String |  N   |   -    | 상태 필터 (UPCOMING\|OVERDUE\|COMPLETED) |

### Response Body (성공)

| 필드        | 타입     | 설명        | 예시                                                     |
| ----------- | -------- | ----------- | -------------------------------------------------------- |
| `deadlines` | Object[] | 마감일 목록 | `[{deadlineId, title, dueDate, status, remainingHours}]` |

> `status`는 DB에 저장되는 컬럼이 아니라 `due_at`과 현재 시각을 비교하여 서버에서 계산하는 값입니다 (UPCOMING \| OVERDUE \| COMPLETED).

### Error Response (실패)

| 필드        | 타입              | 설명                                 | 예시                                                      |
| ----------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| `status`    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| `code`      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| `message`   | String            | 에러 메시지                          | `필수 파라미터가 누락되었습니다.`                         |
| `errors`    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| `timestamp` | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드  | 상태                  | 설명                         | 에러 코드 (code)     |
| ----- | --------------------- | ---------------------------- | -------------------- |
| `200` | OK                    | 조회 성공                    | -                    |
| `401` | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| `403` | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| `404` | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| `500` | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 7.1.3 수동 마감일 생성

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/deadlines`
- **설명**: 교수자가 직접 마감일 등록 (LMS 연동 외 수동 생성)

### Request Headers

| Header          | Value                  | 필수 | 설명           |
| --------------- | ---------------------- | :--: | -------------- |
| `Authorization` | `Bearer {accessToken}` |  Y   | JWT 인증 토큰  |
| `Content-Type`  | `application/json`     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명     | 타입   | 필수 | 설명         |
| ---------- | ------ | :--: | ------------ |
| `courseId` | String |  Y   | 강의 고유 ID |

### Request Body

| 필드           | 타입              | 필수 | 설명                                           | 예시                   |
| -------------- | ----------------- | :--: | ---------------------------------------------- | ---------------------- |
| `deadlineType` | String            |  Y   | 마감 유형 (QUIZ\|MATERIAL\|ASSIGNMENT\|CUSTOM) | `MATERIAL`             |
| `title`        | String            |  Y   | 마감 제목 (2~200자)                            | `4주차 자료 업로드`    |
| `dueAt`        | String (ISO 8601) |  Y   | 마감 일시                                      | `2026-04-10T23:59:00Z` |
| `scheduleId`   | String            |  N   | 연관 스케줄 ID                                 | `sch_004`              |
| `description`  | String            |  N   | 상세 설명 (최대 500자)                         | -                      |

### Response Body (성공)

| 필드         | 타입              | 설명         | 예시                   |
| ------------ | ----------------- | ------------ | ---------------------- |
| `deadlineId` | String            | 마감 고유 ID | `dl_001`               |
| `title`      | String            | 마감 제목    | `4주차 자료 업로드`    |
| `dueAt`      | String (ISO 8601) | 마감 일시    | `2026-04-10T23:59:00Z` |
| `createdAt`  | String (ISO 8601) | 생성 일시    | `2026-04-08T10:00:00Z` |

### Error Response (실패)

| 필드        | 타입              | 설명                                 | 예시                                                      |
| ----------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| `status`    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| `code`      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| `message`   | String            | 에러 메시지                          | `필수 파라미터가 누락되었습니다.`                         |
| `errors`    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| `timestamp` | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드  | 상태                  | 설명                         | 에러 코드 (code)     |
| ----- | --------------------- | ---------------------------- | -------------------- |
| `201` | Created               | 마감일 생성 성공             | -                    |
| `400` | Bad Request           | 요청 데이터 유효성 검증 실패 | `INVALID_PARAMETER`  |
| `401` | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| `403` | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| `404` | Not Found             | 강의를 찾을 수 없음          | `RESOURCE_NOT_FOUND` |
| `422` | Unprocessable Entity  | 비즈니스 로직 유효성 실패    | `VALIDATION_FAILED`  |
| `500` | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 7.2.1 마감 알림 예약

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/deadlines/{deadlineId}/reminders`
- **설명**: 마감 48/24시간 전 교수자에게 알림 발송
  - [변경] `/remind` → `/reminders` (동사→명사)

### Request Headers

| Header          | Value                  | 필수 | 설명           |
| --------------- | ---------------------- | :--: | -------------- |
| `Authorization` | `Bearer {accessToken}` |  Y   | JWT 인증 토큰  |
| `Content-Type`  | `application/json`     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| `courseId`   | String |  Y   | 강의 고유 ID |
| `deadlineId` | String |  Y   | 마감 고유 ID |

### Request Body

| 필드                | 타입      | 필수 | 설명                                   | 예시                |
| ------------------- | --------- | :--: | -------------------------------------- | ------------------- |
| `remindBeforeHours` | Integer[] |  N   | 알림 시점 (시간 전, 기본 `[48,24]`)    | `[48,24]`           |
| `channels`          | String[]  |  N   | 알림 채널 (EMAIL\|KAKAO\|PUSH\|IN_APP) | `["EMAIL","KAKAO"]` |

### Response Body (성공)

| 필드        | 타입     | 설명        | 예시                                        |
| ----------- | -------- | ----------- | ------------------------------------------- |
| `reminders` | Object[] | 예약된 알림 | `[{reminderId, remindAt, channel, status}]` |

### Error Response (실패)

| 필드        | 타입              | 설명                                 | 예시                                                      |
| ----------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| `status`    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| `code`      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| `message`   | String            | 에러 메시지                          | `필수 파라미터가 누락되었습니다.`                         |
| `errors`    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| `timestamp` | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드  | 상태                  | 설명                         | 에러 코드 (code)     |
| ----- | --------------------- | ---------------------------- | -------------------- |
| `201` | Created               | 리소스 생성 성공             | -                    |
| `400` | Bad Request           | 요청 데이터 유효성 검증 실패 | `INVALID_PARAMETER`  |
| `401` | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| `403` | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| `409` | Conflict              | 이미 존재하는 리소스         | `RESOURCE_CONFLICT`  |
| `422` | Unprocessable Entity  | 비즈니스 로직 유효성 실패    | `VALIDATION_FAILED`  |
| `500` | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 7.2.2 마감 경과 긴급 알림

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/deadlines/{deadlineId}/overdue-alerts`
- **설명**: 마감 경과 시 교수자 긴급 알림 + 학생에게 자료 준비 알림
  - [변경] `/overdue-alert` → `/overdue-alerts` (복수형)

### Request Headers

| Header          | Value                  | 필수 | 설명          |
| --------------- | ---------------------- | :--: | ------------- |
| `Authorization` | `Bearer {accessToken}` |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| `courseId`   | String |  Y   | 강의 고유 ID |
| `deadlineId` | String |  Y   | 마감 고유 ID |

### Response Body (성공)

> 긴급 알림 발송 시 교수자 및 학생 각각에게 `notifications` 테이블에 레코드가 생성됩니다. `notificationId`는 교수자에게 발송된 대표 알림 ID입니다.

| 필드                   | 타입              | 설명                                         | 예시                   |
| ---------------------- | ----------------- | -------------------------------------------- | ---------------------- |
| `notificationId`       | String            | 교수자 알림 고유 ID (`notifications` 테이블) | `notif_001`            |
| `notifiedInstructor`   | Boolean           | 교수자 알림 발송 여부                        | `true`                 |
| `notifiedStudentCount` | Integer           | 알림 받은 학생 수                            | `35`                   |
| `sentAt`               | String (ISO 8601) | 발송 시각                                    | `2026-03-16T00:05:00Z` |

### Error Response (실패)

| 필드        | 타입              | 설명                                 | 예시                                                      |
| ----------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| `status`    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| `code`      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| `message`   | String            | 에러 메시지                          | `필수 파라미터가 누락되었습니다.`                         |
| `errors`    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| `timestamp` | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드  | 상태                  | 설명                         | 에러 코드 (code)     |
| ----- | --------------------- | ---------------------------- | -------------------- |
| `200` | OK                    | 처리 성공                    | -                    |
| `400` | Bad Request           | 요청 데이터 유효성 검증 실패 | `INVALID_PARAMETER`  |
| `401` | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| `403` | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| `404` | Not Found             | 대상 리소스를 찾을 수 없음   | `RESOURCE_NOT_FOUND` |
| `422` | Unprocessable Entity  | 처리 불가능한 요청           | `PROCESSING_FAILED`  |
| `500` | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

# 8. 학생AI 시뮬레이션 API 명세서

## 8.1.1 교수자료 컨텍스트 주입

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/ai-student/contexts`
- **설명**: 소형 LLM에 교수자료만을 RAG/ICL 방식으로 주입  
  _[변경] /context → /contexts (복수형)_

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | :--: | ------------ |
| courseId | String |  Y   | 강의 고유 ID |

### Request Body

| 필드      | 타입     | 필수 | 설명                        | 예시                     |
| --------- | -------- | :--: | --------------------------- | ------------------------ |
| scriptIds | String[] |  Y   | 주입할 스크립트 ID 목록     | `["scr_001", "scr_002"]` |
| model     | String   |  N   | 사용 모델 (기본 phi-3-mini) | `phi-3-mini`             |

### Response Body (성공)

| 필드            | 타입              | 설명                  | 예시                   |
| --------------- | ----------------- | --------------------- | ---------------------- |
| contextId       | String            | 컨텍스트 세션 고유 ID | `ctx_001`              |
| loadedDocuments | Integer           | 로드된 문서 수        | `2`                    |
| totalTokens     | Integer           | 총 토큰 수            | `15000`                |
| createdAt       | String (ISO 8601) | 생성 시각             | `2026-03-15T14:00:00Z` |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 201  | Created               | 리소스 생성 성공             | -                    |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | `INVALID_PARAMETER`  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 409  | Conflict              | 이미 존재하는 리소스         | `RESOURCE_CONFLICT`  |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패    | `VALIDATION_FAILED`  |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.1.2 백지 상태 시뮬레이션

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/ai-student/simulations`
- **설명**: 범용 지식 없이 자료만으로 학습하는 환경 구성  
  _[변경] /simulate → /simulations (동사→명사 복수형)_

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | :--: | ------------ |
| courseId | String |  Y   | 강의 고유 ID |

### Request Body

| 필드      | 타입   | 필수 | 설명             | 예시      |
| --------- | ------ | :--: | ---------------- | --------- |
| contextId | String |  Y   | 컨텍스트 세션 ID | `ctx_001` |

### Response Body (성공)

| 필드           | 타입   | 설명               | 예시            |
| -------------- | ------ | ------------------ | --------------- |
| simulationId   | String | 시뮬레이션 고유 ID | `sim_001`       |
| status         | String | 상태               | `READY`         |
| knowledgeScope | String | 지식 범위          | `DOCUMENT_ONLY` |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 201  | Created               | 리소스 생성 성공             | -                    |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | `INVALID_PARAMETER`  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 409  | Conflict              | 이미 존재하는 리소스         | `RESOURCE_CONFLICT`  |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패    | `VALIDATION_FAILED`  |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.2.1 학습 목표 기반 문항 생성 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments`
- **설명**: 대형 LLM이 개념 확인·적용·추론·연결 유형 문항 생성. 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  _[변경] /assessment/generate → POST /assessments (동사 제거, 복수형) + 동기 201 → 비동기 202_

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명   | 타입   | 필수 | 설명         |
| -------- | ------ | :--: | ------------ |
| courseId | String |  Y   | 강의 고유 ID |

### Request Body

| 필드          | 타입     | 필수 | 설명                                                    | 예시                         |
| ------------- | -------- | :--: | ------------------------------------------------------- | ---------------------------- |
| contextId     | String   |  Y   | 컨텍스트 세션 ID                                        | `ctx_001`                    |
| questionTypes | String[] |  N   | 문항 유형 (CONCEPT\|APPLICATION\|REASONING\|CONNECTION) | `["CONCEPT", "APPLICATION"]` |
| count         | Integer  |  N   | 문항 수 (기본 10, 최대 30)                              | `10`                         |

### Response Body (성공 - 202 Accepted)

| 필드         | 타입   | 설명                   | 예시                                                                  |
| ------------ | ------ | ---------------------- | --------------------------------------------------------------------- |
| assessmentId | String | 평가 고유 ID           | `asm_001`                                                             |
| status       | String | 생성 상태 (processing) | `processing`                                                          |
| message      | String | 안내 메시지            | 문항 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `ai_sim_assessments` 채널에서 `status = completed` 수신 후  
> `GET /api/courses/{courseId}/ai-student/assessments/{assessmentId}` 로 문항 조회.

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 202  | Accepted              | 문항 생성 작업 수락          | -                    |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | `INVALID_PARAMETER`  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 컨텍스트를 찾을 수 없음      | `RESOURCE_NOT_FOUND` |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패    | `VALIDATION_FAILED`  |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.2.2 문항 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments/{assessmentId}`
- **설명**: 생성 완료된 문항 조회 (Realtime 수신 후 또는 초기 로드용)

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| courseId     | String |  Y   | 강의 고유 ID |
| assessmentId | String |  Y   | 평가 고유 ID |

### Response Body (성공)

| 필드         | 타입              | 설명         | 예시                                            |
| ------------ | ----------------- | ------------ | ----------------------------------------------- |
| assessmentId | String            | 평가 고유 ID | `asm_001`                                       |
| status       | String            | 생성 상태    | `completed`                                     |
| questions    | Object[]          | 생성된 문항  | `[{questionId, type, content, expectedAnswer}]` |
| completedAt  | String (ISO 8601) | 완료 시각    | `2026-03-15T14:30:00Z`                          |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.3.1 AI 학생 답변 생성 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments/{assessmentId}/answers`
- **설명**: 학생 AI가 교수자료만 참조하여 문항에 답변. 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  _[변경] /answer → /answers (명사 복수형) + 동기 200 → 비동기 202_

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| courseId     | String |  Y   | 강의 고유 ID |
| assessmentId | String |  Y   | 평가 고유 ID |

### Request Body

| 필드         | 타입   | 필수 | 설명          | 예시      |
| ------------ | ------ | :--: | ------------- | --------- |
| simulationId | String |  Y   | 시뮬레이션 ID | `sim_001` |

### Response Body (성공 - 202 Accepted)

| 필드     | 타입   | 설명                   | 예시                                                                  |
| -------- | ------ | ---------------------- | --------------------------------------------------------------------- |
| answerId | String | 답변 고유 ID           | `ans_001`                                                             |
| status   | String | 생성 상태 (processing) | `processing`                                                          |
| message  | String | 안내 메시지            | 답변 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `ai_sim_answers` 채널에서 `status = completed` 수신 후  
> `GET /api/courses/{courseId}/ai-student/assessments/{assessmentId}/answers` 로 결과 조회.

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 202  | Accepted              | 답변 생성 작업 수락          | -                    |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | `INVALID_PARAMETER`  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 대상 리소스를 찾을 수 없음   | `RESOURCE_NOT_FOUND` |
| 409  | Conflict              | 이미 답변이 존재함           | `RESOURCE_CONFLICT`  |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.3.2 AI 학생 답변 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments/{assessmentId}/answers`
- **설명**: 생성 완료된 AI 학생 답변 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| courseId     | String |  Y   | 강의 고유 ID |
| assessmentId | String |  Y   | 평가 고유 ID |

### Response Body (성공)

| 필드        | 타입              | 설명         | 예시                                                    |
| ----------- | ----------------- | ------------ | ------------------------------------------------------- |
| answerId    | String            | 답변 고유 ID | `ans_001`                                               |
| status      | String            | 생성 상태    | `completed`                                             |
| answers     | Object[]          | AI 학생 답변 | `[{questionId, answer, confidence, referencedSection}]` |
| completedAt | String (ISO 8601) | 완료 시각    | `2026-03-15T15:00:00Z`                                  |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.4.1 AI 채점 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments/{assessmentId}/grades`
- **설명**: 대형 LLM이 학생 AI 답변을 정답과 비교 분석. 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  _[변경] /grade → /grades (명사 복수형) + 동기 200 → 비동기 202_

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| courseId     | String |  Y   | 강의 고유 ID |
| assessmentId | String |  Y   | 평가 고유 ID |

### Response Body (성공 - 202 Accepted)

| 필드    | 타입   | 설명                   | 예시                                                             |
| ------- | ------ | ---------------------- | ---------------------------------------------------------------- |
| gradeId | String | 채점 고유 ID           | `grd_001`                                                        |
| status  | String | 채점 상태 (processing) | `processing`                                                     |
| message | String | 안내 메시지            | 채점이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `ai_sim_grades` 채널에서 `status = completed` 수신 후  
> `GET /api/courses/{courseId}/ai-student/assessments/{assessmentId}/grades` 로 결과 조회.

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 202  | Accepted              | 채점 작업 수락               | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 대상 리소스를 찾을 수 없음   | `RESOURCE_NOT_FOUND` |
| 409  | Conflict              | 이미 채점이 존재함           | `RESOURCE_CONFLICT`  |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.4.2 채점 결과 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments/{assessmentId}/grades`
- **설명**: 완료된 채점 결과 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| courseId     | String |  Y   | 강의 고유 ID |
| assessmentId | String |  Y   | 평가 고유 ID |

### Response Body (성공)

| 필드        | 타입              | 설명             | 예시                                         |
| ----------- | ----------------- | ---------------- | -------------------------------------------- |
| gradeId     | String            | 채점 고유 ID     | `grd_001`                                    |
| status      | String            | 채점 상태        | `completed`                                  |
| totalScore  | Float             | 총점 (0.0~100.0) | `72.0`                                       |
| grades      | Object[]          | 문항별 채점      | `[{questionId, score, feedback, isCorrect}]` |
| strengths   | String[]          | 강점 영역        | `["개념 이해"]`                              |
| weaknesses  | String[]          | 약점 영역        | `["추론 능력"]`                              |
| completedAt | String (ISO 8601) | 완료 시각        | `2026-03-15T15:30:00Z`                       |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.4.3 자료 품질 진단 트리거 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments/{assessmentId}/quality-reports`
- **설명**: 교수자 요청에 의해 자료 품질 진단 리포트 생성 시작. 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  _[변경] GET 단일 → POST 트리거 + GET 조회 분리_

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| courseId     | String |  Y   | 강의 고유 ID |
| assessmentId | String |  Y   | 평가 고유 ID |

### Response Body (성공 - 202 Accepted)

| 필드     | 타입   | 설명                   | 예시                                                                  |
| -------- | ------ | ---------------------- | --------------------------------------------------------------------- |
| reportId | String | 리포트 고유 ID         | `qrpt_001`                                                            |
| status   | String | 생성 상태 (processing) | `processing`                                                          |
| message  | String | 안내 메시지            | 품질 진단이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `ai_sim_quality_reports` 채널에서 `status = completed` 수신 후  
> `GET /api/courses/{courseId}/ai-student/assessments/{assessmentId}/quality-reports` 로 결과 조회.

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 202  | Accepted              | 품질 진단 작업 수락          | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 대상 리소스를 찾을 수 없음   | `RESOURCE_NOT_FOUND` |
| 409  | Conflict              | 이미 진단 리포트가 존재함    | `RESOURCE_CONFLICT`  |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.4.4 자료 품질 진단 리포트 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments/{assessmentId}/quality-reports`
- **설명**: 완료된 자료 품질 진단 리포트 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| courseId     | String |  Y   | 강의 고유 ID |
| assessmentId | String |  Y   | 평가 고유 ID |

### Response Body (성공)

| 필드               | 타입              | 설명                      | 예시                            |
| ------------------ | ----------------- | ------------------------- | ------------------------------- |
| reportId           | String            | 리포트 고유 ID            | `qrpt_001`                      |
| status             | String            | 생성 상태                 | `completed`                     |
| coverageRate       | Float             | 자료 커버리지 (0.0~100.0) | `78.5`                          |
| sufficientTopics   | String[]          | 충분한 토픽               | `["스택 개념", "큐 연산"]`      |
| insufficientTopics | Object[]          | 부족한 토픽               | `[{topic, reason, suggestion}]` |
| completedAt        | String (ISO 8601) | 완료 시각                 | `2026-03-15T16:00:00Z`          |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.4.5 핵심 Q&A 생성 (비동기)

- **Method**: `POST`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments/{assessmentId}/qa-pairs`
- **설명**: 수업 내용 기반 AI 학생의 핵심 예측 질문과 답변 생성. 202로 수락 후 Supabase Realtime으로 완료 이벤트 수신.  
  _[변경] /generate-qa → /qa-pairs (동사 generate 제거, 명사) + 동기 200 → 비동기 202_

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| courseId     | String |  Y   | 강의 고유 ID |
| assessmentId | String |  Y   | 평가 고유 ID |

### Request Body

| 필드         | 타입   | 필수 | 설명               | 예시      |
| ------------ | ------ | :--: | ------------------ | --------- |
| simulationId | String |  Y   | 기반 시뮬레이션 ID | `sim_001` |

### Response Body (성공 - 202 Accepted)

| 필드     | 타입   | 설명                   | 예시                                                                 |
| -------- | ------ | ---------------------- | -------------------------------------------------------------------- |
| qaPairId | String | Q&A 고유 ID            | `qa_001`                                                             |
| status   | String | 생성 상태 (processing) | `processing`                                                         |
| message  | String | 안내 메시지            | Q&A 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다. |

> **완료 이벤트**: Supabase Realtime `ai_sim_qa_pairs` 채널에서 `status = completed` 수신 후  
> `GET /api/courses/{courseId}/ai-student/assessments/{assessmentId}/qa-pairs` 로 결과 조회.

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                      |
| --------- | ----------------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                     |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                    |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 202  | Accepted              | Q&A 생성 작업 수락           | -                    |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패 | `INVALID_PARAMETER`  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 대상 리소스를 찾을 수 없음   | `RESOURCE_NOT_FOUND` |
| 409  | Conflict              | 이미 Q&A가 존재함            | `RESOURCE_CONFLICT`  |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 8.4.6 핵심 Q&A 조회

- **Method**: `GET`
- **Endpoint**: `/api/courses/{courseId}/ai-student/assessments/{assessmentId}/qa-pairs`
- **설명**: 생성 완료된 핵심 Q&A 조회

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명       | 타입   | 필수 | 설명         |
| ------------ | ------ | :--: | ------------ |
| courseId     | String |  Y   | 강의 고유 ID |
| assessmentId | String |  Y   | 평가 고유 ID |

### Response Body (성공)

| 필드        | 타입              | 설명        | 예시                                         |
| ----------- | ----------------- | ----------- | -------------------------------------------- |
| qaPairId    | String            | Q&A 고유 ID | `qa_001`                                     |
| status      | String            | 생성 상태   | `completed`                                  |
| qaPairs     | Object[]          | Q&A 목록    | `[{question, answer, category, difficulty}]` |
| completedAt | String (ISO 8601) | 완료 시각   | `2026-03-15T16:30:00Z`                       |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

# 9. 대시보드 API 명세서

## 9.1 강사 대시보드

### 9.1.1 강의별 이해도 추이

- **Method**: `GET`
- **Endpoint**: `/api/dashboard/instructors/comprehension-trends`
- **설명**: 주차별 퀴즈 정답률 추이를 차트로 시각화
  - [변경] `/instructor/comprehension` → `/instructors/comprehension-trends` (복수형, 명확한 리소스명)
  - `courseId` 생략 시: JWT 기준 담당 강의 전체를 집계. 이 경우 `trends` 항목에 `courseId`, `courseName` 필드 추가 포함.
  - `overallTrend` 계산 기준: 최근 3주 평균 정답률이 이전 3주 대비 5%p 이상 상승 → `IMPROVING`, 5%p 이상 하락 → `DECLINING`, 그 외 → `STABLE`.

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Query Parameters

| 파라미터 | 타입   | 필수 | 기본값 | 설명                                                             |
| -------- | ------ | ---- | ------ | ---------------------------------------------------------------- |
| courseId | String | N    | -      | 강의 ID. 생략 시 담당 강의 전체 집계 (응답에 courseId 필드 포함) |
| semester | String | N    | -      | 학기 필터 (예: `2026-1`)                                         |

#### Response Body (성공)

| 필드         | 타입     | 설명                                     | 예시                                                             |
| ------------ | -------- | ---------------------------------------- | ---------------------------------------------------------------- |
| trends       | Object[] | 주차별 추이                              | `[{weekNumber, topic, averageScore, participationRate, quizId}]` |
| overallTrend | String   | 전체 추세 (IMPROVING\|STABLE\|DECLINING) | `IMPROVING`                                                      |

> `participationRate`: 해당 주차 퀴즈 제출 학생 수 / 전체 수강생 수 × 100 (%)  
> `topic`: `course_schedules.topic` 값. 차트 X축 레이블 용도.

#### Error Response (실패)

| 필드      | 타입     | 설명                                 | 예시                                                      |
| --------- | -------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer  | HTTP 상태 코드                       | `400`                                                     |
| code      | String   | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String   | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String   | 에러 발생 시각 (ISO 8601)            | `2026-04-06T12:00:00Z`                                    |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

### 9.1.2 취약 토픽 요약

- **Method**: `GET`
- **Endpoint**: `/api/dashboard/instructors/weak-topics`
- **설명**: 누적 데이터 기반 과목 내 취약 토픽 TOP 리스트
  - [변경] `/instructor/` → `/instructors/` (복수형)
  - 데이터 출처: `dashboard_snapshots.weak_topics` JSONB 캐시. 캐시 갱신은 퀴즈 `CLOSED` 이벤트 시 트리거.

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Query Parameters

| 파라미터 | 타입    | 필수 | 기본값 | 설명                |
| -------- | ------- | ---- | ------ | ------------------- |
| courseId | String  | N    | -      | 강의 ID             |
| limit    | Integer | N    | 10     | 조회 개수 (최대 50) |

#### Response Body (성공)

| 필드       | 타입     | 설명           | 예시                                                                 |
| ---------- | -------- | -------------- | -------------------------------------------------------------------- |
| weakTopics | Object[] | 취약 토픽 목록 | `[{rank, topic, wrongRate, relatedQuizzes: [{quizId, weekNumber}]}]` |

> `wrongRate`: 해당 토픽 관련 문항 전체 오답률 (%).  
> `relatedQuizzes`: 해당 토픽이 출제된 퀴즈 목록 (quizId, weekNumber).

#### Error Response (실패)

| 필드      | 타입     | 설명                                 | 예시                                                      |
| --------- | -------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer  | HTTP 상태 코드                       | `400`                                                     |
| code      | String   | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String   | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String   | 에러 발생 시각 (ISO 8601)            | `2026-04-06T12:00:00Z`                                    |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

### 9.1.3 자료 업로드 현황

- **Method**: `GET`
- **Endpoint**: `/api/dashboard/instructors/upload-status`
- **설명**: 주차별 자료 업로드 상태(완료/미완료) 한눈에 확인
  - [변경] `/instructor/` → `/instructors/`
  - 데이터 출처: `dashboard_snapshots.weekly_stats` JSONB 캐시 (`previewDone`, `reviewDone`, `scriptDone` 필드 포함).
  - `completionRate` 계산: `uploaded_weeks / total_weeks × 100` (스크립트 기준).

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Query Parameters

| 파라미터 | 타입   | 필수 | 기본값 | 설명                                                             |
| -------- | ------ | ---- | ------ | ---------------------------------------------------------------- |
| courseId | String | N    | -      | 강의 ID. 생략 시 담당 강의 전체 집계 (응답에 courseId 필드 포함) |
| semester | String | N    | -      | 학기 필터 (예: `2026-1`)                                         |

#### Response Body (성공)

| 필드           | 타입     | 설명                    | 예시                                                                           |
| -------------- | -------- | ----------------------- | ------------------------------------------------------------------------------ |
| uploadStatus   | Object[] | 주차별 업로드 상태      | `[{weekNumber, topic, previewGuide: bool, reviewSummary: bool, script: bool}]` |
| completionRate | Float    | 전체 완료율 (0.0~100.0) | `87.5`                                                                         |

#### Error Response (실패)

| 필드      | 타입     | 설명                                 | 예시                                                      |
| --------- | -------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer  | HTTP 상태 코드                       | `400`                                                     |
| code      | String   | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String   | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String   | 에러 발생 시각 (ISO 8601)            | `2026-04-06T12:00:00Z`                                    |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 9.2 학생 대시보드

### 9.2.1 나의 퀴즈 참여 이력

- **Method**: `GET`
- **Endpoint**: `/api/dashboard/students/quiz-history`
- **설명**: 참여한 퀴즈 결과 및 오답 복습 제공
  - [변경] `/student/` → `/students/`
  - `anonymous_enabled=true`인 퀴즈라도 **본인 결과 조회는 허용**. 타 학생 데이터는 노출하지 않음.
  - `wrongAnswers`는 `quiz_submission_answers.is_correct=false`인 항목에서 조회. `question_id`, `content`, `correctAnswer` 포함.

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Query Parameters

| 파라미터 | 타입   | 필수 | 기본값 | 설명    |
| -------- | ------ | ---- | ------ | ------- |
| courseId | String | N    | -      | 강의 ID |

#### Response Body (성공)

| 필드         | 타입     | 설명           | 예시                                                                                               |
| ------------ | -------- | -------------- | -------------------------------------------------------------------------------------------------- |
| quizHistory  | Object[] | 퀴즈 참여 이력 | `[{quizId, courseName, score, submittedAt, wrongAnswers: [{questionId, content, correctAnswer}]}]` |
| averageScore | Float    | 평균 점수      | `78.3`                                                                                             |

#### Error Response (실패)

| 필드      | 타입     | 설명                                 | 예시                                                      |
| --------- | -------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer  | HTTP 상태 코드                       | `400`                                                     |
| code      | String   | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String   | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String   | 에러 발생 시각 (ISO 8601)            | `2026-04-06T12:00:00Z`                                    |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

### 9.2.2 예습·복습 자료 모아보기

- **Method**: `GET`
- **Endpoint**: `/api/dashboard/students/materials`
- **설명**: 과목별 예습/복습 자료를 타임라인으로 조회
  - [변경] `/student/` → `/students/`
  - `status=completed`인 자료만 반환. `generating`/`failed` 항목은 제외.
  - `title`은 DB 저장값 우선. `null`이면 서버에서 `"{N}주차 예습 가이드"` / `"{N}주차 복습 요약본"` 자동 생성.
  - 조회 범위: JWT 기준 `course_enrollments`에 등록된 강의만 포함.

#### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | ---- | ------------- |
| Authorization | Bearer {accessToken} | Y    | JWT 인증 토큰 |

#### Query Parameters

| 파라미터 | 타입   | 필수 | 기본값 | 설명                             |
| -------- | ------ | ---- | ------ | -------------------------------- |
| courseId | String | N    | -      | 강의 ID                          |
| type     | String | N    | ALL    | 자료 유형 (PREVIEW\|REVIEW\|ALL) |

#### Response Body (성공)

| 필드      | 타입     | 설명          | 예시                                                             |
| --------- | -------- | ------------- | ---------------------------------------------------------------- |
| materials | Object[] | 자료 타임라인 | `[{materialId, type, courseName, weekNumber, title, createdAt}]` |

> `type`: `PREVIEW` (preview_guides) 또는 `REVIEW` (review_summaries).  
> `title`: DB 저장값 또는 자동 생성값 (`"{N}주차 예습 가이드"` / `"{N}주차 복습 요약본"`).

#### Error Response (실패)

| 필드      | 타입     | 설명                                 | 예시                                                      |
| --------- | -------- | ------------------------------------ | --------------------------------------------------------- |
| status    | Integer  | HTTP 상태 코드                       | `400`                                                     |
| code      | String   | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                       |
| message   | String   | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                           |
| errors    | Object[] | 상세 에러 목록 (유효성 검증 실패 시) | `[{field: "email", reason: "형식이 올바르지 않습니다."}]` |
| timestamp | String   | 에러 발생 시각 (ISO 8601)            | `2026-04-06T12:00:00Z`                                    |

#### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

# 10. 알림 및 설정

## 10.1.1 알림 채널 설정

- **Method**: `PUT`
- **Endpoint**: `/api/users/{userId}/notifications/channels`
- **설명**: 이메일, 카카오톡 등 알림 수신 채널 선택
  - 참조 테이블: `notification_settings` (인앱 알림 채널 설정). 마감 리마인더 채널은 `reminder_settings`(7.2.x)에서 별도 관리.
  - `notification_settings` 행이 없으면 upsert(최초 호출 시 자동 생성).
  - `type` 허용값: `EMAIL` | `PUSH` | `IN_APP` | `KAKAO`
  - `KAKAO` 채널은 카카오 연동이 완료된 경우에만 `enabled=true` 처리. 미연동 상태에서 `enabled=true` 요청 시 422 반환.

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Request Body

| 필드     | 타입     | 필수 | 설명                                              | 예시                                                                       |
| -------- | -------- | :--: | ------------------------------------------------- | -------------------------------------------------------------------------- |
| channels | Object[] |  Y   | 채널 설정 목록 (type: EMAIL\|PUSH\|IN_APP\|KAKAO) | `[{"type": "EMAIL", "enabled": true}, {"type": "KAKAO", "enabled": true}]` |

### Response Body (성공)

| 필드      | 타입              | 설명                                                                              | 예시                                  |
| --------- | ----------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| channels  | Object[]          | 설정된 채널 목록. `verifiedAt`: 채널 연동 완료 시각 (KAKAO 전용, 미연동이면 null) | `[{"type", "enabled", "verifiedAt"}]` |
| updatedAt | String (ISO 8601) | 수정 일시                                                                         | `2026-03-15T10:00:00Z`                |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                          |
| --------- | ----------------- | ------------------------------------ | ------------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                         |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                           |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                               |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{"field": "email", "reason": "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                        |

### Status Codes

| 코드 | 상태                  | 설명                            | 에러 코드 (code)     |
| ---- | --------------------- | ------------------------------- | -------------------- |
| 200  | OK                    | 수정 성공                       | -                    |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패    | `INVALID_PARAMETER`  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료        | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음    | `ACCESS_DENIED`      |
| 404  | Not Found             | 수정 대상 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패       | `VALIDATION_FAILED`  |
| 500  | Internal Server Error | 서버 내부 오류                  | `INTERNAL_ERROR`     |

---

## 10.1.2 알림 채널 조회

- **Method**: `GET`
- **Endpoint**: `/api/users/{userId}/notifications/channels`
- **설명**: 알림 채널 설정 조회
  - `notification_settings` 행이 없으면 기본값(`email_enabled=true`, `push_enabled=true`, `in_app_enabled=true`, `kakao_enabled=false`)으로 응답. 404 반환하지 않음.

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Response Body (성공)

| 필드     | 타입     | 설명                                                                                                    | 예시                                  |
| -------- | -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| channels | Object[] | 채널 목록. `verifiedAt`: 채널 연동 완료 시각 (KAKAO 전용, 미연동이면 null). 설정 행 없으면 기본값 반환. | `[{"type", "enabled", "verifiedAt"}]` |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                          |
| --------- | ----------------- | ------------------------------------ | ------------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                         |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                           |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                               |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{"field": "email", "reason": "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                        |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 10.1.3 알림 유형별 ON/OFF

- **Method**: `PUT`
- **Endpoint**: `/api/users/{userId}/notifications/preferences`
- **설명**: 퀴즈 알림, 자료 알림, 마감 알림 등 유형별 설정
  - 참조 테이블: `notification_settings`. 행 없으면 upsert.
  - `type` 허용값 및 ERD 컬럼 매핑:

| type 값    | ERD 컬럼(`notification_settings`) |
| ---------- | --------------------------------- |
| `QUIZ`     | `quiz_published`                  |
| `MATERIAL` | `material_ready`                  |
| `DEADLINE` | `deadline_reminder`               |

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Request Body

| 필드        | 타입     | 필수 | 설명                                            | 예시                                                                         |
| ----------- | -------- | :--: | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| preferences | Object[] |  Y   | 알림 유형 설정 (type: QUIZ\|MATERIAL\|DEADLINE) | `[{"type": "QUIZ", "enabled": true}, {"type": "DEADLINE", "enabled": true}]` |

### Response Body (성공)

| 필드        | 타입              | 설명        | 예시                    |
| ----------- | ----------------- | ----------- | ----------------------- |
| preferences | Object[]          | 설정된 유형 | `[{"type", "enabled"}]` |
| updatedAt   | String (ISO 8601) | 수정 일시   | `2026-04-06T10:00:00Z`  |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                          |
| --------- | ----------------- | ------------------------------------ | ------------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                         |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                           |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                               |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{"field": "email", "reason": "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                        |

### Status Codes

| 코드 | 상태                  | 설명                            | 에러 코드 (code)     |
| ---- | --------------------- | ------------------------------- | -------------------- |
| 200  | OK                    | 수정 성공                       | -                    |
| 400  | Bad Request           | 요청 데이터 유효성 검증 실패    | `INVALID_PARAMETER`  |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료        | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음    | `ACCESS_DENIED`      |
| 404  | Not Found             | 수정 대상 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 422  | Unprocessable Entity  | 비즈니스 로직 유효성 실패       | `VALIDATION_FAILED`  |
| 500  | Internal Server Error | 서버 내부 오류                  | `INTERNAL_ERROR`     |

---

## 10.1.4 알림 유형별 조회

- **Method**: `GET`
- **Endpoint**: `/api/users/{userId}/notifications/preferences`
- **설명**: 알림 유형별 설정 조회
  - `notification_settings` 행이 없으면 기본값(`quiz_published=true`, `material_ready=true`, `deadline_reminder=true`)으로 응답. 404 반환하지 않음.

### Request Headers

| Header        | Value                | 필수 | 설명          |
| ------------- | -------------------- | :--: | ------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰 |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Response Body (성공)

| 필드        | 타입     | 설명                                                                    | 예시                    |
| ----------- | -------- | ----------------------------------------------------------------------- | ----------------------- |
| preferences | Object[] | 알림 유형 목록 (type: QUIZ\|MATERIAL\|DEADLINE). 행 없으면 기본값 반환. | `[{"type", "enabled"}]` |

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                          |
| --------- | ----------------- | ------------------------------------ | ------------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                         |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                           |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                               |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{"field": "email", "reason": "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                        |

### Status Codes

| 코드 | 상태                  | 설명                         | 에러 코드 (code)     |
| ---- | --------------------- | ---------------------------- | -------------------- |
| 200  | OK                    | 조회 성공                    | -                    |
| 401  | Unauthorized          | 인증 토큰 없음 또는 만료     | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 해당 리소스에 대한 권한 없음 | `ACCESS_DENIED`      |
| 404  | Not Found             | 요청한 리소스를 찾을 수 없음 | `RESOURCE_NOT_FOUND` |
| 500  | Internal Server Error | 서버 내부 오류               | `INTERNAL_ERROR`     |

---

## 10.2.1 계정 탈퇴 및 데이터 삭제

- **Method**: `DELETE`
- **Endpoint**: `/api/users/{userId}`
- **설명**: 회원 탈퇴 시 개인 데이터 완전 삭제<br>[변경] `/users/{userId}/account` → `/users/{userId}` (account 불필요, 사용자 리소스 자체 삭제)
- **Soft Delete 방식**: 즉시 삭제하지 않고 `profiles.deleted_at = NOW()` 설정. 30일 후 배치 작업으로 `auth.users` 삭제 → CASCADE 영구 삭제. 탈퇴 처리 후 해당 계정으로 로그인 시도 시 403 반환.
- **본인 확인 방식**:
  - 이메일 가입 사용자: `password` 필드로 확인
  - 소셜 로그인 사용자: `password` 생략, Supabase OAuth 재인증 토큰(`oauthToken`)으로 확인

### Request Headers

| Header        | Value                | 필수 | 설명           |
| ------------- | -------------------- | :--: | -------------- |
| Authorization | Bearer {accessToken} |  Y   | JWT 인증 토큰  |
| Content-Type  | application/json     |  Y   | 요청 본문 형식 |

### Path Variables

| 변수명 | 타입   | 필수 | 설명           |
| ------ | ------ | :--: | -------------- |
| userId | String |  Y   | 사용자 고유 ID |

### Request Body

| 필드       | 타입   | 필수 | 설명                                        | 예시                  |
| ---------- | ------ | :--: | ------------------------------------------- | --------------------- |
| password   | String |  N   | 비밀번호 확인 (이메일 가입 사용자 필수)     | `P@ssw0rd!`           |
| oauthToken | String |  N   | OAuth 재인증 토큰 (소셜 로그인 사용자 필수) | -                     |
| reason     | String |  N   | 탈퇴 사유 (최대 500자)                      | 더 이상 사용하지 않음 |

> `password`와 `oauthToken` 중 하나는 반드시 포함해야 합니다. 둘 다 없으면 422 반환.

### Response Body (성공)

_(204 No Content - 응답 본문 없음)_

### Error Response (실패)

| 필드      | 타입              | 설명                                 | 예시                                                          |
| --------- | ----------------- | ------------------------------------ | ------------------------------------------------------------- |
| status    | Integer           | HTTP 상태 코드                       | `400`                                                         |
| code      | String            | 에러 코드 (시스템 정의)              | `INVALID_PARAMETER`                                           |
| message   | String            | 에러 메시지                          | 필수 파라미터가 누락되었습니다.                               |
| errors    | Object[]          | 상세 에러 목록 (유효성 검증 실패 시) | `[{"field": "email", "reason": "형식이 올바르지 않습니다."}]` |
| timestamp | String (ISO 8601) | 에러 발생 시각                       | `2026-04-06T12:00:00Z`                                        |

### Status Codes

| 코드 | 상태                  | 설명                                 | 에러 코드 (code)     |
| ---- | --------------------- | ------------------------------------ | -------------------- |
| 204  | No Content            | 탈퇴 성공 (30일 내 복구 가능)        | -                    |
| 401  | Unauthorized          | 인증 실패                            | `AUTH_TOKEN_EXPIRED` |
| 403  | Forbidden             | 비밀번호 불일치 또는 OAuth 인증 실패 | `INVALID_PASSWORD`   |
| 404  | Not Found             | 사용자를 찾을 수 없음                | `RESOURCE_NOT_FOUND` |
| 422  | Unprocessable Entity  | password/oauthToken 모두 누락        | `VALIDATION_FAILED`  |
| 500  | Internal Server Error | 서버 내부 오류                       | `INTERNAL_ERROR`     |
