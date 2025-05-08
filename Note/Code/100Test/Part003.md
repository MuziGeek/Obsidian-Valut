---
title: Part003 压测工具类
date: 2025-05-08 00:05:56
categories:
  - - 笔记
    - 编程
    - 100test
tags:
  - Java
---
**2025-05-07**🌱上海: ☀️   🌡️+19°C 🌬️↖19km/h
# **Part003 压测工具类

## **1. 为什么（Why）**

### **1.1 项目背景**

`part003`模块实现了一个基于java的HTTP接口压测工具，主要用于评估Web接口的性能指标，如响应时间、吞吐量等。在微服务架构和分布式系统中，接口性能是影响整体系统稳定性的关键因素，因此需要一个灵活高效的压测工具来模拟高并发场景，评估接口的性能表现。

### **1.2 解决的问题**

- **接口性能评估**：通过模拟高并发请求，测试接口在不同负载下的响应情况。
    
- **性能瓶颈识别**：测量关键性能指标（吞吐量、响应时间等），帮助识别系统瓶颈。
    
- **稳定性验证**：在高压力下验证系统的稳定性和错误处理能力。
    
- **接口耗时监控**：通过过滤器统计每个请求的实际耗时，辅助性能分析。
    

## **2. 如何实现（How）**

### **2.1 项目结构**

`part003`模块的项目结构如下：

```plain
part003/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── muzi/
│   │   │           └── part3/
│   │   │               ├── controller/
│   │   │               │   └── TestController.java   # 测试接口
│   │   │               ├── filter/
│   │   │               │   └── CostTimeFilter.java   # 请求耗时过滤器
│   │   │               └── utils/
│   │   │                   └── LoadRunnerUtils.java  # 压测工具类
│   │   └── resources/                         # 配置文件
│   └── test/
│       └── java/
│           └── LoadRunnerUtilsTest.java       # 压测工具测试类
└── pom.xml                                    # Maven配置文件
```

### **2.2 关键技术点**

#### **2.2.1 案例分析：压测工具类设计**

**技术实现**： `LoadRunnerUtils`类是核心工具类，实现了接口压测和性能指标收集的功能，主要代码如下：

```java
public static <T> LoadRunnerResult run(int requests, int concurrency, Runnable command) throws InterruptedException {
    log.info("压测开始......");
    // 创建线程池，并将所有核心线程池都准备好
    ThreadPoolExecutor poolExecutor = new ThreadPoolExecutor(concurrency, concurrency,
            0L, TimeUnit.MILLISECONDS,
            new LinkedBlockingQueue<Runnable>());
    // 加载全部线程
    poolExecutor.prestartAllCoreThreads();

    // 创建一个 CountDownLatch，用于阻塞当前线程池待所有请求处理完毕后，让当前线程继续向下走
    CountDownLatch countDownLatch = new CountDownLatch(requests);

    // 成功请求数、最快耗时、最慢耗时 （这几个值涉及到并发操作，所以采用 AtomicInteger 避免并发修改导致数据错误）
    AtomicInteger successRequests = new AtomicInteger(0);
    AtomicInteger fastestCostTime = new AtomicInteger(Integer.MAX_VALUE);
    AtomicInteger slowestCostTime = new AtomicInteger(Integer.MIN_VALUE);

    long startTime = System.currentTimeMillis();
    // 循环中使用线程池处理被压测的方法
    for (int i = 0; i < requests; i++) {
        poolExecutor.execute(() -> {
            try {
                long requestStartTime = System.currentTimeMillis();
                // 执行被压测的方法
                command.run();

                // command执行耗时
                int costTime = (int) (System.currentTimeMillis() - requestStartTime);

                // 请求最快耗时
                setFastestCostTime(fastestCostTime, costTime);

                // 请求最慢耗时
                setSlowestCostTimeCostTime(slowestCostTime, costTime);

                // 成功请求数+1
                successRequests.incrementAndGet();
            } catch (Exception e) {
                log.error(e.getMessage());
            } finally {
                countDownLatch.countDown();
            }
        });
    }
    // 阻塞当前线程，等到压测结束后，该方法会被唤醒，线程继续向下走
    countDownLatch.await();
    // 关闭线程池
    poolExecutor.shutdown();

    long endTime = System.currentTimeMillis();
    
    // 组装最后的结果返回
    LoadRunnerResult result = new LoadRunnerResult();
    result.setRequests(requests);
    result.setConcurrency(concurrency);
    result.setSuccessRequests(successRequests.get());
    result.setFailRequests(requests - result.getSuccessRequests());
    result.setTimeTakenForTests((int) (endTime - startTime));
    result.setRequestsPerSecond((float) requests * 1000f / (float) (result.getTimeTakenForTests()));
    result.setTimePerRequest((float) result.getTimeTakenForTests() / (float) requests);
    result.setFastestCostTime(fastestCostTime.get());
    result.setSlowestCostTime(slowestCostTime.get());
    return result;
}
```

