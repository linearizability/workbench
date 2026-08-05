#!/bin/bash

set -e  # 遇到错误立即退出

# 获取当前工作目录作为默认Git仓库路径
CURRENT_DIR=$(pwd)
# 如果提供了GIT_REPO_PATH环境变量，则使用该路径，否则使用当前目录作为Git仓库路径
GIT_REPO_PATH=${GIT_REPO_PATH:-$CURRENT_DIR}

# 定义要合并的分支序列（按照合并顺序）
# 格式：分支1 分支2 分支3 ...
# 例如：BRANCHES=("feature-A" "develop" "main") 表示 feature-A->develop->main
BRANCHES=("v1.0-workflow-config" "v1.0" "dev")

# Dry run 模式标志
DRY_RUN=false

# 跳过编译检查标志
SKIP_BUILD=false

# 日志级别 (quiet, normal, verbose)
LOG_LEVEL="normal"

# 日志输出函数
log_echo() {
    local level=$1
    shift
    local message="$*"
    
    case $LOG_LEVEL in
        "quiet")
            # 静默模式只输出错误信息
            if [ "$level" = "error" ]; then
                echo "$message" >&2
            fi
            ;;
        "normal")
            # 正常模式输出常规信息和错误信息
            if [ "$level" = "info" ] || [ "$level" = "error" ]; then
                echo "$message"
            fi
            ;;
        "verbose")
            # 详细模式输出所有信息
            echo "$message"
            ;;
    esac
}

# Dry run 模式下的执行函数
dry_run_echo() {
    if [ "$DRY_RUN" = true ]; then
        log_echo "info" "[DRY-RUN] $1"
    else
        log_echo "info" "$1"
    fi
}

# Dry run 模式下的命令执行函数
dry_run_exec() {
    if [ "$DRY_RUN" = true ]; then
        log_echo "verbose" "[DRY-RUN] 将执行命令: $*"
        return 0
    else
        log_echo "verbose" "执行命令: $*"
        "$@"
    fi
}

