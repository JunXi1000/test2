import logger from './logger';

// 媒体工具类
const media = {
  // 音频相关
  audio: {
    // 创建音频上下文
    createContext() {
      try {
        return new (window.AudioContext || window.webkitAudioContext)();
      } catch (error) {
        logger.error('Create audio context failed:', error);
        return null;
      }
    },

    // 播放音频
    async play(source, options = {}) {
      try {
        const audio = new Audio(source);
        if (options.volume) audio.volume = options.volume;
        if (options.loop) audio.loop = options.loop;
        if (options.muted) audio.muted = options.muted;
        await audio.play();
        return audio;
      } catch (error) {
        logger.error('Play audio failed:', error);
        throw error;
      }
    },

    // 录制音频
    async record(options = {}) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          ...options
        });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.start();

        return {
          stop: () => {
            return new Promise((resolve) => {
              mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                resolve({ blob: audioBlob, url: audioUrl });
              };
              mediaRecorder.stop();
              stream.getTracks().forEach(track => track.stop());
            });
          },
          pause: () => mediaRecorder.pause(),
          resume: () => mediaRecorder.resume(),
          stream
        };
      } catch (error) {
        logger.error('Record audio failed:', error);
        throw error;
      }
    }
  },

  // 视频相关
  video: {
    // 获取视频流
    async getStream(options = {}) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          ...options
        });
      } catch (error) {
        logger.error('Get video stream failed:', error);
        throw error;
      }
    },

    // 录制视频
    async record(options = {}) {
      try {
        const stream = await this.getStream(options);
        const mediaRecorder = new MediaRecorder(stream);
        const videoChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          videoChunks.push(event.data);
        };

        mediaRecorder.start();

        return {
          stop: () => {
            return new Promise((resolve) => {
              mediaRecorder.onstop = () => {
                const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
                const videoUrl = URL.createObjectURL(videoBlob);
                resolve({ blob: videoBlob, url: videoUrl });
              };
              mediaRecorder.stop();
              stream.getTracks().forEach(track => track.stop());
            });
          },
          pause: () => mediaRecorder.pause(),
          resume: () => mediaRecorder.resume(),
          stream
        };
      } catch (error) {
        logger.error('Record video failed:', error);
        throw error;
      }
    },

    // 截取视频帧
    async captureFrame(videoElement) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        canvas.getContext('2d').drawImage(videoElement, 0, 0);
        return canvas.toDataURL('image/png');
      } catch (error) {
        logger.error('Capture video frame failed:', error);
        throw error;
      }
    }
  },

  // 图片相关
  image: {
    // 加载图片
    load(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    },

    // 压缩图片
    async compress(file, options = {}) {
      try {
        const {
          maxWidth = 800,
          maxHeight = 600,
          quality = 0.8,
          type = 'image/jpeg'
        } = options;

        // 创建图片对象
        const img = await this.load(URL.createObjectURL(file));

        // 计算压缩后的尺寸
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // 创建canvas并绘制图片
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // 转换为Blob
        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, type, quality);
        });

        return {
          blob,
          url: URL.createObjectURL(blob),
          width,
          height
        };
      } catch (error) {
        logger.error('Compress image failed:', error);
        throw error;
      }
    },

    // 裁剪图片
    async crop(file, options = {}) {
      try {
        const {
          x = 0,
          y = 0,
          width,
          height,
          type = 'image/jpeg',
          quality = 0.8
        } = options;

        const img = await this.load(URL.createObjectURL(file));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, type, quality);
        });

        return {
          blob,
          url: URL.createObjectURL(blob),
          width,
          height
        };
      } catch (error) {
        logger.error('Crop image failed:', error);
        throw error;
      }
    }
  },

  // 屏幕录制
  screen: {
    // 录制屏幕
    async record(options = {}) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          ...options
        });

        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        mediaRecorder.ondataavailable = (event) => {
          chunks.push(event.data);
        };

        mediaRecorder.start();

        return {
          stop: () => {
            return new Promise((resolve) => {
              mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                resolve({ blob, url });
              };
              mediaRecorder.stop();
              stream.getTracks().forEach(track => track.stop());
            });
          },
          pause: () => mediaRecorder.pause(),
          resume: () => mediaRecorder.resume(),
          stream
        };
      } catch (error) {
        logger.error('Record screen failed:', error);
        throw error;
      }
    },

    // 截取屏幕
    async capture(options = {}) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          ...options
        });

        const track = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();

        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);

        track.stop();

        return canvas.toDataURL('image/png');
      } catch (error) {
        logger.error('Capture screen failed:', error);
        throw error;
      }
    }
  }
};

export default media;