const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-4 sm:p-6">
      <div className="glass-nav flex items-center justify-between w-full max-w-4xl px-6 sm:px-8 py-3 rounded-2xl">
        {/* Brand */}
        <a 
          href="https://stabalmo.pro" 
          className="flex items-center group"
        >
          <span className="text-white tracking-tight text-lg" style={{ fontFamily: 'Stabalmo' }}>Stabalmo</span>
        </a>

        {/* Nav Links */}
        <div className="flex items-center gap-6 text-sm font-medium text-gray-400">
          <a 
            href="https://stabalmo.pro" 
            className="hover:text-white transition-colors duration-200"
          >
            Home
          </a>
          <a 
            href="https://github.com/Stabalmo" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-white transition-colors duration-200"
          >
            GitHub
          </a>
          <a 
            href="https://www.linkedin.com/in/stabalmo/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-white transition-colors duration-200"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
