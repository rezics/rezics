import { z } from "zod";
import { username, password, phone, email } from "./common";

export const Login = z.object({
    identity: z.union([username, email, phone]),
    password,
});

export const Register = z.object({
    username,
    email,
    phone,
    password,
});