# 显示帮助信息
show_help() {
    echo "使用方法: $0 [选项]"
    echo "选项:"
    echo "  -h, --help        显示帮助信息"
    echo "  -b, --branches    分支列表  指定要合并的分支序列，格式为 \"branch1 branch2 branch3 ...\""
    echo "  -p, --path        指定Git仓库路径，默认为脚本所在目录"
    echo "  --dry-run         预演模式，只显示将要执行的操作，不实际执行"
    echo "  -q, --quiet       静默模式，只输出错误信息"
    echo "  --skip-build      跳过编译检查（mvn clean & compile）"
    echo ""
    echo "示例:"
    echo "  $0  # 使用默认分支配置"
    echo "  $0 -b \"feature-A develop main\"  # 自定义分支合并序列"
    echo "  $0 -p /opt/code/demo  # 指定Git仓库路径"
    echo "  $0 --dry-run   # 预演模式运行"
    echo "  $0 -q  # 静默模式运行"
    echo "  $0 -v  # 详细模式运行"
    echo "  $0 -b \"feature-A develop main\" -p /opt/code/demo  # 同时指定分支序列和仓库路径"
    echo ""
    echo "注意: 合并是按照顺序进行的，先合并 branch1->branch2，然后 branch2->branch3，以此类推"
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;; 
        -b|--branches)
            BRANCHES=($2)
            shift 2
            ;;
        -p|--path)
            GIT_REPO_PATH=$2
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -q|--quiet)
            LOG_LEVEL="quiet"
            shift
            ;;
        -v|--verbose)
            LOG_LEVEL="verbose"
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查分支数量是否足够
if [ ${#BRANCHES[@]} -lt 2 ]; then
    log_echo "error" "[错误] 至少需要两个分支才能进行合并操作"
    exit 1
fi

# 构建合并描述信息
description=""
for ((i=0; i<${#BRANCHES[@]}; i++)); do
    if [ -z "$description" ]; then
        description="${BRANCHES[i]}"
    else
        description="$description -> ${BRANCHES[i]}"
    fi
done

# 根据日志级别调整详细程度
if [ "$LOG_LEVEL" = "verbose" ]; then
    log_echo "info" "日志级别: 详细模式"
    log_echo "info" "Dry Run模式: $DRY_RUN"
    log_echo "info" "跳过编译检查: $SKIP_BUILD"
    log_echo "info" "Git仓库路径: $GIT_REPO_PATH"
    log_echo "info" "分支序列: $description"
elif [ "$LOG_LEVEL" = "quiet" ]; then
    log_echo "info" "日志级别: 静默模式"
else
    log_echo "info" "日志级别: 正常模式"
    if [ "$SKIP_BUILD" = true ]; then
        log_echo "info" "跳过编译检查: 是"
    fi
fi

if [ "$DRY_RUN" = true ]; then
    log_echo "info" "========================================"
    log_echo "info" "自动合并分支脚本 (预演模式)"
    log_echo "info" "$description"
    log_echo "info" "========================================"
    log_echo "info" "注意: 这是预演模式，不会实际执行任何操作"
    log_echo "info" "========================================"
else
    log_echo "info" "========================================"
    log_echo "info" "自动合并分支脚本"
    log_echo "info" "$description"
    log_echo "info" "========================================"
fi

# 检查指定路径是否为git仓库
if ! git -C "$GIT_REPO_PATH" status >/dev/null 2>&1; then
    log_echo "error" "[错误] $GIT_REPO_PATH 不是一个有效的git仓库"
    exit 1
fi

# 保存当前分支
CURRENT_BRANCH=$(git -C "$GIT_REPO_PATH" branch --show-current)
log_echo "info" "[信息] 当前分支: $CURRENT_BRANCH"

# 检查工作区是否干净
if ! git -C "$GIT_REPO_PATH" diff-index --quiet HEAD --; then
    log_echo "error" "[错误] 工作区有未提交的更改，请先提交或暂存"
    exit 1
fi

# 错误处理函数
restore_branch() {
    log_echo "info" "[信息] 恢复到原始分支: $CURRENT_BRANCH"
    git -C "$GIT_REPO_PATH" checkout "$CURRENT_BRANCH"
    exit 1
}

# 拉取最新代码
dry_run_echo "[步骤1] 拉取最新代码..."
if ! dry_run_exec git -C "$GIT_REPO_PATH" fetch origin; then
    log_echo "error" "[错误] 拉取代码失败"
    if [ "$DRY_RUN" = false ]; then
        exit 1
    fi
fi

# 循环执行合并操作
step=2
for ((i=1; i<${#BRANCHES[@]}; i++)); do
    SRC_BRANCH=${BRANCHES[i-1]}
    DST_BRANCH=${BRANCHES[i]}
    
    dry_run_echo "[步骤$step] 切换到 $DST_BRANCH 分支..."
    if ! dry_run_exec git -C "$GIT_REPO_PATH" checkout "$DST_BRANCH"; then
        log_echo "error" "[错误] 切换到 $DST_BRANCH 分支失败"
        if [ "$DRY_RUN" = false ]; then
            restore_branch
        fi
    fi
    
    step=$((step+1))
    dry_run_echo "[步骤$step] 拉取 $DST_BRANCH 最新代码..."
    if ! dry_run_exec git -C "$GIT_REPO_PATH" pull origin "$DST_BRANCH"; then
        log_echo "error" "[错误] 拉取 $DST_BRANCH 分支失败"
        if [ "$DRY_RUN" = false ]; then
            restore_branch
        fi
    fi
    
    step=$((step+1))
    dry_run_echo "[步骤$step] 合并 $SRC_BRANCH 到 $DST_BRANCH..."
    if ! dry_run_exec git -C "$GIT_REPO_PATH" merge "origin/$SRC_BRANCH" --no-ff -m "merge: $SRC_BRANCH -> $DST_BRANCH"; then
        log_echo "error" "[错误] 合并 $SRC_BRANCH 到 $DST_BRANCH 出现冲突，请手动解决冲突后重新运行脚本"
        if [ "$DRY_RUN" = false ]; then
            git -C "$GIT_REPO_PATH" merge --abort
            restore_branch
        fi
    fi
    
    if [ "$SKIP_BUILD" = false ]; then
        step=$((step+1))
        dry_run_echo "[步骤$step] 清理项目..."
        if ! (cd "$GIT_REPO_PATH" && dry_run_exec mvn clean -q); then
            log_echo "error" "[错误] $DST_BRANCH 分支清理失败，回滚合并"
            if [ "$DRY_RUN" = false ]; then
                git -C "$GIT_REPO_PATH" reset --hard HEAD~1
                restore_branch
            fi
        fi
        
        step=$((step+1))
        dry_run_echo "[步骤$step] 编译检查 $DST_BRANCH 分支..."
        if ! (cd "$GIT_REPO_PATH" && dry_run_exec mvn compile -q); then
            log_echo "error" "[错误] $DST_BRANCH 分支编译失败，回滚合并"
            if [ "$DRY_RUN" = false ]; then
                git -C "$GIT_REPO_PATH" reset --hard HEAD~1
                restore_branch
            fi
        fi
    else
        log_echo "verbose" "[跳过] 编译检查已跳过 (--skip-build)"
    fi
    
    step=$((step+1))
    # 推送目标分支
    dry_run_echo "[步骤$step] 推送 $DST_BRANCH 分支..."
    if ! dry_run_exec git -C "$GIT_REPO_PATH" push origin "$DST_BRANCH"; then
        log_echo "error" "[错误] 推送 $DST_BRANCH 分支失败"
        if [ "$DRY_RUN" = false ]; then
            restore_branch
        fi
    fi
    
    step=$((step+1))
done

if [ "$DRY_RUN" = true ]; then
    log_echo "info" "========================================"
    log_echo "info" "[预演完成] 所有分支合并预演完成！"
    log_echo "info" "$description"
    log_echo "info" "========================================"
else
    log_echo "info" "========================================"
    log_echo "info" "[成功] 所有分支合并完成！"
    log_echo "info" "$description"
    log_echo "info" "========================================"
fi

# 恢复到原始分支
if [ "$DRY_RUN" = false ]; then
    git -C "$GIT_REPO_PATH" checkout "$CURRENT_BRANCH"
else
    log_echo "info" "[DRY-RUN] 将恢复到原始分支: $CURRENT_BRANCH"
fi