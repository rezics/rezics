# README

postgresql.conf

```
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10
```


pg_hba.conf

如果是远程机器，需要修改

```
host replication postgres 0.0.0.0/0 md5
```
