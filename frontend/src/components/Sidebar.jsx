import { NavLink } from 'react-router-dom';
import './Sidebar.css';

// Navigation items matching the Figma design
const navItems = [
  { path: '/upload', label: 'Upload', icon: '📤' },
  { path: '/processing', label: 'Processing', icon: '⚙️' },
  { path: '/results', label: 'Results', icon: '📊' },
  { path: '/history', label: 'History', icon: '📋' },
  { path: '/help', label: 'Help', icon: '❓' },
];

// TODO: Replace emoji icons with proper SVG icons or an icon library
// TODO: Add user info / logout button at the bottom
// TODO: Hide sidebar on the login page (or make it conditional)

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>BCD</h2>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
            }
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span className="sidebar-link-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
