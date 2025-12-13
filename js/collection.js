// 컬렉션 관리 모듈
import { storage, formatDate } from './utils.js';
import { ALL_CARDS_MAP, TOTAL_CARD_COUNT, CARD_COUNTS, RARITY_CONFIG, getCardsByRarity } from './cardData.js';

const STORAGE_KEY = 'dopamine_card_collection';
const STATS_KEY = 'dopamine_card_stats';
const DAILY_KEY = 'dopamine_card_daily';

const DAILY_LIMIT = 3; // 하루 최대 뽑기 횟수

// 컬렉션 데이터 구조
// { cardId: { firstDrawn: timestamp, count: number, lastDrawn: timestamp } }

class Collection {
  constructor() {
    this.data = storage.get(STORAGE_KEY, {});
    this.stats = storage.get(STATS_KEY, {
      totalDraws: 0,
      draws: { common: 0, rare: 0, epic: 0, legendary: 0 }
    });
    this.daily = this.loadDaily();
  }

  // 일일 데이터 로드 (날짜 체크)
  loadDaily() {
    const today = new Date().toDateString();
    const saved = storage.get(DAILY_KEY, { date: '', count: 0 });
    
    // 날짜가 바뀌었으면 리셋
    if (saved.date !== today) {
      return { date: today, count: 0 };
    }
    return saved;
  }

  // 일일 데이터 저장
  saveDaily() {
    storage.set(DAILY_KEY, this.daily);
  }

  // 오늘 뽑기 가능 여부
  canDrawToday() {
    // 날짜 체크 (혹시 자정 넘었을 수 있으니)
    const today = new Date().toDateString();
    if (this.daily.date !== today) {
      this.daily = { date: today, count: 0 };
    }
    return this.daily.count < DAILY_LIMIT;
  }

  // 오늘 남은 횟수
  getRemainingDraws() {
    const today = new Date().toDateString();
    if (this.daily.date !== today) {
      return DAILY_LIMIT;
    }
    return Math.max(0, DAILY_LIMIT - this.daily.count);
  }

  // 일일 뽑기 횟수 증가
  incrementDailyCount() {
    const today = new Date().toDateString();
    if (this.daily.date !== today) {
      this.daily = { date: today, count: 0 };
    }
    this.daily.count++;
    this.saveDaily();
  }

  // 카드 획득 기록
  addCard(cardId, rarity) {
    const now = Date.now();
    
    if (this.data[cardId]) {
      this.data[cardId].count++;
      this.data[cardId].lastDrawn = now;
    } else {
      this.data[cardId] = {
        firstDrawn: now,
        count: 1,
        lastDrawn: now
      };
    }
    
    // 통계 업데이트
    this.stats.totalDraws++;
    this.stats.draws[rarity]++;
    
    this.save();
    
    return !this.data[cardId] || this.data[cardId].count === 1; // 새 카드 여부
  }

  // 저장
  save() {
    storage.set(STORAGE_KEY, this.data);
    storage.set(STATS_KEY, this.stats);
  }

  // 카드 보유 여부
  hasCard(cardId) {
    return !!this.data[cardId];
  }

  // 카드 정보 가져오기
  getCardData(cardId) {
    return this.data[cardId] || null;
  }

  // 보유 카드 수
  getOwnedCount() {
    return Object.keys(this.data).length;
  }

  // 레어리티별 보유 카드 수
  getOwnedCountByRarity(rarity) {
    let count = 0;
    const rarityCards = getCardsByRarity(rarity);
    
    for (const card of rarityCards) {
      if (this.data[card.id]) count++;
    }
    
    return count;
  }

  // 전체 통계
  getStats() {
    return {
      ...this.stats,
      owned: this.getOwnedCount(),
      total: TOTAL_CARD_COUNT,
      percentage: Math.round((this.getOwnedCount() / TOTAL_CARD_COUNT) * 100),
      byRarity: {
        common: { owned: this.getOwnedCountByRarity('common'), total: CARD_COUNTS.common },
        rare: { owned: this.getOwnedCountByRarity('rare'), total: CARD_COUNTS.rare },
        epic: { owned: this.getOwnedCountByRarity('epic'), total: CARD_COUNTS.epic },
        legendary: { owned: this.getOwnedCountByRarity('legendary'), total: CARD_COUNTS.legendary }
      }
    };
  }

  // 컬렉션 데이터 전체 가져오기 (표시용)
  getCollectionDisplay() {
    const result = {
      common: [],
      rare: [],
      epic: [],
      legendary: []
    };
    
    for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
      const cards = getCardsByRarity(rarity);
      
      for (const card of cards) {
        const owned = this.data[card.id];
        result[rarity].push({
          ...card,
          rarity,
          owned: !!owned,
          count: owned?.count || 0,
          firstDrawn: owned?.firstDrawn || null
        });
      }
    }
    
