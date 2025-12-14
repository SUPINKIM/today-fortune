// 공유 매니저 - 이미지 생성 및 공유
import { RARITY_CONFIG } from './cardData.js';
import { getEmojiImageUrl, loadImage, canUseWebShare, showToast } from './utils.js';

const KAKAO_APP_KEY = '7794c1ce53d83f6a22929d333477108d';
const SITE_URL = 'https://supinkim.github.io/today-fortune/'; // 배포된 사이트 URL로 변경

class ShareManager {
  constructor() {
    this.canShare = canUseWebShare();
    this.kakaoInitialized = false;
    this.initKakao();
  }

  // 카카오 SDK 초기화
  initKakao() {
    if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
      try {
        Kakao.init(KAKAO_APP_KEY);
        this.kakaoInitialized = true;
        console.log('Kakao SDK initialized');
      } catch (e) {
        console.warn('Kakao SDK init failed:', e);
      }
    }
  }

  // 카카오톡 공유
  shareToKakao(cardData, onBonusAdded) {
    if (!this.kakaoInitialized) {
      showToast('카카오 SDK가 초기화되지 않았어요');
      return;
    }

    const { emoji, text, rarity } = cardData;
    const config = RARITY_CONFIG[rarity];
    
    try {
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `${emoji} 오늘의 도파민 카드`,
          description: text,
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
        callback: () => {
          // 공유 성공 시 보너스 콜백 호출
          if (onBonusAdded) {
            onBonusAdded();
          }
        }
      });
      
      showToast('카카오톡으로 공유했어요! 💬');
    } catch (e) {
      console.error('Kakao share error:', e);
      showToast('카카오톡 공유에 실패했어요 😢');
    }
  }

  // 카카오 SDK 사용 가능 여부
  isKakaoAvailable() {
    return this.kakaoInitialized;
  }

  // Canvas로 공유 이미지 생성
  async createShareImage(cardData) {
    const { emoji, text, rarity } = cardData;
    const config = RARITY_CONFIG[rarity];
    
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    // 배경
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGrad.addColorStop(0, '#1e1b4b');
    bgGrad.addColorStop(0.5, '#020617');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // 타이틀
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(165, 180, 252, 0.9)';
    ctx.textAlign = 'center';
    
    try {
      const titleEmojiImg = await loadImage(getEmojiImageUrl('🃏'));
      ctx.drawImage(titleEmojiImg, 540 - 160, 100, 56, 56);
      ctx.fillText(' 오늘의 카드', 540 + 20, 150);
    } catch (e) {
      ctx.fillText('🃏 오늘의 카드', 540, 150);
    }

    // 카드 배경
    const cardX = 240;
    const cardY = 400;
    const cardW = 600;
    const cardH = 840;
    const cardR = 40;

    // 그림자
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 20;

    // 카드 배경 그라데이션
    let cardGrad;
    if (rarity === 'legendary') {
      cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      cardGrad.addColorStop(0, '#fef3c7');
      cardGrad.addColorStop(0.5, '#fbbf24');
      cardGrad.addColorStop(1, '#f59e0b');
    } else {
      cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      cardGrad.addColorStop(0, config.colors.gradient[0]);
      cardGrad.addColorStop(1, config.colors.gradient[1]);
    }

    // 둥근 사각형
    this.drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = cardGrad;
    ctx.fill();

    // 그림자 리셋
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 카드 테두리
    ctx.strokeStyle = config.colors.border;
    ctx.lineWidth = 4;
    ctx.stroke();

    // 레전더리 글로우 효과
    if (rarity === 'legendary') {
      ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
      ctx.shadowBlur = 40;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // 이모지
    try {
      const emojiImg = await loadImage(getEmojiImageUrl(emoji));
      const emojiSize = 160;
      ctx.drawImage(emojiImg, 540 - emojiSize/2, 550, emojiSize, emojiSize);
    } catch (e) {
      ctx.font = '160px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(emoji, 540, 630);
    }

    // 텍스트
    ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    
    // 줄바꿈 처리
    const maxWidth = 480;
    const lineHeight = 58;
    const words = text.split(' ');
    let line = '';
    let y = 760;
    let lastY = y;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), 540, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), 540, y);
    lastY = y + lineHeight;

    // 레어리티 배지
    const badgeText = config.label;
    ctx.font = 'bold 28px system-ui';
    const textWidth = ctx.measureText(badgeText.replace(/[^\w\s]/g, '')).width + 40;
    const badgeWidth = textWidth + 60;
    const badgeX = 540 - badgeWidth / 2;
    const badgeY = lastY + 30;
    
    ctx.fillStyle = config.colors.badge;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, 50, 25);
    ctx.fill();
    
    ctx.fillStyle = config.colors.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, 540, badgeY + 25);

    // 워터마크
    ctx.font = '32px system-ui';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.fillText('@dopamine_card', 540, 1800);

    return canvas;
  }

  // 둥근 사각형 그리기 헬퍼
  drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // 공유 또는 저장
  async share(cardData) {
    try {
      const canvas = await this.createShareImage(cardData);
      const { emoji, text } = cardData;

      // Web Share API 지원 시
      if (this.canShare) {
        try {
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          const file = new File([blob], 'dopamine-card.png', { type: 'image/png' });
          
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: '오늘의 도파민 카드',
              text: `${emoji} ${text}\n\n#도파민카드 #오늘의운세`
            });
            showToast('공유 완료! 🎉');
            return true;
          }
        } catch (e) {
          if (e.name === 'AbortError') {
            return false; // 사용자 취소
          }
          console.log('Share failed, falling back to download');
        }
      }

      // 다운로드
      const link = document.createElement('a');
      link.download = `dopamine-card-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('✅ 이미지가 저장되었습니다!');
      return true;
      
    } catch (error) {
      console.error('Share error:', error);
      showToast('이미지 생성에 실패했어요 😢');
      return false;
    }
  }

  // 공유 버튼 텍스트
  getButtonText() {
    return this.canShare ? '📤 공유하기' : '📸 저장하기';
  }
}

export const shareManager = new ShareManager();