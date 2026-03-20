# sr-ga-support 코드 리뷰 보고서

**버전:** v0.2.0 | **분석일:** 2026-03-18
**스택:** React 19 + Google Apps Script + Sheets DB + Google OAuth2 + Vercel
**검토자:** S전무 (마에스트로 AI)

---

## 1. 기능성 — **8.0 / 10**

### 구현 완성도
| 기능 | 상태 |
|------|------|
| 총무 요청 신청 (16종) | ✅ 완성 |
| 다단계 승인 워크플로우 | ✅ 완성 |
| 역할 기반 승인 (담당자/팀장/CEO) | ✅ 완성 |
| 파일 첨부 (Google Drive) | ✅ 완성 |
| Slack 알림 (신청/승인/반려) | ✅ 완성 |
| 대시보드 + Analytics 차트 | ✅ 완성 |
| 관리자 설정 (담당자/결재선/명부) | ✅ 완성 |
| 대량 신청 (타인 대리 제출) | ✅ 완성 |
| 자기 결재 방지 | ✅ 완성 |
| 이메일 알림 | ❌ 미구현 |
| 요청 검색/정렬 | ❌ 미구현 |
| 알림 센터 (인앱) | ❌ 미구현 |
| 엑셀 내보내기 | ❌ 미구현 |

### 주요 이슈
- **누락 기능:** 요청 목록 내 검색/필터 기능 없음 — 데이터 증가 시 사용성 저하
- `cancelled` 상태가 있으나 취소 버튼이 `pending` 상태에만 노출 (`in_progress`에서 취소 불가)
- Analytics는 전체 데이터 기반이나 **날짜 범위 필터 없음**

### 개선 제안
```
- 요청 목록 상단에 텍스트 검색 + 날짜 필터 추가
- in_progress 단계에서도 신청자 취소 허용 (단, 결재 완료 단계 제외)
- Analytics 기간 필터 (이번 달 / 분기 / 연도)
```

---

## 2. 품질 — **5.5 / 10**

### 코드 구조 현황
- `src/App.js` : **1,286줄 / 단일 파일 모노리스**
- 컴포넌트 약 20개가 한 파일에 혼재 (`Dashboard`, `MyRequests`, `Approvals`, `Analytics`, `Admin`, `NewRequestModal`, `RequestDetail` 등)
- TypeScript 미사용 (PropTypes도 없음)

### 주요 이슈

**① 단일 파일 과밀 (Critical)**
```
src/
  App.js (1286줄)  ← 전체 앱이 여기에 집중
```
컴포넌트, 훅, 상수, 타입, API 레이어가 혼재. 유지보수 및 협업 시 충돌 위험 높음.

**② 중복 패턴**
```js
// 동일한 패턴이 여러 컴포넌트에 반복
const [loading, setLoading] = useState(false);
const [error, setError]     = useState(null);
```
`useApiCall` 커스텀 훅으로 추상화 필요.

**③ 테스트 커버리지 0%**
- `App.test.js`는 CRA 기본 smoke test만 존재
- 승인 로직, 결재선 계산 등 핵심 비즈니스 로직 테스트 없음

**④ `apps-script/Code.gs` 품질**
```js
// 238줄 전체가 단일 함수들의 나열
// JSDoc 없음, 에러 로깅 없음
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  // ...
}
```

### 개선 제안
```
- src/ 분리: components/, hooks/, api/, constants/, utils/
- useApiCall(action, params) 커스텀 훅 도입
- Jest + Testing Library로 결재선 로직 단위 테스트 추가
- Code.gs: Logger.log() 추가 및 함수별 JSDoc 작성
```

---

## 3. 보안 — **5.0 / 10**

### 취약점 분석

**① 클라이언트 자격증명 localStorage 저장 (High)**
```js
// App.js ~line 112
localStorage.setItem("ga_user", JSON.stringify(u));
```
XSS 공격 시 세션 탈취 가능. email이 승인 권한 판단에 직접 사용됨.

