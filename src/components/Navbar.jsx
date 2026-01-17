const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-4 sm:p-6">
      <div className="glass-nav flex items-center justify-between w-full max-w-4xl px-6 sm:px-8 py-3 rounded-2xl">
        {/* Brand */}
        <a 
          href="https://stabalmo.pro" 
          className="flex items-center gap-2 group"
        >
          <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24">
              <path d="M20,19H4c-1.1,0-2-0.9-2-2V7c0-1.1,0.9-2,2-2h16c1.1,0,2,0.9,2,2v10C22,18.1,21.1,19,20,19z M4,7v10h16V7H4z M13,15v-2h5v2H13z M6,15l5-4l-5-4l1.4-1.4l6.7,5.4l-6.7,5.4L6,15z"/>
            </svg>
          </div>
          <span className="text-white font-bold tracking-tight text-sm">Stabalmo</span>
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
