import Link from 'next/link';

export default function CapitareHeader() {
  return (
    <header className="capitare-header fixed w-full top-0 z-50">
      <div className="capitare-container flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 7H7v6h6V7z" />
                  <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-white font-bold text-2xl">CAPITARE</div>
            </div>
          </Link>
        </div>
        
        <nav className="hidden md:flex space-x-8">
          <Link href="/" className="text-white hover:text-gray-300">
            Home
          </Link>
          <Link href="/fidc-demo" className="text-white hover:text-gray-300">
            FIDC Demo
          </Link>
          <Link href="/investor" className="text-white hover:text-gray-300">
            Investor
          </Link>
          <Link href="/manager" className="text-white hover:text-gray-300 border-b-2 border-white">
            Manager
          </Link>
        </nav>
        
        <div className="flex items-center">
          <div className="text-white text-sm bg-blue-600 px-3 py-1 rounded-full flex items-center">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
            Holesky Network
          </div>
        </div>
      </div>
    </header>
  );
} 