"""Role-based access control."""
from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    MENTOR = "mentor"
    OPERATOR = "operator"
    VIEWER = "viewer"


PERMISSIONS = {
    Role.ADMIN: {
        "read", "write", "investigate", "manage_users", "manage_skills",
        "manage_teams", "view_team", "review_attempts",
    },
    Role.MENTOR: {
        "read", "write", "investigate", "manage_skills", "view_team",
        "review_attempts",
    },
    Role.OPERATOR: {"read", "write", "investigate"},
    Role.VIEWER: {"read"},
}


def has_permission(role: str | Role, permission: str) -> bool:
    if isinstance(role, str):
        try:
            role = Role(role)
        except ValueError:
            return False
    return permission in PERMISSIONS.get(role, set())
