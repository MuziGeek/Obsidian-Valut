---
title: 解决超卖的四种方案
date: 2025-05-08 00:09:50
categories:
 - [笔记, 编程, 100test]
tags:
  - Java
---
**2025-05-08**🌱上海: ☀️   🌡️+19°C 🌬️↖19km/h
# **Part004技术实现文档**

1. ### **为什么（Why）**
    

### **1.1 项目背景**

`part004`模块实现了一个基于Java的并发安全解决方案，主要针对高并发场景下的商品库存管理（秒杀、抢购）等问题。在电商系统中，库存超卖是一个典型的并发问题，若不妥善处理，可能导致系统数据不一致，影响业务正常运行和用户体验。本模块提供了多种解决方案，系统地解决并发安全问题。

### **1.2 解决的问题**

- **库存超卖问题**：确保在高并发抢购场景下，商品库存不会出现负数，实际售出数量不超过库存数量。
    
- **并发数据修改安全**：解决多线程/多进程并发修改同一数据时的数据一致性问题。
    
- **性能与安全平衡**：在保证数据一致性的同时，尽量减少锁的使用，提高系统并发处理能力。
    
- **通用解决方案**：提供可复用的并发安全框架，适用于各种并发数据修改场景。
    

2. ### **如何实现（How）**
    

### **2.1 项目结构**

`part004`模块的项目结构如下：

```Plain
part004/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── muzi/
│   │   │           ├── part4Application.java          # 应用启动类
│   │   │           └── part4/
│   │   │               ├── concurrencysafe/           # 并发安全框架
│   │   │               │   ├── CasDbConcurrencySafe.java      # 基于乐观锁的并发安全实现
│   │   │               │   ├── ConcurrencyFailException.java  # 并发失败异常
│   │   │               │   └── DbConcurrencySafe.java         # 并发安全接口
│   │   │               ├── controller/                # 控制层
│   │   │               │   └── TestController.java            # 测试接口
│   │   │               ├── mapper/                    # MyBatis映射接口
│   │   │               │   ├── ConcurrencySafeMapper.java     # 并发安全辅助表操作接口
│   │   │               │   └── GoodsMapper.java               # 商品表操作接口
│   │   │               ├── po/                        # 持久化对象
│   │   │               │   ├── ConcurrencySafePO.java         # 并发安全辅助表实体
│   │   │               │   └── GoodsPO.java                   # 商品表实体
│   │   │               ├── service/                   # 业务层
│   │   │               │   ├── GoodsService.java              # 商品服务接口
│   │   │               │   └── GoodsServiceImpl.java          # 商品服务实现
│   │   │               └── utils/                     # 工具类
│   │   │                   └── IdUtils.java                   # ID生成工具
│   │   └── resources/
│   │       ├── mapper/                        # MyBatis映射文件
│   │       │   ├── ConcurrencySafeMapper.xml
│   │       │   └── GoodsMapper.xml
│   │       ├── db/                            # 数据库脚本
│   │       │   └── init.sql
│   │       └── application.yml                # 应用配置
│   └── test/
│       └── java/                              # 测试类
└── pom.xml                                    # Maven配置文件
```

### **2.2 关键技术点**

#### **2.2.1 案例分析：并发安全的多种解决方案**

**技术实现**： 本模块实现了多种解决商品库存超卖的方案，每种方案各有特点：

1. **方案一：SQL条件判断**
    

```Java
// 使用SQL中的条件判断确保库存足够才能扣减
int placeOrder1(@Param("goodsId") String goodsId, @Param("num") int num);

// 对应的SQL实现
update t_goods set num = num - ${num} where goods_id = #{goodsId} and num - #{num} >= 0
```

2. **方案二：乐观锁**
    

```Java
// 使用版本号实现乐观锁机制
int placeOrder2(@Param("goodsId") String goodsId, @Param("num") int num, @Param("expectVersion") long expectVersion);

// 对应的SQL实现
update t_goods set num = num - ${num}, version = version + 1 where goods_id = #{goodsId} and version = #{expectVersion}
```

3. **方案三：事务内比对**
    

