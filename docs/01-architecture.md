# 01-architecture.md - 시스템 아키텍처 및 데이터 흐름 지침

## 1. 디렉토리 구조
```
/
├── public/              # 프론트엔드 정적 파일
│   ├── index.html       # 메인 UI
│   ├── style.css        # 스타일시트
│   └── app.js           # 클라이언트 JavaScript
├── server.js            # Node.js Express 백엔드 서버
├── package.json
├── .env.example
├── .gitignore
├── vercel.json
└── README.md
```

## 2. 데이터 흐름
1. **메뉴 추천**: Client (`app.js`) -> POST `/api/recommend` -> Server (`server.js`) -> OpenAI API -> Client 출력
2. **피드백 작성**: Client (`app.js`) -> POST `/api/feedback` -> Server (`server.js`) -> Supabase DB 저장 -> Client 목록 갱신
3. **피드백 목록 조회**: Client (`app.js`) -> GET `/api/feedback` -> Supabase DB 조회 -> Client 목록 출력

