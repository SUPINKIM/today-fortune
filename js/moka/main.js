// 심야 카페 - 모카 메인 스크립트
import { RARITY_CONFIG, pickRandomCard, ALL_CARDS_MAP, TOTAL_CARD_COUNT, CARD_COUNTS, getCardsByRarity } from '../cardData.js';
import { getGreeting, getRandomDialogue, getCardReaction, getTimeOfDay } from './dialogue.js';
import { storage, formatDate, showToast } from '../utils.js';

// 상수
const STORAGE_KEY = 'dopamine_card_collection';
const STATS_KEY = 'dopamine_card_stats';
const DAILY_KEY = 'dopamine_card_daily';
const DAILY_LIMIT = 3;
const SHARE_BONUS = 1;

// 카카오 SDK 설정
const KAKAO_APP_KEY = '7794c1ce53d83f6a22929d333477108d';
const SITE_URL = 'https://supinkim.github.io/today-fortune/'; // 배포된 사이트 URL로 변경

class MokaCafe {
  constructor() {
    this.chatContainer = document.getElementById('chat-container');
    this.drawBtn = document.getElementById('draw-btn');
    this.inputArea = document.getElementById('input-area');
    this.collectionBtn = document.getElementById('collection-btn');
    this.cafeTime = document.getElementById('cafe-time');
    
    this.collection = storage.get(STORAGE_KEY, {});
    this.stats = storage.get(STATS_KEY, { totalDraws: 0, common: 0, rare: 0, epic: 0, legendary: 0 });
    this.daily = this.loadDaily();
    this.currentCard = null;
    this.isAnimating = false;
    
    this.init();
  }

  init() {
    this.initKakao();
    this.updateCafeTime();
    this.updateCollectionStats();
    this.bindEvents();
    
    // 시작 인사
    setTimeout(() => {
      this.addMokaMessage(getGreeting());
      setTimeout(() => {
        this.addMokaMessage(getRandomDialogue('promptDraw'));
      }, 1200);
    }, 500);

    // 1분마다 시간 업데이트
    setInterval(() => this.updateCafeTime(), 60000);
  }

