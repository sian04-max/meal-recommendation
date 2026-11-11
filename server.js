// ==============================================================================
// 파일명: server.js
// 설명: 식사 메뉴 랜덤 추천기 백엔드 Express 서버 (다양성 극대화 개선 버전)
// 주요 역할:
//   1. 프론트엔드 정적 파일(HTML, CSS, JS) 서빙 (public 폴더)
//   2. 사용자가 선택한 시간대(아침/점심/저녁) 기반 OpenAI API 메뉴 추천 (/api/recommend)
//      - 고기 위주 편향 탈피: 해산물, 생선, 면류, 건강식, 별미 등 다채로운 랜덤 큐레이션
//   3. Supabase 연동 피드백 저장 및 최신순 목록 조회 (/api/feedback)
//   4. Vercel 클라우드 서버리스 배포 완벽 호환
// ==============================================================================

// 1. 필요한 외부 모듈 가져오기
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// 2. 환경 변수(.env) 로드
dotenv.config();

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 3. OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || 'dummy_key',
});

// 4. Supabase 클라이언트 초기화 (안전 검증 로직 적용)
let supabase = null;
const isValidUrl = SUPABASE_URL && SUPABASE_URL.startsWith('http') && !SUPABASE_URL.includes('your_supabase_url');

if (isValidUrl && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('your_supabase_anon')) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ [Supabase] 데이터베이스 클라이언트가 성공적으로 연결되었습니다.');
  } catch (err) {
    console.warn('⚠️ [Supabase] 연결 초기화 실패:', err.message);
  }
} else {
  console.warn('⚠️ [Supabase] 유효한 SUPABASE_URL 또는 KEY가 설정되지 않았습니다.');
}

// 5. Express 앱 인스턴스 생성 및 미들웨어 설정
const app = express();

// 교차 출처 리소스 공유(CORS) 허용
app.use(cors());

// JSON 형태의 요청 본문 파싱
app.use(express.json());

// public 폴더의 정적 파일(index.html, style.css, app.js 등) 서빙
app.use(express.static(path.join(__dirname, 'public')));

// 다양한 음식 카테고리 풀 (랜덤 시드용)
const FOOD_CATEGORIES = [
  '신선한 해산물/생선 요리 (고등어구이, 해물탕, 낙지볶음, 회덮밥, 대구지리, 바지락칼국수 등)',
  '속 편한 담백 한식/찌개류 (청국장, 순두부찌개, 황태해장국, 우렁된장찌개 등)',
  '별미 면 요리 (메밀소바, 짬뽕, 쌀국수, 들기름막국수, 해물파스타 등)',
  '깔끔한 덮밥 및 솥밥 (연어덮밥, 꼬막비빔밥, 가지솥밥, 전복죽 등)',
  '다채로운 아시안/양식/이색 요리 (팟타이, 타코, 리조또, 카레우동 등)',
  '든든한 고기/볶음 요리 (갈비탕, 보쌈, 닭볶음탕 등)'
];

// ==============================================================================
// 6. [API 1] 식사 메뉴 추천: POST /api/recommend (다양성 개선)
// ==============================================================================
app.post('/api/recommend', async (req, res) => {
  try {
    const { timeOfDay } = req.body;

    // [검증] 아침/점심/저녁 중 유효한 값인지 체크
    const validTimes = ['아침', '점심', '저녁'];
    if (!timeOfDay || !validTimes.includes(timeOfDay)) {
      return res.status(400).json({
        success: false,
        error: '식사 시간(아침, 점심, 저녁)을 올바르게 선택해주세요.',
      });
    }

    // OpenAI API 키 누락 여부 확인
    if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('your_openai_api_key')) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.',
      });
    }

    // 추천 다양성을 위해 랜덤 카테고리 힌트 선택
    const randomCategoryHint = FOOD_CATEGORIES[Math.floor(Math.random() * FOOD_CATEGORIES.length)];
    const uniqueSeed = Date.now();

    // OpenAI gpt-4o-mini 호출 (다양성 극대화 프롬프트)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `당신은 음식의 영양 균형과 다채로운 미식을 중요시하는 대한민국 최고의 식사 메뉴 큐레이터입니다.

[메뉴 추천 필수 원칙]
1. [고기 편향 절대 금지]: 제육볶음, 돈까스, 삼겹살 등 뻔한 육류 위주 추천을 피하고, **신선한 해산물/생선 요리(해물탕, 고등어구이, 꼬막비빔밥, 낙지볶음, 회덮밥, 대구탕, 조개칼국수 등), 정갈한 나물/채소 건강식, 시원한 면 요리, 이색 솥밥/덮밥 등 폭넓고 다채로운 장르**에서 창의적으로 추천하세요.
2. [시간대 맞춤 큐레이션]:
   - 아침: 부담 없이 속을 따뜻하게 깨워주는 담백하고 부드러운 메뉴
   - 점심: 활력을 채워주는 다채로운 한식, 해산물 요리, 면류, 아시안/양식 등
   - 저녁: 하루의 피로를 풀어주는 풍성하고 특별한 미식 조합
3. [최적의 꿀조합]: 메인 메뉴의 맛과 식감을 완벽하게 받쳐주는 사이드 메뉴 1개를 센스 있게 페어링하세요.

