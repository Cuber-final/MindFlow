"""
Interest Learning Service

权重更新算法参考 V2 技术规格文档:
- SIGNAL_WEIGHTS: 显式/隐式信号权重
- DECAY_FACTOR: 时间衰减因子
- NOVELTY_BONUS: 新领域发现奖励
- update_tag_weight(): 权重更新函数
"""

import numpy as np
from datetime import datetime
from typing import Optional


# === 信号权重表 ===
SIGNAL_WEIGHTS = {
    # 显式信号（高置信度）
    "show": 1.0,
    "hide": -1.3,
    "share": 0.8,

    # 隐式信号
    "click": 0.3,
    "dwell_10s": 0.1,
    "dwell_30s": 0.3,
    "dwell_60s": 0.5,
    "scroll_bottom": 0.2,
    "revisit": 0.4,
}

# === 算法参数 ===
DECAY_FACTOR = 0.95  # 每7天衰减5%
NOVELTY_BONUS = 0.2  # 新领域首次正向反馈bonus

# 权重边界
WEIGHT_MIN = 0.1
WEIGHT_MAX = 2.5
WEIGHT_DEFAULT = 1.0

# 内容分层阈值
STRONG_INTEREST = 1.3  # 主航道阈值
WEAK_INTEREST = 0.7   # 探索区阈值
SURPRISE_RATIO = 0.1  # 惊喜箱比例


def update_tag_weight(
    current_weight: float,
    signals: list[dict],
    is_new_discovery: bool = False
) -> float:
    """
    权重更新算法

    new_weight = old_weight * exp(sum(weighted_signals))

    Args:
        current_weight: 当前权重
        signals: 信号列表，每条信号包含 action, timestamp, value
        is_new_discovery: 是否为新发现的领域

    Returns:
        更新后的权重（bounded）
    """
    if not signals:
        return current_weight

    now = datetime.now()
    weighted_sum = 0.0

    for signal in signals:
        # 计算信号年龄（天数）
        timestamp = signal.get("timestamp", now)
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except ValueError:
                timestamp = now

        days_old = (now - timestamp).total_seconds() / (24 * 3600)
        time_decay = DECAY_FACTOR ** (days_old / 7)

        # 获取信号基础权重
        action = signal.get("action", "")
        base_weight = SIGNAL_WEIGHTS.get(action, 0)

        # 累加带衰减的权重
        weighted_sum += base_weight * time_decay

    # 信号数量惩罚（防止刷分）
    signal_count_penalty = 1.0 / (1.0 + 0.1 * len(signals))

    # 新发现bonus
    novelty = NOVELTY_BONUS if is_new_discovery else 0.0

    # 计算变化因子
    change_factor = np.exp(weighted_sum * signal_count_penalty + novelty)

    # 计算新权重
    new_weight = current_weight * change_factor

    # 有界更新
    new_weight = max(WEIGHT_MIN, min(WEIGHT_MAX, new_weight))

    return round(new_weight, 3)


def get_content_zone(tag_weight: float) -> str:
    """
    根据标签权重判断内容区域

    Args:
        tag_weight: 标签权重

    Returns:
        zone: "main" | "explore" | "discover"
    """
    if tag_weight >= STRONG_INTEREST:
        return "main"
    elif tag_weight >= WEAK_INTEREST:
        return "explore"
    else:
        return "discover"


def calculate_anchor_zone(anchor: dict, user_tags: list[dict]) -> str:
    """
    计算锚点所属的区域

    基于锚点关联的标签权重，取最大权重对应的区域
    """
    if not anchor.get("tags") or not user_tags:
        return "discover"

    max_zone = "discover"
    max_weight = 0.0

    for tag in anchor.get("tags", []):
        for user_tag in user_tags:
            if user_tag.get("tag") == tag:
                weight = user_tag.get("weight", WEIGHT_DEFAULT)
                zone = get_content_zone(weight)
                if weight > max_weight:
                    max_weight = weight
                    max_zone = zone

    return max_zone