**② 승인 권한 검증이 클라이언트에만 존재 (Critical)**
```js
// 클라이언트 사이드에서만 isAdmin/canApprove 계산
const isAdmin = (quotas?.adminEmails || []).includes(meEmail) || meEmail === quotas?.ceoEmail;
```
`update_request` 처리 시 Code.gs(서버)에서 **호출자 이메일 재검증 없음** → 직접 POST 요청으로 승인 우회 가능.

**③ Apps Script CORS 미제어**
```js
// Code.gs - corsResponse()가 ContentService 사용
// Access-Control-Allow-Origin 헤더 제어 불가 (GAS 기본: 공개)
// → APPS_SCRIPT_URL을 아는 누구나 API 직접 호출 가능
```

**④ 파일 업로드 검증 없음**
```js
// Code.gs upload_file (~line 105)
const decoded = Utilities.base64Decode(body.base64);
const blob    = Utilities.newBlob(decoded, body.mimeType, body.fileName);
// MIME type 화이트리스트 없음, 파일 크기 제한 없음
```

**⑤ 관리자 권한 이메일 기반 (Medium)**
```js
const isAdmin = (quotas?.adminEmails || []).includes(meEmail) || meEmail === quotas?.ceoEmail;
```
localStorage 조작으로 admin 권한 획득 가능 (서버 재검증 없음).

### 개선 제안
```
1. [Critical] Code.gs update_request 서버 사이드 권한 재검증
   - body.callerEmail vs 실제 결재선 매칭 검증 추가
2. [High] upload_file: MIME 화이트리스트 (pdf/jpg/png/xlsx 등) + 10MB 크기 제한
3. [Medium] sessionStorage 사용 (탭 종료 시 소멸) 또는 OAuth 토큰 만료 검사
4. [Low] 민감 API action은 Bearer 토큰 헤더 검사 추가
```

---

## 4. 안정성 — **6.5 / 10**

### 에러 핸들링 현황

**긍정적:**
- Toast 컴포넌트로 사용자에게 에러 노출
- 30초 자동 리프레시로 데이터 동기화
- 낙관적 UI 업데이트 + pending ID 중복 방지

**문제점:**

**① fetch 에러 처리 불일관**
```js
const post = body => fetch(APPS_SCRIPT_URL, { ... }).then(r => r.json());
// .catch() 없음 → 네트워크 오류 시 unhandled rejection
```

**② 파일 업로드 실패 시 요청 계속 진행**
```js
// 첨부파일 업로드 실패해도 요청 제출 계속됨
// 사용자는 첨부 없이 제출된 줄 모를 수 있음
```

**③ Apps Script 타임아웃 (6분 제한)**
- 대량 신청 시 Google Apps Script 실행 제한(6분) 도달 가능성

**④ Google Sheets 동시 쓰기 경쟁 조건**
```js
// Code.gs save_request — 여러 사용자가 동시에 호출 시
var lastRow = sheet.getLastRow(); // race condition 가능
// LockService 미적용
```

### 개선 제안
```
- api 레이어에 try/catch + toast 통합 처리
- 파일 업로드 실패 시 요청 중단 또는 명시적 경고 표시
- Code.gs에 LockService.getScriptLock() 적용
- 재시도 로직 (exponential backoff) 추가
```

---

## 5. 사용성 — **8.5 / 10**

### UX 강점
- 3단계 마법사 신청 흐름 (카테고리 → 타입 → 폼)
- 결재선 시각화 (Step Progress Bar)
- 모바일 반응형 + PWA manifest
- 이모지 아이콘으로 직관적 카테고리 구분
- 배지 색상 코딩 (pending=yellow, approved=green, rejected=red)
- 자기 결재 방지 UX 메시지

### 문제점

**① 요청 목록 페이지네이션 없음**
- 데이터 누적 시 전체 목록 렌더링 → 성능 저하

**② 폼 유효성 검사 피드백 부족**
```js
// 필수 필드 체크는 있으나 인라인 오류 메시지 없음
// alert() 기반 검증 메시지
```

**③ API 응답 형식 불일관 (Code.gs)**
```js
// 성공 시
corsResponse({ ok:true, data: ... })
// 실패 시 (일부 함수)
corsResponse({ ok:false, error:"..." })
// 실패 시 (다른 경우)
// → 예외 발생 → 500 응답 (corsResponse 미적용)
```

