---
title: Day30
date: 2025-01-22 21:07:57
categories:
  - - 笔记
    - 编程
    - 面试训练营
tags:
  - JUC
---
**2025-01-22**🌱上海: ☀️   🌡️+12°C 🌬️↖14km/h
## 说说AQS吧

全称`AbstractQueuedSynchronizer` （抽象队列同步器），AQS是很多同步器的基础框架，比如`ReentranLock`、`CountDownLatch`和`Semaphore`等都是基于AQS实现的，简单来说，AQS就是起到了一个抽象、封装的作用，其中提供一系列关于同步的排队、入队、加锁、中断等方法，通过实现这些方法，可以生成自定义的同步器。

AQS内部主要维护了一个**volatile的int类型的state变量**和**一个FIFO队列**，在state=1的时候表示当前的锁已经被占有了，0表示未被占用。

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1737547615644-d3fd4cdd-f32f-4b98-adb4-c3032db40c5a.png)

**工作流程如下图所示：**

**FIFO队列用来实现多线程的排队工作，当线程加锁失败时，该线程会被封装成一个Node节点置于队列尾部**

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1737548249049-351977e1-d2c6-4a7a-8dea-556ec6c69983.png)

当持有锁的线程释放锁时，AQS会将等待队列中的第一个线程唤醒，并让其重新尝试获取锁

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1737548532709-5b278251-991f-46ed-9657-2bb61033ed2c.png)

### 同步状态-State

AQS使用一个`volatile` int类型的成员变量来表示同步状态，在state=1的时候表示当前对象锁已经被占有了。它提供了三个基本方法来操作同步状态：`getState()`, `setState(int newState),` 和 `compareAndSetState(int expect, int update)`。这些方法允许在不同的同步实现中自定义资源的共享和独占方式。

```
// 同步状态
private volatile int state;

// 获取状态
protected final int getState() {
    return state;
}

// 设置状态
protected final void setState(int newState) {
    state = newState;
}

// CAS更新状态
protected final boolean compareAndSetState(int expect, int update) {
    // See below for intrinsics setup to support this
    return unsafe.compareAndSwapInt(this, stateOffset, expect, update);
}
```

### FIFO队列-Node

AQS内部通过一个内部类Node来实现同步队列的功能的，当线程尝试获取资源失败时，AQS会将该线程包装成一个Node节点，然后将其插入到同步队列的尾部。在锁资源被释放的时候，队列头部的节点会尝试再次通过CAS获取资源，同时Node也用于构建条件队列，当线程需要等待某个条件时就会被加入到条件队列中，条件满足则会被转移回同步队列。

```

// Node类用于构建队列
static final class Node {
    // 标记节点状态。常见状态有 CANCELLED（表示线程取消）、SIGNAL（表示后继节点需要运行）、CONDITION（表示节点在条件队列中）等。
    volatile int waitStatus;
    // 前驱节点
    volatile Node prev;
    // 后继节点
    volatile Node next;
    // 节点中的线程，存储线程引用，指向当前节点所代表的线程。
    volatile Thread thread;
}

// 队列头节点，延迟初始化。只在setHead时修改
private transient volatile Node head;
// 队列尾节点，延迟初始化。
private transient volatile Node tail;

// 入队操作
private Node enq(final Node node) {
    for (;;) {
        Node t = tail;
        if (t == null) { // 必须先初始化
            if (compareAndSetHead(new Node()))
                tail = head;
        } else {
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t;
            }
        }
    }
}
```

**类的继承关系图**

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1737549746092-f26b915c-e779-41ad-9886-3f5bd4c44b03.png)

**AQS中的阻塞队列是一个CLH队列，CLH队列是一种用于实现自旋锁的有效数据结构。**

### 同步队列和条件队列

#### 同步队列

AQS总共有两种队列，分别是同步队列，用于实现锁的获取和释放，另一种是条件队列，用于特定条件下管理线程的等待和唤醒，两者都是FIFO队列。

同步队列主要用于实现锁的获取和释放，比如我们常用的`ReentranLock`，就是基于同步队列来实现的，**它的实现原理较为简单：**

```
private Node addWaiter(Node mode) {
    Node node = new Node(Thread.currentThread(), mode);
    // 尝试快速路径：直接尝试在尾部插入节点
    Node pred = tail;
    if (pred != null) {
        node.prev = pred;
        if (compareAndSetTail(pred, node)) {
            pred.next = node;
            return node;
        }
    }
    // 快速路径失败时，进入完整的入队操作
    enq(node);
    return node;
}

private Node enq(final Node node) {
    for (;;) {
        Node t = tail;
        if (t == null) { // 队列为空，初始化
            if (compareAndSetHead(new Node()))
                tail = head;
        } else {
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t;
            }
        }
    }
}
```

