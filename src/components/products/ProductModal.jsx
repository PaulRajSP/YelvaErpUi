import SingleProductModal from './SingleProductModal';
import ComboProductModal from './ComboProductModal';

export default function ProductModal({ isOpen, onClose, editingProduct, products, onSave, isComboMode }) {
    if (!isOpen) return null;

    const isCombo = editingProduct ? !!editingProduct.isCombo : !!isComboMode;

    if (isCombo) {
        return (
            <ComboProductModal
                isOpen={isOpen}
                onClose={onClose}
                editingProduct={editingProduct}
                products={products}
                onSave={onSave}
            />
        );
    }

    return (
        <SingleProductModal
            isOpen={isOpen}
            onClose={onClose}
            editingProduct={editingProduct}
            onSave={onSave}
        />
    );
}

export { SingleProductModal, ComboProductModal };
