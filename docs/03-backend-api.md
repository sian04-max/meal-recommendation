# 03-backend-api.md - Node.js Express & OpenAI API 연동 지침

## 1. OpenAI 연동 (`/api/recommend`)
- **Method**: POST
- **Body**: `{ "timeOfDay": "아침" | "점심" | "저녁" }`
- **Prompt 기준**:
  - 선택한 식사 시간대에 어울리는 한국인 선호 메뉴를 추천할 것.
  - 응답은 JSON 포맷으로 고정:
    `{ "mainMenu": "메뉴이름", "sideMenu": "조합메뉴이름", "reason": "추천이유" }`

## 2. 피드백 API (`/api/feedback`)
- **GET `/api/feedback`**: Supabase `feedbacks` 테이블에서 최신순(`created_at DESC`)으로 전체 피드백 조회
- **POST `/api/feedback`**: 사용자 피드백(닉네임, 내용)을 Supabase `feedbacks` 테이블에 저장