当一个线程尝试获取锁并失败时，AQS会将该线程包装成一个Node节点并加入到队列的尾部。这个节点会处于等待状态，直到锁资源被其他线程释放。当锁被释放时，持有锁的线程会通知其后继节点（如果存在的话），后继线程尝试获取锁，这个过程会一直持续到有线程成功获取锁或队列为空。

#### 条件队列

条件队列用于实现条件变量，实现了线程间的协调和通信。允许线程在特定条件不满足的时候挂起，等到其他线程改变了条件并显式的唤醒等待在该条件队列上的线程，一个典型的条件队列使用场景就是`ReentranLock`的`Condition`。

`ConditionObject`是AQS的一个内部类，用于实现条件变量。条件变量是并发编程中一种用于线程间通信的机制，它允许一个或多个线程在特定条件成立之前等待，同时释放相关的锁。这在某种程度上类似于对象监视器模式中的`wait()`和`notify()`方法，但提供了更灵活和更强大的控制。

```

public class ConditionObject implements Condition, java.io.Serializable {
    // 条件队列的首尾节点
    private transient Node firstWaiter;
    private transient Node lastWaiter;
    // ...
}
```

**它的主要实现原理如下：**

```
public final void await() throws InterruptedException {
    // 如果当前线程在进入此方法之前已经被中断了，则直接抛出InterruptedException异常。
    if (Thread.interrupted())
        throw new InterruptedException();
    
    // 将当前线程加入到等待队列中。
    Node node = addConditionWaiter();
    
    // 释放当前线程所持有的锁，并返回释放前的状态，以便以后可以重新获取到相同数量的锁。
    int savedState = fullyRelease(node);
    
    // 中断模式，用于记录线程在等待过程中是否被中断。
    int interruptMode = 0;
    
    // 如果当前节点不在同步队列中，则表示线程应该继续等待。
    while (!isOnSyncQueue(node)) {
        // 阻塞当前线程，直到被唤醒或中断。
        LockSupport.park(this);
        
        // 检查线程在等待过程中是否被中断，并更新interruptMode状态。
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
            break;
    }
    
    // 当节点成功加入到同步队列后，尝试以中断模式获取锁。
    // 如果在此过程中线程被中断，且不是在signal之后，则设置中断模式为REINTERRUPT。
    if (acquireQueued(node, savedState) && interruptMode != THROW_IE)
        interruptMode = REINTERRUPT;
    
    // 如果节点后面还有等待的节点，从等待队列中清理掉被取消的节点。
    if (node.nextWaiter != null) // clean up if cancelled
        unlinkCancelledWaiters();
    
    // 根据中断模式处理中断。
    if (interruptMode != 0)
        reportInterruptAfterWait(interruptMode);
}
```

当线程调用了`Condition`的`await()`方法后，它会释放当前持有的锁，并且该线程会被加入到条件队列中等待。直到被另一线程的`signl()`（唤醒等待队列中的头节点对应的线程）或者`signlAll()`（唤醒所有等待的线程）方法唤醒或者被中断。

```
public final void signal() {
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();
    Node first = firstWaiter;
    if (first != null)
        doSignal(first);
}

private void doSignal(Node first) {
    do {
        if ( (firstWaiter = first.nextWaiter) == null)
            lastWaiter = null;
        first.nextWaiter = null;
    } while (!transferForSignal(first) &&
             (first = firstWaiter) != null);
}
```

**两者的主要区别：**

- 同步队列主要用于管理锁的释放和获取，条件队列用于等待特定条件的满足
- 同步队列是AQS自动管理的，条件队列需要显式的调用等待（await）和通知（signal/signalAll）方法
- 同步队列式所有基于AQS同步器共享的，每个同步器实例只有一个同步队列；条件队列是每个Condition实例特有的，一个同步器可以有多个Condition对象，因此也就可以有多个条件队列。
## Synchronized 和 ReentrantLock 有什么区别？

两者都用于线程的同步控制，同时都是可重入锁，但是在功能上来说区别还是挺大的

- **synchronized是Java内置的关键字，而ReentranLock是通过Java代码实现的**
- **synchronized是可以自动获取/释放锁的，但是ReentrantLock需要手动获取/释放锁。**
- **ReentrantLock还具有响应中断、超时等待等特性。**
- **ReentrantLock可以实现公平锁和非公平锁，而synchronized只是非公平锁。**

很多年前，`synchronized`性能不如`ReentrantLock`，现在基本上性能是一致的，一般情况下用`synchronized`就可以了。

