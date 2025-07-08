---
title: Part001 分片上传
date: 2025-05-07 23:53:26
categories:
  - - 笔记
    - 编程
    - 100test
tags:
  - Java
---
**2025-05-07**🌱上海: ☀️   🌡️+19°C 🌬️↖19km/h

# **Part001 分片上传

## **1. 为什么（Why）**

### **1.1 项目背景**

`part001`部分是一个基于java和SQL的模块，主要负责处理分片上传功能。随着文件上传需求的增加，传统的单次上传方式已经无法满足大文件上传的需求，因此引入了分片上传技术，以提高上传效率和稳定性。

### **1.2 解决的问题**

- **大文件上传效率低**：通过分片上传，将大文件分割成多个小文件并行上传，显著提高了上传速度。
    
- **网络不稳定导致上传失败**：分片上传允许断点续传，即使网络中断，也可以从中断处继续上传，避免了重新上传的麻烦。
    
- **服务器压力大**：分片上传减少了单次上传的数据量，降低了服务器的瞬时压力。
    

## **2. 如何实现（How）**

### **2.1 项目结构**

`part001`部分的项目结构如下：

```plain
part001/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── muzi/
│   │   │           └── part1/
│   │   │               ├── comm/              # 通用工具类和响应对象
│   │   │               ├── controller/        # 控制层，提供API接口
│   │   │               ├── dto/               # 数据传输对象
│   │   │               ├── mapper/            # MyBatis映射接口
│   │   │               ├── po/                # 持久化对象
│   │   │               ├── service/           # 业务逻辑层
│   │   │               ├── utils/             # 工具类
│   │   │               └── part1Application.java  # 应用启动类
│   │   └── resources/
│   │       ├── db/                # 数据库初始化脚本
│   │       └── application.yml    # 应用配置文件
│   └── test/
│       └── java/
│           └── com/
│               └── muzi/
│                   └── part1/     # 测试类
└── pom.xml                         # Maven配置文件
```

### **2.2 关键技术点**

#### **2.2.1 案例分析：分片上传的流程设计**

