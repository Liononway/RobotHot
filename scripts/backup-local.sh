#!/bin/bash
# RobotHot 本地备份：PostgreSQL 站点库 + zlzchat 的 MySQL + 两份密钥文件。
# 由 launchd 每天 03:30 调用（见 docs/robot-customization.md「备份与恢复」）。
# 手动执行：bash scripts/backup-local.sh
set -uo pipefail

# launchd 的 PATH 只有 /usr/bin:/bin:/usr/sbin:/sbin，docker 装在家目录下，必须显式补上。
export PATH="/Users/zhouxiangfei/.docker/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

WORKSPACE="/Users/zhouxiangfei/WorkBuddy/2026-10-18-20-31-11"
BACKUP_ROOT="${ROBOTHOT_BACKUP_DIR:-$WORKSPACE/robot-hot-backups}"
KEEP_DAYS="${ROBOTHOT_BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
LOG="$BACKUP_ROOT/backup.log"

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"; }

# 每步独立判错：一个库失败不该让另外两个不备份。
fail=0

# 1) 站点库（aihot）：纯 SQL 便于 psql 直接恢复
out="$BACKUP_ROOT/aihot-$STAMP.sql.gz"
if docker exec aihot-db-1 pg_dump -U aihot --no-owner --no-privileges -d aihot 2>>"$LOG" | gzip >"$out"; then
  gzip -t "$out" 2>>"$LOG" || { log "FAIL gzip check $out"; fail=1; }
  log "ok postgres $(du -h "$out" | cut -f1) $out"
else
  log "FAIL pg_dump aihot"; rm -f "$out"; fail=1
fi

# 2) 公众号中转库（gzhweb）：装了哪些号、feed_id 都在这里，丢了要重新扫码
# --databases 让 dump 自带 CREATE DATABASE / USE，恢复时一条命令即可，不必先手动建库。
out="$BACKUP_ROOT/zlzchat-$STAMP.sql.gz"
if docker exec zlz-mysql8 sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 --single-transaction --routines --events --databases gzhweb' 2>>"$LOG" | gzip >"$out"; then
  gzip -t "$out" 2>>"$LOG" || { log "FAIL gzip check $out"; fail=1; }
  log "ok mysql $(du -h "$out" | cut -f1) $out"
else
  log "FAIL mysqldump gzhweb"; rm -f "$out"; fail=1
fi

# 3) 密钥：.env（模型 key、管理员密码、INGEST_TOKEN）+ zlzchat/.secrets
out="$BACKUP_ROOT/secrets-$STAMP.tar.gz"
if tar czf "$out" -C "$WORKSPACE" robot-hot/.env zlzchat/.secrets 2>>"$LOG"; then
  chmod 600 "$out"
  gzip -t "$out" 2>>"$LOG" || { log "FAIL gzip check $out"; fail=1; }
  log "ok secrets $out"
else
  log "FAIL tar secrets"; rm -f "$out"; fail=1
fi

# 4) 保留最近 N 天，其余删掉（只动本脚本产生的文件名模式）
for prefix in aihot zlzchat secrets; do
  find "$BACKUP_ROOT" -maxdepth 1 -name "$prefix-*.gz" -type f -mtime +"$KEEP_DAYS" -print -delete >>"$LOG" 2>&1
done

total=$(du -sh "$BACKUP_ROOT" 2>/dev/null | cut -f1)
log "done fail=$fail total=$total"
exit "$fail"
