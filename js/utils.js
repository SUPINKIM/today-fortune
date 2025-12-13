// 유틸리티 함수들

// 토스트 메시지 표시
export function showToast(message, duration = 2500) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

// 이모지를 Twemoji 이미지 URL로 변환
export function getEmojiImageUrl(emoji) {
  const codePoints = [...emoji]
    .map(char => char.codePointAt(0).toString(16))
    .join("-");
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoints}.png`;
}

// 이미지 로드 Promise
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}

// Web Share API 지원 여부
export function canUseWebShare() {
  return !!(navigator.share && navigator.canShare);
}

// 날짜 포맷팅
export function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 랜덤 배열 요소 선택
export function randomPick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// 가중치 기반 랜덤 선택
export function weightedRandomPick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let random = Math.random() * total;
  
  for (const [key, weight] of entries) {
    random -= weight;
    if (random <= 0) return key;
  }
  
  return entries[0][0];
}

// DOM 요소 생성 헬퍼
export function createElement(tag, className, innerHTML = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (innerHTML) el.innerHTML = innerHTML;
  return el;
}

// 숫자 애니메이션
export function animateNumber(element, start, end, duration = 500) {
  const startTime = performance.now();
  
  const update = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * easeOut);
    
    element.textContent = current;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  };
  
  requestAnimationFrame(update);
}

// 진동 피드백 (지원 시)
export function vibrate(pattern = 50) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// 로컬 스토리지 안전하게 접근
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn('localStorage get error:', e);
      return defaultValue;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('localStorage set error:', e);
      return false;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('localStorage remove error:', e);
      return false;
    }
  }
};
