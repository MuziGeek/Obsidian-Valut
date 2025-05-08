---
title: Part005 多种限流算法实现
date: 2025-05-08 00:10:56
categories:
  - - 笔记
    - 编程
    - 100test
tags:
  - Java
---
**2025-05-08**🌱上海: ☀️   🌡️+19°C 🌬️↖19km/h
# **Part005 多种限流算法实现**

1. **为什么（Why）**
    

### **1.1 项目背景**

`part005`模块实现了多种限流算法，用于解决高并发场景下服务过载问题。在微服务架构和分布式系统中，限流是保护系统稳定性的关键措施，通过控制请求速率，防止突发流量对系统造成冲击，确保核心业务的正常运行。本模块提供了多种限流算法的实现，展示了不同限流策略的特点和适用场景。

### **1.2 解决的问题**

- **系统过载保护**：通过限制请求速率，防止系统资源耗尽，保障系统稳定性。
    
- **突发流量应对**：平滑处理流量峰值，避免瞬时高并发导致系统崩溃。
    
- **资源合理分配**：根据业务优先级分配系统资源，确保核心业务正常运行。
    
- **服务质量保障**：维持系统可用性和响应时间，提供一致的服务质量。
    

2. **如何实现（How）**
    

### **2.1 项目结构**

`part005`模块的项目结构如下：

```plain
part005/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── muzi/
│   │   │           └── part5/
│   │   │               ├── Counter/                # 固定窗口计数限流
│   │   │               │   ├── CounterRateLimit.java
│   │   │               │   └── CounterRateLimitAspect.java
│   │   │               ├── SlidingWindow/          # 滑动窗口限流
│   │   │               │   ├── SlidingWindowRateLimit.java
│   │   │               │   └── SlidingWindowRateLimitAspect.java
│   │   │               ├── TokenBucket/            # 令牌桶限流
│   │   │               │   ├── TokenBucketRateLimit.java
│   │   │               │   └── TokenBucketRateLimitAspect.java
│   │   │               ├── LeakyBucket/            # 漏桶限流
│   │   │               │   ├── LeakyBucketRateLimit.java
│   │   │               │   ├── LeakyBucketLimiter.java
│   │   │               │   └── LeakyBucketRateLimitAspect.java
│   │   │               ├── SemphoreTokenBucket/    # 信号量限流
│   │   │               │   ├── FrequencyControl.java
│   │   │               │   ├── FrequncyControContainer.java
│   │   │               │   └── FrequrenControlAspect.java
│   │   │               ├── LoadRunnerUtils.java    # 压测工具类
│   │   │               ├── TestController.java     # 测试接口
│   │   │               └── part5Application.java   # 应用启动类
│   │   └── resources/                       # 配置文件
│   └── test/                                # 测试类
└── pom.xml                                  # Maven配置文件
```

### **2.2 关键技术点**

#### **2.2.1 案例分析：固定窗口计数限流**

**技术实现**： 固定窗口计数器是最简单的限流算法，它将时间划分为固定大小的窗口，并在每个窗口内进行计数：

```java
@Around("@annotation(com.muzi.part5.Counter.CounterRateLimit)")
public Object rateLimit(ProceedingJoinPoint joinPoint) throws Throwable {
    // 获取注解信息
    MethodSignature signature = (MethodSignature) joinPoint.getSignature();
    Method method = signature.getMethod();
    CounterRateLimit annotation = method.getAnnotation(CounterRateLimit.class);

    // 获取注解的参数
    int maxRequest = annotation.maxRequest();
    long timeWindowInMillis = TimeUnit.SECONDS.toMillis(annotation.timeWindow());

    // 获取方法名
    String methodName = method.toString();

    // 初始化计数器和时间戳
    AtomicInteger count = REQUEST_COUNT.computeIfAbsent(methodName, x -> new AtomicInteger(0));
    long startTime = REQUEST_TIMESTAMP.computeIfAbsent(methodName, x -> System.currentTimeMillis());

    // 获取当前时间
    long currentTimeMillis = System.currentTimeMillis();

    // 判断：如果当前时间超出时间窗口，则重置
    if (currentTimeMillis - startTime > timeWindowInMillis) {
        count.set(0);
        REQUEST_TIMESTAMP.put(methodName, currentTimeMillis);
    }

    // 原子的增加计数器并检查其值
    if (count.incrementAndGet() > maxRequest) {
        // 如果超出最大请求次数，递减计数器，并报错
        count.decrementAndGet();
        return "服务繁忙，请稍后重试";
    }

    // 方法原执行
    return joinPoint.proceed();
}
```

