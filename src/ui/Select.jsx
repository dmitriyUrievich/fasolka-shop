import {FieldWrapper} from "./FieldWrapper.jsx";

export const Select = ({ label, error, options, placeholder, ...props }) => (
    <FieldWrapper label={label} id={props.id} error={error}>
        <select
            {...props}
            className={`${props.className || ''} ${error ? 'input-error' : ''}`}
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    </FieldWrapper>
)