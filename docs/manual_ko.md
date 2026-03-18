# SR GA Support 사용 매뉴얼

**버전:** v0.1.0 · **최종 업데이트:** 2026-03-18

---

## 개요

SR GA Support는 Seoul Robotics 임직원을 위한 총무 지원 신청 시스템입니다.
명함, 온보딩/오프보딩, 출장, 고장신고, 대여 요청 등을 한 곳에서 신청하고 승인받을 수 있습니다.

---

## 로그인

1. [sr-ga-support.vercel.app](https://sr-ga-support.vercel.app) 접속
2. **Sign in with Google** 클릭
3. Seoul Robotics 구글 계정(@seoulrobotics.org)으로 로그인

> iOS Safari, Chrome 모두 지원

---

## 신청 방법

### 1. My Requests 탭에서 **+ New Request** 클릭

### 2. 카테고리 선택

| 카테고리 | 포함 항목 |
|---------|---------|
| 📋 General Request | 명함, 온보딩 물품/계정, 오프보딩, 법인카드 |
| ✈️ Business Travel | 국내출장, 해외출장 |
| 🔧 Breakdown Report | 자산/설비/IT/물품 고장 |
| 📦 Rental Request | 법인차량, R&D 물품, 비품 대여 |

### 3. 세부 유형 선택 후 폼 작성

- **Title**: 요청 내용 간략 기재 (필수)
- **Details**: 상세 설명
- **Attachments**: 영수증, 사진 등 첨부 (출장 실비정산 시 필수)

### 4. Submit Request 클릭 → 담당자/승인자에게 Slack 알림 발송

---

## 결재선 안내

| 요청 유형 | 결재선 |
|---------|-------|
| 명함, 온보딩/오프보딩, 고장신고, 대여 | 담당자 |
| 국내출장 | 매니저 → 담당자 |
| 해외출장, 법인카드 | 매니저 → CEO → 담당자 |

> 결재선은 Admin에서 변경 가능

---

## 신청 상태 안내

| 상태 | 의미 |
|-----|-----|
| 🟡 Pending | 접수됨, 첫 번째 승인 대기 |
| 🔵 In Progress | 중간 단계 승인 완료, 다음 단계 진행 중 |
| 🟢 Approved / Completed | 전체 승인 완료 |
| 🔴 Rejected | 반려됨 |
| ⚫ Cancelled | 신청자가 직접 취소 |

---

## 승인자 가이드

1. 상단 **Approvals** 탭 클릭
2. 대기 중인 요청 목록 확인 (대기 시간 표시)
3. 요청 클릭 → 상세 내용 확인
4. **Approve** 또는 **Reject** 클릭 (코멘트 선택 입력)

---

## 신청 취소

- My Requests에서 `Pending` 상태의 요청 클릭
- 하단 **Withdraw** 버튼 클릭

---

## 출장 지원 신청 상세

### 국내출장
- 출발/귀환 날짜, 목적지, 지원 유형 선택 (교통/숙박/기타/실비정산)

### 해외출장
- 동일 + 항공권 포함 / 실비정산 시 영수증 첨부 필수

### 실비정산
- Travel 신청 시 Sub Type → **Expense Claim** 선택
- 금액 입력 + 영수증 첨부 필수

---

## 고장신고 상세

| 유형 | 예시 |
|-----|-----|
| Asset Breakdown | 노트북, 모니터, 사무기기 |
| Facility Breakdown | 냉난방, 조명, 문, 화장실 |
| IT Breakdown | 네트워크, 서버, 프린터 |
| Item Breakdown | 사무용품, 기타 물품 |

- **Asset/Location** 필드에 자산명 또는 위치 기재

---

## 관리자(Admin) 가이드

> Admin 탭은 CEO 및 adminEmails 지정 계정만 표시됩니다.

### Assignees 탭
각 요청 유형별 담당자 이메일 설정 (쉼표로 구분)

### Chains 탭
결재선 단계 조정 — Manager / CEO / Assignee 토글로 on/off

### Settings 탭
| 항목 | 설명 |
|-----|-----|
| CEO Email | CEO 계정 이메일 |
| Slack Webhook URL | 알림 발송용 채널 Webhook |
| App URL | 슬랙 버튼 딥링크용 앱 주소 |
| Drive Folder ID | 첨부파일 저장 Google Drive 폴더 ID |

---

## Slack 알림

- 신청 접수 시 → 담당자 채널 알림 + **View & Approve** 링크 버튼
- 승인/반려 시 → 채널 알림

---

## 문의

Sangkil Woo (sangkil.woo@seoulrobotics.org)
