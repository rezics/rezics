import { Client } from "appwrite";

[process.env["ICS_ENDPOINT"], process.env["ICS_PROJECT"]].forEach((value) => {
    if (value === undefined) {
        throw new Error("At least one required value is missing");
    }
});

const appwrite = new Client();
appwrite.setEndpoint(process.env["ICS_ENDPOINT"]!);
appwrite.setProject(process.env["ICS_PROJECT"]!);

export { appwrite };
