---
title: Part006 CompletableFuture使用案例
date: 2025-05-08 00:12:01
categories:
  - - 笔记
    - 编程
    - 100test
tags:
  - Java
---
**2025-05-08**🌱上海: ☀️   🌡️+19°C 🌬️↖19km/h
# **Part006 CompletableFuture使用案例

1. ## **为什么（Why）**
    

### **1.1 项目背景**

`part006`模块实现了一个基于Java并发编程优化的商品详情页查询服务，主要解决的是在微服务架构下，系统需要从多个服务获取数据时的性能问题。在传统实现中，获取完整的商品详情需要依次调用多个接口（商品基本信息、商品描述、评论数、收藏数等），这些调用都是串行执行的，导致响应时间过长，用户体验较差。本模块通过Java的并发编程特性，特别是CompletableFuture，实现了接口调用的并行化，大大提升了系统性能。

### **1.2 解决的问题**

- **响应时间过长**：在微服务架构下，获取完整的商品详情需要调用多个接口，串行调用会导致响应时间累加，大大降低用户体验。
    
- **资源利用率低**：串行调用时，CPU和网络资源未被充分利用，系统吞吐量受限。
    
- **服务依赖阻塞**：一个服务的延迟会导致整个请求链路的阻塞，缺乏弹性。
    
- **开发复杂度高**：传统的异步编程模型（如回调）使代码复杂，难以维护。
    

2. ## **如何实现（How）**
    

### **2.1 项目结构**

```plain
part006/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── muzi/
│   │   │           └── part6/
│   │   │               ├── part6Application.java      # 应用启动类
│   │   │               ├── GoodsController.java       # 商品详情控制器
│   │   │               ├── GoodsDetailResponse.java   # 商品详情响应对象
│   │   │               └── ThreadPoolConfig.java      # 线程池配置
│   │   └── resources/                         # 配置文件
│   └── test/                                  # 测试类
└── pom.xml                                    # Maven配置文件
```

### **2.2 关键技术点**

#### **2.2.1 案例分析：串行调用与并行调用对比**

**技术实现**： 本模块实现了两个版本的商品详情获取接口，分别是串行调用版本和并行调用优化版本：

1. **串行调用版本**
    

```Java
@GetMapping("/getGoodsDetail")
public GoodsDetailResponse getGoodsDetail(@RequestParam("goodsId") String goodsId) {
    long st = System.currentTimeMillis();
    GoodsDetailResponse goodsDetailResponse = new GoodsDetailResponse();
    
    // 1、获取商品基本信息，耗时100ms
    goodsDetailResponse.setGoodsInfo(this.getGoodsInfo(goodsId));

    //2、获取商品描述信息，耗时100ms
    goodsDetailResponse.setGoodsDescription(this.getGoodsDescription(goodsId));

    //3、获取商品评论量，耗时100ms
    goodsDetailResponse.setCommentCount(this.getGoodsCommentCount(goodsId));

    //4、获取商品收藏量，耗时100ms
    goodsDetailResponse.setFavoriteCount(this.getGoodsFavoriteCount(goodsId));

    LOGGER.info("获取商品信息，普通版耗时：{} ms", (System.currentTimeMillis() - st));
    return goodsDetailResponse;
}
```

2. **并行调用优化版本**
    

```Java
@GetMapping("/getGoodsDetailNew")
public GoodsDetailResponse getGoodsDetailNew(@RequestParam("goodsId") String goodsId) {
    long st = System.currentTimeMillis();
    GoodsDetailResponse goodsDetailResponse = new GoodsDetailResponse();

    // 1、获取商品基本信息，耗时100ms
    CompletableFuture<Void> goodsInfoCf = CompletableFuture.runAsync(
        () -> goodsDetailResponse.setGoodsInfo(this.getGoodsInfo(goodsId)), 
        this.goodsThreadPool
    );

    //2、获取商品描述信息，耗时100ms
    CompletableFuture<Void> goodsDescriptionCf = CompletableFuture.runAsync(
        () -> goodsDetailResponse.setGoodsDescription(this.getGoodsDescription(goodsId)), 
        this.goodsThreadPool
    );

    //3、获取商品评论量，耗时100ms
    CompletableFuture<Void> goodsCommentCountCf = CompletableFuture.runAsync(
        () -> goodsDetailResponse.setCommentCount(this.getGoodsCommentCount(goodsId)), 
        this.goodsThreadPool
    );

    //4、获取商品收藏量，耗时100ms
    CompletableFuture<Void> goodsFavoriteCountCf = CompletableFuture.runAsync(
        () -> goodsDetailResponse.setFavoriteCount(this.getGoodsFavoriteCount(goodsId)), 
        this.goodsThreadPool
    );

    //等待上面执行结束
    CompletableFuture.allOf(
        goodsInfoCf, goodsDescriptionCf, goodsCommentCountCf, goodsFavoriteCountCf
    ).join();

    LOGGER.info("获取商品信息，使用线程池并行查询耗时：{} ms", (System.currentTimeMillis() - st));
    return goodsDetailResponse;
}
```