### 개선 제안
```
- 가상 스크롤 또는 페이지네이션 (50건 단위)
- 폼 필드별 인라인 오류 메시지
- Code.gs 응답 형식 완전 표준화: { ok, data, error } 구조 통일 + try/catch 전역 래퍼
```

---

## 6. 편의성 (개발자 경험) — **5.5 / 10**

### 강점
- `.env.example` 제공
- 한/영 매뉴얼 모두 존재 (`docs/manual_ko.md`, `docs/manual_en.md`)
- README 있음
- Vercel 배포 설정 포함

### 문제점

**① Apps Script 개발 환경 부재**
```
apps-script/Code.gs를 로컬에서 실행/테스트할 방법 없음
→ clasp (Google Apps Script CLI) 설정 없음
→ 수정할 때마다 GAS 에디터에 복붙 필요
```

**② 신규 배포 가이드 없음**
```
배포에 필요한 수동 단계:
1. Google Cloud 프로젝트 생성 + OAuth 2.0 클라이언트 설정
2. Google Apps Script 신규 프로젝트 생성 + 코드 붙여넣기
3. Apps Script 웹 앱 배포 → URL 복사
4. Google Sheets 신규 생성 (SHEET_ID 복사)
5. .env에 REACT_APP_APPS_SCRIPT_URL, REACT_APP_GOOGLE_CLIENT_ID 입력
6. Vercel 배포

→ README/docs에 단계별 가이드 없음 (사용자 매뉴얼에 집중)
```

**③ 로컬 개발 시 CORS 이슈**
- GAS endpoint를 `localhost:3000`에서 직접 호출 시 CORS 오류
- mock API 또는 개발용 환경 설정 없음

**④ 버전 관리 전략 없음**
```js
// App.js 하드코딩
const VERSION = "v0.2.0";
// package.json version과 불일치 가능성
```

### 개선 제안
```
- clasp.json 추가 + package.json에 "deploy:gas" 스크립트
- SETUP.md 작성: 신규 배포 6단계 체크리스트 (Google Cloud OAuth 설정 포함)
- src/mocks/: MSW(Mock Service Worker)로 로컬 개발용 mock API
- VERSION을 package.json에서 import하여 단일 소스화
```

---

## 종합 평가

| 차원 | 점수 | 한줄 요약 |
|------|------|-----------|
| 기능성 | 8.0 | 핵심 기능 완성도 높음. 검색/필터 미구현 |
| 품질 | 5.5 | 단일 파일 1286줄, 테스트 0%, 리팩토링 시급 |
| 보안 | 5.0 | 서버 사이드 권한 재검증 없음 — **운영 확장 전 필수 수정** |
| 안정성 | 6.5 | 기본 에러 처리 있으나 race condition/업로드 실패 미처리 |
| 사용성 | 8.5 | UX 완성도 높음. 페이지네이션/인라인 검증 보완 필요 |
| 편의성 | 5.5 | 배포 가이드 없음, GAS 개발 환경 없음 |
| **종합** | **6.5** | 기능은 충분하나 보안·품질 개선 없이 확장 불가 |

---

## 우선순위별 개선 과제

### P1 — 즉시 수정 (보안/안정성)
1. **Code.gs 서버 사이드 권한 재검증** — `update_request` 처리 시 `body.callerEmail`과 결재선 매칭 확인
2. **파일 업로드 MIME 화이트리스트 + 10MB 크기 제한** — 임의 파일 업로드 방지
3. **fetch 에러 처리 전역화** — unhandled promise rejection 방지

### P2 — 단기 (1~2주)
4. **컴포넌트 분리** — `src/components/`, `src/hooks/`, `src/api/`
5. **Code.gs 응답 형식 표준화** + try/catch 전역 래퍼
6. **LockService 적용** — 동시 쓰기 race condition 방지

### P3 — 중기 (1개월)
7. **핵심 비즈니스 로직 단위 테스트** — 결재선 계산, 권한 판단 로직
8. **clasp + SETUP.md** — Google Cloud OAuth 설정 포함 신규 배포 가이드
9. **검색/필터 + 페이지네이션** — 대량 데이터 대응