  initKakao() {
    if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
      try {
        Kakao.init(KAKAO_APP_KEY);
      } catch (e) {
        console.warn('Kakao SDK init failed:', e);
      }
    }
  }

  loadDaily() {
    const today = new Date().toDateString();
    const saved = storage.get(DAILY_KEY, { date: '', count: 0, shared: false });
    
    // 날짜가 바뀌었으면 리셋 후 저장
    if (saved.date !== today) {
      const newDaily = { date: today, count: 0, shared: false };
      storage.set(DAILY_KEY, newDaily);
      return newDaily;
    }
    return saved;
  }

  saveDaily() {
    storage.set(DAILY_KEY, this.daily);
  }

  // 날짜 체크 및 리셋 (앱 사용 중 자정 넘었을 때 대비)
  checkAndResetDaily() {
    const today = new Date().toDateString();
    if (this.daily.date !== today) {
      this.daily = { date: today, count: 0, shared: false };
      this.saveDaily();
      return true;
    }
    return false;
  }

  canDrawToday() {
    this.checkAndResetDaily();
    const totalLimit = DAILY_LIMIT + (this.daily.shared ? SHARE_BONUS : 0);
    return this.daily.count < totalLimit;
  }

  getRemainingDraws() {
    this.checkAndResetDaily();
    const totalLimit = DAILY_LIMIT + (this.daily.shared ? SHARE_BONUS : 0);
    return Math.max(0, totalLimit - this.daily.count);
  }

  canGetShareBonus() {
    this.checkAndResetDaily();
    return !this.daily.shared;
  }

  updateCafeTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    let timeOfDay;
    if (hours >= 0 && hours < 6) timeOfDay = '새벽';
    else if (hours < 12) timeOfDay = '오전';
    else if (hours < 18) timeOfDay = '오후';
    else if (hours < 21) timeOfDay = '저녁';
    else timeOfDay = '밤';
    
    this.cafeTime.textContent = `${timeOfDay} ${hours}:${minutes}`;
  }

  bindEvents() {
    this.drawBtn.addEventListener('click', () => this.handleDraw());
    this.collectionBtn.addEventListener('click', () => this.showCollection());
  }

  // 메시지 추가 함수들
  addMokaMessage(text, delay = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        // 타이핑 인디케이터 추가
        const typingEl = this.addTypingIndicator();
        
        // 타이핑 후 메시지 표시
        setTimeout(() => {
          typingEl.remove();
          
          const messageEl = document.createElement('div');
          messageEl.className = 'message moka';
          messageEl.innerHTML = `
            <div class="moka-avatar">🐱</div>
            <div class="bubble">${text}</div>
          `;
          this.chatContainer.appendChild(messageEl);
          this.scrollToBottom();
          resolve();
        }, 800 + Math.random() * 400);
      }, delay);
    });
  }

  addTypingIndicator() {
    const typingEl = document.createElement('div');
    typingEl.className = 'message moka';
    typingEl.innerHTML = `
      <div class="moka-avatar">🐱</div>
      <div class="bubble typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    this.chatContainer.appendChild(typingEl);
    this.scrollToBottom();
    return typingEl;
  }

  addUserMessage(text) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message user';
    messageEl.innerHTML = `<div class="bubble">${text}</div>`;
    this.chatContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  addSystemMessage(text) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message system';
    messageEl.innerHTML = `<div class="bubble">${text}</div>`;
    this.chatContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  addCardMessage(cardData) {
    const config = RARITY_CONFIG[cardData.rarity];
    
    const cardEl = document.createElement('div');
    cardEl.className = 'card-message';
    cardEl.innerHTML = `
      <div class="chat-card" id="current-card">
        <div class="chat-card-inner">
          <div class="chat-card-face chat-card-back"></div>
          <div class="chat-card-face chat-card-front ${cardData.rarity}">
            <div class="chat-card-emoji">${cardData.emoji}</div>
            <div class="chat-card-text">${cardData.text}</div>
            <div class="chat-card-rarity ${cardData.rarity}">${config.label}</div>
          </div>
        </div>
      </div>
    `;
    
    this.chatContainer.appendChild(cardEl);
    this.scrollToBottom();
    
    // 카드 클릭 이벤트
    const card = cardEl.querySelector('.chat-card');
    card.addEventListener('click', () => this.flipCard(card, cardData));
    
    return cardEl;
  }

  addCardActions(cardData) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'card-actions';
    actionsEl.innerHTML = `
      <button class="btn-card-action kakao" id="action-kakao">
        <img src="https://developers.kakao.com/assets/img/about/logos/kakaotalksharing/kakaotalk_sharing_btn_small.png" alt="카카오" />
        공유
      </button>
      <button class="btn-card-action save" id="action-again">
        ☕ 다시 뽑기
      </button>
    `;
    
    // 마지막 card-message에 추가
    const lastCardMessage = this.chatContainer.querySelector('.card-message:last-child');
    if (lastCardMessage) {
      lastCardMessage.appendChild(actionsEl);
    }
    
    // 이벤트 바인딩
    actionsEl.querySelector('#action-kakao').addEventListener('click', () => {
      this.shareToKakao(cardData);
    });
    
    actionsEl.querySelector('#action-again').addEventListener('click', () => {
      this.handleDraw();
    });
    
    this.scrollToBottom();
  }

  scrollToBottom() {
    setTimeout(() => {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }, 50);
  }

  // 카드 뽑기 로직
  async handleDraw() {
    if (this.isAnimating) return;
    
    if (!this.canDrawToday()) {
      await this.addMokaMessage(getRandomDialogue('noMoreDraws'));
      return;
    }
    
    this.isAnimating = true;
    this.drawBtn.disabled = true;
    
    // 유저 액션 표시
    this.addUserMessage('카드 뽑기');
    
    // 모카 반응
    await this.addMokaMessage(getRandomDialogue('cardSelected'));
    
    // 카드 뽑기
    const cardData = pickRandomCard();
    this.currentCard = cardData;
    
    // 카드 표시
    setTimeout(() => {
      this.addCardMessage(cardData);
      this.isAnimating = false;
      this.drawBtn.disabled = false;
    }, 500);
  }

  async flipCard(cardEl, cardData) {
    if (cardEl.classList.contains('flipped')) return;
    
    // 횟수 차감
    this.daily.count++;
    this.saveDaily();
    
    // 카드 뒤집기
    cardEl.classList.add('flipped');
    
    // 컬렉션에 추가
    this.addToCollection(cardData);
    
    // 통계 업데이트
    this.stats.totalDraws++;
    this.stats[cardData.rarity]++;
    storage.set(STATS_KEY, this.stats);
    this.updateCollectionStats();
    
    // 모카 반응
    const reaction = getCardReaction(cardData.rarity);
    
    setTimeout(async () => {
      await this.addMokaMessage(reaction.revealed);
      
      setTimeout(async () => {
        await this.addMokaMessage(reaction.comment);
        
        // 액션 버튼 추가
        setTimeout(() => {
          this.addCardActions(cardData);
          
          // 남은 횟수 안내
          const remaining = this.getRemainingDraws();
          if (remaining > 0) {
            this.addSystemMessage(`오늘 ${remaining}회 더 뽑을 수 있어요`);
          } else {
            this.addSystemMessage('오늘은 여기까지예요. 내일 또 와요!');
          }
        }, 500);
      }, 1000);
    }, 800);
  }

  addToCollection(cardData) {
    const id = cardData.id;
    const now = Date.now();
    
    if (!this.collection[id]) {
      this.collection[id] = {
        firstDrawn: now,
        count: 0,
        lastDrawn: now
      };
    }
    
    this.collection[id].count++;
    this.collection[id].lastDrawn = now;
    
    storage.set(STORAGE_KEY, this.collection);
  }

  // 카카오 공유
  shareToKakao(cardData) {
    if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) {
      showToast('카카오 SDK가 초기화되지 않았어요');
      return;
    }

    const config = RARITY_CONFIG[cardData.rarity];
    
    // 공유 보너스 먼저 처리 (callback이 모바일에서 안 불리는 문제 해결)
    const canGetBonus = this.canGetShareBonus();
    if (canGetBonus) {
      this.daily.shared = true;
      this.saveDaily();
    }

    try {
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `${cardData.emoji} 심야 카페의 오늘의 카드`,
          description: cardData.text,
          imageUrl: `${SITE_URL}/og-image.png`,
          link: {
            mobileWebUrl: SITE_URL,
            webUrl: SITE_URL,
          },
        },
        itemContent: {
          profileText: `${config.name} 등급`,
        },
        buttons: [
          {
            title: '나도 뽑아보기',
            link: {
              mobileWebUrl: SITE_URL,
              webUrl: SITE_URL,
            },
          },
        ],
      });
      
      // 보너스 받았으면 알림
      if (canGetBonus) {
        showToast('🎁 공유 보너스! 뽑기 +1회 추가!');
      } else {
        showToast('카카오톡으로 공유했어요! 💬');
      }
    } catch (e) {
      console.error('Kakao share error:', e);
      showToast('카카오톡 공유에 실패했어요');
    }
  }

  // 컬렉션 관련
  updateCollectionStats() {
    const owned = Object.keys(this.collection).length;
    document.getElementById('stat-owned').textContent = owned;
    document.getElementById('stat-total').textContent = TOTAL_CARD_COUNT;
    
    // 새 카드 배지
    const newBadge = document.getElementById('new-badge');
    // 간단히 최근 추가된 카드가 있으면 표시
    const hasNew = Object.values(this.collection).some(c => 
      Date.now() - c.lastDrawn < 60000
    );
    newBadge.classList.toggle('hidden', !hasNew);
  }

  showCollection() {
    const owned = Object.keys(this.collection).length;
    const percent = Math.round((owned / TOTAL_CARD_COUNT) * 100);
    
    const modal = document.createElement('div');
    modal.className = 'collection-modal';
    modal.innerHTML = `
      <div class="collection-content">
        <div class="collection-header">
          <h2>☕ 카드 컬렉션</h2>
          <button class="collection-close">✕</button>
        </div>
        
        <div class="collection-stats">
          <div class="stat-main">
            <span class="stat-number">${owned}</span>
            <span class="stat-total">/ ${TOTAL_CARD_COUNT}</span>
          </div>
          <div class="stat-percent">${percent}% 수집</div>
          <div class="stat-draws">총 ${this.stats.totalDraws}회 뽑기</div>
        </div>
        
        <div class="collection-progress">
          ${this.renderProgressBars()}
        </div>
        
        <div class="collection-tabs">
          <button class="tab-btn active" data-rarity="all">전체</button>
          <button class="tab-btn" data-rarity="common">Common</button>
          <button class="tab-btn" data-rarity="rare">Rare</button>
          <button class="tab-btn" data-rarity="epic">Epic</button>
          <button class="tab-btn" data-rarity="legendary">Legendary</button>
        </div>
        
        <div class="collection-grid" id="collection-grid">
          ${this.renderCollectionCards('all')}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));
    
    // 이벤트
    modal.querySelector('.collection-close').addEventListener('click', () => {
      this.closeModal(modal);
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal(modal);
    });
    
    // 탭 전환
    modal.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const rarity = btn.dataset.rarity;
        document.getElementById('collection-grid').innerHTML = this.renderCollectionCards(rarity);
        this.bindCardDetailEvents(modal);
      });
    });
    
    this.bindCardDetailEvents(modal);
  }

  renderProgressBars() {
    const rarities = ['common', 'rare', 'epic', 'legendary'];
    return rarities.map(rarity => {
      const config = RARITY_CONFIG[rarity];
      const total = CARD_COUNTS[rarity];
      const owned = getCardsByRarity(rarity).filter(c => this.collection[c.id]).length;
      const percent = Math.round((owned / total) * 100);
      
      return `
        <div class="progress-row">
          <span class="progress-label" style="color: ${config.colors.text}">${config.name}</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percent}%; background: ${config.colors.badge}"></div>
          </div>
          <span class="progress-count">${owned}/${total}</span>
        </div>
      `;
    }).join('');
  }

  renderCollectionCards(filter) {
    const rarities = filter === 'all' ? ['legendary', 'epic', 'rare', 'common'] : [filter];
    
    return rarities.map(rarity => {
      const config = RARITY_CONFIG[rarity];
      const cards = getCardsByRarity(rarity);
      
      const cardsHtml = cards.map(card => {
        const isOwned = !!this.collection[card.id];
        const count = this.collection[card.id]?.count || 0;
        
        return `
          <div class="collection-card ${isOwned ? 'owned' : 'locked'} ${rarity}" 
               data-card-id="${card.id}" 
               ${isOwned ? '' : 'title="미획득"'}>
            <div class="card-emoji">${card.emoji}</div>
            ${isOwned && count > 1 ? `<div class="card-count">×${count}</div>` : ''}
          </div>
        `;
      }).join('');
      
      if (filter === 'all') {
        return `
          <div class="rarity-section">
            <div class="rarity-title" style="color: ${config.colors.text}">${config.name}</div>
          </div>
          ${cardsHtml}
        `;
      }
      return cardsHtml;
    }).join('');
  }

  bindCardDetailEvents(modal) {
    modal.querySelectorAll('.collection-card.owned').forEach(card => {
      card.addEventListener('click', () => {
        const cardId = card.dataset.cardId;
        this.showCardDetail(cardId);
      });
    });
  }

  showCardDetail(cardId) {
    const cardInfo = ALL_CARDS_MAP.get(cardId);
    if (!cardInfo) return;
    
    const collectionData = this.collection[cardId];
    const config = RARITY_CONFIG[cardInfo.rarity];
    
    const modal = document.createElement('div');
    modal.className = 'card-detail-modal';
    modal.innerHTML = `
      <div class="card-detail-backdrop"></div>
      <div class="card-detail-content ${cardInfo.rarity}">
        <div class="card-detail-emoji">${cardInfo.emoji}</div>
        <div class="card-detail-text">${cardInfo.text}</div>
        <div class="card-detail-rarity" style="background: ${config.colors.badge}; color: ${config.colors.text}">
          ${config.label}
        </div>
        <div class="card-detail-stats">
          <span>🎴 ${collectionData.count}회 획득</span>
          <span>📅 ${formatDate(collectionData.firstDrawn)}</span>
        </div>
        <div class="card-detail-buttons">
          <button class="card-detail-kakao">
            <img src="https://developers.kakao.com/assets/img/about/logos/kakaotalksharing/kakaotalk_sharing_btn_small.png" alt="카카오" width="18" height="18">
            카톡 공유
          </button>
          <button class="card-detail-close">닫기</button>
        </div>
      </div>
    `;
    
    const closeModal = () => {
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 200);
    };
    
    modal.querySelector('.card-detail-backdrop').addEventListener('click', closeModal);
    modal.querySelector('.card-detail-close').addEventListener('click', closeModal);
    modal.querySelector('.card-detail-kakao').addEventListener('click', () => {
      this.shareToKakao({ ...cardInfo, rarity: cardInfo.rarity });
    });
    
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));
  }

  closeModal(modal) {
    modal.classList.add('closing');
    setTimeout(() => modal.remove(), 300);
  }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
  new MokaCafe();
});