**原理分析**：

1. **线程池模型**
    
    1. 使用固定大小线程池模拟并发用户
        
    2. 提前启动所有核心线程(`prestartAllCoreThreads`)，确保测试开始立即达到期望并发度
        
    3. 使用无界队列管理任务，适合压测场景
        
2. **并发控制**
    
    4. 通过`CountDownLatch`实现任务同步，确保所有请求完成才计算结果
        
    5. 使用`AtomicInteger`处理并发计数和极值计算，保证数据一致性
        
    6. 采用CAS操作保证原子性，避免锁开销
        
3. **性能指标收集**
    
    1. 计算关键性能指标：总耗时、平均耗时、吞吐量等
        
    2. 记录最快/最慢响应时间，帮助分析性能波动
        
    3. 统计成功/失败请求数，评估系统稳定性
        

#### **2.2.2 案例分析：请求耗时过滤器**

**技术实现**： `CostTimeFilter`类实现了请求耗时监控功能，代码如下：

```java
@Order(Ordered.HIGHEST_PRECEDENCE)
@WebFilter(urlPatterns = "/**", filterName = "CostTimeFilter")
@Component
public class CostTimeFilter extends OncePerRequestFilter {
    private static final Logger LOGGER = LoggerFactory.getLogger(CostTimeFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        long st = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long et = System.currentTimeMillis();
            LOGGER.info("请求地址:{},耗时(ms):{}", request.getRequestURL().toString(), (et - st));
        }
    }
}
```

**原理分析**：

1. **过滤器优先级**
    
    1. 使用`@Order(Ordered.HIGHEST_PRECEDENCE)`设置最高优先级
        
    2. 确保过滤器最先执行，能够准确捕获完整的请求处理时间
        
2. **耗时计算机制**
    
    1. 在请求处理前记录开始时间
        
    2. 使用`try-finally`结构确保即使发生异常也会执行耗时计算
        
    3. 计算并记录每个请求的完整处理耗时
        
3. **日志输出**
    
    1. 输出请求URL和耗时，便于问题排查
        
    2. 为接口性能分析提供数据支持
        

## **3. 技术点详解（Detail）**

### **3.1 线程池设计**

压测工具使用的线程池具有以下特点：

1. **固定大小线程池**
    

```java
ThreadPoolExecutor poolExecutor = new ThreadPoolExecutor(concurrency, concurrency,
         0L, TimeUnit.MILLISECONDS,
         new LinkedBlockingQueue<Runnable>());
```

1. **线程预热**
    

```java
poolExecutor.prestartAllCoreThreads();
```

1. **优雅关闭**
    

```java
poolExecutor.shutdown();
```

### **3.2 原子操作与CAS机制**

统计数据使用`AtomicInteger`实现原子操作，特别是最大值和最小值的更新：

```java
private static void setFastestCostTime(AtomicInteger fastestCostTime, int costTime) {
    while (true) {
        int fsCostTime = fastestCostTime.get();
        if (fsCostTime < costTime) {
            break;
        }
        if (fastestCostTime.compareAndSet(fsCostTime, costTime)) {
            break;
        }
    }
}
```

这种实现基于CAS（Compare-And-Swap）机制，具有以下优势：

1. **无锁设计**：避免了锁带来的上下文切换和阻塞开销
    
2. **乐观并发控制**：假设冲突较少，只在提交时检查冲突
    
3. **高并发性能**：在高并发环境下比传统锁机制有更好的性能
    

### **3.3 CountDownLatch同步机制**

`CountDownLatch`用于任务同步，实现原理为：

1. **计数器初始化**
    

