// logger-hook.ts

import util from "node:util";
import chalk from "chalk";

function highlightSQL(sql: string) {
  return (
    sql
      // SQL 关键字高亮
      .replace(
        /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|ORDER BY|LIMIT|OFFSET|JOIN|ON|AS|LEFT|RIGHT|INNER|OUTER|GROUP BY|HAVING)\b/gi,
        (m) => chalk.cyanBright(m),
      )
      // 双引号包裹的字段名
      .replace(/"([^"]+)"/g, (_, p1) => chalk.yellow(p1))
      // 参数变量
      .replace(/\$(\d+)/g, (_, p1) => chalk.magenta(`$${p1}`))
  );
}

function colorize(line: string): string {
  // ANCHOR Prisma
  if (line.startsWith("[Prisma Query]")) {
    const match = line.match(/\[Prisma Query\]\s+(\d+)ms:(.*)/s);
    if (match) {
      const [, dur, sql] = match;
      const ms = Number(dur);
      const timeColor =
        ms > 500
          ? chalk.redBright(`${ms}ms`)
          : ms > 100
            ? chalk.yellow(`${ms}ms`)
            : chalk.green(`${ms}ms`);
      return `${chalk.blue("[Prisma]")} ${timeColor}:${highlightSQL(
        sql?.trim() ?? "",
      )}`;
    }
  }

  // ANCHOR Elysia
  if (line.includes("Elysia is running")) return chalk.greenBright(line);
  const httpMatch = line.match(
    /^\[(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\]\s+(\S+)\s+took\s+([\d.]+)ms\s+params:\s*(.*)$/,
  );
  if (httpMatch) {
    const [, method, path, ms, params] = httpMatch;

    // 根据方法上色
    const methodColor =
      method === "GET"
        ? chalk.cyan(`[${method}]`)
        : method === "POST"
          ? chalk.green(`[${method}]`)
          : method === "PUT"
            ? chalk.yellow(`[${method}]`)
            : method === "DELETE"
              ? chalk.red(`[${method}]`)
              : chalk.magenta(`[${method}]`);

    // 耗时上色（性能分级）
    const time = Number(ms);
    const timeColor =
      time > 500
        ? chalk.redBright(`${time.toFixed(1)}ms`)
        : time > 150
          ? chalk.yellow(`${time.toFixed(1)}ms`)
          : chalk.green(`${time.toFixed(1)}ms`);

    return `${methodColor} ${chalk.cyan(path)} ${chalk.gray(
      "took",
    )} ${timeColor} ${chalk.gray("params:")} ${chalk.white(params)}`;
  }

  return line;
}

// 代理 console 输出
for (const key of ["log", "info", "warn", "error"] as const) {
  const orig = console[key];
  console[key] = (...args: any[]) => {
    try {
      const combined = util.format(...args);
      const result = colorize(combined);

      if (result.includes("\n")) {
        orig(result);
      } else {
        orig(result);
      }
    } catch {
      orig(...args);
    }
  };
}
