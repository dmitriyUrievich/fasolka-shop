import { useState, useRef, useEffect, useCallback } from 'react';
import { createImageLoader } from '../utils/imageUtils';

export function useProductImage(id, rawName) {
    const [isFallbackState, setIsFallbackState] = useState(false);
    const [imageSrc, setImageSrc] = useState('/img/fallback.webp');
    const imageLoaderRef = useRef(null);

    useEffect(() => {
        const hasValidId = id != null && id !== 'undefined' && id !== '';
        if (!hasValidId) {
            imageLoaderRef.current = {
                getCurrentUrl: () => '/img/fallback.webp',
                handleImageError: () => false,
                isFallback: () => true
            };
            setIsFallbackState(true);
        } else {
            const loader = createImageLoader(id, rawName);
            imageLoaderRef.current = loader;
            setIsFallbackState(loader.isFallback());
        }
        setImageSrc(imageLoaderRef.current.getCurrentUrl());
    }, [id, rawName]);

    const onImageError = useCallback(() => {
        const loader = imageLoaderRef.current;
        if (loader?.handleImageError) {
            loader.handleImageError();
            setIsFallbackState(loader.isFallback() || loader.state?.formatIndex > 0);
            setImageSrc(loader.getCurrentUrl());
        }
    }, []);

    return { imageSrc, isFallbackState, onImageError };
}