同时在JDK21的发布，推出了虚拟线程，在虚拟线程中不建议使用`synchronized`**，**而是建议使用`ReentrantLock`。
### ReentranLock用法

```
 private final ReentrantLock lock = new ReentrantLock();

    // lock() 方法：获取锁
    public void useLockMethod() {
        lock.lock();
        try {
            System.out.println("使用 lock() 方法获取锁，开始执行受保护的代码块");
            // 这里是受保护的代码块，可以进行一些线程安全的操作
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            lock.unlock();
            System.out.println("使用 lock() 方法释放锁");
        }
    }
```

1. **lock () 方法**：

- `lock.lock()`：获取锁。如果锁不可用，则当前线程将被阻塞，直到锁可用。
- 在 `try` 块中执行受保护的代码操作。
- `lock.unlock()`：在 `finally` 块中释放锁，确保无论代码块是否抛出异常，锁都能正常释放。

```
// tryLock() 方法：尝试获取锁，若能获取则立即返回 true，否则返回 false
    public void useTryLockMethod() {
        if (lock.tryLock()) {
            try {
                System.out.println("使用 tryLock() 方法成功获取锁，开始执行受保护的代码块");
                // 这里是受保护的代码块，可以进行一些线程安全的操作
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            } finally {
                lock.unlock();
                System.out.println("使用 tryLock() 方法释放锁");
            }
        } else {
            System.out.println("使用 tryLock() 方法未能获取锁");
        }
    }
```

2. **tryLock () 方法**：

- `lock.tryLock()`：尝试获取锁，如果锁可用，则立即获取并返回 `true`，否则返回 `false`。
- 如果获取成功，在 `try` 块中执行受保护的操作，并在 `finally` 块中释放锁；如果失败，执行相应的失败处理逻辑。

```
// tryLock(long timeout, TimeUnit unit) 方法：在指定时间内尝试获取锁，能获取则返回 true，否则返回 false
    public void useTryLockWithTimeoutMethod() {
        try {
            if (lock.tryLock(2, java.util.concurrent.TimeUnit.SECONDS)) {
                try {
                    System.out.println("使用 tryLock(long timeout, TimeUnit unit) 方法成功获取锁，开始执行受保护的代码块");
                    // 这里是受保护的代码块，可以进行一些线程安全的操作
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                } finally {
                    lock.unlock();
                    System.out.println("使用 tryLock(long timeout, TimeUnit unit) 方法释放锁");
                }
            } else {
                System.out.println("使用 tryLock(long timeout, TimeUnit unit) 方法在指定时间内未能获取锁");
            }
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
```

3. **tryLock (long timeout, TimeUnit unit) 方法**：

- `lock.tryLock(2, java.util.concurrent.TimeUnit.SECONDS)`：尝试在 2 秒内获取锁。
- 如果在指定时间内成功获取锁，在 `try` 块中执行受保护的操作，并在 `finally` 块中释放锁；如果超时未获取到锁，执行相应的超时处理逻辑。

```
 // isLocked() 方法：检查锁是否被锁定
    public void useIsLockedMethod() {
        boolean isLocked = lock.isLocked();
        System.out.println("当前锁的状态：" + (isLocked? "已锁定" : "未锁定"));
    }
```

4. **isLocked () 方法**：

- `lock.isLocked()`：检查锁是否被锁定，返回 `true` 或 `false`。

```
// isHeldByCurrentThread() 方法：检查锁是否被当前线程持有
public void useIsHeldByCurrentThreadMethod() {
    lock.lock();
    try {
        boolean isHeld = lock.isHeldByCurrentThread();
        System.out.println("当前线程是否持有锁：" + isHeld);
    } finally {
        lock.unlock();
    }
}
```

5. **isHeldByCurrentThread () 方法**：

- `lock.isHeldByCurrentThread()`：检查当前线程是否持有锁，在 `try` 块中获取锁，检查并打印结果，在 `finally` 块中释放锁。

```
// getHoldCount() 方法：返回当前线程持有锁的次数
public void useGetHoldCountMethod() {
    lock.lock();
    lock.lock();
    try {
        int holdCount = lock.getHoldCount();
        System.out.println("当前线程持有锁的次数：" + holdCount);
    } finally {
        lock.unlock();
        lock.unlock();
    }
}
```

6. **getHoldCount () 方法**：

- `lock.lock()`：多次获取锁，`lock.getHoldCount()` 可获取当前线程持有锁的次数。
- 注意在 `finally` 块中要调用相同次数的 `lock.unlock()` 来释放锁，以确保锁被完全释放。

