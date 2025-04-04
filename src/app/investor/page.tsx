"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { ethers } from "ethers";
import Link from "next/link";

const BPS_DENOMINATOR = 10000;
const DEMO_INVESTOR_ADDRESS = "0xF64749A9D8e4e4F33c9343e63797D57B80FBefd0";

export default function InvestorPage() {
  const { address: walletAddress, isConnected: isWalletConnected } =
    useAccount();
  const [useDemoAccount, setUseDemoAccount] = useState(false);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);

  const {
    isProcessing,
    txHash,
    error,
    invest,
    redeemAll,
    redeemAllManager,
    getFIDCDetails,
    getInvestorPosition,
    fundInvestorWallet,
    approveInvestor,
    getContracts,
  } = useContractInteraction();

  const [processing, setProcessing] = useState(false);
  const [fidcId, setFidcId] = useState<number>(1);
  const [logs, setLogs] = useState<string[]>([]);
  const [investments, setInvestments] = useState<
    Array<{
      investmentId: number;
      amount: string;
      investmentDate: Date;
      yieldStartTime: Date;
      isSenior: boolean;
    }>
  >([]);
  const [fidcDetails, setFidcDetails] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [inputs, setInputs] = useState({
    investAmount: "100",
    redeemAmount: "100",
    investmentId: 0,
    isSenior: true,
  });

  useEffect(() => {
    if (useDemoAccount) {
      setAddress(DEMO_INVESTOR_ADDRESS);
      setIsConnected(true);
      addLog("Usando conta de demonstração: " + DEMO_INVESTOR_ADDRESS);
    } else {
      setAddress(walletAddress);
      setIsConnected(isWalletConnected);
    }
  }, [walletAddress, isWalletConnected, useDemoAccount]);

  useEffect(() => {
    const loadData = async () => {
      if (isConnected && address && fidcId) {
        try {
          addLog("Conectado. Carregando dados...");
          console.log("Connected address:", address);
          await loadFIDCDetails();
          await loadInvestments();
          await checkBalance();
        } catch (err) {
          console.error("Error loading data:", err);
          addLog(
            `Erro carregando dados iniciais: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    };

    loadData();
  }, [isConnected, address, fidcId]);

  useEffect(() => {
    if (error) {
      addLog(`Error: ${error}`);
    }
  }, [error]);

  useEffect(() => {
    if (txHash) {
      addLog(`Transaction submitted: ${txHash}`);
    }
  }, [txHash]);

  useEffect(() => {
    if (useDemoAccount) {
      setFidcDetails({
        manager: "0x1234...5678",
        validator: "0xabcd...efgh",
        payableAddress: "0x9876...5432",
        fee: 500,
        amount: "1000",
        invested: "750",
        valid: true,
        status: 1,
        annualYield: 1000,
        gracePeriod: 2592000,
        seniorSpread: 300,
      });
      setInvestments([
        {
          investmentId: 1,
          amount: "250",
          investmentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
          yieldStartTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          isSenior: true,
        },
        {
          investmentId: 2,
          amount: "100",
          investmentDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 dias atrás
          yieldStartTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          isSenior: false,
        },
      ]);

      setWalletBalance("500");

      setInputs((prev) => ({
        ...prev,
        investmentId: 1,
        redeemAmount: "250",
      }));

      addLog("Conta de demonstração carregada com dados simulados");
    }
  }, [useDemoAccount]);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const loadFIDCDetails = async () => {
    if (!isConnected || !address) {
      addLog("Conta não conectada. Não é possível carregar detalhes do FIDC.");
      return;
    }

    if (useDemoAccount) return;

    try {
      console.log("Loading FIDC details for ID:", fidcId);
      console.log("Connected with address:", address);

      const contracts = await getContracts();
      if (!contracts || !contracts.fidcContract) {
        addLog("Erro ao obter contratos. Verifique sua conexão.");
        return;
      }

      const details = await getFIDCDetails(fidcId, useDemoAccount);
      console.log("FIDC details loaded:", details);
      setFidcDetails(details);
      addLog(`FIDC ${fidcId} detalhes carregados com sucesso!`);
    } catch (err) {
      console.error("Error getting FIDC details:", err);
      addLog(
        `Falha ao carregar detalhes do FIDC: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  const loadInvestments = async () => {
    if (!address) return;
    
    // Se estiver no modo demo, os investimentos já foram definidos no useEffect do demo
    if (useDemoAccount) {
      addLog(`Usando investimentos de demonstração para ${address} no FIDC ${fidcId}`);
      
      // Apenas registre os investimentos demo que já foram definidos
      addLog(`Encontrados ${investments.length} investimentos de demonstração`);
      
      if (investments.length > 0) {
        addLog("Detalhes dos investimentos de demonstração:");
        investments.forEach((inv) => {
          const dateStr = inv.investmentDate.toLocaleDateString();
          const typeStr = inv.isSenior ? "Senior" : "Subordinado";
          addLog(
            `- ID ${inv.investmentId}: ${inv.amount} Stablecoin (${typeStr}) - ${dateStr}`
          );
        });
      }
      return;
    }

    try {
      addLog(`Buscando investimentos para ${address} no FIDC ${fidcId}...`);
      const position = await getInvestorPosition(
        address,
        fidcId,
        useDemoAccount
      );
      console.log("Posição do investidor:", position);

      if (!position || !position.investments) {
        addLog("Não foi possível obter informações de investimentos");
        return;
      }

      setInvestments(position.investments);
      addLog(`Encontrados ${position.investments.length} investimentos`);

      if (position.investments.length > 0) {
        addLog("Detalhes dos investimentos:");
        position.investments.forEach((inv) => {
          const dateStr = inv.investmentDate.toLocaleDateString();
          const typeStr = inv.isSenior ? "Senior" : "Subordinado";
          addLog(
            `- ID ${inv.investmentId}: ${inv.amount} Stablecoin (${typeStr}) - ${dateStr}`
          );
        });

        setInputs((prev) => ({
          ...prev,
          investmentId: position.investments[0].investmentId,
          redeemAmount: position.investments[0].amount,
        }));
      } else {
        addLog("Nenhum investimento ativo encontrado");
      }
    } catch (err) {
      console.error("Erro ao carregar investimentos:", err);
      addLog(
        `Falha ao carregar investimentos: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  const checkBalance = async () => {
    if (!address) return;
    try {
      const { drexContract } = await getContracts(useDemoAccount);
      const balance = await drexContract.balanceOf(address);
      setWalletBalance(ethers.formatEther(balance));
    } catch (err) {
      console.error("Error checking balance:", err);
    }
  };

  const handleInvest = async () => {
    if (!isConnected || !address) {
      addLog("Please connect your wallet first");
      return;
    }
    const amount = inputs.investAmount;
    setProcessing(true);
    addLog(
      `Preparing to invest ${amount} Stablecoin in FIDC ${fidcId} as ${
        inputs.isSenior ? "Senior" : "Subordinated"
      } investor...`
    );

    try {
      addLog("Auto-funding wallet with Stablecoin for demonstration...");
      await fundInvestorWallet(
        address!,
        (Number(amount) * 1.1).toString(),
        useDemoAccount
      );
      addLog("Wallet funded successfully");

      let existingInvestments = [];
      try {
        const position = await getInvestorPosition(
          address,
          fidcId,
          useDemoAccount
        );
        existingInvestments = position.investments;
        addLog(`Found ${existingInvestments.length} existing investments`);
      } catch (err) {
        addLog(
          "Could not check existing investments, will continue with new investment"
        );
      }
      const investorType = inputs.isSenior ? 0 : 1;
      addLog(
        `Approving user as ${
          inputs.isSenior ? "Senior" : "Subordinated"
        } investor...`
      );
      const approvalResult = await approveInvestor(
        address!,
        investorType,
        fidcId,
        useDemoAccount
      );
      if (approvalResult.success) {
        addLog(
          `Investor approved as ${inputs.isSenior ? "Senior" : "Subordinated"}`
        );
        addLog(`Initiating investment of ${amount} Stablecoin...`);
        const result = await invest(fidcId, amount, useDemoAccount);
        if (result.success) {
          addLog(
            `Investment successful! Invested ${amount} Stablecoin as ${
              inputs.isSenior ? "Senior" : "Subordinated"
            } investor`
          );
          await loadInvestments();
          await checkBalance();
        } else {
          addLog("Investment failed. See console for details.");
        }
      } else {
        addLog("Failed to approve investor type. See console for details.");
      }
    } catch (error) {
      addLog(
        `Error during investment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleManagerRedeemAll = async () => {
    if (!isConnected || !address) {
      addLog("Please connect your wallet first");
      return;
    }

    setProcessing(true);
    addLog(`Preparing to redeem all investments in FIDC ${fidcId} as manager...`);

    try {
      // Em modo de demonstração, simular que o endereço atual é o gestor
      if (useDemoAccount) {
        addLog(`Demo mode: Assuming ${address} is the manager`);
        
        // Usar os investimentos demo que já temos
        const demoInvestors = [address];
        addLog(`Redeeming for demo investor: ${address}`);
        
        // Simular sucesso no resgate
        setInvestments([]);
        addLog(`Demo redemption successful! Redeemed all investments`);
        return;
      }
      
      // Lógica real para carteira conectada
      const details = await getFIDCDetails(fidcId, useDemoAccount);
      if (details.manager.toLowerCase() !== address?.toLowerCase()) {
        addLog("You are not the manager of this FIDC");
        return;
      }
      
      const investors: string[] = [address];
      addLog(`Redeeming for investor: ${address}`);
      
      const result = await redeemAllManager(fidcId, investors, useDemoAccount);

      if (result.success) {
        addLog(`Manager redemption successful! Redeemed all investments`);
        await loadInvestments();
        await checkBalance();
      } else {
        addLog("Manager redemption failed. See console for details.");
      }
    } catch (error) {
      addLog(`Error during manager redemption: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusString = (statusCode: number): string => {
    const statuses = ["PENDING", "ACTIVE", "STOPPED", "LIQUIDATED"];
    return statuses[statusCode] || "UNKNOWN";
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <nav className="mb-8">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Home
        </Link>
      </nav>

      <h1 className="text-3xl font-bold mb-6">FIDC Investor Portal</h1>

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-4">
        <div className="flex items-center">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={useDemoAccount}
              onChange={() => setUseDemoAccount(!useDemoAccount)}
            />
            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
              Usar conta de demonstração
            </span>
          </label>
          {useDemoAccount && (
            <span className="ml-2 text-xs text-gray-500">
              ({DEMO_INVESTOR_ADDRESS.slice(0, 6)}...
              {DEMO_INVESTOR_ADDRESS.slice(-4)})
            </span>
          )}
        </div>

        {!useDemoAccount && <ConnectButton />}
      </div>

      {!isConnected && !useDemoAccount && (
        <div
          className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6"
          role="alert"
        >
          <p className="font-bold">Wallet not connected</p>
          <p>
            Please connect your wallet or use the demo account to interact with
            this portal
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Make an Investment</h2>

          <div className="mb-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium">
                Your Stablecoin Balance:
              </span>
              <span className="font-bold">{walletBalance} Stablecoin</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">FIDC ID</label>
              <input
                type="number"
                value={fidcId}
                onChange={(e) => setFidcId(Number(e.target.value))}
                className="w-full p-2 border rounded"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Amount to Invest (Stablecoin)
              </label>
              <input
                type="text"
                value={inputs.investAmount}
                onChange={(e) =>
                  setInputs({ ...inputs, investAmount: e.target.value })
                }
                className="w-full p-2 border rounded"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Investment Type
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={inputs.isSenior}
                    onChange={() => setInputs({ ...inputs, isSenior: true })}
                    className="form-radio"
                  />
                  <span className="ml-2">Senior</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={!inputs.isSenior}
                    onChange={() => setInputs({ ...inputs, isSenior: false })}
                    className="form-radio"
                  />
                  <span className="ml-2">Subordinated</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleInvest}
              disabled={processing || isProcessing || !isConnected}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {processing || isProcessing ? "Processing..." : "Invest Now"}
            </button>
          </div>

          {fidcDetails && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <h3 className="font-semibold mb-2">FIDC {fidcId} Details</h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-medium">
                    {getStatusString(fidcDetails.status)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Annual Yield:</span>
                  <span className="font-medium">
                    {fidcDetails.annualYield / 100}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Senior Spread:</span>
                  <span className="font-medium">
                    {fidcDetails.seniorSpread / 100}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Manager Fee:</span>
                  <span className="font-medium">{fidcDetails.fee / 100}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Invested:</span>
                  <span className="font-medium">
                    {fidcDetails.invested} Stablecoin
                  </span>
                </div>
              </div>
            </div>
          )}

          {!fidcDetails && isConnected && (
            <div className="mt-4">
              <button
                onClick={() => {
                  addLog("Tentando recarregar dados manualmente...");
                  loadFIDCDetails();
                  loadInvestments();
                  checkBalance();
                }}
                className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Recarregar Dados
              </button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Redeem Investment</h2>
            <button
              onClick={async () => {
                addLog("Forçando recarga de investimentos...");
                await loadInvestments();
              }}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded"
            >
              Recarregar Investimentos
            </button>
          </div>

          {investments.length > 0 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Investment
                </label>
                <select
                  value={inputs.investmentId}
                  onChange={(e) =>
                    setInputs({
                      ...inputs,
                      investmentId: Number(e.target.value),
                    })
                  }
                  className="w-full p-2 border rounded"
                >
                  {investments.map((inv) => (
                    <option key={inv.investmentId} value={inv.investmentId}>
                      ID: {inv.investmentId} - {inv.amount} Stablecoin (
                      {inv.isSenior ? "Senior" : "Subordinated"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={async () => {
                    if (!isConnected || !address) {
                      addLog("Por favor conecte sua carteira primeiro");
                      return;
                    }

                    if (investments.length === 0) {
                      addLog("Nenhum investimento encontrado para resgate");
                      return;
                    }

                    const selectedInvestment = investments.find(
                      (inv) => inv.investmentId === inputs.investmentId
                    );

                    if (!selectedInvestment) {
                      addLog(
                        `Investimento ID ${inputs.investmentId} não encontrado`
                      );
                      return;
                    }

                    setProcessing(true);
                    addLog(
                      `Resgatando todo o investimento ${inputs.investmentId}...`
                    );

                    try {
                      const result = await redeemAll(
                        fidcId,
                        inputs.investmentId,
                        useDemoAccount
                      );

                      if (result.success) {
                        addLog(`Resgate total concluído com sucesso!`);
                        await loadInvestments();
                        await checkBalance();
                      } else {
                        addLog(
                          "Falha no resgate total. Veja o console para detalhes."
                        );
                      }
                    } catch (error) {
                      addLog(
                        `Erro durante o resgate total: ${
                          error instanceof Error ? error.message : String(error)
                        }`
                      );
                    } finally {
                      setProcessing(false);
                    }
                  }}
                  disabled={processing || isProcessing || !isConnected}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {processing || isProcessing ? "Processing..." : "Redeem All"}
                </button>

                <button
                  onClick={handleManagerRedeemAll}
                  disabled={processing || isProcessing || !isConnected}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                >
                  {processing || isProcessing
                    ? "Processing..."
                    : "Redeem All Manager"}
                </button>
              </div>

              <div className="mt-4">
                <h3 className="font-medium text-sm mb-2">Your Investments</h3>
                <div className="max-h-60 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700">
                        <th className="py-2 px-3 text-left">ID</th>
                        <th className="py-2 px-3 text-left">Type</th>
                        <th className="py-2 px-3 text-left">Amount</th>
                        <th className="py-2 px-3 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map((inv) => (
                        <tr
                          key={inv.investmentId}
                          className="border-b dark:border-gray-700"
                        >
                          <td className="py-2 px-3">{inv.investmentId}</td>
                          <td className="py-2 px-3">
                            {inv.isSenior ? "Senior" : "Subordinated"}
                          </td>
                          <td className="py-2 px-3">{inv.amount} Stablecoin</td>
                          <td className="py-2 px-3">
                            {inv.investmentDate.toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No active investments found.</p>
              <p className="mt-2">Make an investment first.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-black rounded-lg shadow p-4 text-green-400 font-mono">
        <h2 className="text-xl font-semibold mb-2 text-white">
          Transaction Logs
        </h2>
        <div className="h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">
              No logs yet. Start investing to see transaction logs.
            </p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1">
                &gt; {log}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">About FIDC Investments</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Investment Types</h3>
            <p className="mt-2">
              <strong>Senior Investors:</strong> Receive base yield + spread,
              lower risk
            </p>
            <p>
              <strong>Subordinated Investors:</strong> Receive base yield only,
              higher risk but potentially higher returns in certain scenarios
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium">Yield Calculation</h3>
            <p className="mb-2">
              Yield = Principal × Annual Rate × Time (in years)
            </p>
            <p>
              The annual rate includes the base yield for all investors, plus
              the senior spread for senior investors. The manager collects a fee
              on the yield generated.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={loadInvestments}
        className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded"
      >
        Recarregar investimentos
      </button>
    </div>
  );
}
