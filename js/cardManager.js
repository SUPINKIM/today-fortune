// 카드 매니저 - 카드 관련 로직 담당
import { RARITY_CONFIG, getCardsByRarity } from './cardData.js';
import { randomPick, weightedRandomPick, vibrate } from './utils.js';
import { collection } from './collection.js';

class CardManager {
  constructor() {
    this.cards = [];
    this.selectedCard = null;
    this.isFlipped = false;
    this.onCardFlip = null; // 콜백
    this.onStatsUpdate = null; // 콜백
    this.onDailyLimitReached = null; // 콜백
  }

  // 랜덤 카드 뽑기
  pickRandomCard() {
    // 가중치 기반 레어리티 선택
    const weights = {};
    for (const [rarity, config] of Object.entries(RARITY_CONFIG)) {
      weights[rarity] = config.probability;
    }
    
    const rarity = weightedRandomPick(weights);
    const rarityCards = getCardsByRarity(rarity);
    const card = randomPick(rarityCards);
    
    return { ...card, rarity };
  }

  // 카드 스프레드 생성
  createSpread(container, cardCount = 12) {
    container.innerHTML = '';
    this.cards = [];
    this.selectedCard = null;
    this.isFlipped = false;

    const spreadAngle = 120;
    const startAngle = -spreadAngle / 2;
    const angleStep = spreadAngle / (cardCount - 1);
    
    // 화면 크기에 따라 반경 동적 계산
    const screenWidth = window.innerWidth;
    const radius = Math.min(screenWidth * 0.5, 240);

    for (let i = 0; i < cardCount; i++) {
      const cardData = this.pickRandomCard();
      const angle = startAngle + angleStep * i;
      const radians = (angle * Math.PI) / 180;
      
      const x = Math.sin(radians) * radius;
      const y = Math.cos(radians) * radius * 0.3;
      
      const card = this.createCardElement(cardData, i, x, y, angle);
      container.appendChild(card);
      this.cards.push(card);
    }
  }

  // 카드 DOM 요소 생성
  createCardElement(cardData, index, x, y, angle) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.index = index;
    
    const baseTransform = `translateX(${x}px) translateY(${y}px) rotate(${angle}deg)`;
    const hoverTransform = `translateX(${x}px) translateY(${y - 25}px) rotate(${angle}deg) scale(1.12)`;
    
    card.style.setProperty('--hover-transform', hoverTransform);
    card.style.transform = baseTransform;
    card.style.zIndex = index;

    const symbols = ['✦', '◆', '★', '❖', '✧', '◇'];
    const symbol = symbols[index % symbols.length];
    
    const config = RARITY_CONFIG[cardData.rarity];

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back">
          <div class="card-back-pattern"></div>
          <div class="card-back-symbol">${symbol}</div>
        </div>
        <div class="card-face card-front ${cardData.rarity}">
          <div class="card-emoji">${cardData.emoji}</div>
          <div class="card-text">${cardData.text}</div>
          <div class="card-rarity ${cardData.rarity}">${config.label}</div>
        </div>
      </div>
    `;

    card.cardData = cardData;
    card.addEventListener('click', () => this.handleCardClick(card));
    
    return card;
  }

  // 카드 클릭 처리
  handleCardClick(card) {
    // 이미 선택된 카드를 다시 클릭
    if (this.selectedCard === card) {
      if (!this.isFlipped) {
        this.flipCard(card);
      } else {
        this.unflipCard(card);
      }
      return;
    }

    // 다른 카드가 선택되어 있으면 초기화
    if (this.selectedCard) {
      this.selectedCard.classList.remove('selected', 'flipped');
      this.cards.forEach(c => c.classList.remove('hidden'));
    }

    // 새 카드 선택
    this.selectedCard = card;
    this.isFlipped = false;
    
    card.classList.add('selected');
    
    // 다른 카드들 숨기기
    this.cards.forEach(c => {
      if (c !== card) {
        c.classList.add('hidden');
      }
    });

    vibrate(30);
  }

  // 카드 뒤집기
  flipCard(card) {
    // 일일 제한 체크
    if (!collection.canDrawToday()) {
      // 제한 도달 시 콜백으로 알림
      if (this.onDailyLimitReached) {
        this.onDailyLimitReached();
      }
      return;
    }
    
    card.classList.add('flipped');
    this.isFlipped = true;
    
    // 컬렉션에 추가
    const { id, rarity } = card.cardData;
    const isNew = collection.addCard(id, rarity);
    
    // 레어 이상이면 강한 진동
    if (rarity === 'legendary') {
      vibrate([100, 50, 100, 50, 100]);
    } else if (rarity === 'epic') {
      vibrate([80, 40, 80]);
    } else if (rarity === 'rare') {
      vibrate([50, 30, 50]);
    } else {
      vibrate(50);
    }
    
    // 콜백 호출
    if (this.onCardFlip) {
      this.onCardFlip(card.cardData, isNew);
    }
    
    if (this.onStatsUpdate) {
      this.onStatsUpdate(collection.getStats());
    }
  }

  // 카드 다시 덮기
  unflipCard(card) {
    card.classList.remove('flipped');
    this.isFlipped = false;
  }

  // 선택 해제
  deselectCard() {
    if (this.selectedCard) {
      this.selectedCard.classList.remove('selected', 'flipped');
      this.cards.forEach(c => c.classList.remove('hidden'));
      this.selectedCard = null;
      this.isFlipped = false;
    }
  }

  // 현재 선택된 카드 정보
  getSelectedCard() {
    return this.selectedCard?.cardData || null;
  }

  // 카드가 뒤집혀 있는지
  isCardFlipped() {
    return this.isFlipped;
  }

  // 흔들기 감지 설정
  setupShakeDetection(onShake) {
    let lastShake = 0;
    const SHAKE_THRESHOLD = 15;
    const SHAKE_COOLDOWN = 1000; // 1초 쿨다운

    const handleMotion = (event) => {
      const { accelerationIncludingGravity } = event;
      if (!accelerationIncludingGravity) return;

      const { x, y, z } = accelerationIncludingGravity;
      const acceleration = Math.sqrt(x * x + y * y + z * z);

      if (acceleration > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShake > SHAKE_COOLDOWN) {
          lastShake = now;
          vibrate([50, 30, 50]);
          onShake();
        }
      }
    };

    // iOS 13+ 권한 요청 필요
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof DeviceMotionEvent.requestPermission === 'function') {
      // 권한 요청은 사용자 제스처에서 해야 함
      this.requestMotionPermission = async () => {
        try {
          const permission = await DeviceMotionEvent.requestPermission();
          if (permission === 'granted') {
            window.addEventListener('devicemotion', handleMotion);
            return true;
          }
        } catch (e) {
          console.warn('Motion permission denied:', e);
        }
        return false;
      };
    } else {
      // Android 및 기타
      window.addEventListener('devicemotion', handleMotion);
      this.requestMotionPermission = async () => true;
    }
  }
}

// 싱글톤
export const cardManager = new CardManager();