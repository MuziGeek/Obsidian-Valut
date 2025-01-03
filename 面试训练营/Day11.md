---
title: 面试训练营Day11
date: 2025-01-03 16:09:02
updated: 2025-01-03 16:09:02
categories: 面试训练营
tags:
  - 笔记
  - 面试训练营
top: 1
---
**2025-01-03**🌱上海: ⛅️  🌡️+11°C 🌬️↙12km/h

## **Redis 中跳表的实现原理是什么？**

### 总结分析

#### 什么是跳跃链表（跳表）

- 跳表由多层链表组成，底层存所有元素，上层是下层子集。

- 插入操作：从最高层找位置，随机确定新节点层数，插入并更新指针。
- 删除操作：从最高层找节点，在各层更新指针以保持结构。
- 查找操作：从最高层开始逐层向下，效率高，时间复杂度为 O (logn)。

#### 扩展知识

首先回顾下单链表，对于有序链表，若要查找其中某个数据，只能从头到尾遍历，这种方式查找效率低，时间复杂度为 O (n)。

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735884501790-2fda65b0-27d1-4362-b7f1-f2dfb913953e.png)

在单链表中，查找一个数需从头结点开始依次遍历匹配，时间复杂度为 O (n)；插入一个数时，先从头遍历找到合适位置再插入，时间复杂度同样是 O (n)。这表明单链表在查找和插入操作上效率相对较低，随着链表长度增加，耗时会线性增长。

为了提高查询效率，对有序链表进行改造，先对链表中每两个节点建立第一级索引。如下图

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735885461971-cbba0f71-11bc-4507-aa88-710ac260ff10.png)

假设我们要找15这个值，跳表是的查询流程如下图

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735885965964-3e2d9ba5-8736-49cc-b330-38f0cde3291f.png)

加来一层索引之后，查找一个结点需要遍的结点个数减少了，也就是说查找效率提高了，同理再加一级索引。

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735885988796-941f01c1-926f-46c7-b3e8-7208cba9a88a.png)

从图中能看出查找效率得到提升，在数据量少的例子中已有体现；当存在大量数据时，通过增加多级索引，查找效率可获得明显提升

#### 插入实现

以上知识跳表查询的实现，插入的实现如下图：

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735886384175-9703043e-e01d-4dff-9f15-1fa4a3b10d48.png)

### Redis 中的跳表实现解析（通过源码进一步分析）

#### 1. 基本概念

- **跳表**：是一种基于链表的多层数据结构，每一层都是一个有序的链表。最底层的链表包含所有的元素，而高层的链表是底层链表的 “快速通道”，通过跳过一些节点来加快查找速度。
- **节点**：跳表中的每个节点包含多个字段，其中最重要的是指向其他节点的指针数组（用于不同层次的链表），以及存储的数据和分值（用于排序）。

#### 2. 结构示例

##### 跳表节点

Redis 的跳表相对于普通的跳表多了一个**回退指针，且 score 可以重复**。

首先看下Redis中的跳表节点代码实现

```
typedef struct zskiplistNode {
    //Zset 对象的元素值
    sds ele;
    //元素权重值
    double score;
    //后退指针
    struct zskiplistNode *backward;
  
    //节点的level数组，保存每层上的前向指针和跨度
    struct zskiplistLevel {
        struct zskiplistNode *forward;
        unsigned long span;
    } level[];
} zskiplistNode;
```

**结构如下图：**

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735888983535-9c8318df-bf72-45c3-9f14-bc93e534e08a.png)

分析一下几个属性的含义：

- **ele**：采用 Redis 字符串底层实现 sds，用于存储数据。
- **score**：表示节点的分数，数据类型为 double 浮点型。
- **backward**：zskiplistNode 结构体指针类型，指向跳表的前一个节点。
- **level**：zskiplistNode 的结构体数组，数组索引即层级索引；其中 forward 指向同一层的下一个跳表节点，span 表示距离下一个节点的步数 。

跳表是有层级关系的链表，每层可有多个节点，节点间通过指针连接，这依赖跳表节点结构体中的 `zskiplistLevel` 结构体类型的 `level` 数组。`level` 数组每个元素代表跳表一层，如 `level[0]` 为第一层，`level[1]` 为第二层。`zskiplistLevel` 结构体定义了指向下一个跳表节点的指针和跨度，跨度用于记录节点间距离。

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735888409321-e96e2cfb-4124-4173-b6be-fceb06b6f03a.png)

