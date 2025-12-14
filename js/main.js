// 메인 앱 진입점
import { cardManager } from './cardManager.js';
import { shareManager } from './shareManager.js';
import { collection, renderCollectionModal } from './collection.js';
import { showToast } from './utils.js';

class App {
  constructor() {
    this.elements = {};
    this.init();
  }

  init() {
    // DOM 요소 캐싱
    this.elements = {
      cardSpread: document.getElementById('card-spread'),
      hint: document.getElementById('hint'),
      btnGroup: document.getElementById('btn-group'),
      resetBtn: document.getElementById('reset-btn'),
      shareBtn: document.getElementById('share-btn'),
      shareBtnText: document.getElementById('share-btn-text'),
      kakaoBtn: document.getElementById('kakao-btn'),
      collectionBtn: document.getElementById('collection-btn'),
      statOwned: document.getElementById('stat-owned'),
      statTotal: document.getElementById('stat-total'),
      statRare: document.getElementById('stat-rare'),
      statEpic: document.getElementById('stat-epic'),
      statLegendary: document.getElementById('stat-legendary'),
      newBadge: document.getElementById('new-badge'),
      dailyCount: document.getElementById('daily-count')
    };

    // 공유 버튼 텍스트 설정
    this.elements.shareBtnText.textContent = shareManager.getButtonText();

    // 카드 매니저 콜백 설정
    cardManager.onCardFlip = this.handleCardFlip.bind(this);
    cardManager.onStatsUpdate = this.updateStats.bind(this);
    cardManager.onDailyLimitReached = () => {
      showToast(`🚫 오늘 뽑기 횟수를 모두 사용했어요!\n내일 다시 도전하세요 💪`);
    };

    // 이벤트 바인딩
    this.bindEvents();

    // 초기 통계 표시
    this.updateStats(collection.getStats());
    this.updateDailyCount();

    // 카드 생성
    this.createNewSpread();

    // 흔들기 감지 설정
    this.setupShake();
  }

  async setupShake() {
    cardManager.setupShakeDetection(() => {
      // 카드가 선택되지 않은 상태에서만 셔플
      if (!cardManager.getSelectedCard()) {
        this.createNewSpread();
        showToast('🎴 카드를 섞었어요!');
      }
    });

    // iOS 권한 버튼 표시 (첫 터치 시 권한 요청)
    if (cardManager.requestMotionPermission) {
      const firstTouch = async () => {
        const granted = await cardManager.requestMotionPermission();
        if (granted) {
          showToast('📱 흔들어서 카드 섞기 활성화!');
        }
        document.removeEventListener('touchstart', firstTouch);
      };
      document.addEventListener('touchstart', firstTouch, { once: true });
    }
  }

  bindEvents() {
    // 다시 뽑기
    this.elements.resetBtn.addEventListener('click', () => {
      this.createNewSpread();
    });

    // 공유
    this.elements.shareBtn.addEventListener('click', async () => {
      const cardData = cardManager.getSelectedCard();
      
      if (!cardData || !cardManager.isCardFlipped()) {
        showToast('먼저 카드를 뒤집어주세요!');
        return;
      }

      this.elements.shareBtn.disabled = true;
      this.elements.shareBtnText.textContent = '⏳ 준비 중...';
      
      await shareManager.share(cardData);
      
      this.elements.shareBtn.disabled = false;
      this.elements.shareBtnText.textContent = shareManager.getButtonText();
    });

    // 카카오톡 공유
    this.elements.kakaoBtn.addEventListener('click', () => {
      const cardData = cardManager.getSelectedCard();
      
      if (!cardData || !cardManager.isCardFlipped()) {
        showToast('먼저 카드를 뒤집어주세요!');
        return;
      }

      // 공유 보너스 받을 수 있는지 미리 체크
      const canGetBonus = collection.canGetShareBonus();

      shareManager.shareToKakao(cardData, () => {
        // 공유 콜백
        if (canGetBonus && collection.addShareBonus()) {
          showToast('🎁 공유 보너스! 뽑기 +1회 추가!');
          this.updateDailyCount();
        } else {
          showToast('카카오톡으로 공유했어요! 💬');
        }
      });
    });

    // 컬렉션
    this.elements.collectionBtn.addEventListener('click', () => {
      renderCollectionModal();
      this.elements.newBadge.classList.add('hidden');
    });

    // 배경 클릭 시 선택 해제
    this.elements.cardSpread.addEventListener('click', (e) => {
      if (e.target === this.elements.cardSpread) {
        cardManager.deselectCard();
        this.updateHint('카드를 선택하세요');
        this.elements.btnGroup.classList.remove('visible');
      }
    });
  }

  createNewSpread() {
    cardManager.createSpread(this.elements.cardSpread, 12);
    this.updateHint('카드를 선택하세요');
    this.elements.btnGroup.classList.remove('visible');
  }

  handleCardFlip(cardData, isNew) {
    // 일일 횟수 증가 및 UI 업데이트
    collection.incrementDailyCount();
    this.updateDailyCount();
    
    this.updateHint('탭하면 다시 덮어요');
    this.elements.btnGroup.classList.add('visible');
    
    // 새 카드면 배지 표시
    if (isNew) {
      this.elements.newBadge.classList.remove('hidden');
      showToast(`🎉 새로운 카드! ${cardData.emoji}`, 2000);
    }

    // 레어 이상이면 특별 메시지
    if (cardData.rarity === 'legendary') {
      setTimeout(() => showToast('🌟 전설 카드 획득!! 🌟', 3000), 500);
    } else if (cardData.rarity === 'epic') {
      setTimeout(() => showToast('💎 에픽 카드 획득!', 2500), 500);
    }
  }

  updateHint(text) {
    this.elements.hint.textContent = text;
  }

  updateStats(stats) {
    this.elements.statOwned.textContent = stats.owned;
    this.elements.statTotal.textContent = stats.total;
    this.elements.statRare.textContent = stats.byRarity.rare.owned;
    this.elements.statEpic.textContent = stats.byRarity.epic.owned;
    this.elements.statLegendary.textContent = stats.byRarity.legendary.owned;
  }

  updateDailyCount() {
    const remaining = collection.getRemainingDraws();
    this.elements.dailyCount.textContent = remaining;
    
    // 0이면 스타일 변경
    if (remaining === 0) {
      this.elements.dailyCount.parentElement.classList.add('exhausted');
    } else {
      this.elements.dailyCount.parentElement.classList.remove('exhausted');
    }
  }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
  new App();
});