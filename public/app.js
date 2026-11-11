// ==============================================================================
// 파일명: public/app.js
// 설명: 식사 메뉴 랜덤 추천기 프론트엔드 비즈니스 로직 (Vanilla JavaScript)
// 주요 기능:
//   1. 아침/점심/저녁 시간대 선택 및 OpenAI AI 추천 API 호출 (/api/recommend)
//   2. AI 메인 메뉴 + 조합 메뉴 + 이유 화면 렌더링
//   3. Supabase 연동 피드백 작성 (/api/feedback) 및 실시간 목록 조회
//   4. 로딩 상태(스피너) 및 직관적인 오류 처리
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM 엘리먼트 참조 변수 가져오기
  const recommendBtn = document.getElementById('recommend-btn');
  const btnText = recommendBtn.querySelector('.btn-text');
  const btnSpinner = recommendBtn.querySelector('.btn-spinner');
  const errorBox = document.getElementById('error-message');
  
  const resultBox = document.getElementById('result-box');
  const resultTimeTag = document.getElementById('result-time-tag');
  const mainMenuName = document.getElementById('main-menu-name');
  const sideMenuName = document.getElementById('side-menu-name');
  const reasonDesc = document.getElementById('reason-desc');

  const feedbackForm = document.getElementById('feedback-form');
  const nicknameInput = document.getElementById('nickname-input');
  const contentInput = document.getElementById('content-input');
  const feedbackSubmitBtn = document.getElementById('feedback-submit-btn');
  const feedbackError = document.getElementById('feedback-error');
  const feedbackList = document.getElementById('feedback-list');
  const feedbackTotalCount = document.getElementById('feedback-total-count');

  // ==============================================================================
  // 2. 초기 데이터 로드 (페이지 열리자마자 기존 피드백 목록 조회)
  // ==============================================================================
  fetchFeedbackList();

  // ==============================================================================
  // 3. [기능 1] 메뉴 추천받기 버튼 이벤트
  // ==============================================================================
  recommendBtn.addEventListener('click', async () => {
    // 선택된 라디오 버튼의 값(아침/점심/저녁) 확인
    const selectedRadio = document.querySelector('input[name="mealTime"]:checked');
    if (!selectedRadio) {
      showError('식사 시간대(아침, 점심, 저녁)를 선택해주세요.');
      return;
    }

    const timeOfDay = selectedRadio.value;

    // UI 상태: 로딩 중으로 전환
    setRecommendLoading(true);
    hideError();

    try {
      // 백엔드 API (POST /api/recommend) 호출
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeOfDay: timeOfDay }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '메뉴 추천을 가져오지 못했습니다.');
      }

      // 추천 결과 화면 표시
      renderRecommendation(result.data);

    } catch (err) {
      console.error('메뉴 추천 오류:', err);
      showError(err.message || '서버와의 통신에 실패했습니다. 잠시 후 다시 시도해주세요.');
      resultBox.classList.add('hidden');
    } finally {
      // UI 상태: 로딩 해제
      setRecommendLoading(false);
    }
  });

  // ==============================================================================
  // 4. 메뉴 추천 결과 화면 바인딩 함수
  // ==============================================================================
  function renderRecommendation(data) {
    const { timeOfDay, mainMenu, sideMenu, reason } = data;

    resultTimeTag.textContent = `${timeOfDay} 추천 세트`;
    mainMenuName.textContent = mainMenu;
    sideMenuName.textContent = sideMenu;
    reasonDesc.textContent = reason;

    // 숨겨져 있던 결과 카드 노출
    resultBox.classList.remove('hidden');

    // 결과 카드가 화면에 잘 보이도록 부드럽게 스크롤
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ==============================================================================
  // 5. [기능 2] 피드백 작성 폼 제출 이벤트
  // ==============================================================================
  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nickname = nicknameInput.value.trim();
    const content = contentInput.value.trim();

    if (!content) {
      showFeedbackError('피드백 내용을 입력해주세요.');
      contentInput.focus();
      return;
    }

    hideFeedbackError();
    feedbackSubmitBtn.disabled = true;
    feedbackSubmitBtn.textContent = '등록 중...';

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname,
          content: content,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '피드백 등록에 실패했습니다.');
      }

      // 입력 폼 초기화
      contentInput.value = '';
      nicknameInput.value = '';

      // 등록 즉시 최신 피드백 목록 새로고침
      await fetchFeedbackList();

    } catch (err) {
      console.error('피드백 등록 에러:', err);
      showFeedbackError(err.message || '피드백을 저장하지 못했습니다.');
    } finally {
      feedbackSubmitBtn.disabled = false;
      feedbackSubmitBtn.textContent = '남기기';
    }
  });

  // ==============================================================================
  // 6. [기능 3] 피드백 목록 가져오기 함수 (GET /api/feedback)
  // ==============================================================================
  async function fetchFeedbackList() {
    try {
      const response = await fetch('/api/feedback');
      const result = await response.json();

      if (response.ok && result.success && Array.isArray(result.data)) {
        renderFeedbackList(result.data);
      }
    } catch (err) {
      console.warn('피드백 목록 로드 중 경고:', err);
    }
  }

  // 피드백 리스트 화면 렌더링
  function renderFeedbackList(items) {
    feedbackTotalCount.textContent = items.length;

    if (items.length === 0) {
      feedbackList.innerHTML = '<div class="empty-state">아직 등록된 피드백이 없습니다. 첫 번째 한마디를 남겨보세요! ✨</div>';
      return;
    }

    // 최신순 피드백 카드 동적 생성
    feedbackList.innerHTML = items.map((item) => {
      const dateStr = formatDate(item.created_at);
      const safeAuthor = escapeHtml(item.nickname || '익명');
      const safeContent = escapeHtml(item.content);

      return `
        <div class="feedback-item">
          <div class="feedback-item-header">
            <span class="feedback-author">👤 ${safeAuthor}</span>
            <span class="feedback-time">${dateStr}</span>
          </div>
          <p class="feedback-body">${safeContent}</p>
        </div>
      `;
    }).join('');
  }

  // ==============================================================================
  // 7. 유틸리티 함수들
  // ==============================================================================
  function setRecommendLoading(isLoading) {
    if (isLoading) {
      recommendBtn.disabled = true;
      btnText.textContent = 'AI가 맛있는 조합을 생각하는 중...';
      btnSpinner.classList.remove('hidden');
    } else {
      recommendBtn.disabled = false;
      btnText.textContent = '오늘의 메뉴 추천받기 🎲';
      btnSpinner.classList.add('hidden');
    }
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }

  function showFeedbackError(msg) {
    feedbackError.textContent = msg;
    feedbackError.classList.remove('hidden');
  }

  function hideFeedbackError() {
    feedbackError.textContent = '';
    feedbackError.classList.add('hidden');
  }

  // 날짜 포맷 변환 (한국 시간 기준)
  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  }

  // XSS 방지를 위한 안전한 HTML 이스케이프 처리
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});

