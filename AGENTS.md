# AGENTS.md - Antigravity AI 에이전트 작업 지침

## 1. 개요 및 원칙
본 문서는 '식사 메뉴 랜덤 추천기' 프로젝트를 수행하는 AI 코딩 에이전트(Antigravity)를 위한 작업 규칙입니다.
- **추측 금지**: 명시되지 않은 스택이나 임의의 패키지/프레임워크(React, Vue 등)를 절대 도입하지 마십시오.
- **기술 스택 고수**: HTML, CSS, Vanilla JavaScript, Node.js (Express), OpenAI API, Supabase, Vercel 규칙을 엄격히 준수합니다.

## 2. 작업 순서
1. `PRD.md` 및 `docs/` 지침 숙지
2. Supabase 데이터베이스 테이블 및 API 키 설정
3. Node.js 백엔드 서버 구축 및 OpenAI API 연동 (`/api/recommend`)
4. Supabase 피드백 API 구현 (`/api/feedback`)
5. Front-End HTML/CSS/JS 레이아웃 및 비동기 Fetch 통신 구현
6. Vercel 배포 설정 및 환경변수 등록

## 3. 완료 조건
- 비회원 사용자가 식사 시간(아침/점심/저녁) 선택 후 추천 버튼 클릭 시 **메인 메뉴 1개 + 조합 메뉴 1개**가 상단에 표시되어야 함.
- 작성된 피드백이 로그인 없이 Supabase에 저장되고, 하단에 최신순 목록으로 즉시 갱신되어 표시되어야 함.
- API 에러 발생 시 UI 상에 직관적인 에러 메시지가 표시되어야 함.

