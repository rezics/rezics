import type { CreateLabelInput, LabelDTO } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const labelApi = {
  create: async (input: CreateLabelInput): Promise<LabelDTO> => {
    return apiFetch<LabelDTO>("/label/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
