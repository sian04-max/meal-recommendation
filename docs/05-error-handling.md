# 05-error-handling.md - 오류 처리 및 예외 상황 지침

## 1. 프론트엔드 오류 처리
- 입력값 검증 (시간 미선택 시 경고, 피드백 내용 빈값 체크)
- API 요청 중 로딩 상태 표시 (버튼 비활성화 및 스피너)
- 서버 에러 응답 시 화면 상단/결과 카드에 에러 메시지 노출

## 2. 백엔드 오류 처리
- `try-catch` 블록 필수 적용
- OpenAI API Key 누락 또는 Quota 초과 시 `500 Internal Server Error` 및 유저 친화적 메시지 반환
- Supabase 에러 발생 시에도 적절한 에러 JSON 반환

