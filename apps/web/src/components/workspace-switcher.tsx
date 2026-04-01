"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  fetchWorkspaceSwitcher,
  switchActiveWorkspace
} from "../lib/auth-client";
import type { SessionMembership, WorkspaceSwitcherResponse } from "../lib/auth-types";
import {
  buildRecentWorkspaces,
  filterWorkspaces,
  getRoleBadgeLabel
} from "./workspace-switcher.utils";

type WorkspaceSwitcherProps = {
  activeWorkspaceName: string;
  activeWorkspaceRole: SessionMembership["role"] | "member";
};

export function WorkspaceSwitcher({
  activeWorkspaceName,
  activeWorkspaceRole
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [switcherData, setSwitcherData] = useState<WorkspaceSwitcherResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (!panelRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (target && !panelRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || switcherData) {
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void fetchWorkspaceSwitcher()
      .then((response) => {
        if (!isCancelled) {
          setSwitcherData(response);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load workspaces.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, switcherData]);

  const filteredWorkspaces = useMemo(() => {
    if (!switcherData) {
      return [];
    }
    return filterWorkspaces(switcherData.workspaces, searchQuery);
  }, [searchQuery, switcherData]);

  const filteredRecentWorkspaces = useMemo(() => {
    if (!switcherData) {
      return [];
    }
    const filteredSet = new Set(filteredWorkspaces.map((workspace) => workspace.workspaceId));
    return switcherData.recentWorkspaces.filter((workspace) => {
      return filteredSet.has(workspace.workspaceId);
    });
  }, [filteredWorkspaces, switcherData]);

  const activeWorkspaceId = switcherData?.activeWorkspaceId ?? null;

  async function handleSwitchWorkspace(workspaceId: string) {
    if (isSwitching || workspaceId === activeWorkspaceId) {
      setIsOpen(false);
      return;
    }
    setIsSwitching(true);
    setErrorMessage(null);
    try {
      const response = await switchActiveWorkspace(workspaceId);
      setSwitcherData((current) => {
        if (!current) {
          return current;
        }

        const nextRecent = current.workspaces
          .map((workspace) => ({
            ...workspace,
            isActive: workspace.workspaceId === workspaceId,
            lastActiveAt:
              workspace.workspaceId === workspaceId
                ? new Date().toISOString()
                : workspace.lastActiveAt
          }))
          .sort((left, right) => {
            if (!left.lastActiveAt && !right.lastActiveAt) {
              return 0;
            }
            if (!left.lastActiveAt) {
              return 1;
            }
            if (!right.lastActiveAt) {
              return -1;
            }
            return right.lastActiveAt.localeCompare(left.lastActiveAt);
          });

        return {
          activeWorkspaceId: workspaceId,
          workspaces: nextRecent,
          recentWorkspaces: buildRecentWorkspaces(nextRecent)
        };
      });
      setIsOpen(false);
      setSearchQuery("");
      if (response.session.activeWorkspaceId !== workspaceId) {
        setErrorMessage("Failed to switch active workspace.");
      } else {
        router.refresh();
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to switch workspace.");
    } finally {
      setIsSwitching(false);
    }
  }

  return (
    <div className="workspace-switcher" ref={panelRef}>
      <button
        type="button"
        className="switcher-button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="switcher-button__label">Workspace</span>
        <strong>{activeWorkspaceName}</strong>
        <small className="workspace-switcher__role-badge">
          {getRoleBadgeLabel(activeWorkspaceRole)}
        </small>
      </button>

      {isOpen ? (
        <div className="workspace-switcher__panel surface-panel" role="dialog" aria-modal="false">
          <div className="workspace-switcher__panel-header">
            <h2>Switch workspace</h2>
            <p>Metadata only: no cross-workspace preview data is shown.</p>
          </div>

          <label className="workspace-switcher__search">
            <span>Search workspaces</span>
            <input
              type="search"
              value={searchQuery}
              placeholder="Search by name or slug"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          {errorMessage ? <p className="workspace-switcher__error">{errorMessage}</p> : null}

          {isLoading ? <p className="workspace-switcher__loading">Loading workspaces...</p> : null}

          {!isLoading && filteredRecentWorkspaces.length > 0 ? (
            <div className="workspace-switcher__section">
              <h3>Recent</h3>
              <ul>
                {filteredRecentWorkspaces.map((workspace) => {
                  return (
                    <li key={`recent-${workspace.workspaceId}`}>
                      <button
                        type="button"
                        onClick={() => void handleSwitchWorkspace(workspace.workspaceId)}
                        disabled={isSwitching}
                        className={`workspace-switcher__item${workspace.isActive ? " workspace-switcher__item--active" : ""}`}
                      >
                        <span className="workspace-switcher__item-main">
                          <strong>{workspace.workspaceName}</strong>
                          <small>{workspace.workspaceSlug}</small>
                        </span>
                        <span className="workspace-switcher__pill">
                          {getRoleBadgeLabel(workspace.role)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {!isLoading ? (
            <div className="workspace-switcher__section">
              <h3>All workspaces</h3>
              {filteredWorkspaces.length === 0 ? (
                <p className="workspace-switcher__empty">No workspaces match that search.</p>
              ) : (
                <ul>
                  {filteredWorkspaces.map((workspace) => {
                    return (
                      <li key={workspace.workspaceId}>
                        <button
                          type="button"
                          onClick={() => void handleSwitchWorkspace(workspace.workspaceId)}
                          disabled={isSwitching}
                          className={`workspace-switcher__item${workspace.isActive ? " workspace-switcher__item--active" : ""}`}
                        >
                          <span className="workspace-switcher__item-main">
                            <strong>{workspace.workspaceName}</strong>
                            <small>{workspace.workspaceSlug}</small>
                          </span>
                          <span className="workspace-switcher__pill">
                            {getRoleBadgeLabel(workspace.role)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
