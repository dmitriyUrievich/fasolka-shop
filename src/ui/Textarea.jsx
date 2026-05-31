import {FieldWrapper} from "./FieldWrapper.jsx";

export const Textarea = ({ label, ...props }) => (
    <FieldWrapper label={label} id={props.id}>
    <textarea
        {...props}
        className={`textarea-input ${props.className || ''}`}
    />
    </FieldWrapper>
);