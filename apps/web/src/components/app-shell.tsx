"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";

import { navigationItems } from "./app-shell-config";

type AppShellProps = {
  children: ReactNode;
};

function isCurrentPath(currentPath: string, href: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const workspaceMenuId = useId();
  const propertyMenuId = useId();
  const userMenuId = useId();

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <a href="#app-shell-main" className="skip-link">
        Skip to content
      </a>

      <div
        className={`app-shell__overlay${isMobileNavOpen ? " app-shell__overlay--visible" : ""}`}
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="mobile-primary-nav"
        className={`app-sidebar${isMobileNavOpen ? " app-sidebar--open" : ""}`}
        aria-label="Primary navigation"
      >
        <div className="app-sidebar__brand">
          <div className="brand-mark" aria-hidden="true">
            <span>W</span>
          </div>
          <div>
            <p>WebOps Wizard</p>
            <span>Operational governance workspace</span>
          </div>
        </div>

        <nav className="app-sidebar__nav">
          {navigationItems.map((item) => {
            const isActive = isCurrentPath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${isActive ? " nav-item--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="nav-item__glyph" aria-hidden="true">
                  {item.shortLabel}
                </span>
                <span className="nav-item__copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                {item.badge ? <span className="nav-item__badge">{item.badge}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar__footer surface-panel">
          <p className="eyebrow">Readiness</p>
          <h2>87% rollout confidence</h2>
          <p>
            Keep data trust and alert hygiene above target before the next release
            window opens.
          </p>
        </div>
      </aside>

      <div className="app-shell__content">
        <header className="app-topbar surface-panel">
          <div className="app-topbar__row">
            <div className="app-topbar__cluster">
              <button
                type="button"
                className="icon-button app-topbar__menu"
                onClick={() => setIsMobileNavOpen((current) => !current)}
                aria-expanded={isMobileNavOpen}
                aria-controls="mobile-primary-nav"
                aria-label="Toggle navigation"
              >
                <span />
                <span />
                <span />
              </button>

              <button
                type="button"
                className="switcher-button"
                aria-haspopup="menu"
                aria-controls={workspaceMenuId}
              >
                <span className="switcher-button__label">Workspace</span>
                <strong>Growth Ops</strong>
              </button>

              <button
                type="button"
                className="switcher-button switcher-button--property"
                aria-haspopup="menu"
                aria-controls={propertyMenuId}
              >
                <span className="switcher-button__label">Property</span>
                <strong>webopswizard.com</strong>
              </button>
            </div>

            <div className="app-topbar__cluster app-topbar__cluster--end">
              <label className="search-field" aria-label="Global search">
                <span className="search-field__icon" aria-hidden="true">
                  Search
                </span>
                <input
                  type="search"
                  placeholder="Search pages, reports, alerts"
                  readOnly
                />
                <kbd>/</kbd>
              </label>

              <button
                type="button"
                className="user-button"
                aria-haspopup="menu"
                aria-controls={userMenuId}
              >
                <span className="user-button__avatar" aria-hidden="true">
                  LI
                </span>
                <span className="user-button__copy">
                  <strong>Logan Irish</strong>
                  <small>Admin</small>
                </span>
              </button>
            </div>
          </div>

          <div className="app-topbar__status">
            <span className="status-pill">US-West workspace</span>
            <span className="status-pill">Last sync 4m ago</span>
            <span className="status-pill status-pill--accent">2 checks pending</span>
          </div>
          <div id={workspaceMenuId} hidden />
          <div id={propertyMenuId} hidden />
          <div id={userMenuId} hidden />
        </header>

        <main id="app-shell-main" className="app-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
