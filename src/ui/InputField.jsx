import {FieldWrapper} from "./FieldWrapper.jsx";

export const InputField = ({ label, error, type = "text", ...props }) => (
    <FieldWrapper label={label} id={props.id} error={error}>
        <input
            type={type}
            {...props}
            className={`${props.className || ''} ${error ? 'input-error' : ''}`}
        />
    </FieldWrapper>
);