---
title: 分片上传
date: 2025-05-07 23:53:26
categories:
 - [笔记, 编程, 100test]
tags:
  - Java
---
**2025-05-07**🌱上海: ☀️   🌡️+19°C 🌬️↖19km/h

# Part001 分片上传
  针对文件上传，一般来说，小文件直接上传就可以，但是对于一些大文件，由于体积过大会导致上传效率太慢，所以最好通过分片上传的方式进行文件传输。

## 案例简介

将源文件切分成很多分片，进行上传，待所有分片上传完毕之后，将所有分片合并，便可得到源文件。这里面的分片可以采用并行的方式上传，提示大文件上传的效率。

## 设计思路

设置分片大小、文件路径，根据文件大小/分片大小获得分片数量，初始化文件信息（文件路径，文件md5值，分片数量），把文件信息进行持久化，接下来进行分片上传，通过分片序号（根据分片数量从0开始），从分片大小×分片序号的字节位置开始读取分片大小的字节数进行上传，并将分片信息进行持久化，最后分片上传完毕后，进行分片数量和分片序号进行比对，判断是否全部分片上传完成，如果相等，则最后进行分片文件合并并移除分片文件，合并完成后将最终文件信息进行持久化，同时判断最终文件md5值与原始文件md5值是否一致，一致则上传任务完成。

![](https://xqqmo2q8lg.feishu.cn/space/api/box/stream/download/asynccode/?code=YjFmOTc1ZjY0YjIwYTA3YjRlNzM1MGE3OWYxNjc4ZDhfYzQzdTdlejIwN2I0ZEFCSm1RdlpBQzdNWEliVlZzQllfVG9rZW46SlZDb2IzYVRkbzR5dUF4VnhPdGNYUkhKbmpnXzE3NDY2MzMyNTk6MTc0NjYzNjg1OV9WNA)

## 代码实例

### **需要用到2张表**

1. **分片上传任务表(t_shard_upload)**
    

每个分片任务会在此表创建一条记录

```SQL
create table if not exists t_shard_upload(
    id varchar(32) primary key,
    file_name varchar(256) not null comment '文件名称',
    part_num int not null comment '分片数量',
    md5 varchar(128) comment '文件md5值',
    file_full_path varchar(512) comment '文件完整路径'
) comment = '分片上传任务表';
```

2. **分片文件表（t_shard_upload_part）**
    

这个表和上面的表是1对多的关系，用与记录每个分片的信息，比如一个文件被切分成10个分片，那么此表会产生10条记录

```SQL
create table if not exists  t_shard_upload_part(
    id varchar(32) primary key,
    shard_upload_id varchar(32) not null comment '分片任务id（t_shard_upload.id）',
    part_order int not null comment '第几个分片，从1开始',
    file_full_path varchar(512) comment '文件完整路径',
    UNIQUE KEY `uq_part_order` (`shard_upload_id`,`part_order`)
) comment = '分片文件表，每个分片文件对应一条记录';
```

### **服务端需提供4个接口**

3. **创建分片上传任务(/shardUpload/init)**
    

> 返回分片任务id（shardUploadId），后续的3个接口均需要用到该id

4. **上传分片文件(/shardUpload/uploadPart)**
    
5. **合并分片、完成上传(/shardUpload/complete)**
    
6. **获取分片任务详细信息(/shardUpload/detail)**
    

> 可以得到分片任务的状态信息，如分片任务是否上传完毕，哪些分片已上传等信息，网络出现故障，可以借助此接口恢复上传

## 拓展功能

### **上传途中出现故障如何恢复？（断点续传）**

比如出现网络故障，导致分片上失败，此时需要走恢复逻辑，分两种情况

### **情况1：浏览器无法读取刚才用户选择的文件了**

此时需要用户重新选择文件，重新上传。

这个地方也可以给大家提供另外一种思路，第1个接口创建分片任务的时候传入了文件的md5，按说这个值是具有唯一性的，那么就可以通过这个值找到刚才的任务，按照这种思路，就需要后端提供一个新的接口：通过文件的md5值找到刚才失败的那个任务，然后继续上传未上传的分片。

### **情况2：浏览器可以继续读取刚才用户选择的文件**

这种情况，可以先调用第4个接口，通过此接口可以知道那些分片还未上传，然后继续上传这些分片就可以了。