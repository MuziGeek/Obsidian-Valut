---
title: Day29
date: 2025-01-21 16:17:28
categories: 
- [学习成长, 编程, 面试训练营]
tags:
---
**2025-01-21**🌱上海: ☀️   🌡️+14°C 🌬️↖8km/h
## 深入理解线程池原理

### 线程池的创建

### 使用Executors工厂类创建
####  固定大小线程池（FixedThreadPool）
```java
// 创建一个固定大小为 5 的线程池
        ExecutorService executorService = Executors.newFixedThreadPool(5);
```
- `Executors.newFixedThreadPool(5)`：创建一个固定大小为 5 的线程池，核心线程数和最大线程数都为 5。
#### 单线程线程池（SingleThreadExecutor）
```java
// 创建一个单线程的线程池
        ExecutorService executorService = Executors.newSingleThreadExecutor();
```
- `Executors.newSingleThreadExecutor()`：创建一个只有一个核心线程的线程池，保证任务按顺序执行。
#### 可缓存线程池（CachedThreadPool）
```java
// 创建一个可缓存的线程池
        ExecutorService executorService = Executors.newCachedThreadPool();
```
- `Executors.newCachedThreadPool()`：创建一个可缓存的线程池，核心线程数为 0，最大线程数为 `Integer.MAX_VALUE`，线程空闲 60 秒后会被回收。
####  定时任务线程池（ScheduledThreadPool）
```java
  // 创建一个定时任务线程池
        ScheduledExecutorService scheduledExecutorService = Executors.newScheduledThreadPool(5);
        // 提交定时任务
        scheduledExecutorService.schedule(() -> {
            System.out.println("Task is running by " + Thread.currentThread().getName());
        }, 1, TimeUnit.SECONDS);
        // 关闭线程池
        scheduledExecutorService.shutdown();
```
- `Executors.newScheduledThreadPool(5)`：创建一个大小为 5 的定时任务线程池。
- `scheduledExecutorService.schedule()`：在延迟 1 秒后执行任务。
###  使用 `ThreadPoolExecutor` 类
构造函数源码
```java
public ThreadPoolExecutor(int corePoolSize,  
                          int maximumPoolSize,  
                          long keepAliveTime,  
                          TimeUnit unit,  
                          BlockingQueue<Runnable> workQueue,  
                          ThreadFactory threadFactory,  
                          RejectedExecutionHandler handler) {  
    if (corePoolSize < 0 ||  
        maximumPoolSize <= 0 ||  
        maximumPoolSize < corePoolSize ||  
        keepAliveTime < 0)  
        throw new IllegalArgumentException();  
    if (workQueue == null || threadFactory == null || handler == null)  
        throw new NullPointerException();  
    this.acc = System.getSecurityManager() == null ?  
            null :  
            AccessController.getContext();  
    this.corePoolSize = corePoolSize;  
    this.maximumPoolSize = maximumPoolSize;  
    this.workQueue = workQueue;  
    this.keepAliveTime = unit.toNanos(keepAliveTime);  
    this.threadFactory = threadFactory;  
    this.handler = handler;  
}
```
示例解释参数
```java
// 核心线程数，线程池会一直维护的线程数量，即使这些线程处于空闲状态，也不会被回收
        int corePoolSize = 2;
        // 最大线程数，线程池允许存在的最大线程数量，包括核心线程和非核心线程
        int maximumPoolSize = 4;
        // 非核心线程的空闲存活时间，即当非核心线程处于空闲状态超过这个时间，该线程会被回收
        long keepAliveTime = 10;
        // 时间单位，用于指定 keepAliveTime 的时间单位，例如 TimeUnit.SECONDS 表示秒
        TimeUnit unit = TimeUnit.SECONDS;
        // 任务等待队列，用于存储等待执行的任务，当核心线程都在执行任务时，新任务会先进入此队列等待
        BlockingQueue<Runnable> workQueue = new java.util.concurrent.LinkedBlockingQueue<>();
        // 线程工厂，用于创建新线程，可自定义线程的属性，如名称、优先级、是否为守护线程等
        ThreadFactory threadFactory = Executors.defaultThreadFactory();
        // 拒绝策略，当任务队列已满且线程池中的线程数达到最大线程数时，用于处理新提交的任务，例如抛出异常、丢弃任务等
        RejectedExecutionHandler handler = new ThreadPoolExecutor.AbortPolicy();

        ThreadPoolExecutor threadPoolExecutor = new ThreadPoolExecutor(
                // 核心线程数
                corePoolSize,
                // 最大线程数
                maximumPoolSize,
                // 非核心线程的空闲存活时间
                keepAliveTime,
                // 时间单位
                unit,
                // 任务等待队列
                workQueue,
                // 线程工厂
                threadFactory,
                // 拒绝策略
                handler);
```
了解不同的线程池创建方式，接下来讲一下为什么不推荐使用Executor工厂来创建线程池。
#### 为什么不推荐使用Executor创建线程池？
**总的来说，主要两个点不灵活无法定制线程池，还有就是默认使用无界队列，容易引发OOM。**

