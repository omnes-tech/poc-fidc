const WALLET_OPTIONS = [
  {
    id: "manager",
    name: "Manager Wallet",
    address: "0xF64749A9D8e4e4F33c9343e63797D57B80FBefd0",
    shortAddress: "0xF647...efd0",
    description: "Admin wallet with manager privileges",
  },
  {
    id: "validator",
    name: "Validator Wallet",
    address: "0x123456789abcdef123456789abcdef123456789a",
    shortAddress: "0x1234...789a",
    description: "Validator role for approving operations",
  },
  {
    id: "investor",
    name: "Investor Wallet",
    address: "0xabcdef123456789abcdef123456789abcdef1234",
    shortAddress: "0xabcd...1234",
    description: "Investor account for testing",
  },
];

type WalletSelectorProps = {
  onSelectWallet: (walletAddress: string) => void;
  selectedWallet: string | undefined;
};

export default function WalletSelector({
  onSelectWallet,
  selectedWallet,
}: WalletSelectorProps) {
  const handleSelectWallet = (walletAddress: string) => {
    onSelectWallet(walletAddress);
  };

  return (
    <div className="capitare-wallet-selector">
      <h3 className="text-lg font-semibold text-gray-700 mb-3">
        Select Wallet
      </h3>
      <div className="space-y-2">
        {WALLET_OPTIONS.map((wallet) => (
          <div
            key={wallet.id}
            className={`capitare-wallet-item ${
              selectedWallet === wallet.address ? "active" : ""
            }`}
            onClick={() => handleSelectWallet(wallet.address)}
          >
            <div className="flex-1">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-blue-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M13 7H7v6h6V7z" />
                    <path
                      fillRule="evenodd"
                      d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">{wallet.name}</h4>
                  <p className="text-sm text-gray-500">{wallet.shortAddress}</p>
                </div>
              </div>
            </div>
            {selectedWallet === wallet.address && (
              <div className="ml-2">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3 text-white"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm text-gray-500">
        <p>
          Wallet addresses are loaded from environment variables for security.
        </p>
        <p className="mt-1">
          Balance and network information will be displayed after selection.
        </p>
      </div>
    </div>
  );
}
