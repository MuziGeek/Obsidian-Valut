<<<<<<< HEAD

**2025-01-07**🌱上海: ☀️   🌡️+5°C 🌬️↘5km/h
Redis集群的实现原理是什么?

为什么需要集群？

在讲Redis集群架构之前，我们先简单讲下Redis单实例的架构，从最开始的一主N从，到读写分离，再到Sentinel哨兵机制，单实例的Redis缓存足以应对大多数的使用场景，也能实现主从故障迁移。

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736257299045-1bf1ec96-3c96-4ead-85b5-379514055811.png)

- 单实例 Redis 缓存在某些场景下存在问题：

- 写并发：单实例读写分离能解决读操作负载均衡，但写操作全在 master 节点，海量数据高并发时，该节点易出现写瓶颈，压力上升。
- 海量数据的存储压力：单实例仅靠一台 Master 存储，面对海量数据难以应付，数据量大导致持久化成本高，可能阻塞服务器，降低服务请求成功率与服务稳定性。

- Redis 集群提供完善方案，解决了存储受单机限制和写操作无法负载均衡的问题。

### 什么是集群？

- Redis 3.0 加入集群模式，带来以下特性：

- 实现数据分布式存储：对数据分片，将不同数据存于不同 master 节点，解决海量数据存储问题。
- 去中心化思想：无中心节点，客户端视整个集群为一个整体，可连接任意节点操作，如同操作单一 Redis 实例，无需代理中间件。若操作的 key 未分配到该节点，Redis 返回转向指令，指向正确节点。
- 内置高可用机制：支持 N 个 master 节点，每个 master 节点可挂载多个 slave 节点。当 master 节点挂掉，集群会提升某个 slave 节点为新的 master 节点。

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736257666247-69e72a6e-4e01-413e-aac4-c05982718f09.png)

如上图所示，Redis集群可以看成多个主从架构组合起来的，每一个主从架构可以看成一个节点（其中，只有master节点具有处理请求的能力，slave节点主要是用于节点的高可用）

### 哈希槽算法

#### 什么是哈希槽算法？

分布式存储需考虑如何将数据拆分到不同 Redis 服务器，常见分区算法有 hash 算法、一致性 hash 算法。

- 普通 hash 算法：

- 计算方式：将 key 用 hash 算法计算后按节点数量取余，即 hash (key)% N。
- 优点：简单。
- 缺点：扩容或摘除节点时需重新计算映射关系，导致数据重新迁移。

- 一致性 hash 算法：

- 计算方式：为每个节点分配一个 token 构成哈希环，查找时先算 key 的 hash 值，再顺时针找第一个大于等于该哈希值的 token 节点。
- 优点：加入和删除节点仅影响相邻两个节点。
- 缺点：加减节点会造成部分数据无法命中，一般用于缓存，且适用于节点量大的情况，扩容通常增加一倍节点以保障数据负载均衡 。

Redis 集群采用哈希槽分区算法：

- 集群中有 16384 个哈希槽（范围 0 - 16383），不同哈希槽分布在不同 Redis 节点管理，每个节点负责部分哈希槽。
- 数据操作时，集群用 CRC16 算法对 key 计算并对 16384 取模（slot = CRC16 (key)%16383 ），得到的值就是 Key - Value 要放入的槽。
- 通过该值找到对应槽的 Redis 节点，进而在该节点进行存取操作。

使用哈希槽的好处就在于可以方便的**添加或者移除节点**，并且无论是添加删除或者修改某一个节点，都不会造成集群不可用的状态。当需要增加节点时，只需要把其他节点的某些哈希槽挪到新节点就可以了；当需要移除节点时，只需要把移除节点上的哈希槽挪到其他节点就行了；哈希槽数据分区算法具有以下几种特点：

- **解耦数据和节点之间的关系，简化了扩容和收缩难度；**
- **节点自身维护槽的映射关系，不需要客户端代理服务维护槽分区元数据**
- **支持节点、槽、键之间的映射查询，用于数据路由，在线伸缩等场景**

**槽的迁移与指派命令：CLUSTER ADDSLOTS 0 1 2 3 4 ... 5000**

#### Redis中哈希槽相关的数据结构

1. **clusterNode数据结构：**保存节点的当前状态，比如节点的创建时间，节点的名字，节点当前的配置纪元，节点的IP和地址，等等。

```
// 定义一个名为 clusterNode 的结构体，用于表示 Redis 集群中的节点
typedef struct clusterNode {
    // 节点对象的创建时间，以毫秒为单位的时间戳
    mstime_t ctime; /* Node object creation time. */
    
    // 节点名称，是一个十六进制字符串，长度为 REDIS_CLUSTER_NAMELEN（通常为 40 字节，SHA1 哈希值的长度）
    char name[REDIS_CLUSTER_NAMELEN]; /* Node name, hex string, sha1-size */
    
    // 节点的标志位，用于表示节点的各种状态，如是否是主节点、从节点、是否下线等，取值为 REDIS_NODE_... 系列的常量
    int flags;      /* REDIS_NODE_... */
    
    // 该节点观察到的最后一个配置纪元，用于集群的配置的版本管理
    uint64_t configEpoch; /* Last configEpoch observed for this node */
    
    // 一个数组，用于表示该节点负责的哈希槽。每个字节表示 8 个哈希槽，REDIS_CLUSTER_SLOTS 通常为 16384，所以数组大小为 16384 / 8
    unsigned char slots[REDIS_CLUSTER_SLOTS/8]; /* slots handled by this node */
    
    // 该节点负责的哈希槽数量
    int numslots;   /* Number of slots handled by this node */
    
    // 如果该节点是主节点，这个字段表示它拥有的从节点数量
    int numslaves;  /* Number of slave nodes, if this is a master */
    
    // 一个指针数组，指向该主节点的所有从节点
    struct clusterNode **slaves; /* pointers to slave nodes */
    
    // 指向该从节点的主节点，如果该节点本身是主节点，则为 NULL
    struct clusterNode *slaveof; /* pointer to the master node */
    
    // 最近一次发送 PING 命令的时间，以毫秒为单位的时间戳
    mstime_t ping_sent;      /* Unix time we sent latest ping */
    
    // 最近一次接收到 PONG 响应的时间，以毫秒为单位的时间戳
    mstime_t pong_received;  /* Unix time we received the pong */
    
    // 当该节点被标记为 FAIL 状态的时间，以毫秒为单位的时间戳
    mstime_t fail_time;      /* Unix time when FAIL flag was set */
    
    // 最近一次为该主节点的某个从节点投票的时间，以毫秒为单位的时间戳
    mstime_t voted_time;     /* Last time we voted for a slave of this master */
    
    // 最近一次接收到该节点的复制偏移量的时间，以毫秒为单位的时间戳
    mstime_t repl_offset_time;  /* Unix time we received offset for this node */
    
    // 该节点最近已知的复制偏移量，用于主从复制的同步
    PORT_LONGLONG repl_offset;      /* Last known repl offset for this node. */
    
    // 该节点最近已知的 IP 地址，长度为 REDIS_IP_STR_LEN
    char ip[REDIS_IP_STR_LEN];  /* Latest known IP address of this node */
    
    // 该节点最近已知的端口号
    int port;                   /* Latest known port of this node */
    
    // 指向与该节点的 TCP/IP 连接的结构体
    clusterLink *link;          /* TCP/IP link with this node */
    
    // 一个链表，存储了所有报告该节点为失败的节点信息
    list *fail_reports;         /* List of nodes signaling this as failing */
} clusterNode;
```

2. **clusterState数据结构**：记录当前节点所认为的集群目前所处的状态。

