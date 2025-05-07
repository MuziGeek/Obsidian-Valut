---
title: 多线程任务批处理通用工具类
date: 2025-05-07 23:56:41
categories:
  - - 笔记
    - 编程
    - 100test
tags:
  - Java
---
**2025-05-07**🌱上海: ☀️   🌡️+19°C 🌬️↖19km/h

# Part002 多线程人物批处理通用工具类

在项目中一般都会有些需要多线程处理任务的场景，比如短信发送、数据同步等批处理任务，对于这些任务，一般的实现方式都是使用线程池处理，但是对于开发经验比较久的程序员都会采用一种更优雅的方式，因为以上的场景属于通用型的场景，很多业务都会用到，所以我们可以通过一个工具类来实现这个功能。接下来分别展示下两种实现代码。

# 普通实现方式

通过线程池和CountDownLatch来实现

```java
public static void batchTaskTest(){
    long startTime =System.currentTimeMillis();
    List<String> messgList = new ArrayList<>();
    for (int i = 0; i <50 ; i++) {
        messgList.add("短信-"+i);
    }
    ExecutorService executorService = Executors.newFixedThreadPool(10);
    CountDownLatch countDownLatch = new CountDownLatch(messgList.size());
    for (String mess:
         messgList) {

        executorService.execute(()->{
            try {
                //交个线程池处理任务
                disposeTask(mess);
            } finally {
                //处理完成后调用 countDownLatch.countDown()
                countDownLatch.countDown();
            }

        });

    }
    try {
        //阻塞当前线程池
        countDownLatch.await();
    } catch (InterruptedException e) {
        throw new RuntimeException(e);
    }
    System.out.println("任务处理完毕,耗时(ms):" + (System.currentTimeMillis() - startTime));
    executorService.shutdown();

}
```

# 通用实现方式

主要通过函数式编程接口把需要处理的任务类型抽了出来，这样就可以使相同的业务场景处理下可以使用通用实现方式处理。

```java
/**
 * 使用线程池批处理文件，当所有任务处理完毕后才会返回
 *
 * @param taskList 任务列表
 * @param consumer 处理任务的方法(函数式编程)
 * @param executor 线程池
 * @param <T>
 * @throws InterruptedException
 */
public static <T> void dispose(List<T> taskList, Consumer<? super T> consumer, Executor executor) throws InterruptedException {
    if (taskList == null || taskList.size() == 0) {
        return;
    }
    Objects.nonNull(consumer);

    CountDownLatch countDownLatch = new CountDownLatch(taskList.size());
    for (T item : taskList) {
        executor.execute(() -> {
            try {
                consumer.accept(item);
            } finally {
                countDownLatch.countDown();
            }
        });
    }
    countDownLatch.await();
}

public static void main(String[] args) throws InterruptedException {
    long startTime = System.currentTimeMillis();
    //任务列表
    List<String> taskList = new ArrayList<>();
    for (int i = 0; i < 50; i++) {
        taskList.add("短信-" + i);
    }

    ExecutorService executorService = Executors.newFixedThreadPool(10);
    //调用工具类批处理任务
    com.muzi.TaskDisposeUtils.dispose(taskList, com.muzi.TaskDisposeUtils::disposeTask, executorService);

    System.out.println("任务处理完毕,耗时(ms):" + (System.currentTimeMillis() - startTime));
    executorService.shutdown();
}
```
  