```java
CountDownLatch countDownLatch = new CountDownLatch(requests);
```

1. **任务完成通知**
    

```java
countDownLatch.countDown();
```

1. **等待所有任务完成**
    

```java
countDownLatch.await();
```

### **3.4 性能指标计算**

工具计算的关键性能指标及其含义：

1. **吞吐量(TPS/RPS)**
    

```java
result.setRequestsPerSecond((float) requests * 1000f / (float) (result.getTimeTakenForTests()));
```

1. **平均响应时间**
    

```java
result.setTimePerRequest((float) result.getTimeTakenForTests() / (float) requests);
```

1. **最快/最慢响应时间**
    
    1. 记录极值情况，帮助分析性能波动和稳定性
        
    2. 通常最慢响应时间能反映系统瓶颈
        
2. **成功率**
    
    1. 成功请求数占总请求数的比例，衡量系统稳定性
        
    2. 高并发下的错误率是评估系统健壮性的重要指标
        

## **4. 使用示例（Usage）**

### **4.1 基本用法**

以下示例展示如何使用压测工具测试HTTP接口：

```java
@Test
public void test1() throws InterruptedException {
    // 需要压测的接口地址，这里我们压测test1接口
    // 压测参数，总请求数量1000，并发100
    int requests = 1000;
    int concurrency = 100;
    String url = "http://localhost:8080/test1";
    System.out.println(String.format("压测接口:%s", url));
    RestTemplate restTemplate = new RestTemplate();

    // 调用压测工具类开始压测
    LoadRunnerUtils.LoadRunnerResult loadRunnerResult = LoadRunnerUtils.run(requests, concurrency, () -> {
        restTemplate.getForObject(url, String.class);
    });

    // 输出压测结果
    print(loadRunnerResult);
}
```

### **4.2 测试不同类型的接口**

测试包含业务处理逻辑的接口：

```java
@Test
public void test2() throws InterruptedException {
    // 压测带有业务处理逻辑的接口
    int requests = 1000;
    int concurrency = 100;
    String url = "http://localhost:8080/test2";
    System.out.println(String.format("压测接口:%s", url));
    RestTemplate restTemplate = new RestTemplate();

    // 调用压测工具类开始压测
    LoadRunnerUtils.LoadRunnerResult loadRunnerResult = LoadRunnerUtils.run(requests, concurrency, () -> {
        restTemplate.getForObject(url, String.class);
    });

    // 输出压测结果
    print(loadRunnerResult);
}
```

### **4.3 自定义测试逻辑**

压测工具不仅限于HTTP接口测试，还可以测试任何可执行的代码块：

```java
// 测试数据库操作性能
LoadRunnerUtils.LoadRunnerResult dbResult = LoadRunnerUtils.run(1000, 50, () -> {
    userDao.findById(randomId());
});

// 测试缓存性能
LoadRunnerUtils.LoadRunnerResult cacheResult = LoadRunnerUtils.run(10000, 200, () -> {
    redisTemplate.opsForValue().get("test-key-" + randomId());
});
```

## **5. 总结与优化方向（Summary）**

### **5.1 技术总结**

本模块实现了一个高效实用的接口压测工具，具有以下特点：

1. 支持模拟高并发场景，评估接口性能表现
    
2. 提供丰富的性能指标统计，包括吞吐量、响应时间等
    
3. 灵活的接口设计，支持测试任意代码块
    
4. 通过过滤器实现请求耗时监控，辅助性能分析
    

### **5.2 优化方向**

1. **压测参数增强**
    
    1. 支持更多压测参数，如请求间隔、压测持续时间等
        
    2. 实现压测负载的动态调整（如阶梯式增加压力）
        
2. **结果分析增强**
    
    1. 增加响应时间分布统计（如P50、P90、P99）
        
    2. 支持性能指标的图形化展示
        
3. **监控指标扩展**
    
    1. 监控系统资源使用情况（CPU、内存、网络等）
        
    2. 记录GC情况，辅助JVM调优分析
        
4. **分布式压测支持**
    
    1. 支持多机协同压测，模拟更大规模的并发
        
    2. 实现压测任务的分布式调度和结果汇总
        
5. **故障注入模拟**
    
    1. 增加网络延迟、丢包等故障注入功能
        
    2. 测试系统在非理想网络环境下的表现