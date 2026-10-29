from __future__ import annotations

from typing import TYPE_CHECKING

from open_tam.notifications.dingtalk import DingTalkNotifier
from open_tam.notifications.dispatcher import (
    NotificationDispatcher,
    NotificationEvent,
    NotificationType,
)
from open_tam.notifications.feishu import FeishuNotifier
from open_tam.notifications.slack import SlackNotifier

if TYPE_CHECKING:
    from open_tam.config import Settings

__all__ = [
    "DingTalkNotifier",
    "FeishuNotifier",
    "NotificationDispatcher",
    "NotificationEvent",
    "NotificationType",
    "SlackNotifier",
    "build_dispatcher",
    "notify_action_confirmation",
    "notify_investigation_complete",
]


def build_dispatcher(settings: Settings) -> NotificationDispatcher:
    notifiers = []
    if settings.notify_dingtalk_webhook:
        notifiers.append(DingTalkNotifier(settings.notify_dingtalk_webhook))
    if settings.notify_feishu_webhook:
        notifiers.append(FeishuNotifier(settings.notify_feishu_webhook))
    if settings.notify_slack_webhook:
        notifiers.append(SlackNotifier(settings.notify_slack_webhook))
    return NotificationDispatcher(notifiers)


def notify_investigation_complete(
    settings: Settings, *, investigation_id: str, alert_name: str,
    service: str, root_cause: str | None, confidence: str, report_path: str,
) -> list[bool]:
    event = NotificationEvent(
        type=NotificationType.INVESTIGATION_COMPLETE,
        title=f"open-tam 排查完成：{alert_name}",
        content=(
            f"- 服务: {service}\n"
            f"- 根因: {root_cause or '未定位'}\n"
            f"- 置信度: {confidence}\n"
            f"- 报告: {report_path}"
        ),
        investigation_id=investigation_id,
    )
    return build_dispatcher(settings).dispatch(event)


def notify_action_confirmation(
    settings: Settings, *, investigation_id: str, action: str, approved: bool,
) -> list[bool]:
    event = NotificationEvent(
        type=NotificationType.ACTION_CONFIRM,
        title="open-tam 敏感操作确认",
        content=(
            f"- 排查: {investigation_id}\n"
            f"- 动作: {action}\n"
            f"- 结果: {'已批准' if approved else '已拒绝'}"
        ),
        investigation_id=investigation_id,
        action_id=action,
    )
    return build_dispatcher(settings).dispatch(event)