- 跨度与遍历操作并无关联，遍历依靠前向指针就能完成。
- 跨度用于计算节点在跳表中的排位，做法是在从头节点到目标节点的查询路径上，累加沿途各层跨度。
- 以节点 3 为例，经过一层（L2）且跨度为 3，其排位是 3。
- 这里需要指出的是，表头节点是一个包含了所有层的虚拟节点（不包含任何数据），每一层中表头节点的forward都指向该层的第一个真实节点。

上面是跳表节点的具体实现，接下来我们看下跳表的结构实现。

##### 跳表

先看下代码实现

```
typedef struct zskiplist{
struct zskiplistNode *header, *tail,
unsigned long length,
int level;
} zskiplist;
```

跳表结构包含：

- 头尾节点，可在 O (1) 时间复杂度内访问跳表的头、尾节点。
- 跳表的长度，能在 O (1) 时间复杂度获取跳表节点数量。
- 跳表的最大层数，可在 O (1) 时间复杂度获取跳表中层高最大节点的层数量 。

**接下来根据更具体的实现来分析下跳表的查询过程**

- 查找跳表节点从跳表头节点的最高层开始，逐一遍历每一层。
- 遍历某一层节点时，依据节点中 SDS 类型元素和元素权重进行判断：

- 若当前节点权重「小于」要查找的权重，访问该层下一个节点。
- 若当前节点权重「等于」要查找的权重且当前节点 SDS 类型数据「小于」要查找的数据，访问该层下一个节点。

- 若上述两个条件都不满足或下一个节点为空，使用当前遍历节点 level 数组里的下一层指针，跳到下一层继续查找 。

**如图**：

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735888409321-e96e2cfb-4124-4173-b6be-fceb06b6f03a.png)

查找「元素:abcd，权重：4」的节点时：

- 从跳表头节点最高层 L2 开始，指向「元素:abc，权重：3」节点，因其权重小于目标权重，访问下一个节点，却发现下一个节点为空。
- 跳到「元素:abc，权重：3」节点的下一层 leve [1]，其下一个指针指向「元素:abcde，权重：4」节点，虽权重相同，但该节点 SDS 类型数据大于目标数据，继续跳到下一层 leve [0]。
- 在 leve [0] 层，「元素:abc，权重：3」节点的下一个指针指向「元素:abcd，权重：4」节点，找到目标节点，查询结束。

##### 跳表的创建

先上源码

```
zskiplist *zslCreate(void) {
    int j;
    zskiplist *zsl;
 
    zsl = zmalloc(sizeof(*zsl));
 
    zsl->level = 1;
    zsl->length = 0;
 
    // 初始化头节点， O(1)
    zsl->header = zslCreateNode(ZSKIPLIST_MAXLEVEL,0,NULL);
    // 初始化层指针，O(1)
    for (j = 0; j < ZSKIPLIST_MAXLEVEL; j++) {
        zsl->header->level[j].forward = NULL;
        zsl->header->level[j].span = 0;
    }
    zsl->header->backward = NULL;
 
    zsl->tail = NULL;
 
    return zsl;
}
```

创建跳跃表函数有几点说明：

- `ZSKIPLIST_MAXLEVEL` 为跳跃表最大层数，源码通过宏定义设为 32，节点再多也不会超 32 层。
- 初始化头节点时，由于节点最多 32 层，所以先建立好 32 层链表对应的头节点，其余简单初始化工作未赘述 。

**其中，**`**ZSKIPLIST_MAXLEVEL**` **定义的是最高的层数，Redis 7.0 定义为 32，Redis 5.0 定义为 64，Redis 3.0定义为 32。**

##### 跳跃表的插入

