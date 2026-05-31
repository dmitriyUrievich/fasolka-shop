import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

export const useProducts = (initialData) => {
    const [products, setProducts] = useState(initialData?.products || []);
    const [catalogGroups, setCatalogGroups] = useState(initialData?.catalog || []);
    const [loading, setLoading] = useState(!initialData);

    useEffect(() => {
        if (initialData) return;
        const loadData = async () => {
            try {
                const response = await fetch('/api/products-data');
                const data = await response.json();
                setProducts(data.products || []);
                setCatalogGroups(data.catalog || []);
            } catch (err) {
                Swal.fire({ title: 'Ошибка', text: 'Не удалось загрузить каталог.', icon: 'error' });
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [initialData]);

    return { products, catalogGroups, loading };
};