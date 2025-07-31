import { TagContract } from "./Tag";

export type Contract = TagContract;

import { useQuery, useMutation } from "@tanstack/react-query";

export const Query: Contract = async (...input) => {
    const { data } = useQuery({
        queryKey: input,
        queryFn: async () => {
            const response = await fetch("/api", {
                method: "POST",
                body: JSON.stringify(input),
            });

            return response.json();
        },
    });

    return data;
};

export const Mutation: Contract = async (...input) => {
    const { data } = useMutation({
        mutationKey: input,
        mutationFn: async () => {
            const response = await fetch("/api", {
                method: "POST",
                body: JSON.stringify(input),
            });

            return response.json();
        },
    });

    return data;
};