**原理分析**：

1. **串行调用的问题**
    
    1. 每个接口调用都需要等待前一个调用完成才能开始
        
    2. 总响应时间是所有调用时间的总和（例如4个100ms的调用，总耗时约400ms）
        
    3. CPU和网络资源未被充分利用，大部分时间在等待I/O
        
2. **并行调用的优势**
    
    4. 多个接口调用同时进行，不需要相互等待
        
    5. 总响应时间接近最长单个调用的时间（例如4个100ms的调用，总耗时约100ms）
        
    6. 充分利用CPU和网络资源，提高系统吞吐量
        
3. **性能提升**
    
    1. 在示例中，理论上响应时间可降低约75%（从400ms降至100ms）
        
    2. 实际项目中，性能提升通常取决于最慢的那个接口调用
        
    3. 系统整体吞吐量提高，可以处理更多并发请求
        

#### **2.2.2 案例分析：CompletableFuture的使用**

**技术实现**： CompletableFuture是Java 8引入的增强型Future，实现了CompletionStage接口，提供了强大的异步编程能力：

```Java
// 创建异步任务
CompletableFuture<Void> goodsInfoCf = CompletableFuture.runAsync(
    () -> goodsDetailResponse.setGoodsInfo(this.getGoodsInfo(goodsId)), 
    this.goodsThreadPool
);

// 等待多个异步任务完成
CompletableFuture.allOf(
    goodsInfoCf, goodsDescriptionCf, goodsCommentCountCf, goodsFavoriteCountCf
).join();
```

**原理分析**：

1. **异步执行模型**
    
    1. CompletableFuture通过ForkJoinPool或自定义线程池执行异步任务
        
    2. 任务完成后，可以触发链式的后续操作，实现非阻塞的流式处理
        
    3. 提供了丰富的组合操作，支持复杂的异步工作流编排
        
2. **链式调用与组合**
    
    4. 可以通过thenApply、thenAccept、thenRun等方法链式处理结果
        
    5. 通过allOf、anyOf等方法组合多个CompletableFuture
        
    6. 支持异常处理机制（exceptionally、handle等）
        
3. **回调与通知**
    
    1. 支持任务完成、异常发生时的回调通知
        
    2. 可以定义任务完成后的操作，避免显式等待
        
    3. 通过join或get等方法获取最终结果
        

#### **2.2.3 案例分析：线程池配置与优化**

**技术实现**： 本模块使用Spring的ThreadPoolTaskExecutor配置了专用的商品服务线程池：

```Java
@Configuration
public class ThreadPoolConfig {
    @Bean
    public ThreadPoolTaskExecutor goodsThreadPool() {
        ThreadPoolTaskExecutor threadPoolTaskExecutor = new ThreadPoolTaskExecutor();
        threadPoolTaskExecutor.setThreadNamePrefix("ThreadPool-Goods-");
        threadPoolTaskExecutor.setCorePoolSize(Runtime.getRuntime().availableProcessors() * 4);
        threadPoolTaskExecutor.setMaxPoolSize(Runtime.getRuntime().availableProcessors() * 8);
        threadPoolTaskExecutor.setQueueCapacity(0);
        threadPoolTaskExecutor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        return threadPoolTaskExecutor;
    }
}
```

**原理分析**：

1. **线程池核心参数**
    
    1. **核心线程数**：设置为CPU核心数的4倍，保证足够的并发处理能力
        
    2. **最大线程数**：设置为CPU核心数的8倍，应对突发流量
        
    3. **队列容量**：设置为0，即不使用队列缓存任务，超出核心线程数的任务会直接创建新线程（直到达到最大线程数）
        
    4. **拒绝策略**：使用CallerRunsPolicy，当线程池饱和时，让调用者线程执行任务，起到限流作用
        
2. **线程池调优考量**
    
    1. 任务类型：IO密集型任务适合更多的线程数（通常是CPU核心数的数倍）
        
    2. 任务执行时间：短任务适合使用较大的队列，长任务适合较少的队列容量
        
    3. 系统负载：需考虑系统整体资源使用情况，避免线程过多导致上下文切换开销
        
    4. 业务重要性：关键业务可以使用独立的线程池，避免被其他任务影响
        
3. **自适应配置**
    
    1. 使用`Runtime.getRuntime().availableProcessors()`获取CPU核心数，使配置适应不同硬件环境
        
    2. 通过参数比例（如4倍、8倍）进行配置，便于根据实际负载调整
        

