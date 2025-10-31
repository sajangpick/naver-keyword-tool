# 🎯 관리자/매니저 역할 시스템 설정 가이드

> **작성일**: 2025-10-31  
> **버전**: 1.0  
> **상태**: 구현 완료

---

## 📋 목차

1. [개요](#개요)
2. [시스템 구조](#시스템-구조)
3. [설정 방법](#설정-방법)
4. [사용 방법](#사용-방법)
5. [권한 정의](#권한-정의)
6. [테스트](#테스트)

---

## 개요

사장픽 프로젝트는 새로운 4단계 회원등급 시스템을 도입합니다.

### 🎭 4가지 회원 그룹

```
1️⃣ 식당 대표 (owner)
   └─ 씨앗, 파워, 빅파워, 프리미엄

2️⃣ 대행사/블로그 (agency)
   └─ 엘리트, 전문가, 마스터, 플래티넘

3️⃣ 매니저 (manager) ⭐ 새로 추가
   ├─ 일반 매니저 (뷰 권한만)
   └─ 수퍼 매니저 (제한된 편집 권한)

4️⃣ 관리자 (admin) ⭐ 세분화
   ├─ 일반 관리자 (오너가 제약)
   └─ 오너 관리자 (모든 권한)
```

---

## 시스템 구조

### 📊 데이터베이스 스키마

#### 1. `profiles` 테이블 (수정)

```sql
-- 추가된 컬럼:
ALTER TABLE public.profiles 
ADD COLUMN role text DEFAULT 'member';

-- role 값:
-- owner/agency: 'member' (사용 안함)
-- manager: 'general', 'super'
-- admin: 'general', 'owner'
```

#### 2. `admin_permissions` 테이블 (신규)

오너 관리자가 일반 관리자에게 제약할 권한을 저장합니다.

```sql
CREATE TABLE public.admin_permissions (
  id uuid PRIMARY KEY,
  general_admin_id uuid,        -- 일반 관리자 ID
  owner_admin_id uuid,          -- 오너 관리자 ID
  permissions jsonb,            -- 권한 설정 (JSON)
  created_at timestamp,
  updated_at timestamp
);
```

**permissions 예시:**
```json
{
  "members_view": true,
  "members_edit": false,
  "news_view": true,
  "news_edit": true,
  "analytics_view": true,
  "performance_view": false,
  ...
}
```

#### 3. `manager_roles` 테이블 (신규)

관리자가 매니저에게 지정한 역할을 저장합니다.

```sql
CREATE TABLE public.manager_roles (
  id uuid PRIMARY KEY,
  manager_id uuid,              -- 매니저 ID
  assigned_by_admin_id uuid,    -- 할당한 관리자 ID
  manager_role text,            -- 'general' 또는 'super'
  permissions jsonb,            -- 매니저 권한 설정
  scope text,                   -- 관리 범위 (예: 'all')
  created_at timestamp,
  updated_at timestamp
);
```

### 🔗 API 엔드포인트

#### 회원 관리 API (수정)

```javascript
PUT /api/admin/members/:id

// 요청:
{
  "user_type": "manager",       // 새로 추가: manager 지원
  "membership_level": "admin",  
  "role": "super",              // 새로 추가: 역할 지정
  "reset_usage": false
}

// 응답:
{
  "success": true,
  "member": { /* 수정된 회원 정보 */ }
}
```

#### 관리자 권한 관리 API (신규)

```javascript
// 일반 관리자의 권한 조회
GET /api/admin/permissions/:adminId

// 응답:
{
  "success": true,
  "permissions": {
    "id": "...",
    "general_admin_id": "...",
    "permissions": { /* 권한 정보 */ }
  }
}

// 일반 관리자의 권한 설정/수정
POST /api/admin/permissions

// 요청:
{
  "general_admin_id": "...",
  "owner_admin_id": "...",      // 오너 관리자 ID
  "permissions": { /* 권한 정보 */ }
}
```

#### 매니저 역할 관리 API (신규)

```javascript
// 매니저의 역할 조회
GET /api/admin/manager-roles/:managerId

// 매니저의 역할 설정/수정
POST /api/admin/manager-roles

// 요청:
{
  "manager_id": "...",
  "assigned_by_admin_id": "...",  // 할당한 관리자 ID
  "manager_role": "general",      // 'general' 또는 'super'
  "permissions": { /* 권한 정보 */ },
  "scope": "all"
}
```

---

## 설정 방법

### 단계 1: Supabase 스키마 실행

1. Supabase 대시보드 열기
2. SQL Editor 선택
3. 다음 파일 실행: `database/schemas/features/admin/admin-roles.sql`

```sql
-- 파일 내용:
-- 1. profiles 테이블에 role 컬럼 추가
-- 2. admin_permissions 테이블 생성
-- 3. manager_roles 테이블 생성
-- 4. 인덱스 및 트리거 생성
```

✅ **완료 확인:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('admin_permissions', 'manager_roles');
-- 2개 테이블이 조회되어야 함
```

### 단계 2: server.js API 확인

`server.js`에 다음 API가 추가되었는지 확인합니다.

```javascript
// 1. 회원 등급 및 유형 변경 (수정됨)
app.put('/api/admin/members/:id', ...)

// 2. 관리자 권한 조회 (신규)
app.get('/api/admin/permissions/:adminId', ...)

// 3. 관리자 권한 설정 (신규)
app.post('/api/admin/permissions', ...)

// 4. 매니저 역할 조회 (신규)
app.get('/api/admin/manager-roles/:managerId', ...)

// 5. 매니저 역할 설정 (신규)
app.post('/api/admin/manager-roles', ...)
```

✅ **확인 명령어:**
```bash
grep -n "app.put\|app.get\|app.post" server.js | grep "admin"
```

### 단계 3: 프론트엔드 파일 확인

다음 파일들이 수정/생성되었는지 확인합니다.

```
admin/member-management.html      ✏️ 수정됨
admin/pages/admin-permissions.html 🆕 새로 생성됨
admin/assets/admin-bootstrap.js   ✏️ 수정됨
```

---

## 사용 방법

### 👥 회원 역할 지정

#### 1. 매니저 지정

**어드민 → 회원 관리:**

1. "등급 변경" 클릭
2. 회원 유형 → **"매니저"** 선택
3. 역할 선택:
   - 🙋 **일반 매니저**: 어드민 페이지 뷰만 가능
   - 👑 **수퍼 매니저**: 제한된 편집 권한

#### 2. 일반 관리자 지정

**어드민 → 회원 관리:**

1. "등급 변경" 클릭
2. 회원 유형 → **"관리자"** 선택
3. 역할 선택:
   - 👔 **일반 관리자**: 오너 관리자가 제약
   - 👨‍💼 **오너 관리자**: 모든 권한

### 🔐 일반 관리자 권한 제어

**오너 관리자 → 관리자 권한 제어:**

1. 어드민 페이지 → "관리자 권한 제어" 메뉴
2. 일반 관리자 카드 선택
3. 각 기능별로 "✓ 허용" / "✕ 불가" 선택:
   - **조회 권한** (뷰)
     - 📊 대시보드
     - 👥 회원 목록
     - 📰 뉴스 조회
     - 📈 분석
     - ⚡ 성능
     - 👁️ 리뷰 모니터링 조회
     - ⚠️ 오류 로그
     - 🏆 순위 리포트

   - **편집 권한** (수정/삭제)
     - ✏️ 회원 수정
     - 🗑️ 회원 삭제
     - 📝 뉴스 작성/수정
     - 🗑️ 뉴스 삭제
     - ⚙️ 리뷰 모니터링 편집

4. "저장" 클릭

---

## 권한 정의

### 📊 기본 권한 구조

모든 권한은 다음과 같이 저장됩니다.

```json
{
  "feature_key": true_or_false
}
```

**true**: 허용  
**false**: 불가

### 🔑 권한 키 목록

| 키 | 이름 | 설명 | 기본값 |
|----|------|------|--------|
| `dashboard_view` | 대시보드 조회 | 분석 & 통계 | ✅ |
| `members_view` | 회원 조회 | 회원 정보 조회 | ✅ |
| `members_edit` | 회원 수정 | 등급/유형/역할 변경 | ✅ |
| `members_delete` | 회원 삭제 | 회원 삭제 | ✅ |
| `news_view` | 뉴스 조회 | 뉴스 게시판 조회 | ✅ |
| `news_edit` | 뉴스 편집 | 뉴스 작성/수정 | ✅ |
| `news_delete` | 뉴스 삭제 | 뉴스 게시판 삭제 | ✅ |
| `analytics_view` | 분석 조회 | 분석 대시보드 | ✅ |
| `performance_view` | 성능 조회 | 성능 모니터링 | ✅ |
| `review_monitoring_view` | 리뷰 조회 | 리뷰 모니터링 조회 | ✅ |
| `review_monitoring_edit` | 리뷰 편집 | 리뷰 모니터링 설정 | ✅ |
| `errors_view` | 오류 로그 | 오류 로그 조회 | ✅ |
| `rank_report_view` | 순위 리포트 | 순위 리포트 조회 | ✅ |

### 👥 사용자별 기본 권한

#### 오너 관리자 (admin + owner)
```json
{
  모든 권한: true
}
```

#### 일반 관리자 (admin + general)
```json
{
  조회 권한: true,
  편집 권한: 오너 관리자가 설정
}
```

#### 수퍼 매니저 (manager + super)
```json
{
  뷰 권한: true,
  편집 권한: true (제한적)
}
```

#### 일반 매니저 (manager + general)
```json
{
  뷰 권한: true,
  편집 권한: false
}
```

---

## 테스트

### ✅ 테스트 체크리스트

#### 1. Supabase 연동 테스트

```bash
# Supabase에 테스트 데이터 삽입
psql -d sajangpick_db -c "
INSERT INTO profiles (id, name, email, user_type, role, created_at, updated_at)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Owner Admin', 'owner-admin@test.com', 'admin', 'owner', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test General Admin', 'gen-admin@test.com', 'admin', 'general', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Test Manager', 'manager@test.com', 'manager', 'general', now(), now());
"
```

#### 2. API 테스트

```bash
# 회원 등급 변경 (매니저로 지정)
curl -X PUT http://localhost:5000/api/admin/members/cccccccc-cccc-cccc-cccc-cccccccccccc \
  -H "Content-Type: application/json" \
  -d '{
    "user_type": "manager",
    "membership_level": "admin",
    "role": "super"
  }'

# 관리자 권한 설정
curl -X POST http://localhost:5000/api/admin/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "general_admin_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "owner_admin_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "permissions": {
      "members_view": true,
      "members_edit": false,
      "news_view": true,
      "news_edit": false
    }
  }'

# 권한 조회
curl http://localhost:5000/api/admin/permissions/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
```

#### 3. UI 테스트

1. **회원 관리 페이지**
   - [ ] 회원 유형 드롭다운에 "매니저" 옵션 보임
   - [ ] 매니저 선택 시 역할 선택 필드 활성화
   - [ ] 관리자 선택 시 역할 선택 필드 활성화

2. **관리자 권한 제어 페이지** (`/admin/pages/admin-permissions.html`)
   - [ ] 일반 관리자 목록 조회됨
   - [ ] 각 권한별 허용/불가 토글 가능
   - [ ] 저장 버튼 클릭 시 권한 저장됨

#### 4. 권한 검증 테스트

```javascript
// 브라우저 콘솔에서 테스트
const perms = await AdminBootstrap.getCurrentUserPermissions();
console.log('현재 사용자 권한:', perms);

// 특정 권한 확인
AdminBootstrap.checkPermission(perms.permissions, 'members_edit');
// → true: 허용, false: 불가
```

---

## 🎓 사용 시나리오

### 시나리오 1: 신입 관리자 권한 제약

1. 오너 관리자 로그인
2. "회원 관리" → 신입 관리자 선택 → "등급 변경"
3. 유형: **관리자**, 역할: **일반 관리자** 선택 → 저장

4. "관리자 권한 제어" 메뉴 열기
5. 신입 관리자 카드에서:
   - ✅ members_view: 허용
   - ❌ members_edit: 불가
   - ✅ news_view: 허용
   - ❌ news_edit: 불가
6. 저장

이제 신입 관리자는 회원/뉴스 조회만 가능!

### 시나리오 2: 매니저 지정

1. 오너 관리자 로그인
2. "회원 관리" → 일반 직원 선택 → "등급 변경"
3. 유형: **매니저**, 역할: **일반 매니저** 선택 → 저장

이제 매니저는 어드민 페이지에 접근 가능하지만 수정 불가!

---

## 📝 주의사항

### ⚠️ 중요

1. **profiles 테이블 수정**: `admin-roles.sql` 실행 필수
   ```sql
   ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'member';
   ```

2. **권한 검증**: 프론트엔드에서만 UI를 제어하며, **백엔드에서도 권한 확인 필수**
   ```javascript
   // 안전한 구현: 사용자 권한 확인 후 작업
   if (userPermissions.members_edit === false) {
     return res.status(403).json({ error: '권한 없음' });
   }
   ```

3. **오너 관리자 보호**: 오너 관리자는 제약 불가
   - 역할이 'owner'이면 모든 권한 자동 허용

4. **기본값**: role 미설정 시 'member'로 간주

---

## 🚀 다음 단계

### 향후 구현 예정

- [ ] 권한 검증 로직을 모든 어드민 페이지에 적용
- [ ] 매니저별 권한 설정 UI 개선
- [ ] 권한 로그 기록
- [ ] 권한 감시 알림
- [ ] API 엔드포인트 권한 검증

---

## 📞 문제 해결

### Q: 권한 변경이 적용되지 않음

**A:** 페이지 새로고침 필요 (브라우저 캐시 문제)
```bash
Ctrl + Shift + Delete  # 캐시 삭제
```

### Q: "접근 권한이 없습니다" 에러

**A:** 오너 관리자에게 권한 설정 요청

### Q: API 호출 실패

**A:** server.js 재시작 필요
```bash
node server.js
```

---

**마지막 업데이트**: 2025-10-31  
**담당**: AI Assistant  
**상태**: ✅ 구현 완료
