// 定义英文到中文的映射
const translationMap = {
    "Soft": "软件",
    "StudyTool": "学习工具",
    // 可以在这里添加更多的映射关系
};

module.exports = async function (tp) {
    // 生成 categories 部分
    // 获取当前文件的完整路径
    const filePath = tp.file.path(true);
    // 去除文件扩展名
    const pathWithoutExtension = filePath.replace(/\.[^/.]+$/, '');
    // 按路径分隔符分割路径
    let pathParts = pathWithoutExtension.split('/');

    // 去除最后一个路径部分（通常是文件名）
    if (pathParts.length > 0) {
        pathParts = pathParts.slice(0, -1);
    }

    // 对路径部分进行转换
    const translatedParts = pathParts.map(part => {
        return translationMap[part] || part;
    });

    // 构建 categories 字符串
    let categories = '';
    if (translatedParts.length > 0) {
        categories = ` - [${translatedParts.join(', ')}]`;
    }

    // 生成 tags 部分
    // 获取所有已存在的标签
    const allTags = tp.app.metadataCache.getTags();
    const tagNames = Object.keys(allTags).map(tag => tag.replace('#', ''));

    const selectedTags = [];
    let selectedTag;
    do {
        selectedTag = await tp.system.suggester(tagNames, tagNames, false, "请选择一个标签");
        if (selectedTag) {
            selectedTags.push(selectedTag);
        }
    } while (selectedTag);

    // 构建 tags 字符串
    let tagsString = '';
    if (selectedTags.length > 0) {
        tagsString = selectedTags.map(tag => `  - ${tag}`).join('\n');
    }

    // 组合 categories 和 tags 结果
    const result = `categories:
${categories}
tags:
${tagsString}`;
    console.log('Final result:', result);

    return result;
};