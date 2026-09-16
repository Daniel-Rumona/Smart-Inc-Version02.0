# Sidebar navigation backup

Snapshot created before the navigation-modal redesign on 4 September 2026.

The previous workspace shell used a fixed `app-sidebar-pill` rendered by
`SystemLayout.tsx`. It contained the company logo, the role-filtered Ant
Design inline `Menu`, and a logout action. The menu was derived from
`visibleRoutes` through `buildMenuItems`, with `selectedKey`, `defaultOpenKeys`,
and the `collapsed` state controlling its appearance.

The original visual rules remain in `src/styles/system-layout.css` under the
sidebar sections. The essential JSX snapshot was:

```tsx
<aside className={`app-sidebar-pill ${collapsed ? 'is-collapsed' : ''}`}>
  <div className="app-sidebar-head">
    <div className="app-logo-pill">{companyLogoUrl ? <img src={companyLogoUrl} alt="Company logo" className="app-logo-img" /> : 'S'}</div>
  </div>
  <div className="app-sidebar-menu-wrap">
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      defaultOpenKeys={defaultOpenKeys}
      items={navItems}
      inlineCollapsed={!isMobile && collapsed}
      className="app-sidebar-menu"
    />
  </div>
  <div className="app-sidebar-footer">
    <Button block icon={<LogoutOutlined />} className="app-sidebar-logout-btn" onClick={handleLogout}>
      {t('common.logout')}
    </Button>
  </div>
</aside>
```

This is the complete visual/structural sidebar reference needed to restore the
previous layout as one design decision if required.
