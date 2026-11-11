# 06-deployment-vercel.md - Vercel 배포 및 검증 지침

## 1. 환경 변수 설정 (.env)
- `PORT`: 서버 포트 번호 (기본 3000)
- `OPENAI_API_KEY`: OpenAI API 키
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase Anon Public 키

## 2. 최종 검증 기준
1. [ ] 식사 시간 선택 후 버튼 클릭 시 AI 추천 메뉴가 표시되는가?
2. [ ] 메인 메뉴와 함께 조합 메뉴 1개가 함께 나타나는가?
3. [ ] 피드백 작성 시 로그인 없이 Supabase에 저장되는가?
4. [ ] 작성된 피드백이 하단 리스트에 최신순으로 즉시 출력되는가?
5. [ ] Vercel 상에서 오류 없이 정상 작동하는가?

