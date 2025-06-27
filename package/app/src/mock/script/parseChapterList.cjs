#!/usr/bin/env node

// 引入所需的第三方库和Node.js内置模块
// @ts-nocheck
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

/**
 * 解析刺猬猫小说目录的HTML字符串，并生成结构化的章节数据。
 * @param {string} htmlString - 包含章节列表的HTML内容。
 * @returns {Array<Object>} - 格式化后的章节对象数组。
 */
function parseCiweimaoChapters(htmlString) {
    // 使用JSDOM库来创建一个DOM环境
    const dom = new JSDOM(htmlString);
    const { document } = dom.window;

    const result = [];
    let orderCounter = 1;
    let currentParentId = 0; // 顶层卷的ParentID默认为0

    // 选取所有包含卷标题和章节列表的容器
    const bookChapterBoxes = document.querySelectorAll("#J_book_chapter_list > .book-chapter-box");

    bookChapterBoxes.forEach((box) => {
        // 1. 处理分卷标题 (h4)
        const volumeHeader = box.querySelector("h4.sub-tit");
        if (volumeHeader) {
            const volumeId = parseInt(volumeHeader.getAttribute("data-ries-data-process"), 10);

            // 提取卷名，只取h4下的第一个文本节点，以排除<a>标签等子元素
            const volumeName = volumeHeader.firstChild.textContent.trim();

            const volumeData = {
                ID: volumeId,
                ParentID: 0, // 卷是顶层，ParentID为0
                Order: orderCounter++,
                ChapterName: volumeName,
                NoContent: true, // 卷本身没有内容
            };
            result.push(volumeData);

            // 更新当前父ID，用于后续的章节
            currentParentId = volumeId;
        }

        // 2. 处理该卷下的章节列表 (ul > li)
        const chapterList = box.querySelector("ul.book-chapter-list");
        if (chapterList) {
            const chapterItems = chapterList.querySelectorAll("li a");
            chapterItems.forEach((link) => {
                const chapterId = parseInt(link.getAttribute("data-ries-data-process"), 10);

                // .textContent 会自动忽略内部的<i>等标签，只获取文本
                // .replace(/\s+/g, ' ') 用于将多个连续空白符合并为一个空格，并trim()去除首尾空格
                const chapterName = link.textContent.trim().replace(/\s+/g, " ");

                const chapterData = {
                    ID: chapterId,
                    ParentID: currentParentId,
                    Order: orderCounter++,
                    ChapterName: chapterName,
                    NoContent: false, // 普通章节有内容
                };
                result.push(chapterData);
            });
        }
    });

    return result;
}

// --- 脚本主逻辑 ---
function main() {
    // 从命令行参数获取输入文件名
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("错误：请提供一个HTML文件名作为参数。");
        console.error("用法: node parse.js <文件名.html>");
        process.exit(1); // 退出脚本并返回错误码
    }

    const inputFilePath = args[0];

    try {
        // 同步读取HTML文件内容
        const htmlContent = fs.readFileSync(inputFilePath, "utf8");

        // 调用解析函数
        const jsonData = parseCiweimaoChapters(htmlContent);

        // 将结果以格式化的JSON字符串形式输出到控制台
        // console.log(JSON.stringify(jsonData, null, 2));
        fs.writeFileSync(path.join(__dirname, "chapterlist01.json"), JSON.stringify(jsonData, null, 2));
    } catch (error) {
        console.error(`读取或处理文件时出错: ${error.message}`);
        process.exit(1);
    }
}

// 执行主函数
main();