**原理分析**：

1. **固定窗口机制**
    
    1. 将时间划分为固定长度的窗口（如1秒、1分钟）
        
    2. 每个窗口内独立计数，窗口结束时重置计数器
        
    3. 通过注解参数控制窗口大小和最大请求数
        
2. **窗口边界问题**
    
    4. 存在临界问题：窗口切换时可能出现短时间内请求量超过限制
        
    5. 例如，两个窗口交界处（前一个窗口末尾和后一个窗口开始）可能集中大量请求
        
    6. 在高并发场景下可能导致系统瞬间过载
        
3. **实现优势**
    
    1. 算法简单，易于实现和理解
        
    2. 内存占用少，不需要记录每个请求的时间戳
        
    3. 计算复杂度低，性能高
        

#### **2.2.2 案例分析：滑动窗口限流**

**技术实现**： 滑动窗口算法通过记录请求的时间戳，动态计算时间窗口内的请求数量：

```java
@Around("@annotation(com.muzi.part5.SlidingWindow.SlidingWindowRateLimit)")
public Object rateLimit(ProceedingJoinPoint joinPoint) throws Throwable {
    // 获取注解信息和参数
    MethodSignature signature = (MethodSignature) joinPoint.getSignature();
    Method method = signature.getMethod();
    SlidingWindowRateLimit rateLimit = method.getAnnotation(SlidingWindowRateLimit.class);

    // 允许的最大请求数和滑动窗口大小(秒)
    int requests = rateLimit.maxRequest();
    int timeWindow = rateLimit.timeWindow();

    // 获取方法名和请求时间戳队列
    String methodName = method.toString();
    ConcurrentLinkedQueue<Long> requestTimes = REQUEST_TIMES_MAP.computeIfAbsent(methodName,
            k -> new ConcurrentLinkedQueue<>());

    // 当前时间和窗口开始时间
    long currentTime = System.currentTimeMillis();
    long thresholdTime = currentTime - TimeUnit.SECONDS.toMillis(timeWindow);

    // 移除窗口之前的请求记录
    while (!requestTimes.isEmpty() && requestTimes.peek() < thresholdTime) {
        requestTimes.poll();
    }

    // 检查当前窗口内的请求数是否超过限制
    if (requestTimes.size() < requests) {
        // 未超过限制，记录请求并继续执行
        requestTimes.add(currentTime);
        return joinPoint.proceed();
    } else {
        // 超过限制，返回错误信息
        return "服务繁忙，请稍后重试";
    }
}
```

**原理分析**：

1. **动态窗口机制**
    
    1. 不以固定时间点划分窗口，而是以当前时间为基准，向前推移固定时间长度
        
    2. 持续跟踪时间窗口内的请求数量，动态调整窗口范围
        
    3. 通过队列记录每个请求的时间戳，移除窗口外的过期请求
        
2. **平滑限流效果**
    
    4. 解决了固定窗口在窗口边界的突发流量问题
        
    5. 提供更平滑的限流效果，请求计数随时间连续变化
        
    6. 能够更精准地控制系统的负载
        
3. **实现特点**
    
    1. 需要额外的内存空间存储请求时间戳
        
    2. 队列操作的时间复杂度为O(1)，整体性能良好
        
    3. 适用于对限流精度要求较高的场景
        

#### **2.2.3 案例分析：令牌桶限流**

**技术实现**： 令牌桶算法基于Google Guava的RateLimiter实现，以固定速率生成令牌：

```java
@Around("@annotation(com.muzi.part5.TokenBucket.TokenBucketRateLimit)")
public Object rateLimit(ProceedingJoinPoint joinPoint) throws Throwable {
    // 获取方法和注解信息
    MethodSignature signature = (MethodSignature) joinPoint.getSignature();
    Method method = signature.getMethod();
    TokenBucketRateLimit rateLimit = method.getAnnotation(TokenBucketRateLimit.class);

    // 获取注解中定义的每秒令牌数
    double permitsPerSecond = rateLimit.permitsPerSecond();

    // 获取方法名，并创建或获取对应的限流器
    String methodName = method.toString();
    RateLimiter rateLimiter = limiters.computeIfAbsent(methodName, 
            k -> RateLimiter.create(permitsPerSecond));

    // 尝试获取令牌
    if (rateLimiter.tryAcquire()) {
        return joinPoint.proceed();
    } else {
        return "服务繁忙，请稍后重试";
    }
}
```

**原理分析**：

1. **令牌生成机制**
    
    1. 以固定速率向令牌桶中放入令牌
        
    2. 请求到达时必须先获取令牌才能继续执行
        
    3. 当令牌不足时，请求被拒绝或等待
        