```Java
// 在事务中对比修改前后的数据，确保一致性
int reduceStockResult = this.transactionTemplate.execute(action -> {
    // 执行更新扣减库存
    this.goodsMapper.placeOrder3(goodsId, 1);
    
    // 修改数据完成后，查出来看一下，和期望的结果是不是一致的
    GoodsPO updateAfterGoods = this.getById(goodsId);
    
    // 判断：库存扣减前的数量是否等于 扣减后库存数量+1
    if (updateBeforeGoods.getNum() - 1 != updateAfterGoods.getNum()) {
        // 设置事务回滚
        action.setRollbackOnly();
        return 0;
    } else {
        // 成功
        return 1;
    }
});
```

4. **方案四：通用并发安全框架**
    

```Java
// 使用通用并发安全框架解决超卖问题
return this.dbConcurrencySafe.exec(GoodsPO.class, goodsId, () -> {
    // 1、根据商品id获商品
    GoodsPO goodsPO = this.getById(goodsId);
    
    // 2、判断库存是否够
    if (goodsPO.getNum() == 0) {
        return 0;
    }
    // 3、执行更新扣减库存
    this.goodsMapper.placeOrder3(goodsId, 1);
    return 1;
});
```

**原理分析**：

1. **SQL条件判断方案**
    
    1. 利用数据库的原子性操作，在SQL语句中添加条件判断
        
    2. 优点：实现简单，性能好，不需要额外的表或字段
        
    3. 缺点：仅适用于简单的数据修改场景，复杂业务逻辑难以处理
        
2. **乐观锁方案**
    
    4. 使用版本号控制并发修改，每次修改都会增加版本号
        
    5. 优点：不需要显式加锁，适合读多写少的场景
        
    6. 缺点：高并发下会有较多失败请求，需要客户端重试
        
3. **事务内比对方案**
    
    1. 在事务中比对修改前后的数据，确保符合预期才提交
        
    2. 优点：可以处理复杂的业务逻辑，不仅限于简单的库存递减
        
    3. 缺点：需要额外的查询操作，增加了数据库负担
        
4. **通用并发安全框架方案**
    
    4. 使用辅助表和乐观锁实现通用的并发安全控制
        
    5. 优点：框架化设计，可以应用于任何并发数据修改场景
        
    6. 缺点：实现相对复杂，需要维护额外的辅助表
        

#### **2.2.2 案例分析：通用并发安全框架设计**

**技术实现**： `DbConcurrencySafe`接口定义了通用的并发安全操作框架：

```Java
public interface DbConcurrencySafe {
    /**
     * 对同一个key，此方法可以确保 callback 中修改db数据的安全性
     */
    <T> T exec(String key, Supplier<T> callback, Consumer<T> successCallBack, Consumer<ConcurrencyFailException> failCallBack);
    
    /**
     * 针对特定PO类和ID的便捷方法
     */
    default <T> T exec(Class<?> po, String id, Supplier<T> callback) {
        return exec(String.format("%s:%s", po.getName(), id), callback, null, null);
    }
}
```

`CasDbConcurrencySafe`类实现了这个接口，通过乐观锁机制确保数据修改的安全性：

```Java
@Component
public class CasDbConcurrencySafe implements DbConcurrencySafe {
    @Override
    public <T> T exec(String key, Supplier<T> callback, Consumer<T> successCallBack, Consumer<ConcurrencyFailException> failCallBack) {
        return transactionTemplate.execute(status -> {
            // 1、获取或创建 ConcurrencySafePO
            ConcurrencySafePO po = this.getAndCreate(key);
            
            // 2、执行业务操作
            T result = callback.get();
            
            // 3、乐观锁更新 ConcurrencySafePO
            int updateCount = this.concurrencySafeMapper.optimisticUpdate(po);
            
            // 更新成功，执行成功回调
            if (updateCount == 1 && successCallBack != null) {
                successCallBack.accept(result);
            }
            
            // 更新失败，说明数据被他人修改
            if (updateCount == 0) {
                ConcurrencyFailException exception = new ConcurrencyFailException(key, "并发修改失败!");
                if (failCallBack != null) {
                    failCallBack.accept(exception);
                } else {
                    throw exception; // 抛出异常，触发事务回滚
                }
            }
            return result;
        });
    }
}
```