```
// 定义一个名为 clusterState 的结构体，用于表示 Redis 集群的整体状态
typedef struct clusterState {
    // 指向代表本节点的 clusterNode 结构体指针
    clusterNode *myself;  /* This node */
    
    // 当前的集群的配置纪元，用于标识集群的配置的版本
    uint64_t currentEpoch;
    
    // 集群的当前状态，取值为 REDIS_CLUSTER_OK（集群正常）、REDIS_CLUSTER_FAIL（集群故障）等相关常量
    int state;            /* REDIS_CLUSTER_OK, REDIS_CLUSTER_FAIL,... */
    
    // 至少负责一个哈希槽的主节点数量
    int size;             /* Num of master nodes with at least one slot */
    
    // 一个字典，用于通过节点名称（字符串）查找对应的 clusterNode 结构体，方便快速定位节点
    dict *nodes;          /* Hash table of name -> clusterNode structures */
    
    // 一个字典，存储了在一段时间内不重新添加的节点，这些节点可能是出现问题或正在被处理的节点
    dict *nodes_black_list; /* Nodes we don't re-add for a few seconds. */
    
    // 一个数组，长度为 REDIS_CLUSTER_SLOTS（16384），每个元素指向一个 clusterNode 结构体，表示正在将某个哈希槽迁移到的目标节点
    clusterNode *migrating_slots_to[REDIS_CLUSTER_SLOTS];
    
    // 一个数组，长度为 REDIS_CLUSTER_SLOTS（16384），每个元素指向一个 clusterNode 结构体，表示正在从某个节点导入哈希槽
    clusterNode *importing_slots_from[REDIS_CLUSTER_SLOTS];
    
    // 一个数组，长度为 REDIS_CLUSTER_SLOTS（16384），每个元素指向一个 clusterNode 结构体，保存所有哈希槽位的分配情况
    clusterNode *slots[REDIS_CLUSTER_SLOTS];//保存所有槽位分配情况
    
    // 一个跳跃表，用于存储哈希槽到键的映射关系，方便根据哈希槽查找相关的键
    zskiplist *slots_to_keys;
    
    /* 以下字段用于从节点在选举中的状态 */
    // 上次或下次选举的时间，以毫秒为单位的时间戳
    mstime_t failover_auth_time; /* Time of previous or next election. */
    
    // 到目前为止收到的投票数
    int failover_auth_count;    /* Number of votes received so far. */
    
    // 表示是否已经请求过投票，为真则表示已经请求过
    int failover_auth_sent;     /* True if we already asked for votes. */
    
    // 当前从节点在本次选举请求中的排名
    int failover_auth_rank;     /* This slave rank for current auth request. */
    
    // 当前选举的纪元
    uint64_t failover_auth_epoch; /* Epoch of the current election. */
    
    // 表示从节点当前不能进行故障转移的原因，取值为 CANT_FAILOVER_* 系列的宏定义
    int cant_failover_reason;   /* Why a slave is currently not able to
                                   failover. See the CANT_FAILOVER_* macros. */
    
    /* 手动故障转移的通用状态 */
    // 手动故障转移的时间限制（以毫秒为单位的 Unix 时间戳），如果没有正在进行的手动故障转移，则为零
    mstime_t mf_end;            /* Manual failover time limit (ms unixtime).
                                   It is zero if there is no MF in progress. */
    
    /* 主节点手动故障转移的状态 */
    // 执行手动故障转移的从节点指针
    clusterNode *mf_slave;      /* Slave performing the manual failover. */
    
    /* 从节点手动故障转移的状态 */
    // 从节点开始手动故障转移所需的主节点偏移量，如果尚未收到则为零
    PORT_LONGLONG mf_master_offset; /* Master offset the slave needs to start MF
                                   or zero if stil not received. */
    
    // 如果非零，表示手动故障转移可以开始请求主节点投票
    int mf_can_start;           /* If non-zero signal that the manual failover
                                   can start requesting masters vote. */
    
    /* 以下字段用于主节点在选举中的状态 */
    // 上次授予投票的纪元
    uint64_t lastVoteEpoch;     /* Epoch of the last vote granted. */
    
    // 在 `clusterBeforeSleep()` 函数中需要完成的任务数量
    int todo_before_sleep; /* Things to do in clusterBeforeSleep(). */
    
    // 通过集群总线发送的消息数量
    PORT_LONGLONG stats_bus_messages_sent;  /* Num of msg sent via cluster bus. */
    
    // 通过集群总线接收的消息数量
    PORT_LONGLONG stats_bus_messages_received; /* Num of msg rcvd via cluster bus.*/
} clusterState;
```

#### 节点的槽指派信息

clusterNode数据结构的slots属性和numslot属性记录了节点负责处理那些槽：slots属性是一个二进制位数组(bit array)，这个数组的长度为16384/8=2048个字节，共包含16384个二进制位。Master节点用bit来标识对于某个槽自己是否拥有，时间复杂度为O(1)

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736258629816-a8a46622-33f7-483d-8ffd-3c75b3d3d0e1.png)

#### 集群所有槽的指派信息

当收到集群中其他节点发送的信息时，通过将节点槽的指派信息保存在本地的clusterState.slots数组里面，程序要检查槽i是否已经被指派，又或者取得负责处理槽i的节点，只需要访问clusterState.slots[i]的值即可，时间复杂度仅为O(1)

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736260249169-d5202a45-dc7c-4b15-96bd-c625d8aa6e2e.png)

ClusterState 中的 Slots 数组下标对应槽，槽信息对应 clusterNode（缓存节点），节点含实际 Redis 缓存服务的 IP 和 Port 信息。Redis Cluster 通讯机制确保各节点有其他节点和槽数据对应关系，因每个节点都有 ClusterState 记录所有槽与节点对应关系，所以客户端访问集群中任意节点都可路由到对应节点。

#### 集群的请求重定向

前面讲到，Redis集群在客户端层面没有采用代理，并且无论Redis 的客户端访问集群中的哪个节点都可以路由到对应的节点上，下面来看看 Redis 客户端是如何通过路由来调用缓存节点的：

1. MOVED请求

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736260745211-027bc700-25eb-4e2e-942b-c70f0001f1e9.png)

- Redis 客户端经计算找 “缓存节点 1” 操作数据。
- 因数据迁移等，对应 Slot 数据到 “缓存节点 2”，客户端无法从 “缓存节点 1” 获取。
- “缓存节点 1” 存集群节点信息，知数据在 “缓存节点 2”，发 MOVED 重定向请求。
- 客户端获 “缓存节点 2” 地址，继续访问并拿到数据。

2. ASK请求

上面的例子说明了，数据 Slot 从“缓存节点1”已经迁移到“缓存节点2”了，那么客户端可以直接找“缓存节点2”要数据。那么如果两个缓存节点正在做节点的数据迁移，此时客户端请求会如何处理呢？

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736260735931-9d67ef09-a019-4b5a-9553-d2d7233f92b8.png)

- Redis 客户端向 “缓存节点 1” 发出请求。
- 若 “缓存节点 1” 正向 “缓存节点 2” 迁移数据且未命中对应 Slot：

- “缓存节点 1” 会返回客户端一个 ASK 重定向请求，并告知 “缓存节点 2” 的地址。

- 客户端向 “缓存节点 2” 发送 Asking 命令，询问所需数据是否在 “缓存节点 2” 上。
- “缓存节点 2” 接到消息后，返回数据是否存在的结果。

3. 频繁重定向造成的网络开销的处理：smart客户端

1. **什么是smart客户端**

在大部分情况下，可能都会出现一次请求重定向才能找到正确的节点，这个重定向过程显然会增加集群的网络负担和单次请求耗时。所以大部分的客户端都是smart的。所谓 smart客户端，就是指客户端本地维护一份hashslot => node的映射表缓存，大部分情况下，直接走本地缓存就可以找到hashslot => node，不需要通过节点进行moved重定向，

2. **JedisCluster的工作原理**

- JedisCluster 初始化时：

- 随机选择一个 node。
- 初始化 hashslot => node 映射表。
- 为每个节点创建一个 JedisPool 连接池。

- 每次基于 JedisCluster 执行操作时：

- 先在本地计算 key 的 hashslot。
- 在本地映射表找到对应的节点 node。

- 存在两种情况：

- 若该 node 仍持有此 hashslot，则操作正常进行。
- 若进行了 reshard 操作，hashslot 不在该 node 上，会返回 moved。

- 当 JedisCluster API 发现对应节点返回 moved 时：

- 利用节点返回的元数据，更新本地的 hashslot => node 映射表缓存。
- 重复上述步骤直至找到对应节点。

- 若重试超过 5 次：

- 报错，抛出 JedisClusterMaxRedirectionException。

3. hashslot迁移和ask重定向

若 hashslot 正在迁移，会向客户端返回 ask 重定向，客户端接收后重新定位到目标节点执行；因 ask 发生在迁移过程中，JedisCluster API 收到 ask 不会更新 hashslot 本地缓存。ASK 和 MOVED 虽都是对客户端的重定向控制，但有本质区别：ASK 重定向表明集群正在进行 slot 数据迁移，客户端无法知晓迁移完成时间，属于临时性重定向，客户端不更新 slots 缓存；MOVED 重定向说明键对应的槽已明确指定到新节点，客户端需更新 slots 缓存。

#### Redis集群中节点的通信机制：goosip协议