    return result;
  }

  // 최근 획득 카드
  getRecentCards(limit = 10) {
    const entries = Object.entries(this.data)
      .map(([id, data]) => ({
        id,
        ...data,
        card: ALL_CARDS_MAP.get(id)
      }))
      .filter(entry => entry.card)
      .sort((a, b) => b.lastDrawn - a.lastDrawn)
      .slice(0, limit);
    
    return entries;
  }

  // 초기화 (디버그용)
  reset() {
    this.data = {};
    this.stats = {
      totalDraws: 0,
      draws: { common: 0, rare: 0, epic: 0, legendary: 0 }
    };
    this.save();
  }
}

// 싱글톤 인스턴스
export const collection = new Collection();

// 컬렉션 UI 렌더링
export function renderCollectionModal() {
  const stats = collection.getStats();
  const collectionData = collection.getCollectionDisplay();
  
  const modal = document.createElement('div');
  modal.className = 'collection-modal';
  modal.innerHTML = `
    <div class="collection-content">
      <div class="collection-header">
        <h2>📚 내 컬렉션</h2>
        <button class="collection-close" aria-label="닫기">✕</button>
      </div>
      
      <div class="collection-stats">
        <div class="stat-main">
          <span class="stat-number">${stats.owned}</span>
          <span class="stat-total">/ ${stats.total}</span>
          <span class="stat-percent">(${stats.percentage}%)</span>
        </div>
        <div class="stat-draws">총 ${stats.totalDraws}회 뽑기</div>
      </div>
      
      <div class="collection-progress">
        ${['legendary', 'epic', 'rare', 'common'].map(rarity => {
          const r = stats.byRarity[rarity];
          const config = RARITY_CONFIG[rarity];
          return `
            <div class="progress-row">
              <span class="progress-label" style="color: ${config.colors.text}">${config.name}</span>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${(r.owned / r.total) * 100}%; background: ${config.colors.text}"></div>
              </div>
              <span class="progress-count">${r.owned}/${r.total}</span>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="collection-tabs">
        <button class="tab-btn active" data-rarity="all">전체</button>
        <button class="tab-btn" data-rarity="legendary">🌟</button>
        <button class="tab-btn" data-rarity="epic">💎</button>
        <button class="tab-btn" data-rarity="rare">⭐</button>
        <button class="tab-btn" data-rarity="common">📋</button>
      </div>
      
      <div class="collection-grid" id="collection-grid">
        ${renderCollectionCards(collectionData, 'all')}
      </div>
    </div>
  `;
  
  // 이벤트 바인딩
  modal.querySelector('.collection-close').addEventListener('click', () => {
    modal.classList.add('closing');
    setTimeout(() => modal.remove(), 300);
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 300);
    }
  });
  
  // 탭 전환
  modal.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const rarity = btn.dataset.rarity;
      document.getElementById('collection-grid').innerHTML = renderCollectionCards(collectionData, rarity);
      bindCardClickEvents();
    });
  });
  
  // 카드 클릭 이벤트 바인딩
  function bindCardClickEvents() {
    modal.querySelectorAll('.collection-card.owned').forEach(card => {
      card.addEventListener('click', () => {
        const cardId = card.dataset.cardId;
        if (cardId) {
          renderCardDetailModal(cardId);
        }
      });
    });
  }
  
  bindCardClickEvents();
  
  document.body.appendChild(modal);
  
  // 애니메이션
  requestAnimationFrame(() => modal.classList.add('open'));
}

function renderCollectionCards(data, filter) {
  const rarities = filter === 'all' 
    ? ['legendary', 'epic', 'rare', 'common'] 
    : [filter];
  
  let html = '';
  
  for (const rarity of rarities) {
    const cards = data[rarity];
    const config = RARITY_CONFIG[rarity];
    
    if (filter === 'all') {
      html += `<div class="rarity-section">
        <h3 class="rarity-title" style="color: ${config.colors.text}">${config.name}</h3>
      </div>`;
    }
    
    for (const card of cards) {
      html += `
        <div class="collection-card ${card.owned ? 'owned' : 'locked'} ${rarity}" 
             ${card.owned ? `data-card-id="${card.id}"` : ''}>
          <div class="card-emoji">${card.owned ? card.emoji : '?'}</div>
          ${card.owned ? `
            <div class="card-count">×${card.count}</div>
          ` : ''}
        </div>
      `;
    }
  }
  
  return html;
}

// 카드 상세 모달 렌더링
function renderCardDetailModal(cardId) {
  const cardInfo = ALL_CARDS_MAP.get(cardId);
  if (!cardInfo) return;
  
  const collectionData = collection.getCardData(cardId);
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
      <button class="card-detail-close">닫기</button>
    </div>
  `;
  
  // 닫기 이벤트
  modal.querySelector('.card-detail-backdrop').addEventListener('click', () => {
    modal.classList.add('closing');
    setTimeout(() => modal.remove(), 200);
  });
  
  modal.querySelector('.card-detail-close').addEventListener('click', () => {
    modal.classList.add('closing');
    setTimeout(() => modal.remove(), 200);
  });
  
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));
}