2. **平滑处理突发流量**
    
    4. 允许一定程度的突发流量（取决于桶的容量）
        
    5. 长期来看，请求速率不会超过令牌生成速率
        
    6. 提供流量整形能力，使系统负载更加均衡
        
3. **主要优势**
    
    1. 对突发流量有良好的适应性
        
    2. 通过调整令牌生成速率，精确控制请求处理速度
        
    3. 支持请求预热和平滑突发流量
        

#### **2.2.4 案例分析：漏桶限流**

**技术实现**： 漏桶算法将请求比作水滴，以固定速率流出：

```java
public boolean tryAcquire() {
    long currentTime = System.currentTimeMillis();
    synchronized (this) {
        // 计算上次漏水到当前时间的时间间隔
        long leakDuration = currentTime - lastLeakTime;
        // 如果时间间隔大于等于1秒，表示漏桶已经漏出一定数量的水
        if (leakDuration >= TimeUnit.SECONDS.toMillis(1)) {
            // 计算漏出的水量
            long leakQuantity = leakDuration / TimeUnit.SECONDS.toMillis(1) * leakRate;
            // 更新桶中的水量，不能低于0
            water = (int) Math.max(0, water - leakQuantity);
            lastLeakTime = currentTime;
        }
        // 判断桶中的水量是否小于容量
        if (water < capacity) {
            water++;
            return true;
        }
    }
    // 桶满，获取令牌失败
    return false;
}
```

**原理分析**：

1. **固定出水速率**
    
    1. 无论请求速率如何，都以固定速率处理请求
        
    2. 桶满时拒绝新的请求，确保系统不会过载
        
    3. 通过漏出速率控制系统最大处理能力
        
2. **平滑流量特性**
    
    4. 即使面对突发流量，也能保持稳定的处理速率
        
    5. 完全消除了突发流量的影响，保护系统稳定
        
    6. 但缺乏对突发流量的弹性处理能力
        
3. **实现特点**
    
    1. 需要记录上次漏水时间和当前水量
        
    2. 每次请求时计算已漏出的水量
        
    3. 适合对处理速率要求严格、需要严格控制资源使用的场景
        

#### **2.2.5 案例分析：信号量限流**

**技术实现**： 基于Java并发包中的Semaphore实现并发控制：

```java
@Around("@annotation(com.muzi.part5.SemphoreTokenBucket.FrequencyControl)")
public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
    Method method = ((MethodSignature)joinPoint.getSignature()).getMethod();
    FrequencyControl[] annotationsByType = method.getAnnotationsByType(FrequencyControl.class);
    
    List<Semaphore> semaphores = new ArrayList<>();
    boolean flag = true;
    
    for (FrequencyControl frequencyControl : annotationsByType) {
        Semaphore semaphore = new Semaphore(frequencyControl.permits());
        semaphores.add(semaphore);
        boolean acquired = semaphore.tryAcquire(1, frequencyControl.timeout(), frequencyControl.unit());
        if (!acquired) {
            flag = false;
        }
    }
    
    if (flag) {
        try {
            return joinPoint.proceed();
        } finally {
            // 释放所有信号量
            for (Semaphore semaphore : semaphores) {
                semaphore.release();
            }
        }
    } else {
        return "系统繁忙，请稍后重试";
    }
}
```

**原理分析**：

1. **并发控制机制**
    
    1. 通过Semaphore控制同时执行的请求数量
        
    2. 每个请求需要获取许可才能执行，执行完毕后释放许可
        
    3. 可以设置获取许可的超时时间，避免长时间等待
        
2. **线程级别控制**
    
    4. 直接控制线程级别的执行权限，而非请求速率
        
    5. 可以精确控制系统的并发度，防止资源耗尽
        
    6. 适合控制数据库连接数、线程池等有限资源的使用
        
3. **实现优势**
    
    1. 实现简单，基于Java标准库
        
    2. 可以与其他限流算法结合使用
        
    3. 支持公平模式和非公平模式
        
## 3. **技术点详解（Detail）**
    

### **3.1 AOP实现限流**

所有限流算法都通过Spring AOP实现，主要基于以下几点：

1. **注解定义**
    
    1. 每种限流算法定义专用注解，包含必要的配置参数
        
    2. 通过注解可以灵活配置限流策略，无需修改业务代码
        
2. **环绕通知**
    
    1. 使用@Around注解实现环绕通知，在方法执行前后添加限流逻辑
        
    2. 获取注解信息，根据配置执行相应的限流算法
        