**原理分析**：

1. **辅助表设计**
    
    1. 创建专门的并发安全辅助表，记录每个业务数据的并发控制信息
        
    2. 使用业务实体的类名和ID组合作为辅助表的key，确保唯一性
        
2. **函数式编程**
    
    1. 使用`Supplier`和`Consumer`函数式接口，将业务逻辑和并发控制分离
        
    2. 通过回调函数处理成功和失败场景，提高框架灵活性
        
3. **事务控制**
    
    1. 整个操作在事务中执行，确保数据一致性
        
    2. 乐观锁更新失败时自动抛出异常，触发事务回滚
        
4. **通用性设计**
    
    1. 框架可适用于任何需要并发控制的数据修改场景
        
    2. 不侵入业务代码，通过包装业务逻辑实现并发控制
        

#### **2.2.3 案例分析：并发抢购测试**

**技术实现**： `GoodsServiceImpl`类中实现了并发抢购的测试方法：

```Java
private void concurrentPlaceOrderMock(String method, Function<String, Integer> fun) throws InterruptedException {
    // 1、初始化商品数据：10个库存
    String goodsId = "1", goodsName = "iphone";
    int num = 10;
    GoodsPO goodsStart = this.initTestData(goodsId, goodsName, num);

    // 2、创建线程池，模拟100个线程并发下单
    int concurrentNum = 100;
    ExecutorService executorService = Executors.newFixedThreadPool(concurrentNum);
    CountDownLatch countDownLatch = new CountDownLatch(concurrentNum);
    AtomicInteger successNum = new AtomicInteger(0);
    AtomicInteger failNum = new AtomicInteger(0);

    // 使用线程池模拟100人抢购
    for (int i = 0; i < concurrentNum; i++) {
        executorService.execute(() -> {
            try {
                // 调用抢购函数，1表示成功，0表示失败
                int update = fun.apply(goodsId);
                if (update == 0) {
                    failNum.incrementAndGet();
                } else {
                    successNum.incrementAndGet();
                }
            } finally {
                countDownLatch.countDown();
            }
        });
    }

    // 等待所有抢购线程完成
    countDownLatch.await();
    
    // 输出抢购结果
    GoodsPO goodsEnd = this.getById(goodsId);
    System.out.println(String.format("抢购前，商品库存：%s", goodsStart.getNum()));
    System.out.println(String.format("抢购后，商品库存：%s", goodsEnd.getNum()));
    System.out.println(String.format("下单成功人数：%s", successNum.get()));
    System.out.println(String.format("下单失败人数：%s", failNum.get()));
}
```

**原理分析**：

1. **测试设计**
    
    1. 初始化有限数量的商品库存（10个）
        
    2. 使用远超库存数量的线程（100个）模拟高并发抢购
        
    3. 验证最终库存是否为0，成功人数是否等于初始库存
        
2. **函数式设计**
    
    4. 使用`Function`函数式接口传入不同的抢购策略
        
    5. 相同的测试框架可以测试不同的并发控制方案
        
3. **结果验证**
    
    1. 通过比较抢购前后的库存和成功/失败人数，验证并发控制的有效性
        
    2. 成功案例应满足：最终库存为0，成功人数等于初始库存，无超卖情况
        
## 3. **技术点详解（Detail）**
    

### **3.1 数据库设计**

本模块使用了两个数据库表：

1. **商品表 (t_goods)**
    

```SQL
create table if not exists t_goods (
    goods_id   varchar(32) primary key comment '商品id',
    goods_name varchar(256) not null comment '商品名称',
    num        int          not null comment '库存',
    version    bigint default 0 comment '系统版本号'
) comment = '商品表';
```

2. **并发安全辅助表 (t_concurrency_safe)**
    

```SQL
create table if not exists t_concurrency_safe (
    id       varchar(32) primary key comment 'id',
    safe_key varchar(256) not null comment '需要保护的数据的唯一的key',
    version  bigint default 0 comment '系统版本号，默认为0，每次更新+1',
    UNIQUE KEY `uq_safe_key` (`safe_key`)
) comment = '并发安全辅助表';
```

特点分析：

- 商品表包含版本号字段，支持乐观锁机制
    
