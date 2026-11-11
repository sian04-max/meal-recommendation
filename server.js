// ==============================================================================
// 파일명: server.js
// 설명: 식사 메뉴 랜덤 추천기 백엔드 Express 서버
// 주요 역할:
//   1. 프론트엔드 정적 파일(HTML, CSS, JS) 서빙 (public 폴더)
//   2. 사용자가 선택한 시간대(아침/점심/저녁) 기반 OpenAI API 메뉴 추천 (/api/recommend)
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

// ==============================================================================
// 6. [API 1] 식사 메뉴 추천: POST /api/recommend
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

    // OpenAI gpt-4o-mini 호출 (JSON 형식 지정)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `당신은 대한민국 최고의 식사 메뉴 큐레이터입니다.
사용자가 선택한 식사 시간대(아침, 점심, 저녁)에 어울리는 가장 맛깔스럽고 균형 잡힌 한국인 선호 메뉴를 추천해야 합니다.
반드시 아래의 순수 JSON 형식으로만 응답해주세요:
{
  "mainMenu": "추천 메인 메뉴 1개 (예: 얼큰한 소고기 김치찌개)",
  "sideMenu": "같이 먹으면 궁합이 최고인 조합 메뉴 1개 (예: 치즈 계란말이)",
  "reason": "해당 시간대에 이 조합을 강력 추천하는 따뜻하고 센스 있는 한마디 설명"
}`,
        },
        {
          role: 'user',
          content: `지금은 "${timeOfDay}" 식사 시간입니다. 오늘 가장 기분 좋고 든든하게 먹을 수 있는 최적의 메인 메뉴와 꿀조합 메뉴를 1세트 추천해주세요!`,
        },
      ],
      temperature: 0.8,
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
        mainMenu: parsedData.mainMenu || '맛있는 백반 정식',
        sideMenu: parsedData.sideMenu || '정갈한 밑반찬 세트',
        reason: parsedData.reason || '언제 먹어도 든든하고 만족스러운 최고의 한 끼입니다.',
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
    service: '식사 메뉴 랜덤 추천기',
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
