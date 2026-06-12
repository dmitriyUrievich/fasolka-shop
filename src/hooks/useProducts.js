import { useState, useEffect } from 'react';
import { fetchProductsWithRests, getCatalog } from '../services/konturMarketApi';

export const useProducts = (initialData) => {
    const [products, setProducts] = useState(initialData?.products || []);
    const [catalogGroups, setCatalogGroups] = useState(initialData?.catalog || []);
    const [loading, setLoading] = useState(!initialData);

    useEffect(() => {
        const loadData = async () => {
            if (products.length === 0) {
                setLoading(true);
                try {
                    const fetchedProducts = await fetchProductsWithRests();
                    const fetchedCatalog = await getCatalog();

                    setProducts(fetchedProducts);
                    setCatalogGroups(fetchedCatalog);
                } catch (err) {
                    console.error('Ошибка загрузки данных в хуке:', err);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadData();
    }, [products.length]); // Следим за длиной массива
    return { products, catalogGroups, loading };
};