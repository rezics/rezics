const config: CodegenConfig = {
    watch: "/package/**/*",
    schema: {
        "https://library--rezics.c-83.i.aws.edgedb.cloud/branch/dev/graphql": {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env["TOKEN"]}`,
            },
        },
    },
    generates: {
        "./src/client.ts": {
            watchPattern: "../client/**/*",
            documents: "../client/src/**/*.{ts,tsx}",
            preset: "client",
        },
        "./src/server/gql/": {
            watchPattern: "../server/**/*",
            documents: "../server/src/**/*.ts",
            preset: "graphql-modules",
        },
    },
};

export default config;