![](https://xqqmo2q8lg.feishu.cn/space/api/box/stream/download/asynccode/?code=ZDE3MzgxMTM1ZTdkNWMxMzlhZGVhN2EwZThjMzkzMTJfdVBvMDNld214Mk9NSWUxSHhuR05LOGZ5QktYRFNaY3pfVG9rZW46RnhTeWJQZ0t3b0FTc0t4dGFQWWNoMnkxblhkXzE3NDY2ODMyMzA6MTc0NjY4NjgzMF9WNA)

**技术实现**： 分片上传功能采用了"三步走"策略：初始化、分片上传、合并完成。整个流程通过REST API实现，涉及四个核心接口：

1. **初始化分片上传**：`/shardUpload/init`
    
    1. 创建上传任务记录，生成唯一任务ID
        
    2. 记录文件名、分片数量、文件MD5值等元数据
        
2. **上传分片**：`/shardUpload/uploadPart`
    
    1. 按顺序上传每个分片
        
    2. 验证分片是否已上传（避免重复上传）
        
    3. 将分片保存到临时存储位置
        
3. **完成上传**：`/shardUpload/complete`
    
    1. 校验所有分片是否已上传完成
        
    2. 合并所有分片生成完整文件
        
    3. 通过MD5验证文件完整性
        
4. **查询任务状态**：`/shardUpload/detail`
    
    4. 获取上传任务的详细信息
        
    5. 记录已上传的分片列表
        
    6. 判断整体上传是否已完成
        

**原理分析**：

1. **数据存储设计**
    
    1. 采用两张表结构：分片任务表(`t_shard_upload`)和分片文件表(`t_shard_upload_part`)，形成一对多关系
        
    2. 分片任务表记录整体任务信息，分片文件表记录每个分片的详细信息
        
    3. 使用唯一索引确保分片不会重复上传(`uq_part_order`)
        
2. **文件处理机制**
    
    4. 分片文件存储在临时目录(`D:/muzi/shardupload/`)
        
    5. 每个分片独立存储，通过唯一命名方式组织(`shardUploadId/partOrder`)
        
    6. 合并时按照分片顺序读取并拼接，确保文件完整性
        
3. **安全校验**
    
    1. 支持MD5校验，确保大文件上传后的完整性
        
    2. 仅当所有分片均上传完成时才允许合并操作
        
    3. 合并后的文件MD5与原始文件MD5进行比对验证
        

#### **2.2.2 案例分析：多线程并行上传实现**

**技术实现**： 测试类`ShardUploadTest`中实现了两种上传方式：

1. **串行上传**（已注释）
    

```java
// 循环上传分片
for (int partOrder = 1; partOrder <= partNum; partOrder++) {
    this.shardUploadPart(shardUploadId, partOrder);
}
```

1. **并行上传**（实际使用）
    

```java
// 多线程上传分片
ExecutorService executorService = Executors.newFixedThreadPool(partNum);
CountDownLatch countDownLatch = new CountDownLatch(partNum);
for (int i = 1; i <= partNum; i++) {
    int partorder = i;
    executorService.execute(() -> {
        try {
            ShardUploadTest shardUploadTest = new ShardUploadTest();
            shardUploadTest.shardUploadPart(shardUploadId, partorder);
        } catch (Exception e) {
            log.info("分片上传失败{}", e);
        } finally {
            countDownLatch.countDown();
        }
    });
}
countDownLatch.await();
executorService.shutdown();
```

**原理分析**：

1. **线程池优化**
    
    1. 使用`ExecutorService`创建固定大小的线程池，线程数量等于分片数量
        
    2. 避免频繁创建和销毁线程的开销，提高性能
        
2. **任务协调机制**
    
    1. 采用`CountDownLatch`同步机制，确保所有分片任务完成后才进行合并
        
    2. 每个分片上传完成后调用`countDown()`方法，计数器减一
        
    3. 主线程通过`await()`方法等待所有分片上传完成
        
3. **分片读取优化**
    
    1. 使用`RandomAccessFile`实现高效的文件分片读取
        
    2. 通过`seek()`方法直接定位到分片起始位置，减少IO操作
        
    3. 针对最后一个可能不足分片大小的分片进行特殊处理
        

#### **2.2.3 案例分析：断点续传实现**

**技术实现**： 断点续传功能通过以下机制实现：

1. **分片状态检查**
    

```java
// 如果分片已上传，则直接返回
if (this.getUploadPartPO(request.getShardUploadId(), request.getPartOrder()) != null) {
    return;
}
```

1. **上传任务恢复** 通过`/shardUpload/detail`接口获取任务状态和已上传分片列表
    

```java
// 获取分片任务的详细信息(哪些分片文件是否已上传)
ShardUploadDetailResponse detail = this.shardUploadDetail(shardUploadId);
```

**原理分析**：

1. **状态管理**
    
    1. 每个分片的上传状态通过数据库记录，确保持久化
        
    2. 通过唯一约束防止重复上传同一分片
        
    3. 分片上传前先检查是否已存在，实现秒传和断点续传
        
2. **任务恢复策略**
    
    4. 客户端可以通过详情接口获取已上传分片列表
        
    5. 仅上传未完成的分片，节省带宽和时间
        
    6. 服务端支持任意顺序上传分片，提高灵活性
        
3. **容错机制**
    
    1. 每个分片独立保存和记录，互不影响
        
    2. 单个分片上传失败不影响整体进度，可重试
        
    3. 完整性校验确保最终文件无损
        

## **3. 技术点详解（Detail）**

### **3.1 数据库设计**

系统使用两张表设计：

1. **t_shard_upload**：分片上传任务表
    
    1. `id`：主键，任务唯一标识
        
    2. `file_name`：上传文件名
        
    3. `part_num`：分片总数
        
    4. `md5`：文件MD5校验值
        
    5. `file_full_path`：合并后文件完整路径
        
2. **t_shard_upload_part**：分片文件表
    
    6. `id`：主键
        
    7. `shard_upload_id`：关联分片任务ID
        
    8. `part_order`：分片序号，从1开始
        
    9. `file_full_path`：分片文件存储路径
        
    10. 唯一索引：`uq_part_order (shard_upload_id, part_order)`
        

### **3.2 核心算法**

1. **分片数量计算**
    

```java
public static int shardNum(long fileSize, long partSize) {
    if (fileSize % partSize == 0) {
        return (int) (fileSize / partSize);
    } else {
        return (int) (fileSize / partSize) + 1;
    }
}
```

1. **分片读取**
    

```java
public byte[] readPart(int partOrder) throws Exception {
    RandomAccessFile randomAccessFile = null;
    byte[] bytes = new byte[(int) partSize];
    try {
        randomAccessFile = new RandomAccessFile(file, "r");
        randomAccessFile.seek((partOrder - 1) * partSize);
        int read = randomAccessFile.read(bytes);
        if (read == partSize) {
            return bytes;
        } else {
            byte[] tempBytes = new byte[read];
            System.arraycopy(bytes, 0, tempBytes, 0, read);
            return tempBytes;
        }
    } finally {
        IOUtils.closeQuietly(randomAccessFile);
    }
}
```

1. **文件合并**
    

```java
private File mergeFile(ShardUploadPO shardUploadPO, List<ShardUploadPartPO> shardUploadPartList) throws IOException {
    File file = ShardUploadUtils.createFileNotExists(new File(this.getFileFullName(shardUploadPO)));
    
    FileOutputStream fileOutputStream = null;
    try {
        fileOutputStream = FileUtils.openOutputStream(file, true);
        for (ShardUploadPartPO part : shardUploadPartList) {
            File partFile = new File(part.getFileFullPath());
            FileInputStream partFileInputStream = null;
            try {
                partFileInputStream = FileUtils.openInputStream(partFile);
                IOUtils.copyLarge(partFileInputStream, fileOutputStream);
            } finally {
                IOUtils.closeQuietly(partFileInputStream);
            }
            partFile.delete();
        }
    } finally {
        IOUtils.closeQuietly(fileOutputStream);
    }
    
    if (StringUtils.isNotBlank(shardUploadPO.getMd5()) && !shardUploadPO.getMd5().equals(SecureUtil.md5(file))) {
        throw ServiceExceptionUtils.exception("文件md5不匹配");
    }
    return file;
}
```

### **3.3 性能与安全考量**

1. **性能优化**
    
    1. 多线程并行上传分片，提高传输效率
        
    2. 使用`RandomAccessFile`实现高效的文件分片读取
        
    3. 采用固定大小的线程池，避免资源浪费
        
2. **安全措施**
    
    4. MD5完整性校验，防止文件损坏
        
    5. 分片上传状态持久化，支持断点续传
        
    6. 临时分片文件存储与合并完成后的清理
        
3. **资源管理**
    
    1. 文件资源使用后及时关闭，防止资源泄露
        
    2. 合并完成后删除临时分片文件，节省存储空间
        
    3. 使用`try-finally`结构确保资源正确释放
        

## **4. 使用示例（Usage）**

### **4.1 客户端调用流程**

1. **初始化上传任务**
    

```java
public String shardUploadInit(String fileName, int partNum, String md5) {
    ShardUploadInitRequest request = new ShardUploadInitRequest();
    request.setFileName(fileName);
    request.setPartNum(partNum);
    request.setMd5(md5);

    RequestEntity<ShardUploadInitRequest> entity = RequestEntity
            .post(this.getRequestUrl("shardUpload/init"))
            .contentType(MediaType.APPLICATION_JSON)
            .body(request);
    ResponseEntity<Result<String>> exchange = this.restTemplate.exchange(entity, 
            new ParameterizedTypeReference<Result<String>>() {});
    return exchange.getBody().getData();
}
```

1. **上传单个分片**
    

```java
public void shardUploadPart(String shardUploadId, int partOrder) throws Exception {
    byte[] bytes = readPart(partOrder);
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    body.add("shardUploadId", shardUploadId);
    body.add("partOrder", partOrder);
    body.add("file", new ByteArrayResource(bytes) {
        @Override
        public String getFilename() {
            return "part" + partOrder;
        }
    });
    RequestEntity<MultiValueMap<String, Object>> entity = RequestEntity
            .post(this.getRequestUrl("shardUpload/uploadPart"))
            .body(body);
    this.restTemplate.exchange(entity, new ParameterizedTypeReference<Result<String>>() {});
}
```

1. **完成上传**
    

```java
public void shardUploadComplete(String shardUploadId) {
    ShardUploadCompleteRequest request = new ShardUploadCompleteRequest();
    request.setShardUploadId(shardUploadId);

    RequestEntity<ShardUploadCompleteRequest> entity = RequestEntity
            .post(this.getRequestUrl("shardUpload/complete"))
            .contentType(MediaType.APPLICATION_JSON)
            .body(request);
    ResponseEntity<Result<Boolean>> responseEntity = this.restTemplate.exchange(entity, 
            new ParameterizedTypeReference<Result<Boolean>>() {});
}
```

### **4.2 完整示例**

测试类`ShardUploadTest`提供了一个完整的分片上传演示：

```java
@Test
public void shardUpload() throws Exception {
    long begin = System.currentTimeMillis();
    int partNum = ShardUploadUtils.shardNum(file.length(), partSize);
    String fileMd5 = SecureUtil.md5(file);
    
    // 1、分片上传初始化
    String shardUploadId = this.shardUploadInit(file.getName(), partNum, fileMd5);
    
    // 2、多线程上传分片
    ExecutorService executorService = Executors.newFixedThreadPool(partNum);
    CountDownLatch countDownLatch = new CountDownLatch(partNum);
    for (int i = 1; i <= partNum; i++) {
        int partorder = i;
        executorService.execute(() -> {
            try {
                ShardUploadTest shardUploadTest = new ShardUploadTest();
                shardUploadTest.shardUploadPart(shardUploadId, partorder);
            } catch (Exception e) {
                log.info("分片上传失败{}", e);
            } finally {
                countDownLatch.countDown();
            }
        });
    }
    countDownLatch.await();
    executorService.shutdown();
    
    // 3、合并分片，完成上传
    this.shardUploadComplete(shardUploadId);
    
    // 4、获取分片任务的详细信息
    ShardUploadDetailResponse detail = this.shardUploadDetail(shardUploadId);
    long end = System.currentTimeMillis();
    log.info("运行时间：{}", end-begin);
    log.info("分片任务详细信息:{}", detail);
}
```

## **5. 总结与未来优化（Summary）**

### **5.1 技术总结**

本项目成功实现了基于java和Spring Boot的分片上传功能，解决了大文件上传面临的多种问题：

1. 通过分片上传提高了大文件传输效率
    
2. 支持断点续传，增强了上传任务的稳定性
    
3. 实现了并行上传，充分利用网络带宽
    
4. 提供了完整性校验，保证文件安全
    

### **5.2 可优化方向**

1. **存储方式优化**
    
    1. 考虑使用对象存储服务替代本地文件系统
        
    2. 支持分布式存储，提高系统可扩展性
        
2. **传输协议优化**
    
    1. 支持WebSocket等更高效的传输协议
        
    2. 实现流式传输，减少内存占用
        
3. **前端交互优化**
    
    1. 提供上传进度实时反馈
        
    2. 实现可视化的断点续传界面
        
4. **安全性加强**
    
    1. 增加文件类型校验和安全扫描
        
    2. 实现传输过程加密
        
5. **性能进一步提升**
    
    1. 动态调整分片大小，适应不同网络环境
        
    2. 实现服务端分片合并的异步处理