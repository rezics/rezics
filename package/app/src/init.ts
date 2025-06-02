import { Client } from "appwrite";

if (process.env["NODE_ENV"] === "production") {
    [process.env["ICS_ENDPOINT"], process.env["ICS_PROJECT"]].forEach((value) => {
        if (value === undefined) {
            throw new Error("At least one required value is missing");
        }
    });
}

const endpoint = process.env["ICS_ENDPOINT"] || "http://localhost/v1";
const project = process.env["ICS_PROJECT"] || "default-project";

const appwrite = new Client();
appwrite.setEndpoint(endpoint);
appwrite.setProject(project);

export { appwrite };
