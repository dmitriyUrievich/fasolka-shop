export const FieldWrapper = ({ label, id, error, children }) => (
    <div className="form-group">
        {label && <label htmlFor={id}>{label}</label>}
        {children}
        {error && <span className="error-message">{error}</span>}
    </div>
);