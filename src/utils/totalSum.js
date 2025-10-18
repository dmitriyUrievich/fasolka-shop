const totalSum = (cartItems) => {
  let total = 0;
  let totalWithReserve = 0;

  cartItems.forEach(item => {
    const itemTotal = item.sellPricePerUnit * item.quantityInCart;
    total += itemTotal;

    if (item.unit === 'Kilogram') {
      totalWithReserve += itemTotal * 1.15;
    } else {
      totalWithReserve += itemTotal;
    }
  });

  return {
    total: parseFloat(total.toFixed(2)),
    totalWithReserve: parseFloat(totalWithReserve.toFixed(2))
  };
};

export default totalSum