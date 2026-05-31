import CategorySidebar from './CategorySidebar';

const CategoryDrawer = ({ isOpen, onClose, products, categories, activeCategoryId, onCategorySelect }) => {
    if (!isOpen) return null;

    return (
        <div className="category-menu-sidebar" onClick={e => e.stopPropagation()}>
            <div className="category-menu-header">
                <h3>Категории</h3>
                <button className="category-menu-close" onClick={onClose} aria-label="Закрыть">×</button>
            </div>
            <CategorySidebar
                products={products}
                categories={categories}
                activeCategoryId={activeCategoryId}
                onCategorySelect={onCategorySelect}
            />
        </div>
    );
};
export default CategoryDrawer