반드시 아래의 순수 JSON 형식으로만 응답해주세요:
{
  "mainMenu": "추천 메인 메뉴 1개 (예: 바삭하고 촉촉한 고등어구이)",
  "sideMenu": "찰떡궁합 사이드 메뉴 1개 (예: 구수한 시래기된장국)",
  "reason": "해당 시간대에 이 조합을 강력 추천하는 따뜻하고 식욕을 돋우는 한마디 설명"
}`,
        },
        {
          role: 'user',
          content: `지금은 "${timeOfDay}" 식사 시간입니다.
[참고 힌트(영감용)]: 이번 추천에는 특히 "${randomCategoryHint}" 계열이나 평소 자주 접하기 힘든 신선한 별미(해산물, 생선, 면, 솥밥 등)를 적극 고려해 주세요. (고기 일색 탈피)
[식별 시드: ${uniqueSeed}]
오늘 가장 기분 좋고 새롭게 즐길 수 있는 메인 메뉴 1개와 꿀조합 사이드 1개를 추천해주세요!`,
        },
      ],
      temperature: 1.05, // 창의성과 다양성 대폭 증대
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('OpenAI로부터 메뉴 추천 응답을 받지 못했습니다.');
    }

    const parsedData = JSON.parse(rawContent);

    return res.status(200).json({
      success: true,
      data: {
        timeOfDay: timeOfDay,
        mainMenu: parsedData.mainMenu || '신선한 생선구이 정식',
        sideMenu: parsedData.sideMenu || '맑은 바지락 조갯국',
        reason: parsedData.reason || '신선한 재료의 풍미가 가득하여 기분 좋은 활력을 주는 최고의 한 끼입니다.',
      },
    });

  } catch (err) {
    console.error('❌ [메뉴 추천 에러]:', err);
    return res.status(500).json({
      success: false,
      error: '메뉴를 추천하는 도중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// ==============================================================================
// 7. [API 2] 피드백 목록 최신순 조회: GET /api/feedback
// ==============================================================================
app.get('/api/feedback', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(200).json({
        success: true,
        data: [],
        notice: 'Supabase 연동 준비 중입니다.',
      });
    }

    // feedbacks 테이블에서 최신순(created_at 내림차순)으로 최대 50건 조회
    const { data, error } = await supabase
      .from('feedbacks')
      .select('id, nickname, content, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('⚠️ [Supabase 피드백 조회 에러]:', error.message);
      return res.status(500).json({
        success: false,
        error: '피드백 목록을 불러오지 못했습니다.',
      });
    }

    return res.status(200).json({
      success: true,
      data: data || [],
    });

  } catch (err) {
    console.error('❌ [피드백 조회 예외]:', err);
    return res.status(500).json({
      success: false,
      error: '피드백 조회 중 서버 오류가 발생했습니다.',
    });
  }
});

// ==============================================================================
// 8. [API 3] 피드백 작성 및 저장: POST /api/feedback
// ==============================================================================
app.post('/api/feedback', async (req, res) => {
  try {
    const { nickname, content } = req.body;

    // [검증] 피드백 내용 필수 입력 체크
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '피드백 내용을 입력해주세요.',
      });
    }

    const trimmedContent = content.trim();
    const finalNickname = (nickname && typeof nickname === 'string' && nickname.trim().length > 0)
      ? nickname.trim()
      : '익명';

    if (trimmedContent.length > 500) {
      return res.status(400).json({
        success: false,
        error: '피드백은 최대 500자까지 작성 가능합니다.',
      });
    }

    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: '데이터베이스 연결이 설정되지 않았습니다.',
      });
    }

    // Supabase feedbacks 테이블에 데이터 삽입(INSERT)
    const { data, error } = await supabase
      .from('feedbacks')
      .insert([
        {
          nickname: finalNickname,
          content: trimmedContent,
        },
      ])
      .select();

    if (error) {
      console.error('⚠️ [Supabase 피드백 저장 에러]:', error.message);
      return res.status(500).json({
        success: false,
        error: '피드백 저장에 실패했습니다. DB 설정을 확인해주세요.',
      });
    }

    return res.status(201).json({
      success: true,
      message: '피드백이 성공적으로 등록되었습니다!',
      data: data ? data[0] : null,
    });

  } catch (err) {
    console.error('❌ [피드백 저장 예외]:', err);
    return res.status(500).json({
      success: false,
      error: '피드백 저장 중 서버 오류가 발생했습니다.',
    });
  }
});

// ==============================================================================
// 9. 헬스체크 엔드포인트: GET /api/health
// ==============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '식사 메뉴 랜덤 추천기 (다양성 버전)',
    time: new Date().toISOString(),
  });
});

// ==============================================================================
// 10. 로컬 서버 실행 및 Vercel 서버리스 내보내기
// ==============================================================================
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`======================================================`);
    console.log(`🍽️  식사 메뉴 랜덤 추천기 서버가 시작되었습니다!`);
    console.log(`📡 서버 접속 주소: http://localhost:${PORT}`);
    console.log(`======================================================`);
  });
}

// Vercel 서버리스 호환용 모듈 내보내기
module.exports = app;
