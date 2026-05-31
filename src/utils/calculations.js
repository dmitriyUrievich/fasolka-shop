export const calculateOrderTotals = (cartItems) => {
    let subtotal = 0;
    let totalWithReserve = 0;

    cartItems.forEach(item => {
        const price = parseFloat(item.sellPricePerUnit.replace(',', '.'));
        const itemTotal = price * item.quantityInCart;
        subtotal += itemTotal;
        totalWithReserve += (item.unit === 'Kilogram') ? itemTotal * 1.15 : itemTotal;
    });

    const deliveryCost = (subtotal > 0 && subtotal < 3000) ? 200 : 0; // упрощенная логика

    return {
        subtotal,
        totalWithReserve,
        deliveryCost,
        finalAmountForPayment: totalWithReserve + deliveryCost
    };
};