3. **非侵入式集成**
    
    1. 业务代码只需添加注解，无需关心限流实现细节
        
    2. 限流逻辑与业务逻辑解耦，便于维护和更新
        

### **3.2 限流算法对比**

各种限流算法的特点对比：

暂时无法在飞书文档外展示此内容

### **3.3 限流算法的实现要点**

1. **线程安全**
    
    1. 限流器在高并发环境下使用，必须确保线程安全
        
    2. 使用AtomicInteger、ConcurrentHashMap等并发容器
        
    3. 关键操作需使用synchronized或锁保护
        
2. **性能考量**
    
    4. 限流逻辑执行频繁，必须保证高性能
        
    5. 避免使用重量级锁，减少同步范围
        
    6. 缓存限流器实例，避免重复创建
        
3. **状态管理**
    
    1. 管理限流器状态，包括计数器、时间戳等
        
    2. 针对不同方法使用不同的限流器实例
        
    3. 有效处理限流器的生命周期
        

### **3.4 分布式限流考量**

当前实现主要针对单机场景，在分布式环境中需要考虑以下因素：

1. **全局视图**
    
    1. 需要全局视角的限流计数，通常基于Redis等分布式存储
        
    2. 服务实例间共享限流状态，确保整体限流效果
        
2. **一致性问题**
    
    1. 分布式环境下的计数一致性保障
        
    2. CAP理论下的取舍，通常选择可用性和分区容错性
        
3. **性能开销**
    
    1. 分布式限流引入网络通信开销
        
    2. 需要平衡限流精度和性能成本
        
## 4. **使用示例（Usage）**
    

### **4.1 固定窗口计数限流**

```java
@GetMapping("/counter")
@CounterRateLimit(maxRequest = 50, timeWindow = 2)
public String counter() {
    return "下单成功";
}
```

配置说明：

- maxRequest：时间窗口内允许的最大请求数
    
- timeWindow：时间窗口大小，单位为秒
    

### **4.2 滑动窗口限流**

```java
@GetMapping("/slidingWindow")
@SlidingWindowRateLimit(maxRequest = 50, timeWindow = 2)
public String slidingWindow() {
    return "下单成功";
}
```

配置说明：

- maxRequest：滑动窗口内允许的最大请求数
    
- timeWindow：滑动窗口大小，单位为秒
    

### **4.3 令牌桶限流**

```java
@GetMapping("/tokenBucket")
@TokenBucketRateLimit(permitsPerSecond = 50)
public String tokenBucket() {
    return "下单成功";
}
```

配置说明：

- permitsPerSecond：每秒生成的令牌数量
    

### **4.4 漏桶限流**

```java
@GetMapping("/leakyBucket")
@LeakyBucketRateLimit(capacity = 50, leakRate = 2)
public String leakyBucket() {
    return "下单成功";
}
```

配置说明：

- capacity：漏桶容量
    
- leakRate：漏出速率，单位为每秒
    

### **4.5 信号量限流**

```java
@GetMapping("/placeOrder")
@FrequencyControl(permits = 50, timeout = 1)
public String placeOrder() throws InterruptedException {
    TimeUnit.SECONDS.sleep(2);
    return "下单成功";
}
```

配置说明：

- permits：允许的并发数
    
- timeout：获取许可的超时时间，单位为秒
    

## 5. **总结与优化方向（Summary）**
    

### **5.1 技术总结**

本模块实现了多种限流算法，解决了高并发场景下的服务保护问题：

1. 提供了从简单到复杂的多种限流方案，适应不同的业务场景
    
2. 通过AOP实现非侵入式集成，便于在项目中灵活应用
    
3. 各种算法各有特点，可以根据具体需求选择适合的方案
    
4. 良好的代码结构和注释，便于理解和扩展
    

### **5.2 优化方向**

1. **分布式限流支持**
    
    1. 基于Redis实现分布式限流，解决集群环境下的限流问题
        
    2. 使用Redis的Lua脚本保证原子性操作
        
2. **自适应限流**
    
    1. 根据系统负载动态调整限流参数
        
    2. 结合机器学习算法预测流量，提前调整限流策略
        
3. **多维度限流**
    
    1. 支持基于IP、用户ID、接口等多维度限流
        
    2. 实现更精细化的流量控制
        
4. **流量调度**
    
    1. 按优先级处理请求，保证核心业务
        
    2. 实现请求排队和延迟处理机制
        
5. **监控和可视化**
    
    1. 提供限流指标的监控和统计
        
    2. 开发可视化界面，便于运维人员调整限流策略