|对比项|Executors|ThreadPoolExecutor|
|---|---|---|
|灵活性|低，参数固定|高，可定制|
|队列类型|多为无界队列|可按需选择|
|资源耗尽风险|高，易耗尽内存或 CPU|可通过配置避免|
|线程工厂定制|难|易|
|拒绝策略定制|固定且不灵活|可按需选择|
|性能优化|难|可根据场景调整|
### 线程池的生命周期
先上源码
```java
// runState is stored in the high-order bits  
private static final int RUNNING    = -1 << COUNT_BITS;  
private static final int SHUTDOWN   =  0 << COUNT_BITS;  
private static final int STOP       =  1 << COUNT_BITS;  
private static final int TIDYING    =  2 << COUNT_BITS;  
private static final int TERMINATED =  3 << COUNT_BITS;
```
 从上面可以看出线程总共有五种状态，在线程池的生命周期中间会尽力RUNNING、SHUTDOWN、STOP、TIDYING、TERMINATED五个状态。
 - **RUNNING** 表示线程池处于运行状态，能够接受新提交的任务且能对已添加的任务进行处理。RUNNING状态是线程池的初始化状态，线程池一旦被创建就处于RUNNING状态。
    
- **SHUTDOWN** 线程处于关闭状态，不接受新任务，但可以处理已添加的任务。RUNNING状态的线程池调用shutdown后会进入SHUTDOWN状态。
    
- **STOP** 线程池处于停止状态，不接收任务，不处理已添加的任务，且会中断正在执行任务的线程。RUNNING状态的线程池调用了shutdownNow后会进入STOP状态。

- **TIDYING** 当所有任务已终止，且任务数量为0时，线程池会进入TIDYING。当线程池处于SHUTDOWN状态时，阻塞队列中的任务被执行完了，且线程池中没有正在执行的任务了，状态会由SHUTDOWN变为TIDYING。当线程处于STOP状态时，线程池中没有正在执行的任务时则会由STOP变为TIDYING。
    
- **TERMINATED** 线程终止状态。处于TIDYING状态的线程执行terminated()后进入TERMINATED状态。
    
![image.png](https://cdn.easymuzi.cn/img/20250121171136920.png)

### 线程池的工作流程
### 线程池源码分析
关于ThreadPoolExecutor源码，我们从头来分析
，首先就是一些常量定义
```java
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));  
private static final int COUNT_BITS = Integer.SIZE - 3;  
private static final int CAPACITY   = (1 << COUNT_BITS) - 1;  
  
// runState is stored in the high-order bits  
//.....线程状态省略
  
// Packing and unpacking ctl  
private static int runStateOf(int c)     { return c & ~CAPACITY; }  
private static int workerCountOf(int c)  { return c & CAPACITY; }  
private static int ctlOf(int rs, int wc) { return rs | wc; }
```
线程池中有两个比较重要的参数会决定提交任务时任务的走向，分别是线程池的状态和线程数，但是在ThreadPoolExecutor中使用了一个AtomicInteger类型的整数ctl来表示这两个参数。估计很多人都会疑问，怎么使用一个整数表示两个参数呢，接下来我们就继续分析
首先因为涉及多线程的操作，所以这里为了保证原子性ctl参数使用了AtomicInteger类型，并且使用ctlOf方法计算出了ctl的初始值。那么是怎么计算的呢？
int类型在Java中占用4byte的内存，一个byte占用8bit，所以Java中的int类型占用32bit，对于这个32bit，可以进行高低位的拆分，ctl将32位的int拆分位了高3位和低29位，分别表示线程池的运行状态和线程池中的线程个数。
接下来通过进行位运算来验证一下ctl的工作方式。
```java
// 将-1左移29位得到RUNNING状态的值
private static final int RUNNING = -1 << COUNT_BITS;
```
首先看下RUNNING的值为-1左移29位，，在计算机中负数是以其绝对值的补码来表示的，补码是由反码加1得到的，