```
zskiplistNode *zslInsert(zskiplist *zsl, double score, robj *obj) {
 
    // 记录寻找元素过程中，每层能到达的最右节点
    zskiplistNode *update[ZSKIPLIST_MAXLEVEL], *x;
 
    // 记录寻找元素过程中，每层所跨越的节点数
    unsigned int rank[ZSKIPLIST_MAXLEVEL];
 
    int i, level;
 
    redisAssert(!isnan(score));
    x = zsl->header;
    // 记录沿途访问的节点，并计数 span 等属性
    // 平均 O(log N) ，最坏 O(N)
    for (i = zsl->level-1; i >= 0; i--) {
        /* store rank that is crossed to reach the insert position */
        rank[i] = i == (zsl->level-1) ? 0 : rank[i+1];
 
        // 右节点不为空
        while (x->level[i].forward &&                   
            // 右节点的 score 比给定 score 小
            (x->level[i].forward->score < score ||      
                // 右节点的 score 相同，但节点的 member 比输入 member 要小
                (x->level[i].forward->score == score && 
                compareStringObjects(x->level[i].forward->obj,obj) < 0))) {
            // 记录跨越了多少个元素
            rank[i] += x->level[i].span;
            // 继续向右前进
            x = x->level[i].forward;
        }
        // 保存访问节点
        update[i] = x;
    }
 
    /* we assume the key is not already inside, since we allow duplicated
     * scores, and the re-insertion of score and redis object should never
     * happpen since the caller of zslInsert() should test in the hash table
     * if the element is already inside or not. */
    // 因为这个函数不可能处理两个元素的 member 和 score 都相同的情况，
    // 所以直接创建新节点，不用检查存在性
 
    // 计算新的随机层数
    level = zslRandomLevel();
    // 如果 level 比当前 skiplist 的最大层数还要大
    // 那么更新 zsl->level 参数
    // 并且初始化 update 和 rank 参数在相应的层的数据
    if (level > zsl->level) {
        for (i = zsl->level; i < level; i++) {
            rank[i] = 0;
            update[i] = zsl->header;
            update[i]->level[i].span = zsl->length;
        }
        zsl->level = level;
    }
 
    // 创建新节点
    x = zslCreateNode(level,score,obj);
    // 根据 update 和 rank 两个数组的资料，初始化新节点
    // 并设置相应的指针
    // O(N)
    for (i = 0; i < level; i++) {
        // 设置指针
        x->level[i].forward = update[i]->level[i].forward;
        update[i]->level[i].forward = x;
 
        /* update span covered by update[i] as x is inserted here */
        // 设置 span
        x->level[i].span = update[i]->level[i].span - (rank[0] - rank[i]);
        update[i]->level[i].span = (rank[0] - rank[i]) + 1;
    }
 
    /* increment span for untouched levels */
    // 更新沿途访问节点的 span 值
    for (i = level; i < zsl->level; i++) {
        update[i]->level[i].span++;
    }
 
    // 设置后退指针
    x->backward = (update[0] == zsl->header) ? NULL : update[0];
    // 设置 x 的前进指针
    if (x->level[0].forward)
        x->level[0].forward->backward = x;
    else
        // 这个是新的表尾节点
        zsl->tail = x;
 
    // 更新跳跃表节点数量
    zsl->length++;
 
    return x;
}
```

以上代码流程总结：

1. **参数检查与初始化**：确保插入节点的分数 `score` 不是 `NaN`，初始化遍历指针 `x` 指向跳跃表的头节点，定义 `update` 数组记录每层查找的最右节点，`rank` 数组记录每层跨越的节点数。
2. **查找插入位置**：从跳跃表的最高层开始，逐层向下查找插入位置。在每一层中，找到满足条件的最右节点，记录该节点到 `update` 数组，并更新 `rank` 数组记录跨越的节点数。
3. **生成新节点层数**：使用 `zslRandomLevel` 函数生成新节点的随机层数。若新节点层数大于当前跳跃表最大层数，更新跳跃表最大层数，并初始化新增层的 `update` 和 `rank` 数组数据。
4. **创建并插入新节点**：创建新节点，根据 `update` 和 `rank` 数组信息，在每一层中插入新节点，设置 `forward` 指针和 `span` 值。
5. **更新其他节点的** `**span**` **值**：对于未触及的层，更新 `update` 节点的 `span` 值。
6. **设置前后指针**：设置新节点的 `backward` 指针，若新节点有下一个节点，设置下一个节点的 `backward` 指针指向新节点；否则更新跳跃表的 `tail` 指针。
7. **更新跳跃表长度**：跳跃表节点数量加一，返回插入的新节点指针。

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735890671435-c518fd15-b4a3-48ab-b810-bcf6a5db7322.png)

**上面代码中有一个生成随机层数的函数**

redis的跳跃表在插入节点时，会随机生成节点的层数，通过控制每一层的概率，控制每一层的节点个数，也就是保证第一层的节点个数，之后逐层增加

这里面有一个宏定义ZSKIPLIST_P ，在源码中定义为了0.25，所以，上面这段代码，**生成n+1的概率是生成n的概率的4倍。**

