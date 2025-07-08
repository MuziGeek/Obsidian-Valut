---
title: Day27
date: 2025-01-19 20:43:48
categories:
  - - 笔记
    - 编程
    - 面试训练营
tags:
  - Java
---
**2025-01-19**🌱上海: ☀️   🌡️+13°C 🌬️↘7km/h
## 接口和抽象类有什么区别?

### 抽象类

### 1. 定义抽象类

定义抽象类的时候需要用到关键字`abstract`，同时需要放在`class`关键字前面。

关于抽象类的命名。在阿里的java开发手册上有强调，“**抽象类命名要使用 Abstract 或 Base 开头**”。

```java
package com.muzi.abstractinterfaceclass.abstractClassText;

// 定义抽象的动物类
public abstract class AbstractAnimal {
    // 抽象方法：动物发出的声音
    abstract void makeSound();

    // 抽象方法：动物的行为方式
    abstract void move();

    // 普通方法：动物的基本信息
    public void showInfo() {
        System.out.println("I am an animal.");
    }
}
```

### 2. 抽象类的特征

如果一个类定义了一个或者多个抽象方法，那么这个类必须是抽象类

![image.png](https://cdn.easymuzi.cn/img/20250119222500852.png)


抽象类是不能实例化的，通过`new`关键字实例化的时候编译器会报错。

![image.png](https://cdn.easymuzi.cn/img/20250119222511660.png)


虽然抽象类不能实例化，但是可以有子类。通过`extends`关键字来继承抽象类

```java
package com.muzi.abstractinterfaceclass.abstractClassText;

// 小猫类，继承自 Animal 类
class Cat extends AbstractAnimal {
    // 实现抽象方法，小猫发出的声音是喵喵叫
    @Override
    void makeSound() {
        System.out.println("喵喵~");
    }
    // 实现抽象方法，小猫的行为是走
    @Override
    void move() {
        System.out.println("小猫走路");
    }
}
```

抽象类中不仅可以定义抽象方法，也可以定义普通方法

```java
package com.muzi.abstractinterfaceclass.abstractClassText;

// 定义抽象的动物类
public abstract class AbstractAnimal {
    // 抽象方法：动物发出的声音
    abstract void makeSound();

    // 抽象方法：动物的行为方式
    abstract void move();

    // 普通方法：动物的基本信息
    public void showInfo() {
        System.out.println("I am an animal.");
    }
}
```

抽象类派生的子类必须实现父类中定义的抽象方法。比如说，抽象类`AbstractAnimal`中定义了`makeSound`、`move`方法，子类`cat`中就必须实现。

![image.png](https://cdn.easymuzi.cn/img/20250119222527227.png)


### 3. 抽象类的应用场景

#### 3.1. 第一种场景（代码复用）

当一些通用的功能被多个子类复用的时候，就可以使用抽象类，比如`cat`、`fish`、`bird`都需要休息，那我们就可以在`AbstractAnimal`类中添加一个普通方法`sleep()`，那么这个方法就可以被子类复用。

```java
package com.muzi.abstractinterfaceclass.abstractClassText;

// 定义抽象的动物类
public abstract class AbstractAnimal {
    // 抽象方法：动物发出的声音
    abstract void makeSound();

    // 抽象方法：动物的行为方式
    abstract void move();

    // 普通方法：动物的基本信息
    public void showInfo() {
        System.out.println("I am an animal.");
    }
    // 普通方法：动物的通用行为
    public void sleep() {
        System.out.println("要休息了~");
    }
}
```

子类都继承了`AbstractAnimal`类，所以相应的对象也可以直接调用父类的`sleep()`方法

```java
        Cat cat = new Cat();
        Bird bird = new Bird();
        Fish fish = new Fish();
        cat.sleep();
        bird.sleep();
        fish.sleep();
```

从上面就体现了代码的复用

#### 3.2. 第二种场景（拓展实现）

抽象类也就是父类中定义好一个方法API，然后子类中拓展实现的时候就可以使用抽象类中定义的方法进行自己的实现。比如cat走路、bird飞行、fish游泳等。

```java
// 小鸟类，继承自 Animal 类
public class Bird extends AbstractAnimal {
    // 实现抽象方法，小鸟发出的声音是叽叽喳喳叫
    @Override
    void makeSound() {
        System.out.println("叽叽喳喳");
    }
    // 实现抽象方法，小鸟的行为是飞
    @Override
    void move() {
        System.out.println("小鸟飞行");
    }
}
```

```java
// 小猫类，继承自 Animal 类
public class Cat extends AbstractAnimal {
    // 实现抽象方法，小猫发出的声音是喵喵叫
    @Override
    void makeSound() {
        System.out.println("喵喵~");
    }
    // 实现抽象方法，小猫的行为是走
    @Override
    void move() {
        System.out.println("小猫走路");
    }
}
```

```java
// 小鱼类，继承自 Animal 类
public class Fish extends AbstractAnimal {
    // 实现抽象方法，小鱼发出的泡泡声音（假设）
    @Override
    void makeSound() {
        System.out.println("咕噜咕噜");
    }

    // 实现抽象方法，小鱼的行为是游泳
    @Override
    void move() {
        System.out.println("小鱼游泳");
    }
}
```

进一步展示抽象类的特性，可以通过日常开发中文件读取来展示

假设现在有一个文件，现在需要有一个读取器将内容从文件中读取出来，分别按照大写的方式或者小写的方式来读。

首先最好定义一个抽象类`BaseFileReader`：

```java
/**
 * 抽象类，定义了一个读取文件的基础框架，其中 mapFileLine 是一个抽象方法，具体实现需要由子类来完成
 */
abstract class BaseFileReader {
    protected Path filePath; // 定义一个 protected 的 Path 对象，表示读取的文件路径

    /**
     * 构造方法，传入读取的文件路径
     * @param filePath 读取的文件路径
     */
    protected BaseFileReader(Path filePath) {
        this.filePath = filePath;
    }

    /**
     * 读取文件的方法，返回一个字符串列表
     * @return 字符串列表，表示文件的内容
     * @throws IOException 如果文件读取出错，抛出该异常
     */
    public List<String> readFile() throws IOException {
        return Files.lines(filePath) // 使用 Files 类的 lines 方法，读取文件的每一行
                .map(this::mapFileLine) // 对每一行应用 mapFileLine 方法，将其转化为指定的格式
                .collect(Collectors.toList()); // 将处理后的每一行收集到一个字符串列表中，返回
    }

    /**
     * 抽象方法，子类需要实现该方法，将文件中的每一行转化为指定的格式
     * @param line 文件中的每一行
     * @return 转化后的字符串
     */
    protected abstract String mapFileLine(String line);
}
```

- filePath 为文件路径，使用 protected 修饰，表明该成员变量可以在需要时被子类访问到。
- `readFile()` 方法用来读取文件，方法体里面调用了抽象方法 `mapFileLine()`——需要子类来扩展实现大小写的不同读取方式。

这样设计就可以让子类只需要专注于具体的大小写实现方式就可以了。

小写方式

```java
class LowercaseFileReader extends BaseFileReader {
    protected LowercaseFileReader(Path filePath) {
        super(filePath);
    }

    @Override
    protected String mapFileLine(String line) {
        return line.toLowerCase();
    }
}
```

大写方式

```java
class UppercaseFileReader extends BaseFileReader {
    protected UppercaseFileReader(Path filePath) {
        super(filePath);
    }

    @Override
    protected String mapFileLine(String line) {
        return line.toUpperCase();
    }
}
```

读取文件内容的方法就可以被子类复用，子类只需要通过抽象方法实现自己功能就可以了

测试一下

```java
 @Test
    void FileReaderTest() throws IOException, URISyntaxException {
        URL location = this.getClass().getClassLoader().getResource("helloworld.txt");
        Path path  = Paths.get(location.toURI());
        BaseFileReader lowercaseFileReader = new LowercaseFileReader(path);
        BaseFileReader uppercaseFileReader = new UppercaseFileReader(path);
        System.out.println(lowercaseFileReader.readFile());
        System.out.println(uppercaseFileReader.readFile());
    }
```

![image.png](https://cdn.easymuzi.cn/img/20250119222612279.png)


### 4. 总结

1. 抽象类不能被实例化
2. 抽象类应该至少有一个抽象方法
3. 抽象类的抽象方法没有方法体
4. 抽象类的子类必须实现父类中的抽象方法，除非子类也是抽象类。

### 接口

### 1. 定义接口

接口通过interface关键字来定义，可以包含一些常量和方法

```java
package com.muzi.abstractinterfaceclass.inter;

// 支付接口
interface PaymentInterface {
    String weixPay="微信支付";
    void pay(double amount);
    // 静态方法
    static boolean isWeixPay(String Paytype) {
        return Paytype.equals(weixPay);
    }

    // 默认方法
    default void printPayType() {
        System.out.println(weixPay);
    }
}
```

通过命令进行反编译查看

```java
 javap -c -v PaymentInterface.class
```

![image.png](https://cdn.easymuzi.cn/img/20250119222631086.png)


会发现接口中定义的所有变量和方法都会自动添加上public关键字

1. 接口中定义的变量会在编译的时候自动加上public static finnal 修饰符（可以参考上图反编译后的字节码）也就是说上面代码中`weixPay`变量就是一个常量。

java官方文档也有说明

Every field declaration in the body of an interface is implicitly public, static, and final.

所以可看出接口也可以用来作为常量类使用，还能省略掉public static final关键字，但是这种方法并不可取。因为接口的本意是对方法进行抽象，而常量接口会对子类中的变量造成命名空间上的“污染”

2. 没有使用private、default或者static关键字修饰的方法是隐式抽象的，在编译的时候会自动加上public abstract修饰符，也就是说上面代码中的pay（）其实是一个抽象方法，没有方法体，这就是定义接口的本意。
3. 从java8开始，接口中允许有静态方法，比如说上面代码中的isWeixPay()方法。静态方法无法由实现类的对象调用，它只能通过接口名来调用，比如`PaymentInterface.isWeixPay(weixPay)`目的就是为了提供一种简单的机制，使我们不必创建对象就能调用方法。
4. 接口中允许定义default方法，也是从java8开始的，比如上面代码的`printPayType（）`方法，始终由一个代码块组成，为实现该接口且不覆该方法的类提供默认实现。同时必须有方法体，否则会报错

![image.png](https://cdn.easymuzi.cn/img/20250120095400747.png)


有点类似抽象中的普通方法，可以避免在所有的实现类中追加某个具体的方法时需要修改大量大实现类。

**总结：**

1. 接口中允许定义变量
2. 接口中允许定义抽象方法
3. 接口中允许定义静态方法（java8之后）
4. 接口中允许定义默认方法（java8之后）

除此之外还有需要注意的地方

1. **接口中不允许直接实例化，否则编译器会报错**

需要顶一个类实现接口，通过实现类进行实例化操作

![image.png](https://cdn.easymuzi.cn/img/20250119222639639.png)


```java
package com.muzi.abstractinterfaceclass.inter;

// 支付宝支付实现类
public class AlipayPayment implements PaymentInterface, PaymentNotificationInterface {
    @Override
    public void pay(double amount) {
        System.out.println("使用支付宝支付 " + amount + " 元");
    }

    @Override
    public void notifyPaymentStatus(String status) {
        System.out.println("支付宝支付状态通知：" + status);
    }
}
```

![image.png](https://cdn.easymuzi.cn/img/20250119222656457.png)


2. **接口可以是空的，既可以不定义变量，也可以不定义方法，最典型的例子就是io包下的****Serializable 接口。**

![image.png](https://cdn.easymuzi.cn/img/20250119222702810.png)


Serializable 接口用来为序列化的具体实现提供一个标记，也就是说，只要某个类实现了 Serializable 接口，那么它就可以用来序列化了。

3. **不要再定义接口的时候使用final关键字，因为接口本身就是为了让子类实现的，而final组织了这种行为。**

![image.png](https://cdn.easymuzi.cn/img/20250119222707998.png)


4. **接口的抽象方法不能是private、protected或者final 否则都会报错**

![image.png](https://cdn.easymuzi.cn/img/20250119222714673.png)


5. **接口的变量是隐式**`public static final`**（常量），所以其值无法改变** 。

### 2. 接口的作用

1. **使某些实现类具有我们想要的功能，比如说，实现了 Cloneable 接口的类具有拷贝的功能，实现了 Comparable 或者 Comparator 的类具有比较功能。**

Cloneable 和 Serializable 一样，都属于标记型接口，它们内部都是空的。实现了 Cloneable 接口的类可以使用 `Object.clone()` 方法，否则会抛出 CloneNotSupportedException。

```java
public class CloneableTest implements Cloneable {
    @Override
    protected Object clone() throws CloneNotSupportedException {
        return super.clone();
    }

    public static void main(String[] args) throws CloneNotSupportedException {
        CloneableTest c1 = new CloneableTest();
        CloneableTest c2 = (CloneableTest) c1.clone();
    }
}
```

运行后没有报错。现在把 `implements Cloneable` 去掉。

```java
public class CloneableTest {
    @Override
    protected Object clone() throws CloneNotSupportedException {
        return super.clone();
    }

    public static void main(String[] args) throws CloneNotSupportedException {
        CloneableTest c1 = new CloneableTest();
        CloneableTest c2 = (CloneableTest) c1.clone();

    }
}
```

运行后抛出 CloneNotSupportedException。

2. java原则上只支持单一继承，但是通过几口可以实现多重继承的目的

如果有两个类共同继承（extends）一个父类，那么父类的方法就会被两个子类重写。然后，如果有一个新类同时继承了这两个子类，那么在调用重写方法的时候，编译器就不能识别要调用哪个类的方法了。这也正是著名的菱形问题，见下图。

![image.png](https://cdn.easymuzi.cn/img/20250119222732107.png)


简单解释下，ClassC 同时继承了 ClassA 和 ClassB，ClassC 的对象在调用 ClassA 和 ClassB 中重写的方法时，就不知道该调用 ClassA 的方法，还是 ClassB 的方法。

而接口就可以定义两个接口，一个支付消息通知接口，一个支付方式接口

```java
package com.muzi.abstractinterfaceclass.inter;

// 支付接口
public  interface PaymentInterface {
    String weixPay="微信支付";
    void pay(double amount);
    // 静态方法
    static boolean isWeixPay(String Paytype) {
        return Paytype.equals(weixPay);
    }
    // 默认方法
    default void printPayType() {
        System.out.println(weixPay);
    }
}
```

```java
package com.muzi.abstractinterfaceclass.inter;

// 支付消息通知接口
public interface PaymentNotificationInterface {
    void notifyPaymentStatus(String status);
}
```

支付宝支付同时实现这两个接口

```java
package com.muzi.abstractinterfaceclass.inter;

// 支付宝支付实现类
public class AlipayPayment implements PaymentInterface, PaymentNotificationInterface {
    @Override
    public void pay(double amount) {
        System.out.println("使用支付宝支付 " + amount + " 元");
    }

    @Override
    public void notifyPaymentStatus(String status) {
        System.out.println("支付宝支付状态通知：" + status);
    }
}
```

赋予一个类更多的能力，通过抽象类是无法实现的只能通过接口。

3. **实现多态**

比如支付方式选择可以有很多种，除了支付宝支付还有微信支付等

```java
package com.muzi.abstractinterfaceclass.inter;

// 微信支付实现类
public class WeChatPayment implements PaymentInterface, PaymentNotificationInterface {
    @Override
    public void pay(double amount) {
        System.out.println("使用微信支付 " + amount + " 元");
    }

    @Override
    public void notifyPaymentStatus(String status) {
        System.out.println("微信支付状态通知：" + status);
    }
}
```

![image.png](https://cdn.easymuzi.cn/img/20250119222759626.png)


这样就实现了多态。同时多态存在的三个前提：

1. 要有继承关系
2. 子类要重写父类的方法
3. 父类引用指向子类对象

### 接口的三种设计模式

这里就大概提一下，具体的之前的设计模式已经讲到了

1. 策略模式
2. 适配器模式
3. 工厂模式

### 两者的区别

1. 抽象类可以有方法体的方法，但是接口没有（java8以前，之后也有default默认实现）
2. 接口中的成员变量隐式为static final，但抽象类不是
3. 一个类可以实现多个接口，但只能继承一个抽象类

### 语法层面上

- 抽象类可以包含具体方法的实现；而在接口中，方法默认是 public abstract 的，但从 Java 8 开始，接口也可以包含有实现的默认方法和静态方法。
- 抽象类中的成员变量可以是各种类型的，而接口中的成员变量只能是 public static final 类型的；
- 接口中不能含有静态代码块，而抽象类可以有静态代码块；
- 一个类只能继承一个抽象类，而一个类却可以实现多个接口

### 设计层面上

抽象类是对一种事物的抽象，即对类抽象，继承抽象类的子类和抽象类本身是一种 `is-a` 的关系。而接口是对行为的抽象。抽象类是对整个类整体进行抽象，包括属性、行为，但是接口却是对类局部（行为）进行抽象。

### 设计动机上

接口的设计是**自上而下**的。我们知晓某一行为，于是基于这些行为约束定义了接口，一些类需要有这些行为，因此实现对应的接口。

抽象类的设计是**自下而上的**。我们写了很多类，发现它们之间有共性，有很多代码可以复用，因此将公共逻辑封装成一个抽象类，减少代码冗余。

所谓的 **自上而下** 指的是先约定接口，再实现。

而 **自下而上的** 是先有一些类，才抽象了共同父类（可能和学校教的不太一样，但是实战中很多时候都是因为重构才有的抽象）。

### 接口知识扩展

**Java 9：引入了私有方法，允许在接口中定义私有方法，用于 default 方法的内部逻辑复用。**

```java
// 支付接口
interface PaymentInterface {
    // 支付方法
    void pay(double amount);

    // 通知支付状态
    void notifyPaymentStatus(String status);

    // 私有方法，用于检查支付金额是否合法
    private boolean isAmountValid(double amount) {
        return amount > 0;
    }

    // default 方法，包含了对私有方法的调用
    default void performPayment(double amount) {
        if (isAmountValid(amount)) {
            pay(amount);
        } else {
            System.out.println("Invalid payment amount");
        }
    }
}
```

**Java 14：引入了 sealed 接口（仅在某些子类中使用），进一步增强了接口的功能**

```java

// 支付接口，使用 sealed 关键字限定实现类
sealed interface PaymentInterface permits WeChatPayment, AlipayPayment {
    // 支付方法
    void pay(double amount);

    // 通知支付状态
    void notifyPaymentStatus(String status);

    // 私有方法，用于检查支付金额是否合法
    private boolean isAmountValid(double amount) {
        return amount > 0;
    }

    // default 方法，包含了对私有方法的调用
    default void performPayment(double amount) {
        if (isAmountValid(amount)) {
            pay(amount);
        } else {
            System.out.println("Invalid payment amount");
        }
    }
}
```

## JDK动态代理和CGLIB动态代理有什么区别？

首先可以通过代码示例了解下静态代理

接口类

```java
package com.muzi.Structural.proxy.staticProxy;

public interface DataQuery {
    String query(String queryKey);
}
```

目标实现类

```java
package com.muzi.Structural.proxy.staticProxy;

public class DatabaseDataQuery implements DataQuery{
    @Override
    public String query(String queryKey) {
        //通过数据库查询
        System.out.println("数据库查询中。。。。");
        return "DataBaseQuery result";
    }
}
```

代理实现类

```java
package com.muzi.Structural.proxy.staticProxy;

import java.util.HashMap;
import java.util.Map;

public class DatabaseDataQueryProxy implements DataQuery {
    //实现缓存，使用HashMap
    Map<String,String> cacheMap =new HashMap<>();
    //创建持有代理对象
    private DatabaseDataQuery dataQuery;
    //1屏蔽代理对象
    public DatabaseDataQueryProxy( ) {
        this.dataQuery = new DatabaseDataQuery();
    }

    @Override
    //2 对代理对象的方法做增强
    public String query(String queryKey) {
        String s = cacheMap.get(queryKey);
        //查询缓存，命中则返回
        if (s!=null){
            System.out.println("命中缓存，返回结果");
            return s;
        }
        //查询数据库
        s=dataQuery.query(queryKey);
        //查到结果返回并放入缓存
        if (s!=null){
            cacheMap.put(queryKey,s);
        }
        System.out.println("未命中，查询数据库");
        return s;
    }
}
```

可以看出静态代理类是在编译时已经进行了代理操作，而动态代理就是在运行时进行了代理操作，具体有哪些实现方式以及具体是怎么实现的，接下来继续了解

### 基于接口/基于类

1. **JDK动态代理**

基于接口：JDK动态代理要求被代理的类必须实现一个或多个接口。代理对象会实现这些接口，并将方法调用委托给目标对象。如果类没有实现任何接口，JDK动态代理将无法工作。

2. **CGLIB动态代理**

基于类：CGLIB动态代理通过生成目标类的子类来实现代理。它不要求目标类必须实现接口，因此它适用于没有实现接口的类。CGLIB是通过继承方式创建代理类，因此不能代理`final`类或`final`方法，因为这些无法被继承和重写。

### 实现机制

1. **JDK动态代理**

使用反射机制，通过 `java.lang.reflect.Proxy`类和 `InvocationHandler`接口来实现代理。代理对象仅代理接口中的方法。

当调用代理对象的方法时，代理类会拦截方法调用，并通过 `InvocationHandler.invoke()` 方法执行额外的逻辑。

因此，JDK动态代理实现原理：

![image.png](https://cdn.easymuzi.cn/img/20250119222901335.png)


**代码示例**

接口类

```java
package com.muzi.Structural.proxy.dynamicProxy.jdk;


public interface DataQuery {
    String query(String queryKey);
    String queryAll(String queryKey);
}
```

目标实现类

```java
package com.muzi.Structural.proxy.dynamicProxy.jdk;


public class DatabaseDataQuery implements com.muzi.Structural.proxy.dynamicProxy.jdk.DataQuery {
    @Override
    public String query(String queryKey) {
        // 他会使用数据源从数据库查询数据很慢
        System.out.println("正在从数据库查询数据");
        return "result";
    }

    @Override
    public String queryAll(String queryKey) {
        // 他会使用数据源从数据库查询数据很慢
        System.out.println("正在从数据库查询数据");
        return "all result";
    }
}
```

自定义`InvocationHandler`

```java
package com.muzi.Structural.proxy.dynamicProxy.jdk;



import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.LinkedHashMap;

public class CacheInvocationHandler implements InvocationHandler {
    private HashMap<String,String> cache = new LinkedHashMap<>(256);

    private DataQuery databaseDataQuery;

    public CacheInvocationHandler(DatabaseDataQuery databaseDataQuery) {
        this.databaseDataQuery = databaseDataQuery;
    }

    public CacheInvocationHandler() {
        this.databaseDataQuery = new DatabaseDataQuery();
    }
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 1、判断是哪一个方法
        String result = null;
        if("query".equals(method.getName())){
            // 2、查询缓存，命中直接返回
            result = cache.get(args[0].toString());
            if(result != null){
                System.out.println("数据从缓存重获取。");
                return result;
            }

            // 3、未命中，查数据库（需要代理实例）
            result = (String) method.invoke(databaseDataQuery, args);

            // 4、如果查询到了,进行呢缓存
            cache.put(args[0].toString(),result);
            return result;
        }

        // 当其他的方法被调用，不希望被干预，直接调用原生的方法
        return method.invoke(databaseDataQuery,args);
    }
}
```

测试类

```java
package com.muzi.Structural.proxy.dynamicProxy.jdk;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;


public class Main {

    public static void main(String[] args) {
        // jdk提供的代理实现，主要是使用Proxy类来完成
        // 1、classLoader：被代理类的类加载器
        ClassLoader contextClassLoader = Thread.currentThread().getContextClassLoader();
        // 2、代理类需要实现的接口数组
        Class[] classes = new Class[]{DataQuery.class};
        // 3、InvocationHandler
        CacheInvocationHandler cacheInvocationHandler = new CacheInvocationHandler();

        DataQuery dataQuery  = (DataQuery) Proxy.newProxyInstance(contextClassLoader, classes, cacheInvocationHandler);


        // 事实上调用query方法的使用，他是调用了invoke
        String result = dataQuery.query("key1");
        System.out.println(result);
        System.out.println("--------------------");
        result = dataQuery.query("key1");
        System.out.println(result);
        System.out.println("--------------------");
        result = dataQuery.query("key2");
        System.out.println(result);
        System.out.println("++++++++++++++++++++++++++++++++++++");

        // 事实上调用queryAll方法的使用，他是调用了invoke
        result = dataQuery.queryAll("key1");
        System.out.println(result);
        System.out.println("--------------------");
        result = dataQuery.queryAll("key1");
        System.out.println(result);
        System.out.println("--------------------");
        result = dataQuery.queryAll("key2");
        System.out.println(result);
        System.out.println("--------------------");
    }
}
```

例子中 DataQuery 是接口，DatabaseDataQuery 实现该接口。

JDK 动态代理要求被代理对象至少实现一个接口，以便代理类通过接口暴露代理行为。

通过 `Proxy.newProxyInstance ()` 创建代理对象，需三个参数：

- 类加载器，如 `Thread.currentThread().getContextClassLoader()`，用于加载代理类。
- 接口列表，如 `new Class[]{DataQuery.class}`，指定代理类应实现的接口。
- `InvocationHandler`，代理对象实际逻辑由实现该接口的类完成，如 `CacheInvocationHandler` 会拦截代理方法调用并添加额外逻辑。

`CacheInvocationHandler`的 `invoke ()` 方法拦截方法调用，添加一些特殊的业务逻辑，通过 `method.invoke (target, args)` 执行目标对象原始方法。

2. **CGLIB动态代理**

基于字节码操作，它使用 CGLIB（Code Generation Library）生成目标类的子类并重写目标类的方法来实现代理。通过继承方式拦截所有非`final`方法的调用。

CGLIB 使用的是 ASM 字节码生成框架，生成的是字节码级别的代理类，因此性能相对较好，但生成代理类的开销比JDK动态代理略大。

![image.png](https://cdn.easymuzi.cn/img/20250119222926041.png)


**代码示例**

目标类

```java
package com.muzi.Structural.proxy.dynamicProxy.cglib;


import com.muzi.Structural.proxy.dynamicProxy.jdk.DataQuery;

public class DatabaseDataQuery implements DataQuery {
    @Override
    public String query(String queryKey) {
        // 他会使用数据源从数据库查询数据很慢
        System.out.println("正在从数据库查询数据");
        return "result";
    }

    @Override
    public String queryAll(String queryKey) {
        // 他会使用数据源从数据库查询数据很慢
        System.out.println("正在从数据库查询数据");
        return "all result";
    }
}
```

自定义方法拦截器

```java
package com.muzi.Structural.proxy.dynamicProxy.cglib;


import org.springframework.cglib.proxy.MethodInterceptor;
import org.springframework.cglib.proxy.MethodProxy;


import java.lang.reflect.Method;
import java.util.HashMap;

public class CacheMethodInterceptor implements MethodInterceptor {
    private HashMap<String,String> cache = new HashMap<>();
    private DatabaseDataQuery databaseDataQuery;
    public CacheMethodInterceptor( ) {
        this.databaseDataQuery = new DatabaseDataQuery();
    };

    @Override
    public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy) throws Throwable {
        // 1、判断是哪一个方法
        String result = null;
        if("query".equals(method.getName())){
            // 2、查询缓存，命中直接返回
            result = cache.get(args[0].toString());
            if(result != null){
                System.out.println("数据从缓存重获取。");
                return result;
            }

            // 3、未命中，查数据库（需要代理实例）
            result = (String) method.invoke(databaseDataQuery, args);

            // 4、如果查询到了,进行呢缓存
            cache.put(args[0].toString(),result);
            return result;
        }

        return method.invoke(databaseDataQuery,args);
    }
}
```

测试类

```java
package com.muzi.Structural.proxy.dynamicProxy.cglib;

import org.springframework.cglib.proxy.Enhancer;

public class Main {

    public static void main(String[] args) {
        //cglib通过Enhancer
        Enhancer enhancer = new Enhancer();
        //设置父类
        enhancer.setSuperclass(DatabaseDataQuery.class);
        //设置一个拦截器，用来拦截方法
        enhancer.setCallback(new CacheMethodInterceptor());
        //创建代理类
        DatabaseDataQuery databaseDataQuery = (DatabaseDataQuery) enhancer.create();


        databaseDataQuery.query("Key1");
        databaseDataQuery.query("Key1");
        databaseDataQuery.query("Key2");

    }
}
```

MyService类并没有实现任何接口，这就是CGLIB动态代理的优势之一，它不要求目标类实现接口。CGLIB通过生成目标类的子类来实现代理。

CGLIB通过`Enhancer`类来创建代理对象，主要配置了两个部分：

目标类的超类：通过`enhancer.setSuperclass(DatabaseDataQuery.class)`指定目标类`（DatabaseDataQuery）`。

回调逻辑：通过`enhancer.setCallback()`设置方法拦截器`CacheMethodInterceptor`，它会拦截所有方法调用，并可以插入额外的逻辑。

`CacheMethodInterceptor`实现了`MethodInterceptor`接口，代理的核心逻辑在`intercept()`方法中。与JDK动态代理不同，CGLIB使用`proxy.invokeSuper(obj, args)`调用父类的原始方法，而不是通过反射调用。

### 两者的对比

| **特性**   | **JDK 动态代理**                 | **CGLIB 动态代理**                |
| -------- | ---------------------------- | ----------------------------- |
| 代理的对象    | 必须实现接口的类                     | 没有实现接口的类或接口                   |
| 代理创建     | 使用 Proxy.newProxyInstance () | 使用 Enhancer.create ()         |
| 方法调用机制   | 通过反射调用目标对象的接口方法              | 直接通过子类调用父类方法，性能较高             |
| 横切逻辑插入位置 | InvocationHandler.invoke()   | MethodInterceptor.intercept() |
| 性能       | 方法调用的性能较低，因为依赖于反射机制          | 性能较高，因为是直接的字节码生成              |
| 限制       | 目标类必须实现接口                    | 不能代理 final 类和 final 方法        |

### 优缺点对比

| **特性**        | **JDK 动态代理**    | **CGLIB 动态代理**                                   |
| ------------- | --------------- | ------------------------------------------------ |
| 代理对象          | 必须实现接口          | 不需要实现接口                                          |
| 代理方式          | 基于接口和反射         | 基于字节码生成子类                                        |
| 性能            | 创建代理开销小，方法调用开销高 | 创建代理开销大，方法调用性能好                                  |
| 限制            | 不能代理没有接口的类      | 不能代理 final 类和 final 方法                           |
| 使用场景          | 适用于接口驱动的开发      | 适用于没有接口的类                                        |
| Spring AOP 默认 | 接口时使用           | 没有接口时使用，可以强制使用CGLIB代理（通过设置proxyTargetClass=true） |

## 你使用过 Java 的反射机制吗？如何应用反射？

### 什么是反射机制

反射机制（Reflection）是一项强大而灵活的功能，它允许程序**在运行时**对类、接口、字段和方法进行动态检查和操作。

### 反射的优缺点

| **优点**               | **缺点**       |
| -------------------- | ------------ |
| 增强灵活性，可动态加载类与调用方法    | 性能损耗大，操作耗时多  |
| 利于测试，能访问私有成员辅助测试     | 破坏封装性，降低安全性  |
| 实现通用框架，如 Spring 依赖反射 | 代码复杂，可读性维护性差 |

### 实例操作

### Class

编写一个类进行测试

```java
package com.muzi.abstractinterfaceclass.abstractClassTest;

// 小猫类，继承自 Animal 类
public class Cat extends AbstractAnimal {

    private String color;// 小猫的颜色

    private int foots; // 小猫的脚的数量

    public void show(){

    }
     public String show(String color){
        return "小猫的颜色是："+color;
    }
    private String showDetails(String color,int foots){
        return "小猫的颜色是："+color+"，脚的数量是："+foots;
    }
    // 实现抽象方法，小猫发出的声音是喵喵叫
    @Override
    void makeSound() {
        System.out.println("喵喵~");
    }
    // 实现抽象方法，小猫的行为是走
    @Override
    void move() {
        System.out.println("小猫走路");
    }
}
```

#### 获取Class反射类的方式

```java
@Test
    void testReflection() throws ClassNotFoundException {
        //第一种：通过类名.class获取
        Class Class1 = Cat.class;
        System.out.println(Class1);

        //第二种：通过对象.getClass()获取
        Cat cat = new Cat();
        Class Class2 = cat.getClass();
        System.out.println(Class2);

        //第三种：通过Class.forName("全类名")获取
        Class Class3 = Class.forName("com.muzi.abstractinterfaceclass.abstractClassTest.Cat");
        System.out.println(Class3);

         //第四种：通过类加载器获取
        ClassLoader classLoader = this.getClass().getClassLoader();
        Class Class4 = classLoader.loadClass("com.muzi.abstractinterfaceclass.abstractClassTest.Cat");
        System.out.println(Class4);

    }
```

![image.png](https://cdn.easymuzi.cn/img/20250119223005679.png)


#### Class类中常用的方法

**自定义注解**

```java
package com.muzi.abstractinterfaceclass.abstractClassTest;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.TYPE,ElementType.FIELD}) 
@Retention(RetentionPolicy.RUNTIME) //运行期可见
public @interface Myannotation {
    String value();
}
```

**添加注解**

![image.png](https://cdn.easymuzi.cn/img/20250119223018732.png)


**通过反射获取自定义注解及构造实例对象**

```java
        //通过类名获取反射类
        Class<Cat> catClass = Cat.class;
        //1. 通过反射类创建实例对象
        Cat cat1 = catClass.newInstance();
        System.out.println(cat1);
        //2. 获取反射类上的注解
        Myannotation annotation = catClass.getAnnotation(Myannotation.class);
        System.out.println(annotation.value());
```

**测试结果**

![image.png](https://cdn.easymuzi.cn/img/20250119223029299.png)


### Method

#### 获取method方法类的方式

```java
getDeclaredMethods();//得到本类中所有的方法。
getDeclaredMethod("方法名",参数类型);//获取本类中指定的方法对象

getMethods();//获取本类以及父辈类中public修饰的方法。
getMethod("方法名"，参数类型);//获取本类以及父辈类中指定public修饰的方法。
```

示例测试

```java
       //1. 获取本类中所有方法--getDeclaredMethods();
        Method[] declaredMethods = catClass.getDeclaredMethods();
        for (Method declaredMethod : declaredMethods) {
            System.out.println("declaredMethod:"+declaredMethod);
        }

        //2. 获取本类中指定的方法对象--getDeclaredMethod("方法名",参数类型);
        Method show = catClass.getDeclaredMethod("show", String.class);
        System.out.println("show:"+show);

        //3. 获取本类以及父类中public修饰的方法--getMethods();
        Method[] methods = catClass.getMethods();
        for (Method method : methods) {
            System.out.println("method:"+method);
        }

        //4. 获取本类以及父类中public修饰的指定方法--getMethod("方法名"，参数类型);
        Method show1 = catClass.getMethod("show", String.class);
        System.out.println("show1:"+show1);
```

测试结果

![image.png](https://cdn.easymuzi.cn/img/20250119223043718.png)


#### Method类对象中常用的方法

1. invoke()方法反射类获取的方法.invoke—表示方法执行。invoke(调用对象)–参数列表中的参数表示是谁调用。
2. setAccessible()方法，当试图访问并获取实体类中的私有属性或者方法时，是不被允许的。通过设置该方法，参数有两个值：

- true表示可访问，打破不可访问私有规则
- 默认为false，表示不可访问私有属性

**示例测试**

```java
       //invoke()---调用小猫对象，执行该方法
        Method showNoArg = catClass.getDeclaredMethod("show");
        Object result = show.invoke(cat1);
        System.out.println("invoke 不带参的show："+result);

        Method methodShowName = catClass.getMethod("show",String.class);
        Object result1 = methodShowName.invoke(cat1,"yellow");
        System.out.println("invoke 带参的show："+result1);

        //setAccessible()---访问私有方法并执行
        Method methodshowDetails = catClass.getDeclaredMethod("showDetails", String.class, int.class);
        methodshowDetails.setAccessible(true);
        Object result2 = methodshowDetails.invoke(cat1,"yellow",4);
        System.out.println("invoke 带参的showDetails："+result2);
```

测试结果

![image.png](https://cdn.easymuzi.cn/img/20250119223114605.png)


### Field

#### 获取Field属性的方式

```java
getDeclaredFields();//得到本类中所有的属性
getDeclaredField("方法名",参数类型);//获取本类中指定的属性

getFields();//获取本类以及父辈类中public修饰的属性
getMethodFields("方法名"，参数类型);//获取本类以及父辈类中指定public修饰的属性
```

**修改实体类**

```java
package com.muzi.abstractinterfaceclass.abstractClassTest;

// 小猫类，继承自 Animal 类
@Myannotation("小猫")
public class Cat extends AbstractAnimal {
    @Myannotation("颜色")
    private String color;// 小猫的颜色
    @Myannotation("脚的数量")
    private int foots; // 小猫的脚的数量

    public void show(){

    }
    public String show(String color){
        return "小猫的颜色是："+color;
    }
    private String showDetails(String color,int foots){
        return "小猫的颜色是："+color+"，脚的数量是："+foots;
    }
    // 实现抽象方法，小猫发出的声音是喵喵叫
    @Override
    void makeSound() {
        System.out.println("喵喵~");
    }
    // 实现抽象方法，小猫的行为是走
    @Override
    void move() {
        System.out.println("小猫走路");
    }

    @Override
    public String toString() {
        return "Cat{" +
                "color='" + color + '\'' +
                ", foots=" + foots +
                '}';
    }

}
```

示例测试

```java
 //获取小猫类的属性
        Field color = catClass.getDeclaredField("color");
        Field foots = catClass.getDeclaredField("foots");

        //name是私有属性，若要赋值需要设置
        color.setAccessible(true);
        foots.setAccessible(true);
        //为其属性值赋值
        color.set(cat1,"yellow");
        foots.set(cat1,4);
        System.out.println(cat1);

        //获取本类中所有属
        Field[] declaredFields = catClass.getDeclaredFields();
        for (Field declaredField : declaredFields) {
            //getName-->获取属性名
            System.out.println(declaredField.getName());
            //getAnnotation-->获取每个属性对象上的注解对象
            Myannotation annotationField = declaredField.getAnnotation(Myannotation.class);
            String value = annotationField.value();
            System.out.println(value);
        }
```

测试结果

![image.png](https://cdn.easymuzi.cn/img/20250119223121804.png)


