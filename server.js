// ==============================================================================
// 파일명: server.js
// 설명: 식사 메뉴 랜덤 추천기 백엔드 Express 서버
// 주요 개선사항:
//   1. 과장되고 억지스러운 수식어('향긋한', '풍미 가득한' 등) 배제 -> 깔끔하고 담백한 현실적 톤앤매너
//   2. 추천된 메뉴에 꼭 맞는 고화질 실제 음식 이미지(imageUrl) 자동 매칭 제공
//   3. 해산물, 면, 한식, 건강식 등 다양성 유지
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
  } catch (err) {
    console.warn('⚠️ [Supabase] 연결 초기화 실패:', err.message);
  }
}

// 5. Express 앱 인스턴스 생성 및 미들웨어 설정
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 음식 카테고리별 검증된 고화질 무료 음식 사진 큐레이션 (Unsplash CDN)
const FOOD_IMAGES = {
  // 1. 생선구이 / 해산물
  'fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80', // 생선 구이
  'seafood': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80', // 신선한 해산물/초밥
  'sashimi': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80', // 회/덮밥
  'shrimp': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80', // 새우/해물 요리

  // 2. 찌개 / 국물 / 탕
  'stew': 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80', // 얼큰한 찌개/전골
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80', // 따뜻하고 맑은 국물

  // 3. 면 요리
  'noodle': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', // 국수/라멘/우동
  'pasta': 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?auto=format&fit=crop&w=800&q=80', // 파스타

  // 4. 밥 / 비빔밥 / 덮밥 / 정식
  'rice': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=800&q=80', // 정갈한 한식 밥상/덮밥
  'bibimbap': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', // 다채로운 비빔밥

  // 5. 아침 / 가벼운 식사
  'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80', // 부드러운 아침 식사

  // 6. 든든한 일품 요리 / 고기
  'meat': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', // 깔끔한 구이 요리

  // 기본 대표 이미지 (한식 정식)
  'default': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'
};

// 메뉴 이름과 키워드를 기반으로 가장 적합한 고화질 이미지 URL을 찾는 헬퍼 함수
function getFoodImageUrl(menuName, imageType) {
  const name = (menuName || '').toLowerCase();
  
  if (name.includes('고등어') || name.includes('갈치') || name.includes('생선') || name.includes('연어') || name.includes('보리굴비') || name.includes('임연수')) {
    return FOOD_IMAGES['fish'];
  }
  if (name.includes('회') || name.includes('초밥') || name.includes('물회') || name.includes('덮밥')) {
    return FOOD_IMAGES['sashimi'];
  }
  if (name.includes('해물') || name.includes('낙지') || name.includes('쭈꾸미') || name.includes('오징어') || name.includes('조개') || name.includes('꼬막') || name.includes('새우')) {
    return FOOD_IMAGES['seafood'];
  }
  if (name.includes('찌개') || name.includes('탕') || name.includes('전골') || name.includes('순두부') || name.includes('칼국수')) {
    return FOOD_IMAGES['stew'];
  }
  if (name.includes('국') || name.includes('탕') || name.includes('죽')) {
    return FOOD_IMAGES['soup'];
  }
  if (name.includes('면') || name.includes('국수') || name.includes('소바') || name.includes('짬뽕') || name.includes('우동')) {
    return FOOD_IMAGES['noodle'];
  }
  if (name.includes('비빔밥') || name.includes('솥밥')) {
    return FOOD_IMAGES['bibimbap'];
  }
  if (name.includes('토스트') || name.includes('샐러드') || name.includes('계란')) {
    return FOOD_IMAGES['breakfast'];
  }

  // fallback: 모델이 분류한 imageType 또는 기본값
  return FOOD_IMAGES[imageType] || FOOD_IMAGES['default'];
}

// ==============================================================================
// 6. [API 1] 식사 메뉴 추천: POST /api/recommend (담백한 톤 + 이미지 제공)
// ==============================================================================
app.post('/api/recommend', async (req, res) => {
  try {
    const { timeOfDay } = req.body;

    const validTimes = ['아침', '점심', '저녁'];
    if (!timeOfDay || !validTimes.includes(timeOfDay)) {
      return res.status(400).json({
        success: false,
        error: '식사 시간(아침, 점심, 저녁)을 올바르게 선택해주세요.',
      });
    }

    if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('your_openai_api_key')) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.',
      });
    }

    const uniqueSeed = Date.now();

    // OpenAI gpt-4o-mini 호출 (과장 금지, 담백한 실용 설명, 이미지 타입 분류)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `당신은 실용적이고 센스 있는 식사 메뉴 추천 큐레이터입니다.

[작성 및 추천 지침 - 엄격 준수]
1. [과장된 미사여구 금지]:
   - '향긋한', '풍미 가득한', '환상적인', '입안 가득 퍼지는' 등 오글거리거나 억지스러운 수식어를 절대 붙이지 마세요.
   - 메뉴 이름은 군더더기 없이 일상에서 부르는 깔끔한 이름으로 작성하세요 (예: '고등어구이', '해물순두부찌개', '비빔밥', '바지락칼국수').
2. [담백하고 실용적인 추천 이유]:
   - 추천 이유는 1~2문장으로, 현실적인 장점(소화가 편함, 든든함, 가볍게 먹기 좋음, 날씨나 시간대에 어울림 등)을 차분하고 자연스럽게 설명하세요.
3. [카테고리 다양성 보장]:
   - 고기 위주의 편향을 피하고, 해산물/생선구이, 찌개, 덮밥/솥밥, 면류, 건강 한식 등을 골고루 추천하세요.
4. [imageType 필드]:
   - 메뉴에 맞는 적절한 영어 카테고리를 다음 중 하나로 지정하세요: 'fish', 'seafood', 'stew', 'soup', 'noodle', 'rice', 'bibimbap', 'breakfast', 'meat'

반드시 아래의 JSON 형식으로만 응답해주세요:
{
  "mainMenu": "깔끔한 메인 메뉴명",
  "sideMenu": "잘 어울리는 조합 메뉴명",
  "reason": "과장 없는 담백하고 자연스러운 추천 이유 (1~2문장)",
  "imageType": "fish | seafood | stew | soup | noodle | rice | bibimbap | breakfast | meat"
}`,
        },
        {
          role: 'user',
          content: `시간대: "${timeOfDay}" [시드: ${uniqueSeed}]
상투적인 수식어 없이 깔끔한 메뉴명과 담백한 이유로 추천해주세요.`,
        },
      ],
      temperature: 0.95,
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('OpenAI로부터 메뉴 추천 응답을 받지 못했습니다.');
    }

    const parsedData = JSON.parse(rawContent);
    const mainMenu = parsedData.mainMenu || '고등어구이';
    const sideMenu = parsedData.sideMenu || '된장찌개';
    const reason = parsedData.reason || '속이 편안하고 든든하게 한 끼를 챙기기 좋은 조합입니다.';
    const imageType = parsedData.imageType || 'fish';

    // 메뉴와 어울리는 고화질 실제 음식 사진 URL 매칭
    const imageUrl = getFoodImageUrl(mainMenu, imageType);

    return res.status(200).json({
      success: true,
      data: {
        timeOfDay: timeOfDay,
        mainMenu: mainMenu,
        sideMenu: sideMenu,
        reason: reason,
        imageUrl: imageUrl,
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
    service: '식사 메뉴 랜덤 추천기 (이미지 및 담백한 설명 지원)',
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

module.exports = app;
