"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { ethers } from "ethers";
import Link from "next/link";
import CapitareHeader from "@/components/CapitareHeader";
import WalletSelector from "@/components/WalletSelector";
import { FIDC_Management_address, ERC20Mock_address } from "@/constants";
import { adminAddresses } from "@/constants";

const DEMO_WALLET_ADDRESS = "0xF64749A9D8e4e4F33c9343e63797D57B80FBefd0";

// Adicionar novo tipo para os detalhes da transação
type TransactionDetails = {
  hash: string;
  events: {
    type: string;
    from: string;
    to: string;
    amount: string;
    description: string;
  }[];
};

// Adicionar o tipo FIDCDetails
type FIDCDetails = {
  manager: string;
  validator: string;
  payableAddress: string;
  fee: number;
  amount: string;
  invested: string;
  valid: boolean;
  status: number;
  annualYield: number;
  gracePeriod: number;
  seniorSpread: number;
};

// Adicionar tipo para os dados dos investidores (junto com os outros tipos no início do arquivo)
type InvestorData = {
  investors: string[];
  isSenior: boolean[];
  amounts: string[];
};

export default function ManagerPage() {
  const { address: walletAddress, isConnected: isWalletConnected } =
    useAccount();
  const [useDemoAccount, setUseDemoAccount] = useState(false);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);

  const {
    isProcessing,
    txHash,
    error,
    fundInvestorWallet,
    initializeFIDC,
    invest,
    approveInvestor,
    getFIDCDetails,
    getAllInvestors,
    redeemAllManager,
    compensationPay,
    getFIDCScheduleAmount,
    getContracts,
  } = useContractInteraction();

  const [logs, setLogs] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    fidcId: 1,
    pjAddress: "",
    amount: "1000000000",
  });

  // Adicionar novos estados para o FIDC
  const [fidcInitialized, setFidcInitialized] = useState(false);
  const [fidcId, setFidcId] = useState(0);

  // Adicionar novo estado para os detalhes da transação
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetails | null>(null);

  // Primeiro, adicionar os estados necessários
  const [investmentInputs, setInvestmentInputs] = useState({
    amount: "1000",
    isSenior: true,
    investmentFidcId: 1,
  });

  // Adicionar o estado
  const [fidcDetails, setFidcDetails] = useState<FIDCDetails | null>(null);

  // Adicionar os estados (junto com os outros estados)
  const [investorsData, setInvestorsData] = useState<InvestorData | null>(null);
  const [queryFidcId, setQueryFidcId] = useState<number>(1);
  const [loadingInvestors, setLoadingInvestors] = useState(false);

  // Adicionar junto com os outros estados no início do componente
  const [managerRedeemAddresses, setManagerRedeemAddresses] = useState<
    string[]
  >([]);
  const [newRedeemAddress, setNewRedeemAddress] = useState<string>("");

  // Adicionar novo estado para armazenar o valor do schedule amount
  const [scheduleAmount, setScheduleAmount] = useState<string>("");

  // Adicionar novo estado para a nova seção de Antecipação PJ
  const [pjFormData, setPjFormData] = useState({
    anticipationAmount: "100 mil",
    fidcId: 2,
    collateralToken: "token de garantia",
    pjAddress: "address: 0x123",
    collateralAmount: "120 mil tokens",
  });

  // Adicionar novo estado para os detalhes da transação da nova seção de Antecipação PJ
  const [pjTransactionDetails, setPjTransactionDetails] =
    useState<TransactionDetails | null>(null);

  // Add these state variables after the other useState declarations
  const [stablecoinBalance, setStablecoinBalance] = useState<string>("0");
  const [receivablesBalance, setReceivablesBalance] = useState<string>("0");

  // Add this function to update balances
  const updateBalances = useCallback(async () => {
    if (!fidcId) return;

    try {
      const { fidcContract, drexContract } = await getContracts(useDemoAccount);

      // Get stablecoin balance
      const stablecoinBal = await drexContract.balanceOf(
        FIDC_Management_address
      );
      setStablecoinBalance(ethers.formatEther(stablecoinBal));

      // Get receivables balance
      const receivableAddress = await fidcContract.getFIDCReceivable(fidcId);
      if (receivableAddress) {
        const receivablesBal = await fidcContract.balanceOf(receivableAddress);
        setReceivablesBalance(ethers.formatEther(receivablesBal));
      }
    } catch (error) {
      console.error("Error updating balances:", error);
    }
  }, [fidcId, getContracts, useDemoAccount]);

  // Add useEffect to update balances when fidcId changes or after relevant operations
  useEffect(() => {
    updateBalances();
  }, [fidcId, updateBalances]);

  // Add this after the existing useEffect hooks
  useEffect(() => {
    const interval = setInterval(updateBalances, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [updateBalances]);

  useEffect(() => {
    // Se um endereço foi selecionado através do WalletSelector
    if (address) {
      setIsConnected(true);
      addLog(`Usando carteira: ${address}`);
    } else {
      setIsConnected(false);
    }
  }, [address]);

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
    if (fidcInitialized && fidcId) {
      loadFIDCDetails();
    }
  }, [fidcInitialized, fidcId]);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  // New handler for wallet selection
  const handleSelectWallet = (walletAddress: string) => {
    setAddress(walletAddress);
    addLog(`Selected wallet: ${walletAddress}`);
  };

  // Modificar o setupAndInitializeFIDC para remover as aprovações e ir direto para a inicialização
  const setupAndInitializeFIDC = async () => {
    if (!address) {
      addLog("Por favor selecione uma carteira primeiro");
      return;
    }

    setProcessing(true);
    addLog("Iniciando setup do FIDC...");

    try {
      const currentAddress = address;
      addLog(`Usando endereço: ${currentAddress}`);

      // Inicializar o FIDC diretamente
      const fidcConfig = {
        fee: 100, // 1%
        annualYield: 1800, // 18%
        gracePeriod: 86400, // 1 dia
        seniorSpread: 500, // 5%
      };

      addLog("Inicializando FIDC...");
      addLog(`Manager: ${currentAddress}`);
      addLog(`Validator: ${currentAddress}`);
      addLog(`Payable: ${currentAddress}`);

      const result = await initializeFIDC(
        currentAddress,
        currentAddress,
        currentAddress,
        fidcConfig.fee,
        fidcConfig.annualYield,
        fidcConfig.gracePeriod,
        fidcConfig.seniorSpread,
        true // true para usar demo wallet
      );

      if (result.success && result.fidcId) {
        const newFidcId = result.fidcId;
        setFidcId(newFidcId);
        setFidcInitialized(true);
        addLog(`FIDC inicializado com sucesso! ID: ${newFidcId}`);
        addLog(`Manager/Validator/Payable: ${currentAddress}`);

        return {
          fidcId: newFidcId,
          validatorAddress: currentAddress,
          payableAddress: currentAddress,
        };
      } else {
        throw new Error("Falha ao inicializar FIDC");
      }
    } catch (error) {
      addLog(
        `Erro no setup do FIDC: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    } finally {
      setProcessing(false);
    }
  };

  // Modificar o handleValidatorApproval para apenas inicializar o FIDC
  const handleValidatorApproval = async () => {
    if (!address) {
      addLog("Por favor selecione uma carteira primeiro");
      return;
    }

    if (!formData.amount || isNaN(Number(formData.amount))) {
      addLog("Por favor insira um valor válido");
      return;
    }

    setProcessing(true);
    try {
      const setup = await setupAndInitializeFIDC();
      if (!setup) {
        throw new Error("Falha no setup do FIDC");
      }

      // Financiar a carteira com tokens
      addLog(`Financiando carteira ${address} com tokens Stablecoin...`);
      await fundInvestorWallet(address, formData.amount, true);
      addLog("Carteira financiada com sucesso!");
    } catch (error) {
      addLog(
        `Erro durante o processo: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setProcessing(false);
    }
  };

  // Modificar a função handleInvestment para receber o FIDC ID
  const handleInvestment = async (investmentFidcId: number) => {
    if (!address) {
      addLog("Por favor selecione uma carteira primeiro");
      return;
    }

    if (!investmentInputs.amount || isNaN(Number(investmentInputs.amount))) {
      addLog("Por favor insira um valor válido");
      return;
    }

    setProcessing(true);
    const currentAddress = address;

    try {
      addLog(`Iniciando processo de investimento...`);
      addLog(`FIDC ID: ${investmentFidcId}`);
      addLog(`Valor: ${investmentInputs.amount} Stablecoin`);
      addLog(`Tipo: ${investmentInputs.isSenior ? "Senior" : "Subordinado"}`);

      // Primeiro, aprovar o tipo de investidor
      const investorType = investmentInputs.isSenior ? 0 : 1;
      addLog(
        `Aprovando endereço ${currentAddress} como investidor tipo ${investorType}...`
      );

      const approvalResult = await approveInvestor(
        currentAddress,
        investorType,
        investmentFidcId,
        true
      );

      if (!approvalResult.success) {
        throw new Error("Falha ao aprovar tipo de investidor");
      }
      addLog("✓ Aprovação de tipo de investidor concluída");

      // Financiar a carteira
      const fundAmount = (Number(investmentInputs.amount) * 1.1).toString();
      addLog(`Financiando carteira com ${fundAmount} Stablecoin...`);

      const fundResult = await fundInvestorWallet(
        currentAddress,
        fundAmount,
        true
      );

      if (!fundResult.success) {
        throw new Error("Falha ao financiar carteira");
      }
      addLog("✓ Carteira financiada com sucesso");

      // Realizar o investimento
      addLog(`Executando investimento...`);
      const investResult = await invest(
        investmentFidcId,
        investmentInputs.amount,
        true // true para usar demo wallet
      );

      if (investResult.success) {
        addLog("✓ Investimento realizado com sucesso!");
        await updateBalances();
        await loadInvestmentFIDCDetails(investmentFidcId);
      } else {
        throw new Error("Falha ao realizar investimento");
      }
    } catch (error) {
      console.error("Erro no investimento:", error);
      addLog(
        `Erro durante o processo de investimento: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setProcessing(false);
    }
  };

  // Adicionar uma função para carregar os detalhes do FIDC quando o ID for alterado
  const loadInvestmentFIDCDetails = async (newFidcId: number) => {
    try {
      addLog(`Carregando detalhes do FIDC ${newFidcId} para investimento...`);
      const details = await getFIDCDetails(newFidcId, true, address);

      if (!details) {
        throw new Error("Não foi possível obter os detalhes do FIDC");
      }

      setFidcDetails(details);
      addLog("Detalhes do FIDC atualizados com sucesso");
    } catch (err) {
      console.error("Error getting FIDC details:", err);
      addLog(
        `Falha ao carregar detalhes do FIDC: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setFidcDetails(null);
    }
  };

  // Adicionar a função loadFIDCDetails
  const loadFIDCDetails = async () => {
    if (!address) {
      addLog("Conta não conectada. Não é possível carregar detalhes do FIDC.");
      return;
    }

    try {
      addLog(`Carregando detalhes do FIDC ${fidcId}...`);
      const details = await getFIDCDetails(fidcId, true, address);

      if (!details) {
        throw new Error("Não foi possível obter os detalhes do FIDC");
      }

      setFidcDetails(details);
      addLog("Detalhes do FIDC atualizados com sucesso");
    } catch (err) {
      console.error("Error getting FIDC details:", err);
      addLog(
        `Falha ao carregar detalhes do FIDC: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setFidcDetails(null);
    }
  };

  // Adicionar função para carregar os investidores
  const loadInvestors = async (fidcId: number) => {
    setLoadingInvestors(true);
    try {
      addLog(`Consultando investidores do FIDC ${fidcId}...`);
      const data = await getAllInvestors(fidcId, true); // true para usar demo wallet

      setInvestorsData({
        investors: data.investors,
        isSenior: data.isSenior,
        amounts: data.amounts,
      });

      const totalInvested = data.amounts.reduce(
        (acc: number, curr: string) => acc + Number(curr),
        0
      );

      addLog(`Encontrados ${data.investors.length} investidores`);
      addLog(`Total investido: ${totalInvested.toLocaleString()} Stablecoin`);
    } catch (error) {
      addLog(
        `Erro ao carregar investidores: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setInvestorsData(null);
    } finally {
      setLoadingInvestors(false);
    }
  };

  // Adicionar junto com as outras funções de manipulação
  const handleManagerRedeemAll = async () => {
    if (!address) {
      addLog("Por favor selecione uma carteira primeiro");
      return;
    }

    if (managerRedeemAddresses.length === 0) {
      addLog("Por favor adicione pelo menos um endereço para resgate");
      return;
    }

    setProcessing(true);
    addLog(
      `Preparando para resgatar investimentos para ${managerRedeemAddresses.length} endereços no FIDC ${fidcId}...`
    );

    try {
      // Verificar se é o manager usando a carteira selecionada
      const details = await getFIDCDetails(fidcId, true); // true para usar demo wallet
      const currentAddress = address;

      if (details?.manager.toLowerCase() !== currentAddress?.toLowerCase()) {
        throw new Error("Você não é o manager deste FIDC");
      }

      addLog(
        `Executando resgate para ${managerRedeemAddresses.length} investidores...`
      );
      const result = await redeemAllManager(
        fidcId,
        managerRedeemAddresses,
        true // true para usar demo wallet
      );

      if (result.success) {
        addLog(`Resgate manager concluído com sucesso!`);
        setManagerRedeemAddresses([]); // Limpa a lista após sucesso
        await updateBalances();
      } else {
        addLog("Falha no resgate manager. Veja o console para detalhes.");
      }
    } catch (error) {
      console.error("Error in manager redemption:", error);
      addLog(
        `Erro durante o resgate manager: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setProcessing(false);
    }
  };

  // Adicionar função para carregar o schedule amount quando o FIDC ID mudar
  const loadScheduleAmount = async (fidcId: number) => {
    try {
      const amount = await getFIDCScheduleAmount(fidcId, true, address);
      setScheduleAmount(amount);
      setFormData((prev) => ({ ...prev, amount })); // Atualiza automaticamente o input
      addLog(`Valor da emissão do FIDC ${fidcId}: ${amount} Stablecoin`);
    } catch (error) {
      addLog(
        `Erro ao carregar valor da emissão: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  // Adicionar junto com as outras funções de manipulação no ManagerPage
  const handleCompensationPay = async (fidcId: number, amount: string) => {
    if (!address) {
      addLog("Por favor selecione uma carteira primeiro");
      return;
    }

    if (!amount || isNaN(Number(amount))) {
      addLog("Por favor insira um valor válido");
      return;
    }

    try {
      setProcessing(true);
      // Sempre usar true para useDemoWallet já que estamos usando endereços predefinidos
      const res = await compensationPay(fidcId, amount, true);
      if (res.success) {
        addLog("Pagamento de compensação realizado com sucesso!");
        if (res.receipt) {
          setTransactionDetails({
            hash: res.receipt.hash,
            events: res.receipt.logs
              .filter(
                (log: any) =>
                  log.topics[0] ===
                  ethers.id("Transfer(address,address,uint256)")
              )
              .map((log: any) => ({
                type: "Transfer",
                from: `0x${log.topics[1].slice(-40)}`,
                to: `0x${log.topics[2].slice(-40)}`,
                amount: ethers.formatEther(log.data),
                description: "Pagamento de compensação",
              })),
          });
        }
        await updateBalances();
      }
    } catch (error) {
      addLog(
        `Erro durante o pagamento: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setProcessing(false);
    }
  };

  // Adicionar nova função para lidar com a antecipação de recebíveis para PJ
  const handlePjAnticipation = async () => {
    if (!address) {
      addLog("Conecte a carteira");
      return;
    }

    try {
      setProcessing(true);
      const { fidcId, anticipationAmount, collateralAmount } = pjFormData;

      const res = await anticipation(
        fidcId,
        anticipationAmount.replace(" mil", "000"),
        collateralAmount.replace(" mil tokens", "000"),
        true // NÃO usar demo
      );

      if (res.success) {
        addLog(`Antecipação concluída – evento: ${JSON.stringify(res.event)}`);
        setPjTransactionDetails({
          hash: res.receipt.hash,
          events: [
            {
              type: "Anticipation",
              from: res.event[1],
              to: adminAddresses.manager_address,
              amount: ethers.formatEther(res.event[2]),
              description: "Valor antecipado à PJ",
            },
          ],
        });
        updateBalances();
      }
    } catch (e: any) {
      addLog(`Erro: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="capitare-gradient-bg min-h-screen pt-20 pb-12">
      <CapitareHeader />

      <div className="capitare-container mx-auto px-4">
        <h1 className="capitare-section-title text-center mb-12">
          FIDC Management Platform
        </h1>

        <p className="text-center text-white mb-8 max-w-3xl mx-auto">
          Capitare offers a simple and intuitive process for investing in high
          potential opportunities. See below the steps to start investing with
          Capitare.
        </p>

        {/* Wallet Selector */}
        <div className="mb-8">
          <WalletSelector
            onSelectWallet={handleSelectWallet}
            selectedWallet={address}
          />
        </div>

        {/* Balance Bar */}
        <div className="mb-8">
          <div className="capitare-card">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Available Balances - FIDC ID: {fidcId || "N/A"}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium mb-1">
                      Stablecoin
                    </div>
                    <div className="text-2xl font-bold text-blue-800">
                      {Number(stablecoinBalance).toLocaleString()} Stablecoin
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600 font-medium mb-1">
                      Receivables
                    </div>
                    <div className="text-2xl font-bold text-purple-800">
                      {Number(receivablesBalance).toLocaleString()} REC
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={updateBalances}
                className="capitare-btn-outline px-4 py-2 flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh Balances
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Step 1: Iniciar/Selecionar FIDC */}
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Iniciar ou Selecionar FIDC</h2>

            <div className="space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-3">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Nota:</span> Esta operação usa a
                  wallet selecionada acima.
                </p>
              </div>

              <div>
                <label className="capitare-input-label">
                  Amount (Stablecoin)
                </label>
                <input
                  type="text"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="capitare-input"
                  placeholder="Enter amount, e.g. 1000"
                />
              </div>

              <button
                onClick={handleValidatorApproval}
                disabled={processing || isProcessing || !address}
                className="capitare-btn w-full"
              >
                {processing || isProcessing
                  ? "Processing..."
                  : fidcInitialized
                  ? "Start Approval Process"
                  : "Initialize FIDC and Start Approval"}
              </button>

              {fidcInitialized && (
                <div className="bg-green-50 border-l-4 border-green-400 p-3 mt-3">
                  <p className="text-sm text-green-700">
                    <span className="font-semibold">FIDC Active</span> - ID:{" "}
                    {fidcId}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Consulta de Investidores */}
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Consulta de Investidores</h2>

            <div className="space-y-4">
              <div>
                <label className="capitare-input-label">FIDC ID</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={queryFidcId}
                    onChange={(e) => setQueryFidcId(Number(e.target.value))}
                    className="capitare-input flex-1"
                    min="1"
                    placeholder="Digite o ID do FIDC"
                  />
                  <button
                    onClick={() => loadInvestors(queryFidcId)}
                    disabled={loadingInvestors}
                    className="capitare-btn"
                  >
                    {loadingInvestors ? "Carregando..." : "Consultar"}
                  </button>
                </div>
              </div>

              {loadingInvestors ? (
                <div className="text-center py-4">
                  <p className="text-gray-700">
                    Carregando dados dos investidores...
                  </p>
                </div>
              ) : investorsData && investorsData.investors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Endereço
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Tipo
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                          Valor Investido
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {investorsData.investors.map((investor, index) => (
                        <tr key={investor} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-mono">
                            {`${investor.slice(0, 6)}...${investor.slice(-4)}`}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                investorsData.isSenior[index]
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {investorsData.isSenior[index]
                                ? "Senior"
                                : "Subordinado"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-mono">
                            {Number(
                              investorsData.amounts[index]
                            ).toLocaleString()}{" "}
                            Stablecoin
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">
                    {investorsData === null
                      ? "Digite um ID de FIDC e clique em Consultar"
                      : "Nenhum investidor encontrado para este FIDC"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Step 3: Investir no FIDC */}
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Investir no FIDC</h2>

            <div className="space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-3">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Nota:</span> Esta operação usa a
                  wallet selecionada acima.
                </p>
              </div>

              <div>
                <label className="capitare-input-label">FIDC ID</label>
                <input
                  type="number"
                  value={investmentInputs.investmentFidcId}
                  onChange={(e) => {
                    const newFidcId = Number(e.target.value);
                    setInvestmentInputs({
                      ...investmentInputs,
                      investmentFidcId: newFidcId,
                    });
                    loadInvestmentFIDCDetails(newFidcId);
                  }}
                  className="capitare-input"
                  min="1"
                  placeholder="1"
                />
              </div>

              <div>
                <label className="capitare-input-label">
                  Valor do Investimento (Stablecoin)
                </label>
                <input
                  type="text"
                  value={investmentInputs.amount}
                  onChange={(e) =>
                    setInvestmentInputs({
                      ...investmentInputs,
                      amount: e.target.value,
                    })
                  }
                  className="capitare-input"
                  placeholder="1000"
                />
              </div>

              <div>
                <label className="capitare-input-label">
                  Tipo de Investimento
                </label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={investmentInputs.isSenior}
                      onChange={() =>
                        setInvestmentInputs({
                          ...investmentInputs,
                          isSenior: true,
                        })
                      }
                      className="form-radio text-blue-600"
                    />
                    <span className="ml-2 text-gray-700">Senior</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={!investmentInputs.isSenior}
                      onChange={() =>
                        setInvestmentInputs({
                          ...investmentInputs,
                          isSenior: false,
                        })
                      }
                      className="form-radio text-blue-600"
                    />
                    <span className="ml-2 text-gray-700">Subordinado</span>
                  </label>
                </div>
              </div>

              <button
                onClick={() =>
                  handleInvestment(investmentInputs.investmentFidcId)
                }
                disabled={
                  processing || isProcessing || !address || !fidcDetails
                }
                className="capitare-btn w-full"
              >
                {processing || isProcessing
                  ? "Processando..."
                  : "Realizar Investimento"}
              </button>
            </div>
          </div>

          {/* Step 4: Antecipação PJ */}
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">
              Antecipação de Recebíveis para PJ
            </h2>

            <div className="space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-3">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Nota:</span> Esta operação usa a
                  wallet selecionada acima.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="capitare-input-label">
                    Valor da Antecipação
                  </label>
                  <input
                    type="text"
                    value={pjFormData.anticipationAmount}
                    onChange={(e) =>
                      setPjFormData({
                        ...pjFormData,
                        anticipationAmount: e.target.value,
                      })
                    }
                    className="capitare-input"
                  />
                </div>

                <div>
                  <label className="capitare-input-label">FIDC ID</label>
                  <input
                    type="number"
                    value={pjFormData.fidcId}
                    onChange={(e) =>
                      setPjFormData({
                        ...pjFormData,
                        fidcId: Number(e.target.value),
                      })
                    }
                    className="capitare-input"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="capitare-input-label">
                    Token de Garantia
                  </label>
                  <input
                    type="text"
                    value={pjFormData.collateralToken}
                    onChange={(e) =>
                      setPjFormData({
                        ...pjFormData,
                        collateralToken: e.target.value,
                      })
                    }
                    className="capitare-input"
                  />
                </div>

                <div>
                  <label className="capitare-input-label">Endereço da PJ</label>
                  <input
                    type="text"
                    value={pjFormData.pjAddress}
                    onChange={(e) =>
                      setPjFormData({
                        ...pjFormData,
                        pjAddress: e.target.value,
                      })
                    }
                    className="capitare-input"
                  />
                </div>
              </div>

              <div>
                <label className="capitare-input-label">
                  Tokens de Colateral
                </label>
                <input
                  type="text"
                  value={pjFormData.collateralAmount}
                  onChange={(e) =>
                    setPjFormData({
                      ...pjFormData,
                      collateralAmount: e.target.value,
                    })
                  }
                  className="capitare-input"
                />
              </div>

              <button
                onClick={handlePjAnticipation}
                disabled={processing || isProcessing}
                className="capitare-btn w-full"
              >
                {processing || isProcessing
                  ? "Processando..."
                  : "Aprovar no Blockchain"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Step 5: Pagamento do Adquirente */}
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Pagamento do Adquirente</h2>

            <div className="space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-3">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Nota:</span> Esta operação usa a
                  wallet selecionada acima.
                </p>
              </div>

              <div>
                <label className="capitare-input-label">FIDC ID</label>
                <input
                  type="number"
                  value={fidcId}
                  onChange={(e) => {
                    const newFidcId = Number(e.target.value);
                    setFidcId(newFidcId);
                    loadScheduleAmount(newFidcId);
                  }}
                  className="capitare-input"
                  min="1"
                  placeholder="Digite o ID do FIDC"
                />
              </div>

              <div>
                <label className="capitare-input-label">
                  Amount (Stablecoin)
                </label>
                <input
                  type="text"
                  value={formData.amount}
                  readOnly
                  className="capitare-input bg-gray-50"
                  placeholder="Valor será preenchido automaticamente"
                />
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      O valor será automaticamente definido com base no valor da
                      emissão do FIDC
                    </p>
                    {scheduleAmount && (
                      <p className="text-sm text-blue-600 mt-1">
                        Valor da emissão: {scheduleAmount} Stablecoin
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleCompensationPay(fidcId, formData.amount)}
                disabled={
                  processing || isProcessing || !address || !scheduleAmount
                }
                className="capitare-btn w-full"
              >
                {processing || isProcessing
                  ? "Processing..."
                  : "Execute Compensation Pay"}
              </button>
            </div>
          </div>

          {/* Step 6: Redeem All Manager */}
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Manager Redeem</h2>

            <div className="space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-3">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Nota:</span> Esta operação usa a
                  wallet selecionada acima.
                </p>
              </div>

              <div>
                <label className="capitare-input-label">FIDC ID</label>
                <input
                  type="number"
                  value={fidcId}
                  onChange={(e) => setFidcId(Number(e.target.value))}
                  className="capitare-input"
                  min="1"
                  placeholder="FIDC ID"
                />
              </div>

              <div>
                <label className="capitare-input-label">
                  Add Investor Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRedeemAddress}
                    onChange={(e) => setNewRedeemAddress(e.target.value)}
                    placeholder="Endereço do investidor"
                    className="capitare-input flex-1"
                  />
                  <button
                    onClick={() => {
                      if (
                        !newRedeemAddress ||
                        !ethers.isAddress(newRedeemAddress)
                      ) {
                        addLog("Por favor insira um endereço válido");
                        return;
                      }
                      if (managerRedeemAddresses.includes(newRedeemAddress)) {
                        addLog("Este endereço já foi adicionado");
                        return;
                      }
                      setManagerRedeemAddresses([
                        ...managerRedeemAddresses,
                        newRedeemAddress,
                      ]);
                      setNewRedeemAddress("");
                      addLog(
                        `Endereço ${newRedeemAddress} adicionado à lista de resgate`
                      );
                    }}
                    className="capitare-btn"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {managerRedeemAddresses.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2 text-gray-700">
                    Addresses to Redeem
                  </h3>
                  <div className="max-h-48 overflow-y-auto border rounded">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-2 px-4 text-left text-xs font-medium text-gray-500">
                            Endereço
                          </th>
                          <th className="py-2 px-4 text-right text-xs font-medium text-gray-500">
                            Ação
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {managerRedeemAddresses.map((addr) => (
                          <tr key={addr} className="hover:bg-gray-50">
                            <td className="py-2 px-4 text-sm">
                              {addr.slice(0, 6)}...{addr.slice(-4)}
                            </td>
                            <td className="py-2 px-4 text-right">
                              <button
                                onClick={() => {
                                  setManagerRedeemAddresses(
                                    managerRedeemAddresses.filter(
                                      (a) => a !== addr
                                    )
                                  );
                                  addLog(
                                    `Endereço ${addr} removido da lista de resgate`
                                  );
                                }}
                                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handleManagerRedeemAll}
                  disabled={
                    processing ||
                    isProcessing ||
                    !address ||
                    managerRedeemAddresses.length === 0
                  }
                  className="capitare-btn flex-1"
                >
                  {processing || isProcessing
                    ? "Processing..."
                    : `Redeem All (${managerRedeemAddresses.length})`}
                </button>

                {managerRedeemAddresses.length > 0 && (
                  <button
                    onClick={() => {
                      setManagerRedeemAddresses([]);
                      addLog("Lista de endereços para resgate limpa");
                    }}
                    className="capitare-btn-outline"
                  >
                    Limpar Lista
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction and Logs Card */}
        <div className="capitare-card">
          <div className="capitare-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
          </div>
          <h2 className="capitare-card-title">Transaction Logs</h2>

          <div className="bg-gray-900 rounded-lg p-4 text-green-400 font-mono">
            <div className="h-[300px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500">
                  No logs yet. Start operations to see transaction logs.
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

          {/* Transaction Details */}
          {(transactionDetails || pjTransactionDetails) && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Transaction Details</h3>

              <div className="space-y-3">
                {/* Use the most recent transaction details */}
                {(pjTransactionDetails || transactionDetails)?.events.map(
                  (event, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-lg p-4 border border-gray-200"
                    >
                      <div className="text-sm font-medium text-blue-600 mb-2">
                        {event.description}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">From:</span>
                          <div className="font-mono break-all text-xs">
                            {event.from}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">To:</span>
                          <div className="font-mono break-all text-xs">
                            {event.to}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Amount:</span>
                          <div className="font-mono text-green-600">
                            {event.amount}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
