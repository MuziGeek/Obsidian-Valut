---
title: Day21
date: 2025-01-15 17:19:14
categories:
  - - 学习成长
    - 编程
    - 面试训练营
tags:
  - 计算机网络
---
**2025-01-15**🌱上海: ☀️   🌡️+6°C 🌬️↓18km/h
## 说说TCP的四次挥手

之前的文章已经提到相关概念，并且做了大概的讲解

具体可看

[TCP 和 UDP 有什么区别？ - 木子金又二丨的回答记录 - 面试鸭 - 程序员求职面试刷题神器](https://www.mianshiya.com/answer/1826085029072973825/question-answer/1878452541179367426?questionId=1780933295719084034)

今天就详细分析下四次挥手的具体细节

### 为什么需要四次挥手？

建立一个连接**需要三次握手**，而终止一个连接要经过 **4次握手**。这由 TCP 的**半关闭( half-close)** 造成的。既然一个 TCP 连接是**全双工 (即数据在两个方向上能同时传递)**， 因此每个方向必须单独地进行关闭。这原则就是当一方完成它的数据发送任务后就能发送一个 FIN 来终止这个方向连接。当一端收到一个 FIN，它必须通知应用层另一端已经终止了数据传送。**理论上客户端和服务器都可以发起主动关闭**，但是更多的情况下是客户端主动发起。

![image.png](https://cdn.easymuzi.cn/img/20250115172002022.png)


**四次挥手详细过程如下：**

1. 客户端发送关闭连接的报文段，**FIN 标志位1**，**请求关闭连接**，并**停止发送数据**。序号字段 seq = x (等于之前发送的所有数据的最后一个字节的序号加一)，然后客户端会进入 FIN-WAIT-1 状态，等待来自服务器的确认报文。
2. 服务器收到 FIN 报文后，**发回确认报文**，**ACK = 1， ack = x + 1**，并带上自己的序号 seq = y，然后服务器就进入 **CLOSE-WAIT 状态**。服务器还会**通知上层的应用程序对方已经释放连接**，此时 TCP 处于**半关闭状态**，也就是说客户端已经没有数据要发送了，但是服务器还可以发送数据，客户端也还能够接收。
3. 客户端收到服务器的 **ACK 报文段后随即进入 FIN-WAIT-2 状态**，**此时还能收到来自服务器的数据**，直到收到 FIN 报文段。
4. 服务器发送完所有数据后，**会向客户端发送 FIN 报文段**，各字段值如图所示，**随后服务器进入 LAST-ACK 状态**，等待来自客户端的确认报文段。
5. 客户端收到来自服务器的 FIN 报文段后，**向服务器发送 ACK 报文**，随后进入 **TIME-WAIT 状态**，等待 **2MSL(2 * Maximum Segment Lifetime，两倍的报文段最大存活时间)** ，这是任何报文段在被**丢弃前能在网络中存在的最长时间**，常用值有**30秒、1分钟和2分钟**。如无特殊情况，客户端会进入 CLOSED 状态。
6. 服务器在接收到客户端的 ACK 报文后会随即进入 CLOSED 状态，**由于没有等待时间，一般而言，服务器比客户端更早进入 CLOSED 状态。**

### 同时关闭的情况

TCP 关闭时也会有一种特殊情况，那就是同时关闭，这种情况仅作了解即可，流程图如下：

![image.png](https://cdn.easymuzi.cn/img/20250115172015399.png)


双方应用层同时发关闭命令，**各自发送一个 FIN**，状态从 **ESTABLISHED 变为 FIN_WAIT_1** 。FIN 经网络到达对方后，状态从 **FIN_WAIT_1 变为 CLOSING** 并发送最后的 ACK ，收到该 ACK 后，为确保对方也收到，**进入 TIME_WAIT 状态**，等待 2MSL 时间，若无异常，**最终进入 CLOSED 状态**。

### **高频问题（重点，面试相关）**

#### 为什么关闭连接需要四次？

服务器在收到客户端的 **FIN 报文段后，可能还有一些数据要传输**，所以不能马上关闭连接，但是会做出应答，返回 ACK 报文段，接下来可能会继续发送数据，在数据发送完后，服务器会向客户单发送 FIN 报文，表示数据已经发送完毕，请求关闭连接，然后客户端再做出应答，因此一共需要四次挥手。

#### 挥手可以变为三次么？

**特殊情况下可以**

上面为什么需要四次提到了在收到客户端的FIN报文段后，可能还有一些数据要传输，嫁入这时候已经没有数据需要发送给客户端了，那么服务端就可以将ACK和FIN一起发给客户端，这样就变成了三次挥手

#### 客户端为什么需要在 TIME-WAIT 状态等待 2MSL 时间才能进入 CLOSED 状态？

- 正常网络下，四个报文段发送完双方可关闭连接进入 CLOSED 状态。
- 网络不可靠时，若客户端发送的 ACK 报文段丢失，服务器会一直重发 FIN 报文段。
- 客户端为确保服务器收到 ACK，会设置定时器，在 TIME - WAIT 状态等待 2MSL 时间。
- 等待期间若收到服务器的 FIN 报文段，客户端会重新设置计时器并再次等待 2MSL 时间。
- 若等待期间未收到服务器的 FIN 报文，说明服务器已成功收到 ACK 报文，客户端可进入 CLOSED 状态。

## TCP 的粘包和拆包能说说吗？

### 粘包与拆包是什么？

- 正常情况下，接收端正常收到两个数据包，即没有发生拆包和粘包的现象。

![image.png](https://cdn.easymuzi.cn/img/20250115172034679.png)


- TCP 接收数据时有滑动窗口控制接收数据大小，可理解为缓冲区大小，缓冲区满了就发送数据，数据包大小不固定。
- 当一次请求发送的数据量小，没达到缓冲区大小，TCP 会合并多个请求发送，形成粘包问题。

![image.png](https://cdn.easymuzi.cn/img/20250115172041604.png)


- 当一次请求发送的数据量大，超过缓冲区大小，TCP 会拆分数据为多次发送，即拆包，把一个大包拆成多个小包发送。

![image.png](https://cdn.easymuzi.cn/img/20250115172052429.png)


### 为什么会发生粘包与拆包

- **TCP 粘包与拆包**：

- TCP 是面向连接的流式传输协议，数据以无明确起止边界的字节流形式传输，需手动划分边界。
- 粘包情况：当发送方每次写入数据小于接收方套接字缓冲区大小时发生。

- 要发送的数据小于TCP发送缓冲区的大小，TCP将多次写入缓冲区的数据一次发送出去，将会发生粘包。
- 接收数据端的应用层没有及时读取接收缓冲区中的数据，将发生粘包。

- 拆包情况：当发送方每次写入数据大于接收方套接字缓冲区大小时发生。

- 要发送的数据大于TCP发送缓冲区剩余空间大小，将会发生拆包。
- 待发送数据大于MSS（最大报文长度），TCP在传输前将进行拆包。

- **UDP 无粘包问题**：UDP 有保护消息边界，每个 UDP 包带有消息头（含 UDP 长度、源端口、目的端口、校验和）。
- **问题发生层面**：粘包拆包问题在数据链路层、网络层、传输层都可能出现，但日常网络应用开发多在传输层，因 UDP 特性，该问题仅在 TCP 协议中发生。

### 实例测试

```
package com.muzi.easypicturebackend;
 
import java.io.IOException;
import java.io.InputStream;
import java.net.ServerSocket;
import java.net.Socket;
 
/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class Server {
    // 字节数组的长度
    private static final int BYTE_LENGTH = 20;
 
    public static void main(String[] args) throws IOException {
        // 创建 Socket 服务器
        ServerSocket serverSocket = new ServerSocket(8888);
        // 获取客户端连接
        Socket clientSocket = serverSocket.accept();
        // 得到客户端发送的流对象
        InputStream is = clientSocket.getInputStream();
        while (true) {
            // 循环获取客户端发送的信息
            byte[] bytes = new byte[BYTE_LENGTH];
            // 读取客户端发送的信息
            try {
                int count = is.read(bytes, 0, BYTE_LENGTH);
                if (count > 0) {
                    // 成功接收到有效消息并打印
                    System.out.println("接收到客户端的信息是:" + new String(bytes));
                }
                count = 0;
            } catch (Exception e) {
                // ignore
            }
        }
    }
}
```

```
package com.muzi.easypicturebackend;
 
import java.io.IOException;
import java.io.OutputStream;
import java.net.Socket;

/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class Client {
    public static void main(String[] args) throws IOException {
        // 创建 Socket 客户端并尝试连接服务器端
        Socket socket = new Socket("127.0.0.1", 8888);
        // 发送的消息内容
        final String message = "Hi,Muzi.";
        // 使用输出流发送消息
        OutputStream os = socket.getOutputStream();
        // 给服务器端发送 10 次消息
        for (int i = 0; i < 10; i++) {
            // 发送消息
            os.write(message.getBytes());
        }
    }
}
```

![image.png](https://cdn.easymuzi.cn/img/20250115172114626.png)

从结果可知，服务器端出现粘包问题。客户端发送 10 次固定 “Hi,Muzi.” 消息，理想状态下服务器应接收 10 次相同消息，但实际并非如此，接收内容长度不足时还用空格字符填充。

```
package com.muzi.easypicturebackend;
 
import java.io.IOException;
import java.io.OutputStream;
import java.net.Socket;

/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class Client {
    public static void main(String[] args) throws IOException {
        // 创建 Socket 客户端并尝试连接服务器端
        Socket socket = new Socket("127.0.0.1", 8888);
        // 发送的消息内容
        final String message = "Hi,Muzi.面试训练营加油加油加油面试训练营加油加油加油面试训练营加油加油加油面试训练营加油加油加油!!!";
        // 使用输出流发送消息
        OutputStream os = socket.getOutputStream();
        // 给服务器端发送 10 次消息
        for (int i = 0; i < 10; i++) {
            // 发送消息
            os.write(message.getBytes());
        }
    }
}
```

![image.png](https://cdn.easymuzi.cn/img/20250115172125683.png)


通过修改发送字符串长度，可以发现一条消息被拆成了多个，并且都是不完整的消息，类似拆包情况。

那么对于该问题，该如何解决呢？

### 解决方案

**方案分析**

- **固定包长**：客户端发送数据包时统一长度，如 1024 字节，数据不足则补空格至指定长度。
- **添加分隔符**：客户端在每个包末尾用固定分隔符（如 \r\n ），若包拆分，等后续包来后，依据分隔符合并拆分的头部与前包剩余部分，获取完整包。
- **消息分头部与消息体**：在头部记录整个消息长度，读取到足够长度数据才视为完整消息。
- **自定义协议**：通过自定义协议处理粘包和拆包问题。

#### 固定数据大小

```
package com.muzi.easypicturebackend;
 
import java.io.IOException;
import java.io.InputStream;
import java.net.ServerSocket;
import java.net.Socket;
 
/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class Server {

    private static final int BYTE_LENGTH = 1024;  // 字节数组长度（收消息用）

    public static void main(String[] args) throws IOException {
        ServerSocket serverSocket = new ServerSocket(8888);
        // 获取到连接
        Socket clientSocket = serverSocket.accept();
        InputStream inputStream = clientSocket.getInputStream();
        while (true) {
            byte[] bytes = new byte[BYTE_LENGTH];
            try {
                // 读取客户端发送的信息
                int count = inputStream.read(bytes, 0, BYTE_LENGTH);
                if (count > 0) {
                    // 接收到消息打印
                    System.out.println("接收到客户端的信息是:" + new String(bytes).trim());
                }
                count = 0;
            } catch (Exception e) {
                // ignore
            }
        }
    }

}
```

```
package com.muzi.easypicturebackend;
 
import java.io.IOException;
import java.io.OutputStream;
import java.net.Socket;

/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class Client {
    private static final int BYTE_LENGTH = 1024;  // 字节长度

    public static void main(String[] args) throws IOException {
        Socket socket = new Socket("127.0.0.1", 8888);
        final String message = "Hi,Muzi."; // 发送消息
        OutputStream outputStream = socket.getOutputStream();
        // 将数据组装成定长字节数组
        byte[] bytes = new byte[BYTE_LENGTH];
        int idx = 0;
        for (byte b : message.getBytes()) {
            bytes[idx] = b;
            idx++;
        }
        // 给服务器端发送 10 次消息
        for (int i = 0; i < 10; i++) {
            outputStream.write(bytes, 0, BYTE_LENGTH);
        }
    }

}
```

**结果如下**

![image.png](https://cdn.easymuzi.cn/img/20250115172150825.png)


从以上代码可以看出，虽然这种方式可以解决粘包问题，但这种**固定数据大小的传输方式，当数据量比较小时会使用空字符来填充，所以会额外的增加网络传输的负担**，因此不是理想的解决方案。

#### 自定义请求协议

将请求的数据封装为两部分：**消息头（发送的数据大小）**+**消息体（发送的具体数据）**，它的格式如下图所示：

![image.png](https://cdn.easymuzi.cn/img/20250115172159660.png)


**定义一个消息封装类** 提供两个方法：一个是将消息转换成消息头 + 消息体的方法，另一个是读取消息头的方法，具体实现代码如下

```
package com.muzi.easypicturebackend;
 
import java.io.IOException;
import java.io.InputStream;
import java.text.NumberFormat;

/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class SocketUtils {
    // 消息头存储的长度(占 8 字节)
    static final int HEAD_SIZE = 8;
 
    /**
     * 将协议封装为:协议头 + 协议体
     *
     * @param context 消息体(String 类型)
     * @return byte[]
     */
    public static byte[] toBytes(String context) {
        // 协议体 byte 数组
        byte[] bodyByte = context.getBytes();
        int bodyByteLength = bodyByte.length;
        // 最终封装对象
        byte[] result = new byte[HEAD_SIZE + bodyByteLength];
        // 借助 NumberFormat 将 int 转换为 byte[]
        NumberFormat numberFormat = NumberFormat.getNumberInstance();
        numberFormat.setMinimumIntegerDigits(HEAD_SIZE);
        numberFormat.setGroupingUsed(false);
        // 协议头 byte 数组
        byte[] headByte = numberFormat.format(bodyByteLength).getBytes();
        // 封装协议头
        System.arraycopy(headByte, 0, result, 0, HEAD_SIZE);
        // 封装协议体
        System.arraycopy(bodyByte, 0, result, HEAD_SIZE, bodyByteLength);
        return result;
    }
 
    /**
     * 获取消息头的内容(也就是消息体的长度)
     *
     * @param inputStream
     * @return
     */
    public static int getHeader(InputStream inputStream) throws IOException {
        int result = 0;
        byte[] bytes = new byte[HEAD_SIZE];
        inputStream.read(bytes, 0, HEAD_SIZE);
        // 得到消息体的字节长度
        result = Integer.valueOf(new String(bytes));
        return result;
    }
 
}
```

```
package com.muzi.easypicturebackend;
 
import java.io.IOException;
import java.io.InputStream;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class CustomServer {
    public static void main(String[] args) throws IOException {
        // 创建 Socket 服务器端
        ServerSocket serverSocket = new ServerSocket(8888);
        // 获取客户端连接
        Socket clientSocket = serverSocket.accept();
        // 获取客户端发送的消息对象
        InputStream inputStream = clientSocket.getInputStream();
        while (true) {
            // 获取消息头(也就是消息体的长度)
            try {
                int bodyLength = SocketUtils.getHeader(inputStream);
                // 消息体 byte 数组
                byte[] bodyByte = new byte[bodyLength];
                // 每次实际读取字节数
                int readCount = 0;
                // 消息体赋值下标
                int bodyIndex = 0;
                // 循环接收消息头中定义的长度
                while (bodyIndex < bodyLength &&
                        (readCount = inputStream.read(bodyByte, bodyIndex, bodyLength)) != -1) {
                    bodyIndex += readCount;
                }
                bodyIndex = 0;
                // 成功接收到客户端的消息并打印
                System.out.println("接收到客户端的信息:" + new String(bodyByte));
            } catch (IOException ioException) {
                System.out.println(ioException.getMessage());
                break;
            }
        }
    }
}
```

```
package com.muzi.easypicturebackend;
 
import java.io.IOException;
import java.io.OutputStream;
import java.net.Socket;
import java.util.Random;

/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class CustomClient {
    public static void main(String[] args) throws IOException {
        // 启动 Socket 并尝试连接服务器
        Socket socket = new Socket("127.0.0.1", 8888);
        // 发送消息合集（随机发送一条消息）
        final String[] message = {"Hi,Muzi.", "面试训练营加油加油", "木子金又二丨."};
        // 创建协议封装对象
        OutputStream outputStream = socket.getOutputStream();
        // 给服务器端发送 10 次消息
        for (int i = 0; i < 10; i++) {
            // 随机发送一条消息
            String msg = message[new Random().nextInt(message.length)];
            // 将内容封装为:协议头+协议体
            byte[] bytes = SocketUtils.toBytes(msg);
            // 发送消息
            outputStream.write(bytes, 0, bytes.length);
            outputStream.flush();
        }
    }
}
```

![image.png](https://cdn.easymuzi.cn/img/20250115172213384.png)


可以看出，消息通讯正常没有出现粘包问题。

但是此解决方案虽然可以解决粘包问题，但消息的设计和代码的实现复杂度比较高，所以也不是理想的解决方案

#### 特殊字符结尾

通过以特殊字符结尾确定流边界来解决粘包问题，具体实现为：在 Java 中利用自带的 BufferedReader 和 BufferedWriter（带缓冲区的输入、输出字符流），写入数据时以`\n`结尾，读取时使用`readLine`按行读取，以此明确流的边界。

```
package com.muzi.easypicturebackend;
 
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.net.Socket;


/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class SpecialCharClient {
    public static void main(String[] args) throws IOException {
        // 启动 Socket 并尝试连接服务器
        Socket socket = new Socket("127.0.0.1", 8888);
        final String message = "Hi,Muzi."; // 发送消息
        BufferedWriter bufferedWriter = new BufferedWriter(
                new OutputStreamWriter(socket.getOutputStream()));
        // 给服务器端发送 10 次消息
        for (int i = 0; i < 10; i++) {
            // 注意:结尾的 \n 不能省略,它表示按行写入
            bufferedWriter.write(message + "\n");
            // 刷新缓冲区(此步骤不能省略)
            bufferedWriter.flush();
        }
    }
}
```

```
package com.muzi.easypicturebackend;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * @Author: muzi
 * @Date: 2025/01/13
 */
public class SpecialCharServer {
    public static void main(String[] args) throws IOException {
        // 创建 Socket 服务器端
        ServerSocket serverSocket = new ServerSocket(8888);
        // 获取客户端连接
        Socket clientSocket = serverSocket.accept();
        while (true) {
            try {
                // 获取客户端发送的消息流对象
                BufferedReader bufferedReader = new BufferedReader(
                        new InputStreamReader(clientSocket.getInputStream()));
                while (true) {
                    // 按行读取客户端发送的消息
                    String msg = bufferedReader.readLine();
                    if (msg != null) {
                        // 成功接收到客户端的消息并打印
                        System.out.println("接收到客户端的信息:" + msg);
                    }
                }
            } catch (IOException ioException) {
                System.out.println(ioException.getMessage());
                break;
            }
        }
    }
}
```

![image.png](https://cdn.easymuzi.cn/img/20250115172226778.png)


以特殊符号解决粘包问题，优点为实现简单，但存在局限性。消息中间若出现结束符，会导致半包问题，因此处理复杂字符串时，需对内容进行编码和解码，以保障结束符的正确性。

### HTTP是如何解决粘包问题的？

**回顾下HTTP请求的结构**

![image.png](https://cdn.easymuzi.cn/img/20250115172303200.png)


**http请求报文格式**
1）请求行：以\r\n结束；  
2）请求头：以\r\n结束；  
3）\r\n；  
3）数据；

**http响应报文格式**
1）响应行：以\r\n结束；  
2）响应头：以\r\n结束；  
3）\r\n；  
4）数据；

**1、遇到第一个\r\n表示读取请求行或响应行结束；** 
**2、遇到\r\n\r\n表示读取请求头或响应头结束；**

**那怎么读取Body数据呢？**

- **HTTP协议通常使用**`Content-Length`**来标识**`body`**的长度。在服务器端，需要先申请对应长度的**`buffer`**，然后再赋值。**
![image.png](https://cdn.easymuzi.cn/img/20250115172328840.png)



**分析**

1. HTTP 服务器接收数据：若 header 中存在 `Content - Length` 属性，读取该属性值来确定要读取的 body 长度。
2. HTTP 服务器发送数据：依据待发送 byte 数据的长度，在 header 中添加 `Content - Length` 项，其 value 为 byte 数据长度，随后将 byte 数据作为 body 发送至客户端。

- **如果需要一边生产数据一边发送数据，就需要使用"Transfer-Encoding: chunked" 来代替Content-Length，也就是对数据进行分块传输。**

![image.png](https://cdn.easymuzi.cn/img/20250115172409316.png)


**分析**

- **HTTP Server 接收数据**：当检测到 header 中有 “Transfer - Encoding: chunked”，会按 chunked 协议分批读取数据。
- **HTTP Server 发送数据**：若要向客户端分批发送数据，需在 header 中添加 “Transfer - Encoding:chunked”，并按 chunked 协议分批发送。

**结构如下**

![image.png](https://cdn.easymuzi.cn/img/20250115172418217.png)


1. chunked 协议数据主要包含三部分：**chunk，last - chunk 和 trailer**。若分多次发送，chunk 会有多份。
2. chunk 主要由大小和数据构成。大小表示该 chunk 包的大小，以 **16 进制标示**，且 chunk 之间的分隔符为 CRLF。
3. **通过 last - chunk 标识 chunk 发送完成**。通常读取到 last - chunk（内容为 0）时，意味着 chunk 发送完毕。
4. trailer 用于增加 header 等额外信息，一般情况下 header 为空，**通过 CRLF 标识整个 chunked 数据发送完成**。

| **方面** | **描述**                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 优点     | 1. 对于 10K 的 body，Content-Length 需申请 10K 连续 buffer，Transfer-Encoding:chunked 可申请 1K 空间并循环使用 10 次，节省内存开销。<br>2. 当内容长度不可知时，chunked 方式可解决 Content-Length 问题。<br>3. http 服务器压缩可采用分块压缩，可边压缩边发送，加快传输时间。 |
| 缺点     | 1. chunked 协议解析复杂。<br>2. 在 http 转发场景（如 nginx）下难以处理，如分块数据的转发问题。                                                                                                                                   |

## 说说TCP拥塞控制的步骤

1. **慢启动（Slow Start）**：

- 连接建立初期，发送方缓慢增加数据发送速率。
- 初始拥塞窗口（cwnd）通常为一个最大报文段大小（MSS）。
- 每次收到 ACK 后成倍增加 cwnd，直至达到慢启动阈值（ssthresh）或检测到网络拥塞。

2. **拥塞避免（Congestion Avoidance）**：

- 当 cwnd 达到 ssthresh 后，TCP 进入此阶段。
- 拥塞窗口增长速度从指数变为线性，每个往返时间（RTT）增加一个 MSS，旨在避免激烈拥塞反应，维持网络稳定。

3. **快速重传（Fast Retransmit）**：

- 发送方收到三个重复的 ACK 后，立即重传被认为丢失的报文段，无需等待超时，减少重传延迟。

4. **快速恢复（Fast Recovery）**：

- 快速重传后，TCP 不进入慢启动。
- 将 cwnd 减小到当前的一半，并设置 ssthresh 为当前新的 cwnd 值，然后开始线性增加 cwnd，以快速恢复到丢包前的传输速率。

**总体的工作流程如下：**

- 最开始按照小的速度，小的窗口来发送数据
- 如果没有丢包，就加大速度，增大窗口，继续发送
- 增加到一定程度，出现了丢包现象，就立即减小速度，缩小窗口
- 当没有丢包情况出现后，就继续加大速度，增大窗口
- 上述操作持续进行，直到找到一个阈值。

**上面讲到的流量控制也会改变窗口的大小，那么流量控制的窗口和阻塞控制的窗口选择哪个呢?**

按照小的来

**阻塞控制的窗口变化也是有相应的规律的**

![image.png](https://cdn.easymuzi.cn/img/20250115172450192.png)


1. **慢开始**： 先以小的窗口传输数据，主要是检测通信路径是否通畅。
2. **扩大窗口①**：以指数的形式来扩大窗口。
3. **扩大窗口②**：到达某个阈值，就开始线性扩大窗口
4. **缩小窗口**：  
    **①：窗口直接缩小到0，再重复上述流程，**  
    **②：窗口缩小一半，然后线性的增长窗口。**

拥塞控制：TCP 有拥塞控制的机制， 通过慢启动、拥塞避免、拥塞发生，快速重传和快速恢复等算法调整发送速率来避免网络拥塞。当网络出现拥塞时，TCP 会降低发送速率，以减少网络负载，保证数据的可靠传输。

拥塞控制的慢启动门限，拥塞窗口变化两种情况如下： 慢启动->拥塞避免->超时重传->慢启动：

![image.png](https://cdn.easymuzi.cn/img/20250115172458244.png)


慢启动->拥塞避免->快速重传->快速恢复->拥塞避免：

![image.png](https://cdn.easymuzi.cn/img/20250115172517892.png)


TCP协议的拥塞控制主要通过五个算法来实现：慢启动、拥塞避免、超时重传、快速重传和快速恢复。

1. 慢启动：发送方开始时设置一个较小的拥塞窗口大小，在每收到一个对新的报文段的确认后，每当成功发送跟拥塞窗口大小等量的数据后，拥塞窗口大小就会翻倍，以指数方式增长，直到拥塞控制窗口达到慢启动门限。
2. 拥塞避免：当窗口大小达到慢启动门限后，就进入拥塞避免阶段，每当成功发送跟拥塞窗口大小等量的数据后，拥塞窗口大小就会增加一个报文段的大小，以线性方式增长。
3. 拥塞发生：随着发送速率慢慢增长，可能网络会出现拥塞，发生了数据包丢失，这时候就需要重传数据，重传机制主要有两种，一个是超时重传和快速重传。

- 超时重传：当发生了超时重传，慢启动门限会设置为拥塞窗口的一半，并且将拥塞窗口恢复为初始值，接着，就重新开始慢启动，发送速率就会瞬间下降了很多。
- 快速重传和快速恢复：当发送方连续收到三个重复确认时，就认为发生了丢包，这时候拥塞窗口会减少到原来的一半，然后慢启动门限设置为减少后的拥塞窗口大小，然后进入到快速恢复阶段，这时候会把拥塞控制窗口+3，3 的意思是确认有 3 个数据包被收到了，然后重传丢失的报文，如果收到重传丢失报文的 ACK 后，将拥塞窗口设置为慢启动门限，这样就直接进入拥塞避免，继续增大发送速率。

这些拥塞控制算法，可以让TCP协议能够根据网络状况动态调整发送速率，避免因为过大的流量导致网络拥塞。

### 深入挖掘-慢启动

TCP 在刚建立连接完成后，首先是有个慢启动的过程，这个慢启动的意思就是一点一点的提高发送数据包的数量，如果一上来就发大量的数据，这不是给网络添堵吗？

慢启动的算法主要记住一个规则：**当发送方每收到一个 ACK，拥塞窗口 cwnd 的大小就会加 1。**

这里假定拥塞窗口 cwnd 和发送窗口 swnd 相等，下面举个例子：

- 连接建立完成后，一开始初始化 cwnd = 1，表示可以传一个 MSS 大小的数据。
- 当收到一个 ACK 确认应答后，cwnd 增加 1，于是一次能够发送 2 个
- 当收到 2 个的 ACK 确认应答后， cwnd 增加 2，于是就可以比之前多发2 个，所以这一次能够发送 4 个
- 当这 4 个的 ACK 确认到来的时候，每个确认 cwnd 增加 1， 4 个确认 cwnd 增加 4，于是就可以比之前多发 4 个，所以这一次能够发送 8 个。

慢启动算法的变化过程如下图：

![image.png](https://cdn.easymuzi.cn/img/20250115172551181.png)


可以看出慢启动算法，发包的个数是指数性的增长。

### 慢启动门限

在慢启动涨到头之后，会有一个东西叫做慢启动门限的东西。

- 当 cwnd < ssthresh 时，使用慢启动算法。
- 当 cwnd >= ssthresh 时，就会使用「拥塞避免算法」。

### 拥塞避免算法

当拥塞窗口 cwnd 「超过」慢启动门限 ssthresh 就会进入拥塞避免算法。

一般来说 ssthresh 的大小是 65535 字节。

那么进入拥塞避免算法后，它的规则是：每当收到一个 ACK 时，cwnd 增加 1/cwnd。

接上前面的慢启动的例子，现假定 ssthresh 为 8：

- 当 8 个 ACK 应答确认到来时，每个确认增加 1/8，8 个 ACK 确认 cwnd 一共增加 1，于是这一次能够发送 9 个 MSS 大小的数据，变成了线性增长。

拥塞避免算法的变化过程如下图：

![image.png](https://cdn.easymuzi.cn/img/20250115172600125.png)


所以，我们可以发现，拥塞避免算法就是将原本慢启动算法的指数增长变成了线性增长，还是增长阶段，但是增长速度缓慢了一些。

就这么一直增长着后，网络就会慢慢进入了拥塞的状况了，于是就会出现丢包现象，这时就需要对丢失的数据包进行重传。

当触发了重传机制，也就进入了「拥塞发生算法」。

### 拥塞发生算法

当网络出现拥塞，也就是会发生数据包重传，重传机制主要有两种：

- 超时重传
- 快速重传

这两种使用的拥塞发送算法是不同的，接下来分别来说说。

### 超时重传

当发生了「超时重传」，则就会使用拥塞发生算法。

这个时候，ssthresh 和 cwnd 的值会发生变化：

- ssthresh 设为 cwnd/2，
- cwnd 重置为 1 （是恢复为 cwnd 初始化值，我这里假定 cwnd 初始化值 1）

### 怎么查看系统的 cwnd 初始化值？

Linux 针对每一个 TCP 连接的 cwnd 初始化值是 10，也就是 10 个 MSS，我们可以用 ss -nli 命令查看每一个 TCP 连接的 cwnd 初始化值，如下图

![image.png](https://cdn.easymuzi.cn/img/20250115172609264.png)


拥塞发生算法的变化如下图：

![image.png](https://cdn.easymuzi.cn/img/20250115172615155.png)


接着，就重新开始慢启动，慢启动是会突然减少数据流的。这真是一旦「超时重传」，马上回到解放前。但是这种方式太激进了，反应也很强烈，会造成网络卡顿。

就好像本来在秋名山高速漂移着，突然来个紧急刹车，轮胎没办法接受。

### 快速重传

还有更好的方式，前面我们讲过「快速重传算法」。当接收方发现丢了一个中间包的时候，发送三次前一个包的 ACK，于是发送端就会快速地重传，不必等待超时再重传。

TCP 认为这种情况不严重，因为大部分没丢，只丢了一小部分，则 ssthresh 和 cwnd 变化如下：

- cwnd = cwnd/2 ，也就是设置为原来的一半;
- ssthresh = cwnd;
- 进入快速恢复算法

### 快速回复

快速重传和快速恢复算法一般同时使用，快速恢复算法是认为，你还能收到 3 个重复 ACK 说明网络也不那么糟糕，所以没有必要像 RTO 超时那么强烈。

正如前面所说，进入快速恢复之前，cwnd 和 ssthresh 已被更新了：

- cwnd = cwnd/2 ，也就是设置为原来的一半;
- ssthresh = cwnd;

然后，进入快速恢复算法如下：

- 拥塞窗口 cwnd = ssthresh + 3 （ 3 的意思是确认有 3 个数据包被收到了）；
- 重传丢失的数据包；
- 如果再收到重复的 ACK，那么 cwnd 增加 1；
- 如果收到新数据的 ACK 后，把 cwnd 设置为第一步中的 ssthresh 的值，原因是该 ACK 确认了新的数据，说明从 duplicated ACK 时的数据都已收到，该恢复过程已经结束，可以回到恢复之前的状态了，也即再次进入拥塞避免状态；

快速恢复算法的变化过程如下图：

![image.png](https://cdn.easymuzi.cn/img/20250115172625206.png)


也就是没有像「超时重传」一夜回到解放前，而是还在比较高的值，后续呈线性增长。

### 拓展：快速恢复算法过程中，为什么收到新的数据后，cwnd 设置回了 ssthresh ？

我的理解是：

- 在快速恢复的过程中，首先 ssthresh = cwnd/2，然后 cwnd = ssthresh + 3，表示网络可能出现了阻塞，所以需要减小 cwnd 以避免，加 3 代表快速重传时已经确认接收到了 3 个重复的数据包；
- 随后继续重传丢失的数据包，如果再收到重复的 ACK，那么 cwnd 增加 1。加 1 代表每个收到的重复的 ACK 包，都已经离开了网络。这个过程的目的是尽快将丢失的数据包发给目标。
- 如果收到新数据的 ACK 后，把 cwnd 设置为第一步中的 ssthresh 的值，恢复过程结束。

首先，快速恢复是拥塞发生后慢启动的优化，其首要目的仍然是降低 cwnd 来减缓拥塞，所以必然会出现 cwnd 从大到小的改变。

其次，过程2（cwnd逐渐加1）的存在是为了尽快将丢失的数据包发给目标，从而解决拥塞的根本问题（三次相同的 ACK 导致的快速重传），所以这一过程中 cwnd 反而是逐渐增大的。
