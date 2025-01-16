```dataviewjs
// 指定文件夹路径，这里假设我们要获取 "exampleFolder" 文件夹下的文件 
const folderPath = '"Interview"'; 
// 使用 dv.pages 获取指定文件夹下的所有文件 
const pages = dv.pages(folderPath).sort(t=>t.date); 
// 存储二级标题的数组 
let secondLevelHeaders = []; 
// 遍历所有文件 
for (const page of pages) { 
	const file = app.vault.getAbstractFileByPath(page.file.path); 
	// 异步读取文件内容 
	const contents = await app.vault.read(file); 
	// 正则表达式匹配二级标题，以 "## " 开头，直到遇到换行符或文件结束 
    const regex = /^##\s*(?!#)(.*?)(?=\n(?!###)|$)/gms;
	
let lastIndex = 0;
    while ((match = regex.exec(contents))!== null) {
        const title = match[1];
        const startIndex = match.index;
        // 构建链接，格式为 [[文件名#标题]]
        const link = `[[${file.basename}#${title.replace(/\s+/g, '-')}]]`;
        secondLevelHeaders.push(link);
        lastIndex = startIndex + match[0].length;
	}
} 
	// 输出二级标题列表 
dv.list(secondLevelHeaders);
```
