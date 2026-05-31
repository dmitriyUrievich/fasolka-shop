// src/utils/imageUtils.js
const imageFormats = ['webp', 'jpg', 'jpeg'];
const FALLBACK_IMAGE_URL = '/img/fallback.webp';
const imageCache = {};

export function getFallbackImageUrl(name) {
  return FALLBACK_IMAGE_URL;
}

export function createImageLoader(id, name = '') {
  // Защита от null/undefined id
  const safeId = id ?? 'unknown';

  if (!imageCache[safeId]) {
    imageCache[safeId] = {
      formatIndex: 0,
      fallback: false,
    };
  }

  const state = imageCache[safeId];

  function getCurrentUrl() {
    if (state.fallback) {
      return getFallbackImageUrl(name);
    }
    return `/img/${safeId}.${imageFormats[state.formatIndex]}`;
  }

  function handleImageError() {
    if (state.formatIndex < imageFormats.length - 1) {
      state.formatIndex += 1;
      return true; // Есть форматы — пробуем
    } else {
      state.fallback = true;
      return false; // нет форматов — переходим на fallback
    }
  }

  function isFallback() {
    return state.fallback;
  }

  return {
    getCurrentUrl,
    handleImageError,
    isFallback,
  };
}
