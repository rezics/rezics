// @ts-nocheck
const fs = require("fs");

// 1. 读取原始 JSON 数据
const inputData = JSON.parse(fs.readFileSync("../data/chapterlist01.json", "utf-8"))

// 2. 初始化输出结构
const chapterMap = {};
const orderMap = {};

// 3. 构造扁平结构和顺序表
for (const item of inputData) {
    const id = item.ID;
    const parentId = item.ParentID === 0 ? null : item.ParentID;

    // 添加到扁平映射中
    chapterMap[id] = {
        id,
        parentId,
        title: item.ChapterName,
        noContent: item.NoContent,
    };

    // 初始化顺序数组
    const key = parentId === null ? "null" : String(parentId);
    if (!orderMap[key]) {
        orderMap[key] = [];
    }
    orderMap[key].push({ id, order: item.Order });
}

// 4. 按 Order 排序
for (const key in orderMap) {
    orderMap[key] = orderMap[key].sort((a, b) => a.order - b.order).map((entry) => entry.id);
}

// 5. 写入输出 JSON 文件
const output = {
    chapters: chapterMap,
    order: orderMap,
};

fs.writeFileSync("../data/chapterlist02.json", JSON.stringify(output, null, 2), "utf-8");
console.log("✅ 转换完成，文件已输出到 output.json");