Redis 集群的哈希槽算法解决数据存取问题，不同哈希槽分布在不同节点，各节点维护自身认知的集群状态，且集群采用去中心化架构。当集群状态如新节点加入、slot 迁移、节点宕机、从节点提升为主节点等发生变化时，需让其他节点尽快知晓，那么 Redis 如何处理以及不同节点间怎样通信以维护集群同步状态的呢？

在Redis集群中，不同的节点之间采用gossip协议进行通信，节点之间通讯的目的是为了维护节点之间的元数据信息。这些元数据就是每个节点包含哪些数据，是否出现故障，**通过gossip协议，达到最终数据的一致性。**
gossip协议，是基于病毒传播方式的节点或者进程之间信息交换的协议。原理就是在不同的节点间不断地通信交换信息，一段时间后，所有的节点就都有了整个集群的完整信息，并且所有节点的状态都会达成一致。每个节点可能知道所有其他节点，也可能仅知道几个邻居节点，但只要这些节可以通过网络连通，最终他们的状态就会是一致的。Gossip协议最大的好处在于，即使集群节点的数量增加，每个节点的负载也不会增加很多，几乎是恒定的。

**Redis集群中节点的通信过程如下：**

- 集群中每个节点都会单独开一个TCP通道，用于节点间彼此通信。
- 每个节点在固定周期内通过待定的规则选择几个节点发送ping消息
- 接收到ping消息的节点用pong消息作为响应

gossip 协议优点是分散了元数据更新的压力，缺点是元数据更新有延时致操作滞后，对服务器时间要求高，时间戳不准影响消息有效性，节点增多网络开销大且达最终一致性时间变长，官方推荐最大节点数约 1000。

redis cluster架构下的每个redis都要开放两个端口号，比如一个是6379，另一个就是加1w的端口16379。

- **6379端口号就是redis服务器入口。**
- **16379端口号是用来进行节点间通信的**，也就是 cluster bus 的东西，cluster bus 的通信，用来进行故障检测、配置更新、故障转移授权。cluster bus 用的是一种叫gossip 协议的二进制协议

#### 1. gossip协议的常见类型

gossip协议常见的消息类型包含： `ping`、`pong`、`meet`、`fail`等等。

- **meet**：主要用于通知新节点加入到集群中，通过「cluster meet ip port」命令，已有集群的节点会向新的节点发送邀请，加入现有集群。
- **ping**：用于交换节点的元数据。每个节点每秒会向集群中其他节点发送 ping 消息，消息中封装了自身节点状态还有其他部分节点的状态数据，也包括自身所管理的槽信息等等。

- 因为发送ping命令时要携带一些元数据，如果很频繁，可能会加重网络负担。因此，一般每个节点每秒会执行 **10 次 ping**，每次会选择 5 个最久没有通信的其它节点。
- 如果发现某个节点通信延时达到了 `cluster_node_timeout / 2`，那么立即发送 ping，避免数据交换延时过长导致信息严重滞后。比如说，两个节点之间都 10 分钟没有交换数据了，那么整个集群处于严重的元数据不一致的情况，就会有问题。所以 `cluster_node_timeout` 可以调节，如果调得比较大，那么会降低 ping 的频率。
- 每次 ping，会带上自己节点的信息，还有就是带上 **1/10 其它节点的信息**，发送出去，进行交换。至少包含 **3 个其它节点**的信息，最多包含 **（总节点数 - 2）**个其它节点的信息。

- **pong**：ping和meet消息的响应，同样包含了自身节点的状态和集群元数据信息。
- **fail**：某个节点判断另一个节点 fail 之后，向集群所有节点广播该节点挂掉的消息，其他节点收到消息后标记已下线。

由于Redis集群的去中心化以及gossip通信机制，**Redis集群中的节点只能保证最终一致性**。例如当加入新节点时(meet)，**只有邀请节点和被邀请节点**知道这件事，其余节点要等待 ping 消息一层一层扩散。除了 **Fail 是立即全网通知**的，其他诸如新节点、节点重上线、从节点选举成为主节点、槽变化等，都需要等待被通知到，也就是Gossip协议是最终一致性的协议。

#### 2. **meet命令的实现**

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736263535927-d6f2aaef-9175-46a1-aaae-da15b61d212b.png)

1. 节点 A 为节点 B 创建 clusterNode 结构并添加到自身 clusterState.nodes 字典。
2. 节点 A 按 CLUSTER MEET 命令的 IP 和端口向节点 B 发 MEET 消息。
3. 节点 B 收到 MEET 消息后为节点 A 创建 clusterNode 结构并添加到自身 clusterState.nodes 字典。
4. 节点 B 向节点 A 返回 PONG 消息。
5. 节点 A 收到 PONG 消息，知晓节点 B 已接收 MEET 消息。
6. 节点 A 向节点 B 返回 PING 消息。
7. 节点 B 收到 PING 消息，知晓节点 A 已接收 PONG 消息，握手完成。
8. 节点 A 通过 Gossip 协议将节点 B 信息传播给其他节点，使其他节点与节点 B 握手，一段时间后节点 B 被集群所有节点认识。

### 集群的扩容与收缩

作为分布式部署的缓存节点总会遇到缓存扩容和缓存故障的问题。这就会导致缓存节点的上线和下线的问题。由于每个节点中保存着槽数据，因此当缓存节点数出现变动时，这些槽数据会根据对应的虚拟槽算法被迁移到其他的缓存节点上。所以对于redis集群，**集群伸缩主要在于槽和数据在节点之间移动**。

#### 1. 扩容

- 启动新节点
- 使用cluster meet命令将新节点加入到集群
- 迁移槽和数据：添加新节点后，需要将一些槽和数据从旧节点迁移到新节点

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736265686155-5d535f72-daa0-4bc2-a159-6aa4d9abea30.png)

如上图所示，集群中本来存在“缓存节点1”和“缓存节点2”，此时“缓存节点3”上线了并且加入到集群中。此时根据虚拟槽的算法，“缓存节点1”和“缓存节点2”中对应槽的数据会应该新节点的加入被迁移到“缓存节点3”上面。

新节点加入到集群的时候，作为孤儿节点是没有和其他节点进行通讯的。因此需要在集群中任意节点执行 cluster meet 命令让新节点加入进来。假设新节点是 192.168.1.1 5002，老节点是 192.168.1.1 5003，那么运行以下命令将新节点加入到集群中。

192.168.1.1 5003> cluster meet 192.168.1.1 5002

这个是由老节点发起的，有点老成员欢迎新成员加入的意思。新节点刚刚建立没有建立槽对应的数据，也就是说没有缓存任何数据。如果这个节点是主节点，需要对其进行槽数据的扩容；如果这个节点是从节点，就需要同步主节点上的数据。总之就是要同步数据。

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736265872417-99f3a30b-86e4-4823-94b1-e452d620feab.png)

如上图所示，由客户端发起节点之间的槽数据迁移，数据从源节点往目标节点迁移。

1. 客户端对目标节点发起准备导入槽数据的命令，让目标节点准备好导入槽数据。使用命令：cluster setslot {slot} importing {sourceNodeId}
2. 之后对源节点发起送命令，让源节点准备迁出对应的槽数据。使用命令：cluster setslot {slot} migrating {targetNodeId}
3. 此时源节点准备迁移数据了，在迁移之前把要迁移的数据获取出来。通过命令 cluster getkeysinslot {slot} {count}。Count 表示迁移的 Slot 的个数。
4. 然后在源节点上执行，migrate {targetIP} {targetPort} “” 0 {timeout} keys {keys} 命令，把获取的键通过流水线批量迁移到目标节点。
5. 重复 3 和 4 两步不断将数据迁移到目标节点。
6. 完成数据迁移到目标节点以后，通过 cluster setslot {slot} node {targetNodeId} 命令通知对应的槽被分配到目标节点，并且广播这个信息给全网的其他主节点，更新自身的槽节点对应表。

#### 2. 收缩

- 迁移槽。
- 忘记节点。通过命令 cluster forget {downNodeId} 通知其他的节点

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736266160166-8161195d-4f28-4d4e-80d0-2e21e7740559.png)

为了安全删除节点，Redis集群只能下线没有负责槽的节点。因此如果要下线有负责槽的master节点，则需要先将它负责的槽迁移到其他节点。迁移的过程也与上线操作类似，不同的是下线的时候需要通知全网的其他节点忘记自己，此时通过命令 cluster forget {downNodeId} 通知其他的节点。