## 3. **技术点详解（Detail）**
    

### **3.1 CompletableFuture深度解析**

CompletableFuture是Java并发编程的强大工具，提供了丰富的异步操作API：

1. **创建异步任务**
    
    1. `runAsync`：执行没有返回值的异步任务
        
    2. `supplyAsync`：执行有返回值的异步任务
        
    3. 都可以指定自定义线程池或使用默认的ForkJoinPool
        
2. **任务转换与处理**
    
    4. `thenApply`：将上一步结果转换为新的结果
        
    5. `thenAccept`：消费上一步结果，无返回值
        
    6. `thenRun`：上一步完成后执行操作，不使用上一步结果，无返回值
        
3. **任务组合**
    
    1. `thenCombine`：组合两个任务的结果
        
    2. `allOf`：等待所有任务完成
        
    3. `anyOf`：等待任意一个任务完成
        
4. **异常处理**
    
    4. `exceptionally`：处理异常并提供默认值
        
    5. `handle`：处理正常结果或异常
        
    6. `whenComplete`：任务完成时执行操作，不修改结果
        
5. **执行时机控制**
    
    1. 带Async后缀的方法（如thenApplyAsync）会在独立线程中执行
        
    2. 不带Async后缀的方法会在触发任务的线程中执行（如果已完成）
        
    3. 可以指定线程池执行特定阶段的任务
        

### **3.2 线程池与ThreadPoolTaskExecutor**

Spring的ThreadPoolTaskExecutor是对Java标准线程池的封装，提供了更多功能：

1. **核心组件**
    
    1. 内部封装了ThreadPoolExecutor
        
    2. 支持任务队列、拒绝策略配置
        
    3. 提供线程前缀命名、优雅关闭等功能
        
2. **关键参数解析**
    
    4. **corePoolSize**：核心线程数，长期保持的线程数量
        
    5. **maxPoolSize**：最大线程数，应对峰值负载
        
    6. **queueCapacity**：任务队列容量，当所有核心线程都在工作时，新任务进入队列
        
    7. **rejectedExecutionHandler**：拒绝策略，当线程池和队列都满时的处理方式
        
    8. **keepAliveTime**：非核心线程空闲存活时间
        
3. **任务执行流程**
    
    1. 首先尝试使用核心线程执行任务
        
    2. 核心线程都忙时，任务进入队列
        
    3. 队列满时，创建新线程（直到达到最大线程数）
        
    4. 线程池和队列都满时，触发拒绝策略
        
4. **常用拒绝策略**
    
    1. **AbortPolicy**：直接抛出异常（默认）
        
    2. **CallerRunsPolicy**：在调用者线程中执行任务
        
    3. **DiscardPolicy**：静默丢弃任务
        
    4. **DiscardOldestPolicy**：丢弃队列中最老的任务，然后重试执行
        

### **3.3 并发编程最佳实践**

在微服务架构中使用并发编程的最佳实践：

1. **线程池隔离**
    
    1. 为不同类型的任务创建独立的线程池
        
    2. 避免关键业务受到其他任务的影响
        
    3. 便于监控和调整特定类型任务的性能
        
2. **超时控制**
    
    4. 为每个异步调用设置合理的超时时间
        
    5. 使用CompletableFuture的orTimeout或completeOnTimeout方法
        
    6. 避免因单个服务响应慢而影响整体响应时间
        
3. **优雅降级**
    
    1. 当依赖服务不可用时，提供降级策略（如返回缓存数据或默认值）
        
    2. 利用CompletableFuture的exceptionally或handle方法实现降级
        
    3. 保证核心功能的可用性
        
4. **资源控制**
    
    4. 合理设置线程池参数，避免资源耗尽
        
    5. 监控线程池使用情况，及时调整参数
        
    6. 使用限流措施保护系统稳定性
        
5. **并行度控制**
    
    1. 并非所有任务都适合并行执行
        
    2. 评估任务的依赖关系，仅并行执行独立的任务
        
    3. 考虑任务的执行时间，短任务可能不值得并行化
        

### **3.4 性能对比分析**

串行调用和并行调用的性能对比：

1. **响应时间**
    
    1. 串行调用：约等于所有调用时间之和
        
    2. 并行调用：约等于最长调用的时间
        
    3. 当调用时间相近时，性能提升更为明显
        
2. **资源使用**
    
    4. 串行调用：资源利用率低，CPU和网络资源大部分时间在等待
        
    5. 并行调用：资源利用率高，但可能导致资源竞争
        
    6. 需要配置合适的线程池大小，平衡资源利用和竞争
        
3. **服务依赖**
    
    1. 串行调用：一个服务故障会阻塞整个调用链
        
    2. 并行调用：服务故障只影响特定部分，其他服务可正常返回
        
    3. 提高了系统的弹性和可用性
        
