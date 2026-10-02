#!/usr/bin/env python3
# 96-timeout-observe.py — 超时任务是否真的执行过?逐单对账
import sys, json
sys.path.insert(0, "/tmp")
from qa import B, L, sql, req, J

print("=" * 76)
print("1) order_no 逐单对账(product_order 状态 vs payment 状态)")
print("=" * 76)
print(sql("""
select po.order_no,
       group_concat(distinct po.status) as order_status,
       count(*) as rows_cnt,
       sum(po.total_money) as sum_money,
       min(po.create_time) as created,
       timestampdiff(minute, min(po.create_time), now()) as age_min,
       (select p.status from payment p where p.order_no = po.order_no) as pay_status
from product_order po
group by po.order_no
order by created;
"""))

print("\n" + "=" * 76)
print("2) 有 payment 但无 product_order 的单(或被删)")
print("=" * 76)
print("payment 里不在 product_order 的 order_no:",
      repr(sql("select order_no,status,amount from payment where order_no not in (select distinct order_no from product_order);")))
print("product_order 里无 payment 行的 order_no:",
      repr(sql("select distinct order_no from product_order where order_no is not null and order_no not in (select order_no from payment);")))

print("\n" + "=" * 76)
print("3) 「已超时」的 payment 是否属于 TASK-001 的旧单?")
print("=" * 76)
print(sql("select order_no,user_id,amount,status,create_time,coalesce(paid_time,'-') from payment where status='已超时' order by id;"))

print("\n" + "=" * 76)
print("4) 后端日志里 OrderTimeoutTask 的痕迹")
print("=" * 76)