- 并发安全辅助表通过唯一键约束确保每个业务数据只有一条对应记录
    
- 辅助表的设计与业务数据解耦，可以应用于任何需要并发控制的场景
    

### **3.2 乐观锁与悲观锁对比**

本模块主要使用乐观锁机制解决并发问题，下面是乐观锁与悲观锁的对比：

1. **乐观锁特点**
    
    1. 假设冲突很少发生，只在数据提交时检查是否有冲突
        
    2. 通常使用版本号或时间戳实现，每次修改都会更新版本号
        
    3. 适合读多写少的场景，并发性能好
        
2. **悲观锁特点**
    
    4. 假设冲突经常发生，提前锁定资源，阻止其他事务访问
        
    5. 通常使用数据库的行锁、表锁或Java的synchronized等机制实现
        
    6. 适合写多读少的场景，但会降低并发性能
        
3. **乐观锁优势**
    
    1. 不需要加锁，减少数据库锁等待，提高并发性能
        
    2. 适合高并发、读多写少的互联网应用
        
    3. 实现相对简单，不涉及复杂的锁管理
        
4. **悲观锁劣势**
    
    4. 加锁操作会导致其他事务等待，降低并发性能
        
    5. 可能导致死锁，需要额外的死锁检测机制
        
    6. 长事务持有锁时间长，影响系统整体吞吐量
        

### **3.3 并发安全框架设计分析**

`DbConcurrencySafe`并发安全框架的设计思想：

1. **分离关注点**
    
    1. 将并发控制和业务逻辑分离，业务代码关注业务处理，框架负责并发安全
        
    2. 使用函数式编程和回调机制实现代码分离
        
2. **三步操作的原子性**
    
    1. 数据操作通常包含三个步骤：查询数据、内存中修改、保存到数据库
        
    2. 框架确保这三个步骤作为一个整体原子执行，避免并发修改问题
        
3. **乐观锁控制**
    
    1. 使用辅助表记录版本信息，通过乐观锁机制控制并发
        
    2. 更新失败时自动触发回滚，确保数据一致性
        
4. **事务管理**
    
    1. 所有操作在一个事务中执行，确保数据一致性
        
    2. 使用Spring的`TransactionTemplate`管理事务，简化代码
        

### **3.4 商品超卖问题分析**

商品超卖是电商系统中常见的并发问题，主要原因：

1. **读-改-写问题**
    

```Plain
线程A读取库存为10
线程B读取库存为10
线程A计算新库存为9，并写入
线程B计算新库存为9，并写入（实际应为8）
```

1. **解决思路**
    
    1. 保证读-改-写的原子性
        
    2. 使用数据库级别的锁或条件控制
        
    3. 使用应用级别的乐观锁或悲观锁
        
    4. 设计特殊的辅助表或缓存结构
        
2. **性能与正确性平衡**
    
    1. 简单的悲观锁方案可以确保正确性，但会大幅降低并发性能
        
    2. 乐观锁在高并发下会有较高的失败率，需要重试机制
        
    3. 需要根据业务场景和并发量选择适当的解决方案
        
## 4.  **使用示例（Usage）**
    

### **4.1 方案一：SQL条件判断**

```Java
// 控制器调用
@GetMapping("/test1")
public String test1() throws InterruptedException {
    this.goodsService.placeOrder1();
    return "ok";
}

// 服务实现
@Override
public void placeOrder1() throws InterruptedException {
    Function<String, Integer> reduceStock = (String goodsId) -> {
        int update = goodsMapper.placeOrder1(goodsId, 1);
        return update;
    };
    this.concurrentPlaceOrderMock("方案1", reduceStock);
}

// SQL语句
update t_goods set num = num - ${num} where goods_id = #{goodsId} and num - #{num} >= 0
```

### **4.2 方案二：乐观锁**