### 集群的故障检测与故障恢复机制

#### 1. 集群的故障检测

Redis集群的故障检测是基于gossip协议的，集群中的每个节点都会定期地向集群中的其他节点发送PING消息，以此交换各个节点状态信息，检测各个节点状态：在线状态、疑似下线状态PFAIL、已下线状态FAIL。

- 主观下线（pfail）：当节点A检测到与节点B的通讯时间超过了cluster-node-timeout 的时候，就会更新本地节点状态，把节点B更新为主观下线。

主观下线并不能代表某个节点真的下线了，有可能是节点A与节点B之间的网络断开了，但是其他的节点依旧可以和节点B进行通讯。

- 客观下线：由于集群内的节点会不断地与其他节点进行通讯，下线信息也会通过 Gossip 消息传遍所有节点，因此集群内的节点会不断收到下线报告。

当**半数以上的主节点**标记了节点B是主观下线时，便会触发客观下线的流程（该流程只针对主节点，如果是从节点就会忽略）。将主观下线的报告保存到本地的 ClusterNode 的结构**fail_reports**链表中，并且对主观下线报告的时效性进行检查，如果超过 **cluster-node-timeout*2** 的时间，就忽略这个报告，否则就记录报告内容，将其标记为**客观下线**。

接着向集群广播一条主节点B的**Fail 消息**，所有收到消息的节点都会标记节点B为客观下线。

#### 2. 集群的故障恢复

当故障节点下线后，如果是持有槽的主节点则需要在其从节点中找出一个替换它，从而保证高可用。此时下线主节点的所有从节点都担负着恢复义务，这些从节点会定时监测主节点是否进入客观下线状态，如果是，则触发故障恢复流程。故障恢复也就是选举一个节点充当新的master，选举的过程是基于Raft协议选举方式来实现的。

1. **从节点过滤**

检查每个slave节点与master节点断开连接的时间，如果超过了**cluster-node-timeout * cluster-slave-validity-factor**，那么就没有资格切换成master

2. **投票选举**

- **节点排序**： 对通过过滤条件的所有从节点进行排序，按照priority、offset、run id排序，排序越靠前的节点，越优先进行选举。

- priority的值越低，优先级越高
- offset越大，表示从master节点复制的数据越多，选举时间越靠前，优先进行选举
- 如果offset相同，run id越小，优先级越高

- **更新配置纪元**：每个主节点会去更新配置纪元（clusterNode.configEpoch），这个值是不断增加的整数。这个值记录了每个节点的版本和整个集群的版本。每当发生重要事情的时候（例如：出现新节点，从节点精选）都会增加全局的配置纪元并且赋给相关的主节点，用来记录这个事件。更新这个值目的是，保证所有主节点对这件“大事”保持一致，大家都统一成一个配置纪元，表示大家都知道这个“大事”了。

- **发起选举**：更新完配置纪元以后，从节点会向集群发起广播选举的消息（CLUSTERMSG_TYPE_FAILOVER_AUTH_REQUEST），要求所有收到这条消息，并且具有投票权的主节点进行投票。每个从节点在一个纪元中只能发起一次选举。

- **选举投票**：如果一个主节点具有投票权，并且这个主节点尚未投票给其他从节点，那么主节点将向要求投票的从节点返回一条CLUSTERMSG_TYPE_FAILOVER_AUTH_ACK消息，表示这个主节点支持从节点成为新的主节点。每个参与选举的从节点都会接收CLUSTERMSG_TYPE_FAILOVER_AUTH_ACK消息，并根据自己收到了多少条这种消息来统计自己获得了多少主节点的支持。

如果超过**(N/2 + 1)**数量的**master节点**都投票给了某个从节点，那么选举通过，这个从节点可以切换成master，如果在 **cluster-node-timeout*2** 的时间内从节点没有获得足够数量的票数，本次选举作废，**更新配置纪元**，并进行**第二轮选举**，直到选出新的主节点为止。

在节点排序领先的从节点通常会获得更多的票，因为它触发选举的时间更早一些，获得票的机会更大

3. **替换主节点**

当满足投票条件的从节点被选出来以后，会触发替换主节点的操作。删除原主节点负责的槽数据，把这些槽数据添加到自己节点上，并且广播让其他的节点都知道这件事情，新的主节点诞生了。

1. 被选中的从节点执行SLAVEOF NO ONE命令，使其成为新的主节点
2. 新的主节点会撤销所有对已下线主节点的槽指派，并将这些槽全部指派给自己
3. 新的主节点对集群进行广播PONG消息，告知其他节点已经成为新的主节点
4. 新的主节点开始接收和处理槽相关的请求

备注：如果集群中某个节点的master和slave节点都宕机了，那么集群就会进入fail状态，因为集群的slot映射不完整。如果集群超过半数以上的master挂掉，无论是否有slave，集群都会进入fail状态。

### Redis集群的搭建

Redis集群的搭建可以分为以下几个部分：

1、**启动节点**：将节点以**集群模式**启动，读取或者生成集群的配置文件，此时节点是**独立**的。

2、**节点握手**：节点通过**gossip协议**通信，将独立的节点连成网络，**主要使用meet命令**。

3、**槽指派**：将16384个槽位分配给主节点，以达到分片保存数据库键值对的效果。

参考文章