```
int zslRandomLevel(void) {
    int level = 1;
    while ((random()&0xFFFF) < (ZSKIPLIST_P * 0xFFFF))
        level += 1;
    return (level<ZSKIPLIST_MAXLEVEL) ? level : ZSKIPLIST_MAXLEVEL;
}
```

**如果生成的新节点层数大于当前跳跃表的最大层数**，由于之前的遍历是从当前最大层数开始，多出来的层尚未获取 `update` 节点和 `rank`。因此需通过特定程序为这些多出来的层写入相应的 `rank` 和 `update` 节点。这一过程较为简单，多出来层的 `update` 节点为头节点，`rank` 都为 0 ，`span` 被设置为当前跳跃表的节点个数（为后续插入新节点时计算新节点的 `span` 做准备）。

```
 if (level > zsl->level) {
        for (i = zsl->level; i < level; i++) {
            rank[i] = 0;
            update[i] = zsl->header;
            update[i]->level[i].span = zsl->length;
        }
        zsl->level = level;
    }
```

##### 遍历跳表

```
    // 记录寻找元素过程中，每层能到达的最右节点
    zskiplistNode *update[ZSKIPLIST_MAXLEVEL], *x;
 
    // 记录寻找元素过程中，每层所跨越的节点数
    unsigned int rank[ZSKIPLIST_MAXLEVEL];
 
    int i, level;
 
    redisAssert(!isnan(score));
    x = zsl->header;
    // 记录沿途访问的节点，并计数 span 等属性
    // 平均 O(log N) ，最坏 O(N)
    for (i = zsl->level-1; i >= 0; i--) {
        /* store rank that is crossed to reach the insert position */
        rank[i] = i == (zsl->level-1) ? 0 : rank[i+1];
 
        // 右节点不为空
        while (x->level[i].forward &&                   
            // 右节点的 score 比给定 score 小
            (x->level[i].forward->score < score ||      
                // 右节点的 score 相同，但节点的 member 比输入 member 要小
                (x->level[i].forward->score == score && 
                compareStringObjects(x->level[i].forward->obj,obj) < 0))) {
            // 记录跨越了多少个元素
            rank[i] += x->level[i].span;
            // 继续向右前进
            x = x->level[i].forward;
        }
        // 保存访问节点
        update[i] = x;
    }
```

这里创建了两个数组，数组大小都是最大层数，其中：

- **update数组**用来记录新节点在每一层的上一个节点，也就是新节点要插到哪个节点后面；
- **rank数组**用来记录update节点的排名，也就是在这一层，update节点到头节点的距离，这个上一节说过，是为了用来计算span

**代码分析**

1. **变量声明**：

- `zskiplistNode *update[ZSKIPLIST_MAXLEVEL], *x;`：声明了一个 `update` 数组，用于存储在每一层查找过程中能到达的最右节点；`x` 是用于遍历跳跃表的指针。
- `unsigned int rank[ZSKIPLIST_MAXLEVEL];`：声明 `rank` 数组，用于记录在每一层查找过程中跨越的节点数。
- `int i, level;`：声明循环变量 `i` 和用于存储新节点层数的 `level`。

2. **初始化与断言**：

- `redisAssert(!isnan(score));`：断言输入的分数 `score` 不是 `NaN`（非数字），确保数据的有效性。
- `x = zsl->header;`：将遍历指针 `x` 初始化为跳跃表的头节点。

3. **查找插入位置**：

- 外层 `for` 循环从跳跃表的最高层（`zsl->level - 1`）开始，逐层向下遍历到最低层（`0`）。
- 在每次循环中，根据当前层是否为最高层来初始化 `rank[i]`：如果是最高层，`rank[i] = 0`；否则，`rank[i] = rank[i + 1]`。
- 内层 `while` 循环在当前层中查找满足条件的节点：

- 当当前节点的下一个节点存在，且下一个节点的 `score` 小于给定的 `score`，或者下一个节点的 `score` 等于给定的 `score` 且其 `member` 小于输入的 `member` 时，执行循环体。
- 在循环体中，将当前节点的 `span` 值累加到 `rank[i]` 中，以记录跨越的节点数，然后将 `x` 移动到下一个节点。

- 内层 `while` 循环结束后，将当前层遍历到的最右节点存储到 `update[i]` 中

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735891473306-1db5a16d-a325-43ee-9028-65f8dc6e5701.png)

##### 跳表的删除

老规矩 先上源码

