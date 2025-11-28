// 워터마크 유틸리티 함수

/**
 * 이미지에 워터마크를 추가합니다
 */
export const addWatermarkToImage = async (imageUrl: string): Promise<string> => {
  try {
    // fetch를 사용하여 이미지 가져오기 (CORS 우회)
    const response = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // 캔버스 크기를 이미지 크기로 설정
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0);
        
        // 워터마크 스타일 설정
        ctx.fillStyle = 'rgba(124, 34, 200, 0.7)'; // #7C22C8 반투명
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 워터마크 텍스트
        const watermarkText = 'MAKERY';
        
        // 이미지 중앙에 워터마크 추가
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        
        // 텍스트 그림자 효과
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillText(watermarkText, x, y);
        
        // base64로 변환
        const watermarkedUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(blobUrl);
        resolve(watermarkedUrl);
      };
      
      img.onerror = (error) => {
        URL.revokeObjectURL(blobUrl);
        reject(error);
      };
      
      img.src = blobUrl;
    });
  } catch (error) {
    // fetch 실패 시 원본 URL 그대로 반환 (워터마크 없이)
    console.warn('워터마크 추가 실패, 원본 이미지 사용:', error);
    return imageUrl;
  }
};

/**
 * 비디오의 첫 프레임에 워터마크를 추가하여 썸네일을 생성합니다
 */
export const addWatermarkToVideo = async (videoUrl: string): Promise<{ videoUrl: string; thumbnailUrl: string }> => {
  try {
    // fetch를 사용하여 비디오 가져오기 (CORS 우회)
    const response = await fetch(videoUrl, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = blobUrl;
      video.muted = true;
      
      video.onloadedmetadata = () => {
        video.currentTime = 0.1; // 첫 프레임으로 이동
      };
      
      video.oncanplay = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // 캔버스 크기를 비디오 크기로 설정
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // 비디오 프레임 그리기
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 워터마크 스타일 설정
        ctx.fillStyle = 'rgba(124, 34, 200, 0.7)'; // #7C22C8 반투명
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 워터마크 텍스트
        const watermarkText = 'MAKERY';
        
        // 비디오 중앙에 워터마크 추가
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        
        // 텍스트 그림자 효과
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillText(watermarkText, x, y);
        
        // base64로 변환
        const thumbnailUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(blobUrl);
        
        resolve({
          videoUrl: videoUrl, // 원본 비디오 URL (실제로는 비디오 전체에 워터마크를 추가하려면 더 복잡한 처리가 필요)
          thumbnailUrl: thumbnailUrl
        });
      };
      
      video.onerror = (error) => {
        URL.revokeObjectURL(blobUrl);
        reject(error);
      };
      
      video.load();
    });
  } catch (error) {
    // fetch 실패 시 원본 URL 그대로 반환 (워터마크 없이)
    console.warn('워터마크 추가 실패, 원본 비디오 사용:', error);
    return {
      videoUrl: videoUrl,
      thumbnailUrl: videoUrl, // 썸네일도 원본 URL 사용
    };
  }
};

