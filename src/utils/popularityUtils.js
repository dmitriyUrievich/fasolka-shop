// src/utils/popularityUtils.js
export const calculatePopularityMap = (cheques) => {
    console.log('Популярность рассчитывается для чеков:', cheques?.length);
    if (!Array.isArray(cheques)) return {};

    return cheques.reduce((acc, cheque) => {
        const coeff = cheque.IsRefund ? -1 : 1; // Вычитаем, если возврат

        cheque.Lines?.forEach(line => {
            console.log('[line.ProductId]',line)
            if (line.ProductId) {
                const currentCount = acc[line.ProductId] || 0;
                acc[line.ProductId] = currentCount + (line.Count * coeff);
            }
        });

        return acc;
    }, {});
};