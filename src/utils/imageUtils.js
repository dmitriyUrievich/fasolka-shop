// src/utils/imageUtils.js

const imageFormats = ['webp', 'jpg', 'jpeg'];

const FALLBACK_IMAGE_URL = '/img/fallback.webp';

const imageCache = {};

export function getFallbackImageUrl(name) {
  // Можно игнорировать `name`, так как у нас одно дефолтное фото
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
      return true; // Есть ещё форматы — пробуем
    } else {
      state.fallback = true;
      return false; // Больше нет форматов — переходим на fallback
    }
  }

  function reset() {
    state.formatIndex = 0;
    state.fallback = false;
  }

  function isFallback() {
    return state.fallback;
  }

  return {
    getCurrentUrl,
    handleImageError,
    reset,
    isFallback,
  };
}

export function clearImageCache() {
  Object.keys(imageCache).forEach(key => delete imageCache[key]);
}