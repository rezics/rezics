import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { setCookie } from "../utils/cookie";

const app = new Elysia()
  .get("/", ({ cookie: { user } }) => {
    // 读取 cookie
    const name = user?.value; // 这里是当前 cookie 值（可能是 string / object，看你 schema）

    console.log("name", name);
    if (!name) {
      setCookie(user!, {
        value: "saltyaom",
        httpOnly: true,
        path: "/",
      });
      return `Hi, no cookie!`;
    }

    return `Hi, ${user?.value}!`;
  })
  .use(swagger());

app.listen(8083);

console.log(
  `Cookie test server started\n  Service: http://${app.server?.hostname}:${app.server?.port}\n  Swagger: http://${app.server?.hostname}:${app.server?.port}/swagger`,
);
