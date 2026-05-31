export const DISABLE_BUY_TYPES = ['Tobacco'];
export const AGE_RESTRICTED_TYPES = ['Tobacco', 'LightAlcohol', 'Cigarettes'];

export const capitalize = (string) =>
    string ? string.charAt(0).toUpperCase() + string.slice(1) : '';

export const isLighter = (text) => {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return lowerText.includes('зажигалк') || lowerText.includes('зажагк');
};

export const generateSrcSet = (baseSrc, isFallback) => {
    if (!baseSrc || isFallback || baseSrc.includes('fallback')) return null;
    const lastDotIndex = baseSrc.lastIndexOf('.');
    const pathWithoutExt = lastDotIndex === -1 ? baseSrc : baseSrc.slice(0, lastDotIndex);
    const extension = baseSrc.slice(lastDotIndex + 1);
    if (extension !== 'webp') return null;
    return `${pathWithoutExt}-150w.webp 150w, ${pathWithoutExt}-250w.webp 250w`;
};