import ts from "typescript";
import fs from "fs";
import path from "path";

// 递归收集 src/ 下所有 .ts/.tsx 文件
function collectSourceFiles(dir: string): string[] {
    const files: string[] = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(fullPath));
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }

    return files;
}

// 读取 tsconfig.json 配置
const configPath = path.resolve("tsconfig.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
    throw new Error("读取 tsconfig.json 失败");
}

// 解析配置
const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
);

// 收集 src 目录下文件
const rootFiles = collectSourceFiles(path.resolve("src"));

// 创建 Program
const program = ts.createProgram({
    rootNames: rootFiles,
    options: parsedConfig.options,
});

// 获取 diagnostics（语法 + 语义 + 类型错误）
const diagnostics = ts.getPreEmitDiagnostics(program);

// 格式化并写入文件
const output: string[] = [];
diagnostics.forEach((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n",
    );
    if (diagnostic.file) {
        const { line, character } =
            diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
        const fileName = path.relative(process.cwd(), diagnostic.file.fileName);
        output.push(`${fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
        output.push(message);
    }
});

const outputPath = path.resolve("ts-errors.log");
fs.writeFileSync(outputPath, output.join("\n"), "utf-8");
console.log(`TypeScript 错误已写入 ${outputPath}`);

if (diagnostics.length > 0) {
    process.exitCode = 1;
}
