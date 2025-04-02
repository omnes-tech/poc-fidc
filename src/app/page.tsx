import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">FIDC Platform</h1>
      
      <div className="flex flex-col gap-4">
        <Link 
          href="/fidc-demo" 
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
        >
          FIDC Flow Demonstration
        </Link>
        
        <Link 
          href="/fidc-details" 
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-center"
        >
          Understand FIDC in Detail
        </Link>
      </div>
      
      <p className="mt-8 text-center text-gray-600 max-w-md">
        This platform demonstrates how a FIDC (Fundo de Investimento em Direitos Creditórios) 
        operates on the blockchain, from initialization to investment and redemption.
      </p>
    </main>
  );
}
