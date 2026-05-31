export const QuantityControl = ({
    quantity,
    total,
    isWeighted,
    onDecrement,
    onIncrement,
    nextAvailable,
    disableBuy
    }) => (
    <div className="quantity-control">
        <button className="btn-quantity" onClick={onDecrement} disabled={quantity === 0}>−</button>
        <div className="quantity-info">
            <div className="quantity">
                {isWeighted ? `${quantity.toFixed(3)} кг` : `${Math.round(quantity)} шт.`}
            </div>
            <div className="total-price">{total.toLocaleString('ru-RU')} ₽</div>
        </div>
        <button className="btn-quantity" onClick={onIncrement} disabled={!nextAvailable || disableBuy}>+</button>
        {(!nextAvailable && !disableBuy) && (<span className="tooltip-text">Товара нет</span>)}
    </div>
);