def filter_anchors_by_zone(
    anchors: list[dict],
    user_tags: list[dict],
    target_size: int = 10
) -> list[dict]:
    """
    按区域过滤和选择锚点

    Args:
        anchors: 所有锚点
        user_tags: 用户兴趣标签
        target_size: 目标简报大小

    Returns:
        选中的锚点列表
    """
    main_anchors = []
    explore_anchors = []
    surprise_pool = []

    for anchor in anchors:
        zone = calculate_anchor_zone(anchor, user_tags)
        if zone == "main":
            main_anchors.append(anchor)
        elif zone == "explore":
            explore_anchors.append(anchor)
        else:
            surprise_pool.append(anchor)

    # 按显著性排序
    main_anchors.sort(key=lambda x: x.get("significance", 0), reverse=True)
    explore_anchors.sort(key=lambda x: x.get("significance", 0), reverse=True)

    # 按比例选择
    main_size = int(target_size * 0.6)
    explore_size = int(target_size * 0.3)
    surprise_size = max(1, int(target_size * SURPRISE_RATIO))

    selected = []
    selected.extend(main_anchors[:main_size])
    selected.extend(explore_anchors[:explore_size])

    # 从惊喜池随机选择
    import random
    if surprise_pool:
        selected.extend(random.sample(surprise_pool, min(surprise_size, len(surprise_pool))))

    return selected


def process_feedback_signals(tag: str) -> list[dict]:
    """
    从数据库获取某标签的反馈信号，用于权重更新

    Returns:
        信号列表
    """
    from database import get_behavior_logs

    logs = get_behavior_logs(anchor_id=None, limit=500)
    # 过滤出该标签相关的信号
    tag_logs = [log for log in logs if log.get("tag") == tag]
    return tag_logs


def daily_learning_batch():
    """
    每日批处理学习任务

    更新所有活跃标签的权重
    """
    from database import get_all_interest_tags, update_interest_tag

    tags = get_all_interest_tags()
    updated_count = 0

    for tag_data in tags:
        if tag_data.get("status") != "active":
            continue

        tag = tag_data["tag"]
        current_weight = tag_data.get("weight", WEIGHT_DEFAULT)

        # 获取反馈信号
        signals = process_feedback_signals(tag)

        if signals:
            # 计算新权重
            new_weight = update_tag_weight(current_weight, signals)
            if new_weight != current_weight:
                update_interest_tag(tag_data["id"], weight=new_weight)
                updated_count += 1

    return updated_count


def discover_new_tags(anchors: list[dict]) -> list[str]:
    """
    从锚点中发现新标签

    检查锚点中的标签是否已存在于用户兴趣标签中，
    返回不存在的标签列表（候选标签）
    """
    from database import get_all_interest_tags

    existing_tags = {t["tag"] for t in get_all_interest_tags()}
    new_candidates = []

    for anchor in anchors:
        for tag in anchor.get("tags", []):
            if tag not in existing_tags:
                new_candidates.append(tag)
                existing_tags.add(tag)  # 避免重复

    return list(set(new_candidates))


def suggest_tag_candidates(top_n: int = 5) -> list[dict]:
    """
    推荐候选标签

    从最近的锚点中提取高权重但未关注的标签
    """
    from database import get_all_anchors_for_digest, get_all_interest_tags

    existing_tags = {t["tag"] for t in get_all_interest_tags()}
    tag_significance = {}

    # 收集标签和其显著性
    anchors = get_all_anchors_for_digest()
    for anchor in anchors:
        sig = anchor.get("significance", 0.5)
        for tag in anchor.get("tags", []):
            if tag not in existing_tags:
                if tag not in tag_significance:
                    tag_significance[tag] = []
                tag_significance[tag].append(sig)

    # 计算平均显著性
    candidates = []
    for tag, sigs in tag_significance.items():
        avg_sig = sum(sigs) / len(sigs) if sigs else 0
        candidates.append({"tag": tag, "avg_significance": avg_sig, "count": len(sigs)})

    # 排序并返回top_n
    candidates.sort(key=lambda x: x["avg_significance"], reverse=True)
    return candidates[:top_n]
