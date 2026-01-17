const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <a href="https://stabalmo.pro" className="navbar-brand">
          Stabalmo
        </a>
        <div className="navbar-links">
          <a href="https://stabalmo.pro">Home</a>
          <a href="https://github.com/Stabalmo" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://www.linkedin.com/in/stabalmo/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
