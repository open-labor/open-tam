"""Mock K8s MCP server (K8sGPT-style diagnostics).

The server implements the standard MCP protocol via FastMCP, so it can be
reached through ``McpStdioBackend`` as well as the in-process handlers.
"""
from __future__ import annotations

import json
import sys

from mcp.server.fastmcp import FastMCP

from open_tam.faults import FaultState

mcp = FastMCP("mock-k8s")


def _query_k8s_events(namespace: str, pod_name: str | None = None,
                      kind: str | None = None) -> str:
    events = []
    state = FaultState()
    if state.is_active("pod_crash_loop"):
        events.append({
            "type": "Warning",
            "reason": "BackOff",
            "message": "Back-off restarting failed container",
            "object": f"pod/{pod_name or 'demo-app-xxx'}",
        })
        events.append({
            "type": "Warning",
            "reason": "CrashLoopBackOff",
            "message": "Container crashed with exit code 1",
            "object": f"pod/{pod_name or 'demo-app-xxx'}",
        })
    if state.is_active("node_not_ready"):
        events.append({
            "type": "Warning",
            "reason": "NodeNotReady",
            "message": "Node condition Ready is False",
            "object": "node/worker-1",
        })
    if state.is_active("dns_failure"):
        events.append({
            "type": "Warning",
            "reason": "DNSLookupFailed",
            "message": "DNS lookup failed for external service",
            "object": f"pod/{pod_name or 'demo-app-xxx'}",
        })
    if kind:
        events = [e for e in events if kind.lower() in e.get("object", "").lower()]
    return json.dumps(events, ensure_ascii=False)


def _query_pod_status(namespace: str, pod_name: str) -> str:
    state = FaultState()
    status = {
        "name": pod_name,
        "namespace": namespace,
        "phase": "Running",
        "restart_count": 0,
        "ready": True,
    }
    if state.is_active("pod_crash_loop"):
        status["phase"] = "CrashLoopBackOff"
        status["restart_count"] = 5
        status["ready"] = False
    return json.dumps(status, ensure_ascii=False)


def _query_node_status(node_name: str) -> str:
    state = FaultState()
    status = {
        "name": node_name,
        "ready": True,
        "conditions": [{"type": "Ready", "status": "True"}],
    }
    if state.is_active("node_not_ready"):
        status["ready"] = False
        status["conditions"] = [{"type": "Ready", "status": "False"}]
    return json.dumps(status, ensure_ascii=False)


def _analyze_with_k8sgpt(namespace: str, pod_name: str | None = None) -> str:
    state = FaultState()
    findings = []
    if state.is_active("pod_crash_loop"):
        findings.append({
            "type": "CrashLoopBackOff",
            "severity": "critical",
            "message": "Pod is in CrashLoopBackOff state",
            "suggestion": "Check container logs and liveness probe configuration",
        })
    if state.is_active("node_not_ready"):
        findings.append({
            "type": "NodeNotReady",
            "severity": "critical",
            "message": "Node is in NotReady state",
            "suggestion": "Check kubelet logs and node resource usage",
        })
    if state.is_active("dns_failure"):
        findings.append({
            "type": "DNSFailure",
            "severity": "high",
            "message": "DNS resolution failing for pods",
            "suggestion": "Check CoreDNS pod status and configuration",
        })
    if state.is_active("cert_expiry"):
        findings.append({
            "type": "CertExpiry",
            "severity": "high",
            "message": "TLS certificate is expired or about to expire",
            "suggestion": "Renew certificate or configure cert-manager for auto-renewal",
        })
    return json.dumps(findings, ensure_ascii=False)


TOOLS = [
    {
        "name": "query_k8s_events",
        "description": "查询 K8s 事件（Pod/Node 相关）",
        "parameters": {
            "type": "object",
            "properties": {
                "namespace": {"type": "string", "description": "命名空间"},
                "pod_name": {"type": "string", "description": "Pod 名称（可选）"},
                "kind": {"type": "string", "description": "资源类型过滤（可选）"},
            },
            "required": ["namespace"],
        },
    },
    {
        "name": "query_pod_status",
        "description": "查询 Pod 状态",
        "parameters": {
            "type": "object",
            "properties": {
                "namespace": {"type": "string", "description": "命名空间"},
                "pod_name": {"type": "string", "description": "Pod 名称"},
            },
            "required": ["namespace", "pod_name"],
        },
    },
    {
        "name": "query_node_status",
        "description": "查询 Node 状态",
        "parameters": {
            "type": "object",
            "properties": {
                "node_name": {"type": "string", "description": "Node 名称"},
            },
            "required": ["node_name"],
        },
    },
    {
        "name": "analyze_with_k8sgpt",
        "description": "使用 K8sGPT 自动分析 K8s 问题",
        "parameters": {
            "type": "object",
            "properties": {
                "namespace": {"type": "string", "description": "命名空间"},
                "pod_name": {"type": "string", "description": "Pod 名称（可选）"},
            },
            "required": ["namespace"],
        },
    },
]


@mcp.tool()
def query_k8s_events(namespace: str, pod_name: str | None = None,
                     kind: str | None = None) -> str:
    """查询 K8s 事件。"""
    return _query_k8s_events(namespace, pod_name, kind)


@mcp.tool()
def query_pod_status(namespace: str, pod_name: str) -> str:
    """查询 Pod 状态。"""
    return _query_pod_status(namespace, pod_name)


@mcp.tool()
def query_node_status(node_name: str) -> str:
    """查询 Node 状态。"""
    return _query_node_status(node_name)


@mcp.tool()
def analyze_with_k8sgpt(namespace: str, pod_name: str | None = None) -> str:
    """使用 K8sGPT 自动分析 K8s 问题。"""
    return _analyze_with_k8sgpt(namespace, pod_name)


def _server_command() -> tuple[str, list[str]]:
    return (sys.executable, ["-m", "open_tam.mcp_servers.k8s_server"])


if __name__ == "__main__":
    mcp.run()