```
    public void performTask() {
        Thread thread1 = new Thread(() -> {
            try {
                lock.lockInterruptibly(); // 可中断地获取锁
                try {
                    System.out.println("Thread 1: 已获取锁，开始执行任务");
                    // 模拟任务执行
                    for (int i = 0; i < 5; i++) {
                        System.out.println("Thread 1: 正在执行任务，第 " + (i + 1) + " 步");
                        Thread.sleep(1000);
                    }
                } finally {
                    lock.unlock();
                    System.out.println("Thread 1: 已释放锁");
                }
            } catch (InterruptedException e) {
                System.out.println("Thread 1: 被中断，未获取锁");
                // 可在此处进行中断处理逻辑
            }
        });

        Thread thread2 = new Thread(() -> {
            try {
                lock.lockInterruptibly();
                try {
                    System.out.println("Thread 2: 已获取锁，开始执行任务");
                    // 模拟任务执行
                    for (int i = 0; i < 5; i++) {
                        System.out.println("Thread 2: 正在执行任务，第 " + (i + 1) + " 步");
                        Thread.sleep(1000);
                    }
                } finally {
                    lock.unlock();
                    System.out.println("Thread 2: 已释放锁");
                }
            } catch (InterruptedException e) {
                System.out.println("Thread 2: 被中断，未获取锁");
                // 可在此处进行中断处理逻辑
            }
        });

        thread1.start();
        thread2.start();

        try {
            Thread.sleep(2000);
            thread2.interrupt(); // 中断 thread2
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
```

7. **lockInterruptibly()方法**

- 当调用 `thread2.interrupt()` 时，`thread2` 正在等待 `lockInterruptibly()` 获取锁，如果 `thread2` 还未获取锁，它将抛出 `InterruptedException`，并打印 "Thread 2: 被中断，未获取锁"，而不是一直等待锁的释放。

**测试方法**

```
 public static void main(String[] args) throws InterruptedException {
        ReentrantLockMethodsExample example = new ReentrantLockMethodsExample();
        example.useLockMethod();
        example.useTryLockMethod();
        example.useTryLockWithTimeoutMethod();
        example.useIsLockedMethod();
        example.useIsHeldByCurrentThreadMethod();
        example.useGetHoldCountMethod();
        example.performTask();

    }
```

**测试结果**

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1737554558923-99d82997-9c4a-422c-b4bd-b2eeec7226fa.png)

### ReentranLock是如何实现可重入的？

可重入锁指的是同一个线程中可以多次获取同一把锁。比如在JAVA中，当一个线程调用一个对象的加锁的方法后,还可以调用其他加同一把锁的方法，这就是可重入锁。  
ReentrantLock 加锁的时候，看下当前持有锁的线程和当前请求的线程是否是同一个，一样就可重入了。 只需要简单得将state值加1，记录当前线程的重入次数即可。

```
if (current == getExclusiveOwnerThread()) {
     int nextc = c + acquires;
     if (nextc < 0)
     	throw new Error("Maximum lock count exceeded");
     setState(nextc);
     return true;
 }
```

同时在锁进行释放的时候，需要确保状态State=0的时候才可执行释放资源的操作，所以一个可重入锁加锁多少次，同时需要解锁多少次。

```

protected final boolean tryRelease(int releases) {
    int c = getState() - releases;
    if (Thread.currentThread() != getExclusiveOwnerThread())
        throw new IllegalMonitorStateException();
    boolean free = false;
    if (c == 0) {
        free = true;
        setExclusiveOwnerThread(null);
    }
    setState(c);
    return free;
}
```

## Java 中 volatile 关键字的作用是什么？

volatile主要作用就是保证变量的**可见性**和**禁止指令重排优化（双检锁实现单例模式中就是利用了该特性）**

**可见性:**

`volatile`关键字确保变量的可见性，当一个线程修改了`volatile`变量的值，新值会立即被刷新到主存中，其他线程在读取该变量时可以立即获取最新的值，这样可以保证了一个volatile变量在并发编程中，其值在多个线程是可见的。

**有序性：**

普通的变量仅仅会保证在该方法的执行过程中所依赖的赋值结果的地方都能获得正确的结果，而不能保证变量的赋值操作的顺序和程序代码中的执行顺序一致。volatile是通过内存屏障来禁止特定情况下的指定重排序，从而保证了程序的执行顺序符合预期，对volatile变量的写操作会在其前面插入一个StoreStore屏障，而对volatile变量的读操作则会在其后面插入一个LoadLoad屏障，保证了在多线程环境下，代码块执行顺序的可预测性。

### 扩展知识

### volatile的可见性和有序性是如何保证的？

待补充。。。

### 有了synchroniazed为什么还需要volatile？

待补充。。。

### 什么是内存屏障，是怎么通过加内存屏障保证有序性的?

待补充。。。