[2W 字详解 Redis 集群环境搭建实践](https://juejin.cn/post/6922690589347545102#heading-1)

### Redis集群的运维

1、**数据迁移问题**

Redis集群可以进行节点的**动态扩容缩容**，这一过程目前还处于**半自动状态**，需要**人工介入**。在扩缩容的时候，需要进行**数据迁移**。而 Redis为了保证迁移的一致性，迁移所有操作都是**同步操作**，执行迁移时，**两端的 Redis**均会进入时长不等的**阻塞状态**，对于小Key，该时间可以忽略不计，但如果一旦Key的内存使用过大，严重的时候会直接触发集群内的**故障转移**，造成不必要的切换。

2、**带宽消耗问题**

Redis集群是**无中心节点的集群架构**，依靠**Gossip协议**协同自动化修复集群的状态，但goosip有**消息延时和消息冗余**的问题，在集群节点数量过多的时候，goosip协议通信会消耗大量的带宽，主要体现在以下几个方面：

- **消息发送频率**：跟`cluster-node-timeout`密切相关，当节点发现与其他节点的最后通信时间超过 `cluster-node-timeout/2`时会直接发送ping消息
- **消息数据量**：每个消息主要的数据占用包含：slots槽数组（2kb）和整个集群1/10的状态数据
- **节点部署的机器规模**：机器的带宽**上限是固定的**，因此相同规模的集群分布的机器越多，每台机器划分的节点越均匀，则整个集群内整体的可用带宽越高

**集群带宽消耗主要分为**：**读写命令消耗**+**Gossip消息消耗**，因此搭建Redis集群需要根据业务数据规模和消息通信成本做出合理规划：

- 在满足业务需求的情况下尽量避免大集群，同一个系统可以针对不同业务场景拆分使用若干个集群。
- 适度提供`cluster-node-timeout`**降低消息发送频率**，但是cluster-node-timeout还影响故障转移的速度，因此需要根据自身业务场景兼顾二者平衡
- 如果条件允许尽量均匀部署在更多机器上，**避免集中部署**。如果有60个节点的集群部署在3台机器上每台20个节点，这是机器的带宽消耗将非常严重

3、**Pub/Sub广播问题**：

集群模式下内部对**所有publish命令**都会向**所有节点**进行广播，加重带宽负担，所以集群应该**避免频繁使用Pub/sub功能**

4、**集群倾斜**：

集群倾斜是指不同节点之**间数据量和请求量**出现明显差异，这种情况将加大负载均衡和开发运维的难度。因此需要理解集群倾斜的原因

- **数据倾斜**：

- 节点和槽分配不均
- 不同槽对应键数量差异过大
- 集合对象包含大量元素
- 内存相关配置不一致

- **请求倾斜**：

- 合理设计键，热点**大集合对象做拆分**或者**使用hmget代替hgetall避免整体读取**

5、**集群读写分离**：

集群模式下**读写分离成本比较高**，**直接扩展主节点数量**来提高集群性能是更好的选择。

以上参考文章

[不懂Redis Cluster原理，我被同事diss了！](https://baijiahao.baidu.com/s?id=1663270958212268352&wfr=spider&for=pc)
=======
## 如何解决Redis中的热点Key问题？

### 什么是热点key问题？

热 key 问题指的是在某个瞬间，大量请求集中访问 Redis 里的同一个固定 key，这会造成缓存击穿，使得请求都直接涌向数据库，最终拖垮缓存服务和数据库服务，进而影响应用服务的正常运行。

像`热点新闻`、`热点评论`、`明星直播`这类读多写少的场景，很容易出现热点 key 问题。虽然 Redis 的查询性能比数据库高很多，但它也有性能上限，单节点查询性能一般在 2 万 QPS，所以对单个固定 key 的查询不能超过这个数值。

在服务端读取数据并进行分片切分（利用 Redis 的哈希槽）时，会在某个 Redis 节点主机 Server 上访问对应的 Key，如果对这个 Key 的访问量超过了该节点 Server 的承受极限，热点 Key 问题就会出现。

### 如何定义热key

热key的定义，通常以其接收到的Key被请求频率来判定，例如：

- QPS集中在特定的Key：Redis实例的总QPS为10,000，而其中一个Key的每秒访问量达到了7,000。那么这个key就算热key了。
- 带宽使用率集中在特定的Key：对一个拥有1000个成员且总大小为1 MB的HASH Key每秒发送大量的HGETALL操作请求。
- CPU使用时间占比集中在特定的Key：对一个拥有10000个成员的Key（ZSET类型）每秒发送大量的ZRANGE操作请求。

### 热key的危害

1. **流量集中超网卡上限**：热点 Key 请求过多，超过主机网卡流量上限，会使该节点服务器的其他服务无法运行。
2. **打垮缓存分片服务**：Redis 单点查询性能有限，热点 Key 查询超阈值会占用大量 CPU 资源，降低整体性能，严重时导致缓存分片服务崩溃（如 Redis 节点自重启），影响其他业务。
3. **集群访问倾斜**：在集群架构下，会出现某个数据分片被大量访问，其他分片空闲的情况，可能导致该分片连接数耗尽，新连接请求被拒。
4. **DB 击穿与业务雪崩**：热 Key 请求超 Redis 承受能力致缓存击穿，缓存失效时大量请求直抵 DB 层，DB 性能弱，易引发雪崩，影响业务。在抢购或秒杀场景下，还可能因库存 Key 请求量过大造成超卖

### 如何发现热Key？

1. **凭借业务经验预估**：具有一定可行性，例如整点秒杀活动中，活动信息 key 和头部楼层秒杀商品信息 key 通常是热点 key。但并非所有热 key 都能准确预测，可借助商家历史活动数据分析作为参考。
2. **业务侧自行监控收集**：在操作 Redis 前添加代码进行数据统计并异步上报，类似日志采集，将 Redis 命令操作、结果、耗时等信息通过异步消息发送至采集消息队列。缺点是对代码有入侵性，可通过中间件集成在 Redis 二方包中。若有较好的 Daas 平台，可在 proxy 层监控，业务无感知，统一在平台查看监控。
3. **使用 Redis 自带命令**：

- **monitor 命令**：能实时抓取 Redis 服务器接收的命令，可通过代码统计热 key，也有现成分析工具如 redis - faina。但在高并发下存在内存暴增隐患，且会降低 Redis 性能。

- **优点**：这个方案的优点在于这个是 Redis 原生支持的功能，使用起来简单快捷。
- **缺点**：monitor 非常消耗性能，单个客户端执行 monitor 就会损耗 50% 的性能！不推荐这个方式！

- **hotkeys 参数**：Redis 4.0.3 提供此热点 key 发现功能，它是通过 scan + object freq 实现的。执行 redis - cli 时加 –hotkeys 选项即可。不过 key 较多时执行速度慢，且一般公司不允许直接连接 Redis 节点输入命令，多通过 Daas 平台查看热点 key 分析和监控 。

4. **客户端收集**：在操作 Redis 前添加统计 Redis 键值查询频次的逻辑，将统计数据发送到聚合计算平台计算，之后查看结果。

- **优点**：对性能损耗较低。
- **缺点**：成本较大，若企业没有聚合计算平台则需引入。

5. **代理层收集**：利用有些服务在请求 Redis 前会先请求代理服务这一特点，在代理层统一收集 Redis 热 Key 数据。比如**京东的JD-hotkey**、**有赞的TMC中间件技术**等

- **优点**：客户端使用方便，无需考虑 SDK 多语言异构差异和升级成本高的问题。
- **缺点**：需要为 Redis 定制代理层进行转发等操作，构建代理成本高，且转发存在性能损耗 。

### 如何解决热key

针对上面的Redis产生的原因以及危害，可以进行以下几个解决思路：

#### 多级缓存

**我之前自己写过一个简单的二级缓存框架（实现了本地缓存同步，注解操作多级缓存，监控内存使用情况等技术点），也是参考了阿里的jetcache开源框架，后面我会详细讲解。**

解决热 key 问题主要靠加缓存，通过减少系统交互让用户请求提前返回，既能提升用户体验，又能减轻系统压力。缓存方式多样，可在客户端浏览器、就近 CDN、借助 Redis 等缓存框架以及服务器本地进行缓存。多种缓存结合使用便形成二级、三级等多级缓存，其目的是尽量缩短用户访问链路长度 。

如下图：

![](https://cdn.nlark.com/yuque/0/2022/png/26566882/1665051833627-309f0f4d-2621-46d2-97e7-16ce4eb86199.png?x-oss-process=image%2Fformat%2Cwebp%2Fresize%2Cw_750%2Climit_0)

但通常应对热key时，二级缓存就是一种有效的解决方案。

使用本地缓存，如利用`ehcache`、`GuavaCache`、`Caffeine`等，甚至是一个`HashMap`都可以；在发现热key以后，把热key加载到系统的JVM中，针对这种热key请求，会直接从本地缓存中取，而不会直接请求redis；

本地缓存天然的将同一个key的大量请求，根据网络层的`负载均衡`，均匀分散到了不同的机器节点上，避免了对于固定key全部打到单个redis节点的情况，并且减少了1次网络交互；

当然，使用本地缓存不可避免的遇到的问题就是，对于要求缓存强一致性的业务来说，需要花费更多的精力在保证分布式缓存一致性上，会增加系统的复杂度；

#### 热key备份

该方案旨在缓解 Redis 单点热 key 查询压力，具体做法是在多个 Redis 节点上备份热 key，避免固定 key 总是访问同一节点。通过在初始化时为 key 拼接 0 - 2N 之间的随机尾缀，使生成的备份 key 分散在各个节点上。在有热 key 请求时，随机选取一个备份 key 所在的节点进行访问取值，这样读写操作就不会集中于单个节点，从而有效减轻了单个 Redis 节点的负担，提升系统应对热 key 问题的能力。

流程如下：

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736244176205-f93d4a3f-c429-4895-8ff5-1ea7a9deff5f.png)

热key备份，是把一份数据全量复制到多个服务节点中，还有一种情况，我们可以使用热key拆分，两者主要的区别就是前者是**一份数据全量复制多份**，后者是**一份数据拆分成多份**。

#### 热key拆分

将热 key 拆分成多个带后缀名的 key，分散存储到多个实例中。客户端请求时按规则算出固定 key，使多次请求分散到不同节点。以 “某抖音热搜” 为例，拆分成多个带编号后缀的 key 存储在不同节点，用户查询时根据用户 ID 算出下标访问对应节点。

虽用户可能只能获取部分数据，比如抖音中对于热点相关视频，可将其分散存储在不同节点并推送给不同用户，待热点降温后再汇总数据，挑选优质内容重新推送未收到的用户。此方法可缓解热 key 集中访问压力，提升系统性能和用户体验。

#### 核心业务隔离

Redis 单点查询性能有局限，当热点 key 查询量超节点性能阈值，会致使缓存分片服务崩溃，该节点上所有业务的 Redis 读写均无法使用。

为避免热点 key 问题波及核心业务，应提前做好核心与非核心业务的 Redis 隔离，至少要将存在热点 key 的 Redis 集群与核心业务隔离开，如此可保障核心业务不受热点 key 引发的问题影响，确保核心业务的稳定性和可用性，提升系统整体的可靠性和容错能力。

## 手写多级缓存框架

### 功能实现

对于框架要实现的功能，首先进行一个分析：

- JSR107定义了缓存使用规范，spring中提供了基于这个规范的接口，所以我们可以直接使用spring中的接口进行Caffeine和Redis两级缓存的整合改造。
- 在分布式环境下，如果一台主机的本地缓存进行修改，需要通知其他主机修改本地缓存，解决分布式环境下本地缓存一致性问题。
- 通过Springboot中的[Actuator](https://www.cnblogs.com/qingmuchuanqi48/p/13380334.html)功能对应用程序进行监控和管理， 通过Restful API请求来监管、审计、收集应用的运行情况，针对微服务而言它是必不可少的一个环节。

以上就是要实现的具体功能。接下来我们先了解下[JSR107规范](https://blog.csdn.net/lzb348110175/article/details/105341703)。

![](https://cdn.nlark.com/yuque/0/2024/png/26566882/1732604681992-d691db32-37a8-4df5-8127-154b74ddb8f5.png)其中缓存规范定义了5个核心接口， 而我们在使用`spring`集成第三方的缓存时，只需要实现`Cache`和`CacheManager`这两个接口就可以了，下面分别具体来看一下。

### Cache

在`Cache`接口中，定义了`get`、`put`、`evict`、`clear`等方法，分别对应缓存的存入、取出、删除、清空操作。不过我们这里不直接使用Cache接口，上面这张图中的`AbstractValueAdaptingCache`是一个抽象类，它已经实现了`Cache`接口，是`spring`在`Cache`接口的基础上帮助我们进行了一层封装，所以我们直接继承这个类就可以。

### 继承AbstractValueAdaptingCache

```
public class RedisCaffeineCahe extends AbstractValueAdaptingCache {
    protected RedisCaffeineCahe(boolean allowNullValues) {
        super(allowNullValues);
    }

    @Override
    protected Object lookup(Object o) {
        return null;
    }

  .....//后续等继承方法省略
}
```

但是继承类实现构造方法，需要把redis和caffeine缓存的不同配置添加进来，通过添加配置属性实现构造方法，这样就可以通过构造方法生成特殊的缓存实例`RedisCaffeineCahe`。

```
@Slf4j
public class RedisCaffeineCache extends AbstractValueAdaptingCache {

	@Getter
	private final String name;

	@Getter
    //咖啡因缓存的相关配置
	private final Cache<Object, Object> caffeineCache;
    
    //Redis缓存的相关配置
	private final RedisTemplate<Object, Object> stringKeyRedisTemplate;
    
	private final String cachePrefix;

	private final Duration defaultExpiration;
    
	private final Duration defaultNullValuesExpiration;

	private final Map<String, Duration> expires;

	private final String topic;

	private final Map<String, ReentrantLock> keyLockMap = new ConcurrentHashMap<>();

	private RedisSerializer<String> stringSerializer = RedisSerializer.string();

	private RedisSerializer<Object> javaSerializer = RedisSerializer.java();

	public RedisCaffeineCache(String name, RedisTemplate<Object, Object> stringKeyRedisTemplate,
			Cache<Object, Object> caffeineCache, CacheConfigProperties cacheConfigProperties) {
		super(cacheConfigProperties.isCacheNullValues());
		this.name = name;
		this.stringKeyRedisTemplate = stringKeyRedisTemplate;
		this.caffeineCache = caffeineCache;
		this.cachePrefix = cacheConfigProperties.getCachePrefix();
		this.defaultExpiration = cacheConfigProperties.getRedis().getDefaultExpiration();
		this.defaultNullValuesExpiration = cacheConfigProperties.getRedis().getDefaultNullValuesExpiration();
		this.expires = cacheConfigProperties.getRedis().getExpires();
		this.topic = cacheConfigProperties.getRedis().getTopic();
	}

    ......//后续继承方法，也需要根据不同的逻辑进行实现，暂略

}
```

### 自定义配置

通过上面的实现案例中可以看到注入了很多属性，这些属性都是我们根据需要进行定义的，接下来就了解一下相关的属性信息，总共三个类，分别是

CaffeineConfigProp，RedisConfigProp，CacheConfigProperties。都是属性配置相关，前两个是两个不同缓存的配置，最后一个是缓存的配置汇总，多级缓存，主要就是把不同的缓存进行组合，通过继承实现接口实现多级缓存的各种操作逻辑。

```
@Data
public class CaffeineConfigProp {

	/**
	 * 访问后过期时间
	 */
	private Duration expireAfterAccess;

	/**
	 * 写入后过期时间
	 */
	private Duration expireAfterWrite;

	/**
	 * 写入后刷新时间
	 */
	private Duration refreshAfterWrite;

	/**
	 * 初始化大小
	 */
	private int initialCapacity;

	/**
	 * 最大缓存对象个数，超过此数量时之前放入的缓存将失效
	 */
	private long maximumSize;

	/**
	 * key 强度
	 */
	private CaffeineStrength keyStrength;

	/**
	 * value 强度
	 */
	private CaffeineStrength valueStrength;

}
```

```
@Data
public class RedisConfigProp {

	/**
	 * 全局过期时间，默认不过期
	 */
	private Duration defaultExpiration = Duration.ZERO;

	/**
	 * 全局空值过期时间，默认和有值的过期时间一致，一般设置空值过期时间较短
	 */
	private Duration defaultNullValuesExpiration = null;

	/**
	 * 每个cacheName的过期时间，优先级比defaultExpiration高
	 */
	private Map<String, Duration> expires = new HashMap<>();

	/**
	 * 缓存更新时通知其他节点的topic名称
	 */
	private String topic = "cache:redis:caffeine:topic";

}
```

```
@Data
@ConfigurationProperties(prefix = "spring.cache.multi")
public class CacheConfigProperties {

	private Set<String> cacheNames = new HashSet<>();

	/**
	 * 是否存储空值，默认true，防止缓存穿透
	 */
	private boolean cacheNullValues = true;

	/**
	 * 是否动态根据cacheName创建Cache的实现，默认true
	 */
	private boolean dynamic = true;

	/**
	 * 缓存key的前缀
	 */
	private String cachePrefix;

	@NestedConfigurationProperty
	private RedisConfigProp redis = new RedisConfigProp();

	@NestedConfigurationProperty
	private CaffeineConfigProp caffeine = new CaffeineConfigProp();

}
```

### CacheManager

```
@Slf4j
public class RedisCaffeineCacheManager implements CacheManager {

	private ConcurrentMap<String, Cache> cacheMap = new ConcurrentHashMap<String, Cache>();

	private CacheConfigProperties cacheConfigProperties;

	private RedisTemplate<Object, Object> stringKeyRedisTemplate;

	private boolean dynamic;

	private Set<String> cacheNames;
    //构造方法 
	public RedisCaffeineCacheManager(CacheConfigProperties cacheConfigProperties,
			RedisTemplate<Object, Object> stringKeyRedisTemplate) {
		super();
		this.cacheConfigProperties = cacheConfigProperties;
		this.stringKeyRedisTemplate = stringKeyRedisTemplate;
		this.dynamic = cacheConfigProperties.isDynamic();
		this.cacheNames = cacheConfigProperties.getCacheNames();
	}

    
	@Override
	public Cache getCache(String name) {
		Cache cache = cacheMap.get(name);
		if (cache != null) {
			return cache;
		}
		if (!dynamic && !cacheNames.contains(name)) {
			return cache;
		}

		cache = new RedisCaffeineCache(name, stringKeyRedisTemplate, caffeineCache(), cacheConfigProperties);
		Cache oldCache = cacheMap.putIfAbsent(name, cache);
		log.debug("create cache instance, the cache name is : {}", name);
		return oldCache == null ? cache : oldCache;
	}
    //生成caffeine缓存实例
	public com.github.benmanes.caffeine.cache.Cache<Object, Object> caffeineCache() {
		Caffeine<Object, Object> cacheBuilder = Caffeine.newBuilder();
		doIfPresent(cacheConfigProperties.getCaffeine().getExpireAfterAccess(), cacheBuilder::expireAfterAccess);
		doIfPresent(cacheConfigProperties.getCaffeine().getExpireAfterWrite(), cacheBuilder::expireAfterWrite);
		doIfPresent(cacheConfigProperties.getCaffeine().getRefreshAfterWrite(), cacheBuilder::refreshAfterWrite);
		if (cacheConfigProperties.getCaffeine().getInitialCapacity() > 0) {
			cacheBuilder.initialCapacity(cacheConfigProperties.getCaffeine().getInitialCapacity());
		}
		if (cacheConfigProperties.getCaffeine().getMaximumSize() > 0) {
			cacheBuilder.maximumSize(cacheConfigProaf
	}

	@Override
	public Collection<String> getCacheNames() {
		return this.cacheNames;
	}

	public void clearLocal(String cacheName, Object key) {
		Cache cache = cacheMap.get(cacheName);
		if (cache == null) {
			return;
		}

		RedisCaffeineCache redisCaffeineCache = (RedisCaffeineCache) cache;
		redisCaffeineCache.clearLocal(key);
	}

}
```

需要注意的上面代码中的有参构造方法通过给属性赋值，然后`getCache`方法中会生成`RedisCaffeineCache`的实例，`RedisCaffeineCache`这个实例中的方法就是定义如何具体操作缓存数据的。

两个核心类`Cache`，`CacheManager`的实现类都有，接下来就是通过配置生成实现类的Bean。

```
@Configuration(proxyBeanMethods = false)
@AutoConfigureAfter(RedisAutoConfiguration.class)
@EnableConfigurationProperties(CacheConfigProperties.class)
public class MultilevelCacheAutoConfiguration {

	@Bean
	@ConditionalOnBean(RedisTemplate.class)
	public RedisCaffeineCacheManager cacheManager(CacheConfigProperties cacheConfigProperties,
			@Qualifier("stringKeyRedisTemplate") RedisTemplate<Object, Object> stringKeyRedisTemplate) {
		return new RedisCaffeineCacheManager(cacheConfigProperties, stringKeyRedisTemplate);
	}

	/**
	 * 可自定义名称为stringKeyRedisTemplate的RedisTemplate覆盖掉默认RedisTemplate。
	 */
	@Bean
	@ConditionalOnMissingBean(name = "stringKeyRedisTemplate")
	public RedisTemplate<Object, Object> stringKeyRedisTemplate(RedisConnectionFactory redisConnectionFactory) {
		RedisTemplate<Object, Object> template = new RedisTemplate<>();
		template.setConnectionFactory(redisConnectionFactory);
		template.setKeySerializer(new StringRedisSerializer());
		template.setHashKeySerializer(new StringRedisSerializer());
		return template;
	}

	@Bean
	public RedisMessageListenerContainer cacheMessageListenerContainer(CacheConfigProperties cacheConfigProperties,
			@Qualifier("stringKeyRedisTemplate") RedisTemplate<Object, Object> stringKeyRedisTemplate,
			RedisCaffeineCacheManager redisCaffeineCacheManager) {
		RedisMessageListenerContainer redisMessageListenerContainer = new RedisMessageListenerContainer();
		redisMessageListenerContainer.setConnectionFactory(stringKeyRedisTemplate.getConnectionFactory());
		CacheMessageListener cacheMessageListener = new CacheMessageListener(redisCaffeineCacheManager);
		redisMessageListenerContainer.addMessageListener(cacheMessageListener,
				new ChannelTopic(cacheConfigProperties.getRedis().getTopic()));
		return redisMessageListenerContainer;
	}

}
```

前两个Bean就是实现多级缓存相关的配置，第三个的话就是实现我们上面说的第二个功能。

- 在分布式环境下，如果一台主机的本地缓存进行修改，需要通知其他主机修改本地缓存，解决分布式环境下本地缓存一致性问题。

需要先了解下redis的pub/sub模式(发布订阅)。我们可以通过redis的发布订阅模式进行消息通知其他主机的本地缓存。

### 分布式下本地缓存一致

既然通过redis的发布订阅模式保证缓存一致，那就需要思考在什么时候会导致本地缓存不一致，毫无疑问就是操作缓存变动后，所以经过上面分析我们可以在操作缓存变动的同时发布消息通知其他主机进行缓存同步，把相关变动的缓存key通过topic发送到相应的服务器上，接下来我们进行代码实现：

```
/**
 * @param message
 * @description 缓存变更时通知其他节点清理本地缓存
 * @author muzi
 *
 */
private void push(CacheMessage message) {

   /**
    * 为了能自定义redisTemplate，发布订阅的序列化方式固定为jdk序列化方式。
    */
   Assert.hasText(topic, "a non-empty channel is required");
   byte[] rawChannel = stringSerializer.serialize(topic);
   byte[] rawMessage = javaSerializer.serialize(message);
   stringKeyRedisTemplate.execute((connection) -> {
      connection.publish(rawChannel, rawMessage);
      return null;
   }, true);

   // stringKeyRedisTemplate.convertAndSend(topic, message);
}
```

在缓存进行`put`，`evict`，`clear`操作的时候都需要进行消息通知，通知其他服务器进行移除本地对应key的缓存，这样下次其他服务器本地查询缓存数据回因为不存在进行更新缓存。

```
@Override
	public <T> T get(Object key, Callable<T> valueLoader) {
		Object value = lookup(key);
		if (value != null) {
			return (T) value;
		}

		ReentrantLock lock = keyLockMap.computeIfAbsent(key.toString(), s -> {
			log.trace("create lock for key : {}", s);
			return new ReentrantLock();
		});

		try {
			lock.lock();
			value = lookup(key);
			if (value != null) {
				return (T) value;
			}
			value = valueLoader.call();
			Object storeValue = toStoreValue(value);
			put(key, storeValue);
			return (T) value;
		}
		catch (Exception e) {
			throw new ValueRetrievalException(key, valueLoader, e.getCause());
		}
		finally {
			lock.unlock();
		}
	}

	@Override
	public void put(Object key, Object value) {
		if (!super.isAllowNullValues() && value == null) {
			this.evict(key);
			return;
		}
		doPut(key, value);
	}

	@Override
	public ValueWrapper putIfAbsent(Object key, Object value) {
		Object prevValue;
		// 考虑使用分布式锁，或者将redis的setIfAbsent改为原子性操作
		synchronized (key) {
			prevValue = getRedisValue(key);
			if (prevValue == null) {
				doPut(key, value);
			}
		}
		return toValueWrapper(prevValue);
	}

	private void doPut(Object key, Object value) {
		value = toStoreValue(value);
		Duration expire = getExpire(value);
		setRedisValue(key, value, expire);

		push(new CacheMessage(this.name, key));

		caffeineCache.put(key, value);
	}

	@Override
	public void evict(Object key) {
		// 先清除redis中缓存数据，然后清除caffeine中的缓存，避免短时间内如果先清除caffeine缓存后其他请求会再从redis里加载到caffeine中
		stringKeyRedisTemplate.delete(getKey(key));

		push(new CacheMessage(this.name, key));

		caffeineCache.invalidate(key);
	}

	@Override
	public void clear() {
		// 先清除redis中缓存数据，然后清除caffeine中的缓存，避免短时间内如果先清除caffeine缓存后其他请求会再从redis里加载到caffeine中
		Set<Object> keys = stringKeyRedisTemplate.keys(this.name.concat(":*"));

		if (!CollectionUtils.isEmpty(keys)) {
			stringKeyRedisTemplate.delete(keys);
		}

		push(new CacheMessage(this.name, null));

		caffeineCache.invalidateAll();
	}

	@Override
	protected Object lookup(Object key) {
		Object cacheKey = getKey(key);
		Object value = caffeineCache.getIfPresent(key);
		if (value != null) {
			log.debug("get cache from caffeine, the key is : {}", cacheKey);
			return value;
		}

		value = getRedisValue(key);

		if (value != null) {
			log.debug("get cache from redis and put in caffeine, the key is : {}", cacheKey);
			caffeineCache.put(key, value);
		}
		return value;
	}
```

发布实现了后，当然还需要订阅方法，也就是我们需要监听消息通知。

```
@Slf4j
@RequiredArgsConstructor
public class CacheMessageListener implements MessageListener {

	private RedisSerializer<Object> javaSerializer = RedisSerializer.java();

	private final RedisCaffeineCacheManager redisCaffeineCacheManager;

	@Override
	public void onMessage(Message message, byte[] pattern) {

		/**
		 * 发送端固定了jdk序列户方式，接收端同样固定了jdk序列化方式进行反序列化。
		 */
		CacheMessage cacheMessage = (CacheMessage) javaSerializer.deserialize(message.getBody());
		log.debug("recevice a redis topic message, clear local cache, the cacheName is {}, the key is {}",
				cacheMessage.getCacheName(), cacheMessage.getKey());
		redisCaffeineCacheManager.clearLocal(cacheMessage.getCacheName(), cacheMessage.getKey());
	}

}
```

以上就是分布式本地缓存一致的问题解决方案，当然可以思考下是否有更好的实现方案。

然后就是监控缓存相关信息的功能，这个该如何实现？学过SpringBoot的话就会了解其中有个actuate模块。

actuate模块

- 它是 Spring Boot 提供的一个用于监控和管理应用程序的模块。它提供了生产级别的功能，如端点（endpoints）来查看应用程序的各种运行时信息，包括健康检查、性能指标、环境信息等诸多内容。

1. **主要功能 - 端点（Endpoints）**

- **/health 端点**

- 这个端点用于检查应用程序的健康状况。它返回一个包含应用程序健康信息的 JSON 对象。例如，它可以检查数据库连接是否正常、消息队列是否可用等。默认情况下，它会检查应用程序上下文（application context）中的各种健康指示器（HealthIndicator）。比如，如果应用程序连接了一个数据库，Spring Boot Actuator 会通过数据库连接池提供的健康检查机制来确定数据库连接是否健康。如果数据库连接正常，健康状态可能显示为 “UP”，否则可能显示为 “DOWN”。

- **/metrics 端点**

- 用于暴露应用程序的各种度量指标信息。这些指标包括 JVM 内存使用情况（如堆内存使用量、非堆内存使用量）、线程池信息（如活跃线程数、线程池最大线程数）、HTTP 请求统计信息（如请求次数、响应时间）等。例如，通过访问这个端点可以获取到应用程序在一段时间内处理的 HTTP 请求的平均响应时间，这对于性能优化和监控系统的负载情况非常有用。

- **/info 端点**

- 可以用来展示应用程序的自定义信息。开发人员可以在配置文件（如 application.properties 或 application.yml）中设置一些关于应用程序的信息，比如应用程序的版本号、构建时间、作者信息等。当访问这个端点时，这些自定义信息就会以 JSON 格式返回，方便在运维过程中快速了解应用程序的基本情况。

2. **自定义端点**

- 除了使用 Spring Boot Actuator 提供的默认端点外，还可以自定义端点。通过创建一个带有`@Endpoint`注解的 Java 类来定义一个新的端点。例如，可以创建一个端点来获取应用程序中某个特定业务模块的运行状态。在这个自定义端点类中，可以定义操作（使用`@ReadOperation`、`@WriteOperation`等注解）来返回或修改相关的状态信息。

3. **安全考虑**

- 由于 Spring Boot Actuator 端点暴露了应用程序的敏感信息，如应用程序的内部状态和配置细节，所以在生产环境中需要进行适当的安全配置。可以通过 Spring Security 等安全框架来保护这些端点，例如设置访问权限，只允许具有特定角色的用户访问某些敏感端点，如`/actuator/env`端点（用于查看环境变量）。

4. **与其他工具的集成**

- Spring Boot Actuator 可以与各种监控和管理工具集成。例如，它可以很方便地与 Prometheus 集成，将应用程序的度量指标数据发送给 Prometheus 服务器，然后通过 Grafana 等工具进行可视化展示。这样运维人员就可以直观地看到应用程序的运行情况和性能指标变化趋势。

### CacheMeterBinderProvider

SpringBoot中有一个函数式接口CacheMeterBinderProvider主要是一个与缓存计量（Cache Metering）相关的提供器（Provider）。代码类实现：

```
@NoArgsConstructor
public class RedisCaffeineCacheMeterBinderProvider implements CacheMeterBinderProvider<RedisCaffeineCache> {

	@Override
	public MeterBinder getMeterBinder(RedisCaffeineCache cache, Iterable<Tag> tags) {
		return new CaffeineCacheMetrics(cache.getCaffeineCache(), cache.getName(), tags);
	}

}
```

这段代码是在一个与缓存度量和监控相关的上下文中，通过获取特定缓存实例和相关标记信息，创建并返回一个能够对该缓存进行性能指标度量的`CaffeineCacheMetrics`对象，从而实现对`RedisCaffeineCache`的有效监控。

- `Iterable<Tag> tags`：第二个参数，类型为可迭代的`Tag`集合。`Tag`在这里可能是用于对度量数据进行分类或者标记的一种数据结构，通过传入不同的`Tag`，可以在后续的度量和监控过程中更方便地对数据进行筛选、分组和分析。

然后别忘把RedisCaffeineCacheMeterBinderProvider作为bean让spring进行管理

```
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass({ MeterBinder.class, CacheMeterBinderProvider.class })
public class RedisCaffeineCacheMeterConfiguration {

	@Bean
	public RedisCaffeineCacheMeterBinderProvider redisCaffeineCacheMeterBinderProvider() {
		return new RedisCaffeineCacheMeterBinderProvider();
	}
}
```

简单的监测内存的功能已经初步实现，如果要实现可视化数据监控，还需要接入其他工具。

## 有赞TMC方案分析

### 架构分析

其实方案的核心只有两步：1. 系统持续监控热点key；2. 发现热点key时发出通知做相应处理；有赞出过一篇《有赞透明多级缓存解决方案（TMC）》，里头也有提到热点key问题，我们刚好借此说明；

介绍一个方案之前先来看看为什么要设计这个方案——即他是来解决哪些痛点的？

使用有赞服务的电商商家数量和类型很多，商家会不定期做一些“商品秒杀”、“商品推广”活动，导致“营销活动”、“商品详情”、“交易下单”等链路应用出现缓存热点访问的情况：

（1）活动时间、活动类型、活动商品之类的信息不可预期，导致缓存热点访问情况不可提前预知；

（2）缓存热点访问出现期间，应用层少数热点访问key产生大量缓存访问请求：冲击分布式缓存系统，大量占据内网带宽，最终影响应用层系统稳定性；

为了应对以上问题，需要一个能够自动发现热点并将热点缓存访问请求前置在应用层本地缓存的解决方案，这就是TMC产生的原因；以下是系统架构；

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736245410063-417b0af3-7989-4c00-abe4-4ed3335e3b0c.png)

1. Jedis-Client：Java应用与缓存服务端交互的直接入口，接口定义与原生Jedis-Client无异；
2. Hermes-SDK：自研“热点发现+本地缓存”功能的SDK封装，Jedis-Client通过与它交互来集成相应能力；
3. Hermes 服务端集群：接收Hermes-SDK上报的缓存访问数据，进行热点探测，将热点key推送给Hermes-SDK做本地缓存；
4. 缓存集群：由代理层和存储层组成，为应用客户端提供统一的分布式缓存服务入口；
5. 基础组件：etcd集群、Apollo配置中心，为TMC提供“集群推送”和“统一配置”能力；
### 监控热key

在监控热key方面，有赞用的**是在客户端进行收集**。在《有赞透明多级缓存解决方案（TMC）设计思路》中有一句话提到

“TMC 对原生jedis包的JedisPool和Jedis类做了改造，在JedisPool初始化过程中集成TMC“热点发现”+“本地缓存”功能Hermes-SDK包的初始化逻辑。”

也就说他改写了jedis原生的jar包，加入了Hermes-SDK包，目的就是做热点发现和本地缓存；

从监控的角度看，该包对于Jedis-Client的每次key值访问请求，Hermes-SDK 都会通过其通信模块将key访问事件异步上报给Hermes服务端集群，以便其根据上报数据进行“热点探测”。热点发现的流程如下：

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1736245554605-77a63424-5d40-470d-95b1-97317e5b0f6c.png)

### 通知系统做处理

在处理热key方案上，有赞用的是二级缓存；

有赞在监控到热key后，Hermes服务端集群会通过各种手段通知各业务系统里的Hermes-SDK，告诉他们：“老弟，这个key是热key，记得做本地缓存。” 于是Hermes-SDK就会将该key缓存在本地，对于后面的请求；Hermes-SDK发现这个是一个热key，直接从本地中拿，而不会去访问集群；通知方式各种各样，这篇文章文只是提供一个思路；

### 如何保证缓存一致性

再补充下有赞使用二级缓存时如何保证缓存一致性的；

1. Hermes-SDK的热点模块仅缓存热点key数据，绝大多数非热点key数据由缓存集群存储；
2. 热点key变更导致value失效时，Hermes-SDK同步失效本地缓存，保证本地强一致；
3. 热点key变更导致value失效时，Hermes-SDK通过etcd集群广播事件，异步失效业务应用集群中其他节点的本地缓存，保证集群最终一致；

附上有赞原文链接：

[有赞透明多级缓存解决方案（TMC）](https://tech.youzan.com/tmc/)

今天这道题解虽然大体看来不难，但是由于之前我开发的多级缓存框架正好涉及到相关功能（热key收集，热key检测等功能）只是暂未开发，所以就搜了很多相关的成熟业务架构，比如有赞的TMC、阿里的jetcache、京东的hotkey等做了一些了解，顺带研究题解时做了笔记
>>>>>>> origin/master