4. **理论性能提升**
    
    4. 假设有n个相似耗时的独立调用
        
    5. 理论上性能提升：(n-1)/n * 100%
        
    6. 例如4个调用，理论提升75%
        

## 4.   **使用示例（Usage）**
    

### **4.1 基本使用**

获取商品详情基本示例：

```Java
@GetMapping("/getGoodsDetailNew")
public GoodsDetailResponse getGoodsDetailNew(@RequestParam("goodsId") String goodsId) {
    GoodsDetailResponse response = new GoodsDetailResponse();
    
    // 创建多个异步任务获取商品信息
    CompletableFuture<Void> cf1 = CompletableFuture.runAsync(
        () -> response.setGoodsInfo(getGoodsInfo(goodsId)), 
        goodsThreadPool
    );
    CompletableFuture<Void> cf2 = CompletableFuture.runAsync(
        () -> response.setGoodsDescription(getGoodsDescription(goodsId)), 
        goodsThreadPool
    );
    
    // 等待所有任务完成
    CompletableFuture.allOf(cf1, cf2).join();
    return response;
}
```

### **4.2 带返回值的异步调用**

```Java
// 创建带返回值的异步任务
CompletableFuture<String> infoFuture = CompletableFuture.supplyAsync(
    () -> getGoodsInfo(goodsId), 
    goodsThreadPool
);

// 处理返回值
infoFuture.thenAccept(info -> response.setGoodsInfo(info));

// 或者转换结果
CompletableFuture<Integer> lengthFuture = infoFuture.thenApply(info -> info.length());
```

### **4.3 异常处理**

```Java
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    // 可能抛出异常的业务逻辑
    if (goodsId == null) {
        throw new IllegalArgumentException("商品ID不能为空");
    }
    return getGoodsInfo(goodsId);
}).exceptionally(ex -> {
    // 异常处理，提供默认值
    log.error("获取商品信息失败", ex);
    return "默认商品信息";
});
```

### **4.4 超时控制**

```Java
// Java 9及以上版本
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> getGoodsInfo(goodsId))
    .orTimeout(500, TimeUnit.MILLISECONDS)
    .exceptionally(ex -> {
        if (ex instanceof TimeoutException) {
            return "获取商品信息超时，返回默认信息";
        }
        return "获取商品信息失败，返回默认信息";
    });

// Java 8版本
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> getGoodsInfo(goodsId));
try {
    String result = future.get(500, TimeUnit.MILLISECONDS);
} catch (TimeoutException e) {
    // 超时处理
}
```

### **4.5 组合多个异步调用**

```Java
CompletableFuture<String> infoFuture = CompletableFuture.supplyAsync(() -> getGoodsInfo(goodsId));
CompletableFuture<String> descFuture = CompletableFuture.supplyAsync(() -> getGoodsDescription(goodsId));

// 组合两个结果
CompletableFuture<String> combinedFuture = infoFuture.thenCombine(descFuture, 
    (info, desc) -> "商品信息: " + info + ", 描述: " + desc);
```

## 5.  **总结与优化方向（Summary）**
    

### **5.1 技术总结**

本模块通过Java的并发编程特性，特别是CompletableFuture，实现了商品详情查询服务的优化：

1. 使用并行调用替代串行调用，大幅提升响应速度，改善用户体验
    
2. 通过自定义线程池，实现资源隔离和控制，提高系统稳定性
    
3. 利用CompletableFuture的异步编程模型，简化代码复杂度，提高可维护性
    
4. 展示了现代Java并发编程的最佳实践，适用于微服务架构下的性能优化
    

### **5.2 优化方向**

1. **增加缓存层**
    
    1. 对于热点商品信息，增加本地缓存或分布式缓存
        
    2. 减少对后端服务的调用，进一步提升响应速度
        
    3. 使用多级缓存策略，平衡性能和数据一致性
        
2. **服务熔断与降级**
    
    4. 集成熔断器（如Hystrix或Resilience4j）
        
    5. 当服务不可用时，快速失败并返回降级结果
        
    6. 防止依赖服务故障导致的级联失败
        
3. **请求合并与批量处理**
    
    1. 合并短时间内对同一资源的多个请求
        
    2. 使用批量API替代多个单独调用
        
    3. 减少网络往返和系统负载
        
4. **动态线程池**
    
    4. 根据系统负载动态调整线程池参数
        
    5. 监控线程池使用情况，自动优化配置
        
    6. 实现线程池的弹性扩缩容
        
5. **异步非阻塞API**
    
    1. 将整个请求处理流程改为非阻塞模式
        
    2. 使用WebFlux等响应式框架
        
    3. 进一步提升系统并发处理能力