```Java
// 控制器调用
@GetMapping("/test2")
public String test2() throws InterruptedException {
    this.goodsService.placeOrder2();
    return "ok";
}

// 服务实现
@Override
public void placeOrder2() throws InterruptedException {
    Function<String, Integer> reduceStock = (String goodsId) -> {
        // 1、先查询
        GoodsPO goodsPO = this.getById(goodsId);
        
        // 2、判断库存是否==0
        if (goodsPO.getNum() == 0) {
            return 0;
        }
        
        // 3、带版本号更新库存
        int update = goodsMapper.placeOrder2(goodsId, 1, goodsPO.getVersion());
        return update;
    };
    this.concurrentPlaceOrderMock("方案2", reduceStock);
}

// SQL语句
update t_goods set num = num - ${num}, version = version + 1 
where goods_id = #{goodsId} and version = #{expectVersion}
```

### **4.3 方案三：事务内比对**

```Java
// 控制器调用
@GetMapping("/test3")
public String test3() throws InterruptedException {
    this.goodsService.placeOrder3();
    return "ok";
}

// 服务实现
@Override
public void placeOrder3() throws InterruptedException {
    Function<String, Integer> reduceStock = (String goodsId) -> {
        // 1、获取商品
        GoodsPO updateBeforeGoods = this.getById(goodsId);
        
        // 2、判断库存是否够
        if (updateBeforeGoods.getNum() == 0) {
            return 0;
        }
        
        // 在事务中执行并验证
        int reduceStockResult = this.transactionTemplate.execute(action -> {
            // 3、执行更新扣减库存
            this.goodsMapper.placeOrder3(goodsId, 1);
            
            // 4、修改后查询验证
            GoodsPO updateAfterGoods = this.getById(goodsId);
            
            // 5、验证是否符合预期
            if (updateBeforeGoods.getNum() - 1 != updateAfterGoods.getNum()) {
                action.setRollbackOnly();
                return 0;
            } else {
                return 1;
            }
        });
        return reduceStockResult;
    };
    this.concurrentPlaceOrderMock("方案3", reduceStock);
}
```

### **4.4 方案四：通用并发安全框架**

```Java
// 控制器调用
@GetMapping("/test4")
public String test4() throws InterruptedException {
    this.goodsService.placeOrder4();
    return "ok";
}

// 服务实现
@Override
public void placeOrder4() throws InterruptedException {
    Function<String, Integer> reduceStock = (String goodsId) -> {
        try {
            // 使用通用并发安全框架
            return this.dbConcurrencySafe.exec(GoodsPO.class, goodsId, () -> {
                // 1、获取商品
                GoodsPO goodsPO = this.getById(goodsId);
                
                // 2、判断库存
                if (goodsPO.getNum() == 0) {
                    return 0;
                }
                
                // 3、扣减库存
                this.goodsMapper.placeOrder3(goodsId, 1);
                return 1;
            });
        } catch (ConcurrencyFailException e) {
            return 0;
        } catch (Exception e) {
            return 0;
        }
    };
    this.concurrentPlaceOrderMock("方案4", reduceStock);
}
```

## 5. **总结与优化方向（Summary）**
    

### **5.1 技术总结**

本模块实现了多种并发安全处理方案，重点解决了商品超卖问题：

1. 提供了从简单到复杂的四种解决方案，适应不同的业务场景
    
2. 设计了通用的并发安全框架，可以应用于各种数据并发修改场景
    
3. 通过实际的多线程测试验证了各方案的有效性
    
4. 结合了SQL、乐观锁、事务控制等多种技术，全面解决并发问题
    

### **5.2 优化方向**

1. **分布式锁扩展**
    
    1. 当前方案适用于单体应用，可扩展为支持分布式环境
        
    2. 结合Redis或Zookeeper实现分布式锁，解决跨节点的并发问题
        
2. **性能优化**
    
    1. 减少数据库访问次数，可使用缓存预热热点商品库存
        
    2. 引入多级缓存架构，减轻数据库压力
        
3. **限流和流量整形**
    
    1. 增加限流机制，控制系统入口流量
        
    2. 实现请求排队和流量削峰，避免瞬时高并发
        
4. **异步处理**
    
    1. 考虑将部分操作异步化，如库存扣减成功后的订单处理
        
    2. 使用消息队列实现请求异步处理，提高系统吞吐量
        
5. **监控和报警**
    
    1. 增加并发处理的监控指标，如成功率、失败率、响应时间等
        
    2. 建立异常报警机制，及时发现并发问题