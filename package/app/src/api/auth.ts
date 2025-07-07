import { gql } from "graphql-tag";

export const LOGIN = gql`
    mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
            token
            user {
                id
                name
                avatar
            }
        }
    }
`;

export const REGISTER = gql`
    mutation Register($email: String!, $password: String!) {
        register(email: $email, password: $password) {
            token
            user {
                id
                name
                avatar
            }
        }
    }
`;

export const VALIDATE_EMAIL = gql`
    mutation ValidateEmail($email: String!) {
        validateEmail(email: $email) {
            field
            message
        }
    }
`;

export const VALIDATE_PASSWORD = gql`
    mutation ValidatePassword($password: String!) {
        validatePassword(password: $password) {
            field
            message
        }
    }
`;
