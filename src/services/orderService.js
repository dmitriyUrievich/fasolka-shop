
//orderService.js
import { generateDailyOrderId } from '../utils/orderUtils';
import { calculateOrderTotals } from '../utils/orderUtils';

export const createPayment = async (orderData) => {
    const response = await fetch(`/api/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Ошибка сервера' }));
        throw new Error(errorData.message || 'Ошибка сети');
    }

    const data = await response.json();
    return data?.payment?.confirmation?.confirmation_url;
};

export const prepareOrderData = (customerData, cartItems) => {
    const { subtotal, totalWithReserve, deliveryCost, finalAmountForPayment } = calculateOrderTotals(cartItems);

    return {
        id: generateDailyOrderId(),
        customer_name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        comment: customerData.comment,
        deliveryTime: customerData.deliveryTime,
        subtotal: parseFloat(subtotal.toFixed(2)),
        totalWithReserve: parseFloat(totalWithReserve.toFixed(2)),
        amountToPay: parseFloat(finalAmountForPayment.toFixed(2)),
        deliveryCost: deliveryCost,
        cart: cartItems.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantityInCart,
            price: item.sellPricePerUnit,
            unit: item.unit,
        })),
    };
};