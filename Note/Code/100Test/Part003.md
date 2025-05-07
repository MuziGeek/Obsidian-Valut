---
title: 压测工具类
date: 2025-05-08 00:05:56
categories:
 - [笔记, 编程, 100test]
tags:
  - Java
---
**2025-05-08**🌱上海: ☀️   🌡️+19°C 🌬️↖19km/h
 
# Part003接口性能压测工具类

## 案例简介

对于压测工具，常用的一般有Jmeter、Apache服务器安装目录的ab.exe及LoadRunner

## 三者区别

1. **JMeter**
    
    1. **优势**：多协议支持、分布式测试、开源生态丰富（如Throughput Shaping Timer插件）。
        
    2. **劣势**：GUI模式消耗资源，大并发需调整JVM参数。
        
2. **Apache Bench (ab.exe)**
    
    1. **优势**：轻量级、快速启动，适合开发调试时快速验证接口吞吐量。
        
    2. **劣势**：无法模拟复杂场景（如动态参数、关联请求）。
        
3. **LoadRunner**
    
    1. **优势**：全链路监控（如AppDynamics集成）、专利技术（如Auto Correlation）。
        
    2. **劣势**：License成本高，适合预算充足的团队。
        

### **如何选择？**

- **简单HTTP测试**：用 `ab.exe`（例如：`ab -n 1000 -c 100 http://example.com`）。
    
- **多协议/复杂场景**：用 **JMeter**（如OAuth认证、数据库压测）。
    
- **企业级高精度测试**：选 **LoadRunner**（尤其需要合规性报告时）。
    

## 为什么要自己实现一个压测工具？

为了方便后续学习JUC相关知识（线程池以及常用工具类），很多时候对于以上的知识不动手进行实战演练，通过不同的场景案例灵活的解决业务问题，很难深入掌握这些知识点，所以手撸一个压测工具类，方便后续各种并发场景实战演练。

## 涉及的知识点

1. 线程池（ThreadPoolExecutor）
    
2. CountDownlatch
    
3. AtomicInteger
    

## 示例代码

定义一个压测结果类

```java
@Data
public static class LoadRunnerResult {
    // 请求总数
    private int requests;
    // 并发量
    private int concurrency;
    // 成功请求数
    private int successRequests;
    // 失败请求数
    private int failRequests;
    // 请求总耗时(ms)
    private int timeTakenForTests;
    // 每秒请求数（吞吐量）
    private float requestsPerSecond;
    // 每个请求平均耗时(ms)
    private float timePerRequest;
    // 最快的请求耗时(ms)
    private float fastestCostTime;
    // 最慢的请求耗时(ms)
    private float slowestCostTime;
}
```

定义压测工具类

```java
/**
 * 对 command 执行压测
 *
 * @param requests    总请求数
 * @param concurrency 并发数量
 * @param command     需要执行的压测代码
 * @param <T>
 * @return 压测结果 {@link LoadRunnerResult}
 * @throws InterruptedException
 */
public static <T> LoadRunnerResult run(int requests, int concurrency, Runnable command) throws InterruptedException {
    log.info("压测开始......");
    //创建线程池，并将所有核心线程池都准备好
    ThreadPoolExecutor poolExecutor = new ThreadPoolExecutor(concurrency, concurrency,
            0L, TimeUnit.MILLISECONDS,
            new LinkedBlockingQueue<Runnable>());
    //加载全部线程
    poolExecutor.prestartAllCoreThreads();

    // 创建一个 CountDownLatch，用于阻塞当前线程池待所有请求处理完毕后，让当前线程继续向下走
    CountDownLatch countDownLatch = new CountDownLatch(requests);

    //成功请求数、最快耗时、最慢耗时 （这几个值涉及到并发操作，所以采用 AtomicInteger 避免并发修改导致数据错误）
    AtomicInteger successRequests = new AtomicInteger(0);
    AtomicInteger fastestCostTime = new AtomicInteger(Integer.MAX_VALUE);
    AtomicInteger slowestCostTime = new AtomicInteger(Integer.MIN_VALUE);

    long startTime = System.currentTimeMillis();
    //循环中使用线程池处理被压测的方法
    for (int i = 0; i < requests; i++) {
        poolExecutor.execute(() -> {
            try {
                long requestStartTime = System.currentTimeMillis();
                //执行被压测的方法
                command.run();

                //command执行耗时
                int costTime = (int) (System.currentTimeMillis() - requestStartTime);

                //请求最快耗时
                setFastestCostTime(fastestCostTime, costTime);

                //请求最慢耗时
                setSlowestCostTimeCostTime(slowestCostTime, costTime);

                //成功请求数+1
                successRequests.incrementAndGet();
            } catch (Exception e) {
                log.error(e.getMessage());
            } finally {
                countDownLatch.countDown();
            }
        });
    }
    //阻塞当前线程，等到压测结束后，该方法会被唤醒，线程继续向下走
    countDownLatch.await();
    //关闭线程池
    poolExecutor.shutdown();

    long endTime = System.currentTimeMillis();
    log.info("压测结束，总耗时(ms):{}", (endTime - startTime));


    //组装最后的结果返回
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

测试方法

```java
@Test
public void test2() throws InterruptedException {
    //需要压测的接口地址，这里我们压测test2接口
    //压测参数，总请求数量10000，并发100
    int requests = 1000;
    int concurrency = 100;
    String url = "http://localhost:8080/test2";
    System.out.println(String.format("压测接口:%s", url));
    RestTemplate restTemplate = new RestTemplate();

    //调用压测工具类开始压测
    LoadRunnerUtils.LoadRunnerResult loadRunnerResult = LoadRunnerUtils.run(requests, concurrency, () -> {
        restTemplate.getForObject(url, String.class);
    });

    //输出压测结果
    print(loadRunnerResult);
}
```