```
/* 
 * 内部函数，被 zslDelete、zslDeleteRangeByScore 和 zslDeleteRangeByRank 使用
 * 功能：从跳跃表中删除指定节点，并更新相关节点的跨度和指针
 * 参数：
 *  - zsl: 指向跳跃表的指针
 *  - x: 要删除的节点
 *  - update: 一个数组，记录每层中查找过程中到达的最后一个节点，用于后续指针更新
 */
void zslDeleteNode(zskiplist *zsl, zskiplistNode *x, zskiplistNode **update) {
    int i;
    // 遍历跳跃表的每一层
    for (i = 0; i < zsl->level; i++) {
        // 如果当前层的 update[i] 节点的下一个节点是要删除的节点 x
        if (update[i]->level[i].forward == x) {
            // 更新 update[i] 节点的跨度
            update[i]->level[i].span += x->level[i].span - 1;
            // 将 update[i] 节点的下一个节点直接指向 x 的下一个节点
            update[i]->level[i].forward = x->level[i].forward;
        } else {
            // 如果当前层的 update[i] 节点的下一个节点不是 x，说明 x 在这一层对 update[i] 的跨度没有影响，只需要将跨度减 1
            update[i]->level[i].span -= 1;
        }
    }
    // 如果要删除的节点 x 的下一个节点存在
    if (x->level[0].forward) {
        // 将 x 的下一个节点的前驱指针指向 x 的前驱节点
        x->level[0].forward->backward = x->backward;
    } else {
        // 如果 x 没有下一个节点，说明 x 是尾节点，更新跳跃表的尾节点为 x 的前驱节点
        zsl->tail = x->backward;
    }
    // 如果跳跃表的层数大于 1 且最高层的头节点的下一个节点为空
    while(zsl->level > 1 && zsl->header->level[zsl->level-1].forward == NULL)
        // 减少跳跃表的层数
        zsl->level--;
    // 跳跃表的节点数减 1
    zsl->length--;
}

/* 
 * 从跳跃表中删除具有匹配分数和元素的节点
 * 参数：
 *  - zsl: 指向跳跃表的指针
 *  - score: 要删除节点的分数
 *  - ele: 要删除节点的元素
 *  - node: 指向指针的指针，如果为 NULL，删除节点后会释放该节点；否则，将该指针设置为被删除的节点指针，供调用者重用该节点
 * 返回值：
 *  - 如果找到并删除节点，返回 1
 *  - 否则，返回 0
 */
int zslDelete(zskiplist *zsl, double score, sds ele, zskiplistNode **node) {
    zskiplistNode *update[ZSKIPLIST_MAXLEVEL], *x;
    int i;

    // 从跳跃表的头节点开始遍历
    x = zsl->header;
    // 从最高层开始，逐层向下遍历
    for (i = zsl->level-1; i >= 0; i--) {
        // 在当前层中，找到满足条件的节点
        while (x->level[i].forward &&
                (x->level[i].forward->score < score ||
                    (x->level[i].forward->score == score &&
                     sdscmp(x->level[i].forward->ele,ele) < 0)))
        {
            // 移动到下一个节点
            x = x->level[i].forward;
        }
        // 记录当前层遍历到的最后一个节点
        update[i] = x;
    }
    // 继续移动到下一层的第一个节点，准备检查是否是要删除的节点
    x = x->level[0].forward;
    // 如果找到的节点存在，且分数和元素都匹配
    if (x && score == x->score && sdscmp(x->ele,ele) == 0) {
        // 调用 zslDeleteNode 函数删除节点
        zslDeleteNode(zsl, x, update);
        // 如果 node 为 NULL，说明调用者不需要重用该节点，释放该节点
        if (!node)
            zslFreeNode(x);
        else
            // 如果 node 不为 NULL，将 *node 设置为被删除的节点指针，供调用者重用
            *node = x;
        // 返回 1 表示成功删除节点
        return 1;
    }
    // 如果没有找到匹配的节点，返回 0
    return 0; 
}
```

1. `zslDeleteNode` 函数负责从跳跃表中删除指定节点，并更新相关节点的跨度和指针，同时根据情况调整跳跃表的层数和节点数。
2. `zslDelete` 函数用于在跳跃表中查找具有特定分数和元素的节点，并调用 `zslDeleteNode` 函数进行删除操作，最后根据是否找到匹配节点返回相应的结果。

![](https://cdn.nlark.com/yuque/0/2025/png/26566882/1735893179727-05f3768d-27c8-4994-8c81-cc91a3516481.png)