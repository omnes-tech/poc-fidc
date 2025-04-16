"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { ethers } from "ethers";
import Link from "next/link";

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
    approveEmissionValidator,
    approveEmissionPayable,
    approvedValidator,
    approvePayable,
    fundInvestorWallet,
    getContracts,
    initializeFIDC,
    invest,
    approveInvestor,
    getFIDCDetails,
    getAllInvestors,
    redeemAllManager,
    compensationPay,
    getFIDCScheduleAmount,
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

  // Adicionar novos estados no início do componente ManagerPage
  const [approvalInputs, setApprovalInputs] = useState({
    fidcId: 1,
    investorAddress: "",
    isSenior: true,
  });

  // Adicionar junto com os outros estados no início do componente
  const [managerRedeemAddresses, setManagerRedeemAddresses] = useState<
    string[]
  >([]);
  const [newRedeemAddress, setNewRedeemAddress] = useState<string>("");

  // Adicionar novo estado para armazenar o valor do schedule amount
  const [scheduleAmount, setScheduleAmount] = useState<string>("");

  useEffect(() => {
    if (useDemoAccount) {
      setAddress(DEMO_WALLET_ADDRESS);
      setIsConnected(true);
      addLog("Usando conta de demonstração: " + DEMO_WALLET_ADDRESS);
    } else {
      setAddress(walletAddress);
      setIsConnected(isWalletConnected);
    }
  }, [walletAddress, isWalletConnected, useDemoAccount]);

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

  // Função para fazer os approves e inicializar o FIDC
  const setupAndInitializeFIDC = async () => {
    if (!isConnected && !useDemoAccount) {
      addLog("Por favor conecte sua carteira primeiro");
      return;
    }

    setProcessing(true);
    addLog("Iniciando setup do FIDC...");

    try {
      // Determinar qual endereço usar baseado na seleção de conta
      const currentAddress = useDemoAccount
        ? DEMO_WALLET_ADDRESS
        : walletAddress;

      if (!currentAddress) {
        throw new Error("Endereço não disponível");
      }

      addLog(`Usando endereço: ${currentAddress}`);

      // 1. Primeiro aprovar o validator
      addLog(`Aprovando ${currentAddress} como validator...`);
      const validatorResult = await approvedValidator(
        currentAddress,
        useDemoAccount
      );

      if (!validatorResult.success) {
        throw new Error("Falha ao aprovar validator");
      }
      addLog("Validator aprovado com sucesso!");

      // 2. Aprovar o payable
      addLog(`Aprovando ${currentAddress} como payable...`);
      const payableResult = await approvePayable(
        currentAddress,
        useDemoAccount
      );

      if (!payableResult.success) {
        throw new Error("Falha ao aprovar payable");
      }
      addLog("Payable aprovado com sucesso!");

      // 3. Inicializar o FIDC
      const fidcConfig = {
        fee: 100, // 1%
        annualYield: 1800, // 18%
        gracePeriod: 86400, // 1 dia
        seniorSpread: 500, // 5%
      };

      addLog("Inicializando FIDC com os endereços aprovados...");
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
        useDemoAccount
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

  // Modificar o handleValidatorApproval para usar o novo fluxo
  const handleValidatorApproval = async () => {
    if (!isConnected && !useDemoAccount) {
      addLog("Por favor conecte sua carteira primeiro");
      return;
    }

    if (!formData.amount || isNaN(Number(formData.amount))) {
      addLog("Por favor insira um valor válido");
      return;
    }

    setProcessing(true);
    try {
      // Se o FIDC ainda não foi inicializado, fazer todo o setup
      let currentFidcId = fidcId;
      let validatorAddress;
      let payableAddress;

      if (!currentFidcId) {
        const setup = await setupAndInitializeFIDC();
        if (!setup) {
          throw new Error("Falha no setup do FIDC");
        }
        currentFidcId = setup.fidcId;
        validatorAddress = setup.validatorAddress;
        payableAddress = setup.payableAddress;
      }

      // Usar o endereço correto baseado na seleção de conta
      const validatorAddr = useDemoAccount
        ? DEMO_WALLET_ADDRESS
        : walletAddress;

      if (!validatorAddr) {
        throw new Error("Endereço do validator não disponível");
      }

      // Financiar a carteira do validator para as aprovações
      addLog(
        `Financiando carteira do validator ${validatorAddr} com tokens Stablecoin...`
      );
      await fundInvestorWallet(validatorAddr, formData.amount, useDemoAccount);
      addLog("Carteira do validator financiada com sucesso!");

      // Prosseguir com approveEmissionValidator usando o endereço do validator
      addLog(
        `Validator (${validatorAddr}) aprovando emissão do FIDC ID: ${currentFidcId}`
      );
      const result = await approveEmissionValidator(
        validatorAddr,
        currentFidcId,
        formData.amount,
        formData.amount,
        true,
        useDemoAccount
      );

      if (result.success) {
        addLog("Aprovação da emissão pelo validator concluída com sucesso!");
        // Passar o fidcId correto para o handlePayableApproval
        handlePayableApproval(currentFidcId, payableAddress!);
      } else {
        throw new Error("Falha na aprovação da emissão pelo validator");
      }
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

  const handlePayableApproval = async (
    currentFidcId: number,
    payableAddress: string
  ) => {
    if (!isConnected && !useDemoAccount) {
      addLog("Por favor conecte sua carteira primeiro");
      return;
    }

    setProcessing(true);
    addLog("Iniciando processo de aprovação do payable...");

    try {
      // Usar o endereço do payable definido no initializeFIDC
      const payableAddr = useDemoAccount ? DEMO_WALLET_ADDRESS : address;

      // Financiar a carteira do payable com tokens
      addLog(`Financiando carteira do payable (${payableAddr}) com tokens...`);
      await fundInvestorWallet(payableAddr!, formData.amount, useDemoAccount);
      addLog("Carteira do payable financiada com sucesso!");

      // Proceder com a aprovação da emissão usando o endereço do payable
      addLog(
        `Payable (${payableAddr}) aprovando emissão do FIDC ID: ${currentFidcId}`
      );
      addLog(`Amount: ${formData.amount} Stablecoin`);

      const result = await approveEmissionPayable(
        currentFidcId,
        formData.amount,
        true,
        useDemoAccount
      );

      if (result.success) {
        addLog("Aprovação da emissão pelo payable concluída com sucesso!");

        // Capturar os eventos de transfer da transação
        if (result.receipt) {
          const events = result.receipt.logs
            .filter(
              (log: any) =>
                log.topics[0] === ethers.id("Transfer(address,address,uint256)")
            )
            .map((log: any, index: number) => {
              return {
                type: "Transfer",
                from: `0x${log.topics[1].slice(-40)}`,
                to: `0x${log.topics[2].slice(-40)}`,
                amount: ethers.formatEther(log.data),
                description:
                  index === 0
                    ? "Transferência de pagamento do adiquiriente"
                    : "Queima dos recebiveis apos pagamento do adiquirente",
              };
            });

          setTransactionDetails({
            hash: result.receipt.hash,
            events: events,
          });
        }

        // Agora que o FIDC está ativo, podemos aprovar os investidores
        const currentAddress = useDemoAccount ? DEMO_WALLET_ADDRESS : address;

        try {
          // 1. Aprovar como investidor Senior
          addLog(
            `Aprovando ${currentAddress} como investidor Senior para FIDC ${currentFidcId}...`
          );
          const seniorApprovalResult = await approveInvestor(
            currentAddress!,
            0, // 0 = Senior
            currentFidcId,
            useDemoAccount
          );

          if (!seniorApprovalResult.success) {
            throw new Error("Falha ao aprovar investidor Senior");
          }
          addLog("Aprovação como investidor Senior concluída com sucesso!");

          // 2. Aprovar como investidor Subordinado
          addLog(
            `Aprovando ${currentAddress} como investidor Subordinado para FIDC ${currentFidcId}...`
          );
          const subordinatedApprovalResult = await approveInvestor(
            currentAddress!,
            1, // 1 = Subordinado
            currentFidcId,
            useDemoAccount
          );

          if (!subordinatedApprovalResult.success) {
            throw new Error("Falha ao aprovar investidor Subordinado");
          }
          addLog(
            "Aprovação como investidor Subordinado concluída com sucesso!"
          );

          addLog(
            `Endereço ${currentAddress} aprovado como investidor Senior e Subordinado para FIDC ${currentFidcId}`
          );
        } catch (error) {
          addLog(
            `Erro durante aprovação dos investidores: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } else {
        addLog(
          "Falha na aprovação da emissão pelo payable. Verifique o console para detalhes."
        );
      }
    } catch (error) {
      addLog(
        `Erro durante aprovação do payable: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setProcessing(false);
    }
  };

  // Função auxiliar para obter a descrição correta de cada evento
  const getEventDescription = (index: number, fidcId: number) => {
    switch (index) {
      case 0:
        return "Envio de StableCoins ao Vault do fundo para distribuição de antecipações para PJs";
      case 1:
        return `Emissão de recebíveis (FIDC ${fidcId}) relacionada a quantidade solicitada de antecipação`;
      case 2:
        return "Quantidade de StableCoin enviada para o vault do FIDC";
      case 3:
        return "Quantidade de StableCoin enviada para a PJ que solicitou a antecipação";
      default:
        return "Transferência";
    }
  };

  // Adicionar componente para exibir os detalhes da transação
  const TransactionDetailsCard = () => {
    if (!transactionDetails) return null;

    return (
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Detalhes da Transação</h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500">
              Hash da Transação
            </h4>
            <div className="flex items-center space-x-2">
              <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono break-all">
                {transactionDetails.hash}
              </code>
              <a
                href={`https://holesky.etherscan.io/tx/${transactionDetails.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">
              Eventos de Transferência
            </h4>
            <div className="space-y-3">
              {transactionDetails.events.map((event, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                      {event.description}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">De:</span>
                        <div className="font-mono break-all">{event.from}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Para:</span>
                        <div className="font-mono break-all">{event.to}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Quantidade:</span>
                        <div className="font-mono text-green-600 dark:text-green-400">
                          {event.amount}{" "}
                          {index === 1
                            ? `Recebível FIDC ${fidcId}`
                            : "StableCoin"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Função auxiliar para obter o status do FIDC em string
  const getStatusString = (status: number): string => {
    const statuses = ["Pendente", "Ativo", "Parado", "Liquidado"];
    return statuses[status] || "Desconhecido";
  };

  // Modificar a função handleInvestment para receber o FIDC ID
  const handleInvestment = async (investmentFidcId: number) => {
    if (!isConnected && !useDemoAccount) {
      addLog("Por favor conecte sua carteira primeiro");
      return;
    }

    if (!investmentInputs.amount || isNaN(Number(investmentInputs.amount))) {
      addLog("Por favor insira um valor válido");
      return;
    }

    if (!fidcDetails) {
      addLog("Detalhes do FIDC não disponíveis");
      return;
    }

    setProcessing(true);
    const currentAddress = useDemoAccount ? DEMO_WALLET_ADDRESS : address;

    try {
      // Primeiro, aprovar o tipo de investidor (senior ou subordinado)
      const investorType = investmentInputs.isSenior ? 0 : 1;
      addLog(
        `Aprovando endereço como investidor ${
          investmentInputs.isSenior ? "Senior" : "Subordinado"
        } para o FIDC ${investmentFidcId}...`
      );

      const approvalResult = await approveInvestor(
        currentAddress!,
        investorType,
        investmentFidcId,
        useDemoAccount
      );

      if (!approvalResult.success) {
        throw new Error("Falha ao aprovar tipo de investidor");
      }
      addLog("Aprovação de tipo de investidor concluída com sucesso!");

      // Financiar a carteira com tokens para o investimento
      addLog("Financiando carteira com Stablecoin para o investimento...");
      await fundInvestorWallet(
        currentAddress!,
        (Number(investmentInputs.amount) * 1.1).toString(),
        useDemoAccount
      );
      addLog("Carteira financiada com sucesso!");

      // Realizar o investimento
      addLog(
        `Iniciando investimento de ${investmentInputs.amount} Stablecoin no FIDC ${investmentFidcId}...`
      );
      const investResult = await invest(
        investmentFidcId,
        investmentInputs.amount,
        useDemoAccount
      );

      if (investResult.success) {
        addLog(`Investimento realizado com sucesso!`);
        // Atualizar detalhes do FIDC após o investimento
        await loadInvestmentFIDCDetails(investmentFidcId);
      } else {
        throw new Error("Falha ao realizar investimento");
      }
    } catch (error) {
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
      const details = await getFIDCDetails(newFidcId, useDemoAccount);

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
    if (!isConnected && !useDemoAccount) {
      addLog("Conta não conectada. Não é possível carregar detalhes do FIDC.");
      return;
    }

    try {
      addLog(`Carregando detalhes do FIDC ${fidcId}...`);
      const details = await getFIDCDetails(fidcId, useDemoAccount);

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
    }
  };

  // Adicionar função para carregar os investidores
  const loadInvestors = async (fidcId: number) => {
    setLoadingInvestors(true);
    try {
      addLog(`Consultando investidores do FIDC ${fidcId}...`);
      const data = await getAllInvestors(fidcId, useDemoAccount);

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

  // Adicionar nova função para lidar com a aprovação de investidores
  const handleInvestorApproval = async () => {
    if (!isConnected && !useDemoAccount) {
      addLog("Por favor conecte sua carteira primeiro");
      return;
    }

    setProcessing(true);
    try {
      // Primeiro, verificar se o endereço atual é o manager do FIDC
      const fidcDetails = await getFIDCDetails(
        approvalInputs.fidcId,
        useDemoAccount
      );
      const currentAddress = useDemoAccount ? DEMO_WALLET_ADDRESS : address;

      if (!fidcDetails) {
        throw new Error("Não foi possível obter os detalhes do FIDC");
      }

      if (fidcDetails.manager.toLowerCase() !== currentAddress?.toLowerCase()) {
        addLog(
          `Erro: Apenas o manager do FIDC (${fidcDetails.manager}) pode aprovar investidores`
        );
        return;
      }

      // Se chegou aqui, o endereço atual é o manager
      addLog(
        `Aprovando ${approvalInputs.investorAddress} como investidor ${
          approvalInputs.isSenior ? "Senior" : "Subordinado"
        } para FIDC ${approvalInputs.fidcId}...`
      );

      const result = await approveInvestor(
        approvalInputs.investorAddress,
        approvalInputs.isSenior ? 0 : 1,
        approvalInputs.fidcId,
        useDemoAccount
      );

      if (result.success) {
        addLog("Investidor aprovado com sucesso!");
        // Atualizar a lista de investidores após a aprovação
        await loadInvestors(approvalInputs.fidcId);
      } else {
        throw new Error("Falha ao aprovar investidor");
      }
    } catch (error) {
      addLog(
        `Erro durante a aprovação do investidor: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setProcessing(false);
    }
  };

  // Adicionar junto com as outras funções de manipulação
  const handleManagerRedeemAll = async () => {
    if (!isConnected && !useDemoAccount) {
      addLog("Por favor conecte sua carteira primeiro");
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
      // Verificar se é o manager usando a conta de demonstração ou a carteira conectada
      const details = await getFIDCDetails(fidcId, useDemoAccount);
      const currentAddress = useDemoAccount ? DEMO_WALLET_ADDRESS : address;

      if (details.manager.toLowerCase() !== currentAddress?.toLowerCase()) {
        const message = useDemoAccount
          ? "Conta de demonstração não é o manager deste FIDC"
          : "Você não é o manager deste FIDC";
        throw new Error(message);
      }

      addLog(
        `Executando resgate para ${managerRedeemAddresses.length} investidores...`
      );
      const result = await redeemAllManager(
        fidcId,
        managerRedeemAddresses,
        useDemoAccount
      );

      if (result.success) {
        addLog(`Resgate manager concluído com sucesso!`);
        setManagerRedeemAddresses([]); // Limpa a lista após sucesso
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
      const amount = await getFIDCScheduleAmount(fidcId, useDemoAccount);
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
    if (!isConnected && !useDemoAccount) {
      addLog("Por favor conecte sua carteira primeiro");
      return;
    }

    setProcessing(true);
    try {
      // Primeiro, vamos verificar se o valor corresponde ao fidcScheduleAmount
      const scheduleAmount = await getFIDCScheduleAmount(
        fidcId,
        useDemoAccount
      );

      if (amount !== scheduleAmount) {
        addLog(
          `Erro: O valor deve ser exatamente ${scheduleAmount} Stablecoin`
        );
        return;
      }

      // Financiar a carteira com tokens para o pagamento
      addLog("Financiando carteira com Stablecoin para o pagamento...");
      const currentAddress = useDemoAccount ? DEMO_WALLET_ADDRESS : address;
      await fundInvestorWallet(currentAddress!, amount, useDemoAccount);
      addLog("Carteira financiada com sucesso!");

      // Executar o compensationPay
      addLog(
        `Iniciando compensationPay de ${amount} Stablecoin para FIDC ${fidcId}...`
      );
      const result = await compensationPay(fidcId, amount, useDemoAccount);

      if (result.success) {
        addLog("Pagamento do adiquiriente realizado com sucesso!");

        // Se houver receipt com eventos, podemos processá-los
        if (result.receipt) {
          const events = result.receipt.logs
            .filter(
              (log: any) =>
                log.topics[0] === ethers.id("Transfer(address,address,uint256)")
            )
            .map((log: any, index: number) => {
              return {
                type: "Transfer",
                from: `0x${log.topics[1].slice(-40)}`,
                to: `0x${log.topics[2].slice(-40)}`,
                amount: ethers.formatEther(log.data),
                description:
                  index === 0
                    ? "Transferência de pagamento do adiquiriente"
                    : "Queima dos recebiveis apos pagamento do adiquirente",
              };
            });

          setTransactionDetails({
            hash: result.receipt.hash,
            events: events,
          });
        }
      } else {
        throw new Error("Falha no pagamento do adiquiriente");
      }
    } catch (error) {
      addLog(
        `Erro durante o pagamento do adiquiriente: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setProcessing(false);
    }
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

      <h1 className="text-3xl font-bold mb-6">FIDC Manager Portal</h1>

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
              ({DEMO_WALLET_ADDRESS.slice(0, 6)}...
              {DEMO_WALLET_ADDRESS.slice(-4)})
            </span>
          )}
        </div>

        {!useDemoAccount && <ConnectButton />}
      </div>

      {/* Adicionar seção de status do FIDC */}
      {fidcInitialized && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-700">FIDC Ativo</h3>
          <p className="text-sm text-green-600">ID: {fidcId}</p>
          <p className="text-sm text-green-600">
            Manager/Validator/Payable:{" "}
            {useDemoAccount ? DEMO_WALLET_ADDRESS : address}
          </p>
        </div>
      )}

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
          <h2 className="text-xl font-semibold mb-4">
            Validator and Payable Approval
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Amount (Stablecoin)
              </label>
              <input
                type="text"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="w-full p-2 border rounded"
                placeholder="1000"
              />
            </div>

            <button
              onClick={handleValidatorApproval}
              disabled={
                processing || isProcessing || (!isConnected && !useDemoAccount)
              }
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {processing || isProcessing
                ? "Processing..."
                : fidcInitialized
                ? "Start Approval Process"
                : "Initialize FIDC and Start Approval"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-black rounded-lg shadow p-4 text-green-400 font-mono">
            <h2 className="text-xl font-semibold mb-2 text-white">
              Transaction Logs
            </h2>
            <div className="h-[400px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500">
                  No logs yet. Start the approval process to see transaction
                  logs.
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

          {/* Adicionar o componente de detalhes da transação */}
          <TransactionDetailsCard />
        </div>
      </div>

      {/* Adicionar seção de investimento no JSX, após a seção de Validator and Payable Approval: */}
      {fidcInitialized && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Realizar Investimento no FIDC
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">FIDC ID</label>
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
                className="w-full p-2 border rounded"
                min="1"
                placeholder="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
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
                className="w-full p-2 border rounded"
                placeholder="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
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
                    className="form-radio"
                  />
                  <span className="ml-2">Senior</span>
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
                    className="form-radio"
                  />
                  <span className="ml-2">Subordinado</span>
                </label>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
              <h3 className="text-sm font-medium mb-2">Detalhes do FIDC</h3>
              <div className="space-y-2 text-sm">
                {fidcDetails ? (
                  <>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-medium">
                        {getStatusString(fidcDetails.status)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rendimento Base:</span>
                      <span className="font-medium">
                        {(fidcDetails.annualYield / 100).toFixed(2)}%
                      </span>
                    </div>
                    {investmentInputs.isSenior && (
                      <div className="flex justify-between">
                        <span>Spread Senior:</span>
                        <span className="font-medium">
                          {(fidcDetails.seniorSpread / 100).toFixed(2)}%
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Taxa de Gestão:</span>
                      <span className="font-medium">
                        {(fidcDetails.fee / 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Investido:</span>
                      <span className="font-medium">
                        {fidcDetails.invested} Stablecoin
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Manager:</span>
                      <span className="font-medium text-xs">
                        {`${fidcDetails.manager.slice(
                          0,
                          6
                        )}...${fidcDetails.manager.slice(-4)}`}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2 text-gray-500">
                    Carregando detalhes do FIDC...
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() =>
                handleInvestment(investmentInputs.investmentFidcId)
              }
              disabled={
                processing ||
                isProcessing ||
                (!isConnected && !useDemoAccount) ||
                !fidcDetails
              }
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {processing || isProcessing
                ? "Processando..."
                : "Realizar Investimento"}
            </button>
          </div>
        </div>
      )}

      {/* Seção de Consulta de Investidores */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Consulta de Investidores
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">FIDC ID</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={queryFidcId}
                  onChange={(e) => setQueryFidcId(Number(e.target.value))}
                  className="flex-1 p-2 border rounded"
                  min="1"
                  placeholder="Digite o ID do FIDC"
                />
                <button
                  onClick={() => loadInvestors(queryFidcId)}
                  disabled={loadingInvestors}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loadingInvestors ? "Carregando..." : "Consultar"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Investidores do FIDC {queryFidcId}
          </h2>

          {loadingInvestors ? (
            <div className="text-center py-4">
              <p className="text-gray-500">
                Carregando dados dos investidores...
              </p>
            </div>
          ) : investorsData && investorsData.investors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
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
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {investorsData.investors.map((investor, index) => (
                    <tr
                      key={investor}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
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
                        {Number(investorsData.amounts[index]).toLocaleString()}{" "}
                        Stablecoin
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <td className="px-4 py-2 text-sm font-medium">Total</td>
                    <td className="px-4 py-2 text-sm"></td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {investorsData.amounts
                        .reduce((acc, curr) => acc + Number(curr), 0)
                        .toLocaleString()}{" "}
                      Stablecoin
                    </td>
                  </tr>
                </tfoot>
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

      {/* Seção de Aprovação de Investidores */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Aprovação de Investidores
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">FIDC ID</label>
              <input
                type="number"
                value={approvalInputs.fidcId}
                onChange={(e) =>
                  setApprovalInputs({
                    ...approvalInputs,
                    fidcId: Number(e.target.value),
                  })
                }
                className="w-full p-2 border rounded"
                min="1"
                placeholder="Digite o ID do FIDC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Endereço do Investidor
              </label>
              <input
                type="text"
                value={approvalInputs.investorAddress}
                onChange={(e) =>
                  setApprovalInputs({
                    ...approvalInputs,
                    investorAddress: e.target.value,
                  })
                }
                className="w-full p-2 border rounded"
                placeholder="0x..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tipo de Investidor
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={approvalInputs.isSenior}
                    onChange={() =>
                      setApprovalInputs({
                        ...approvalInputs,
                        isSenior: true,
                      })
                    }
                    className="form-radio"
                  />
                  <span className="ml-2">Senior</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={!approvalInputs.isSenior}
                    onChange={() =>
                      setApprovalInputs({
                        ...approvalInputs,
                        isSenior: false,
                      })
                    }
                    className="form-radio"
                  />
                  <span className="ml-2">Subordinado</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleInvestorApproval}
              disabled={
                processing ||
                isProcessing ||
                (!isConnected && !useDemoAccount) ||
                !approvalInputs.investorAddress ||
                !ethers.isAddress(approvalInputs.investorAddress)
              }
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {processing || isProcessing
                ? "Processando..."
                : "Aprovar Investidor"}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Instruções</h2>
          <div className="space-y-2 text-sm">
            <p>• Apenas o manager do FIDC pode aprovar novos investidores</p>
            <p>
              • O endereço do investidor deve ser um endereço Ethereum válido
            </p>
            <p>• A aprovação é específica para cada FIDC ID</p>
            <p>• Você pode verificar os investidores na seção de consulta</p>
          </div>
        </div>
      </div>

      {/* Nova seção de Resgate Manager */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Manager Redeem Multiple Addresses
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">FIDC ID</label>
            <input
              type="number"
              value={fidcId}
              onChange={(e) => setFidcId(Number(e.target.value))}
              className="w-full p-2 border rounded"
              min="1"
              placeholder="FIDC ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Add Investor Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRedeemAddress}
                onChange={(e) => setNewRedeemAddress(e.target.value)}
                placeholder="Endereço do investidor"
                className="flex-1 p-2 border rounded"
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
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {managerRedeemAddresses.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Addresses to Redeem</h3>
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
                              managerRedeemAddresses.filter((a) => a !== addr)
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

        <div className="flex items-center gap-4">
          <button
            onClick={handleManagerRedeemAll}
            disabled={
              processing ||
              isProcessing ||
              !isConnected ||
              managerRedeemAddresses.length === 0
            }
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
          >
            {processing || isProcessing
              ? "Processing..."
              : `Redeem All Manager (${managerRedeemAddresses.length} endereços)`}
          </button>

          {managerRedeemAddresses.length > 0 && (
            <button
              onClick={() => {
                setManagerRedeemAddresses([]);
                addLog("Lista de endereços para resgate limpa");
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Limpar Lista
            </button>
          )}
        </div>
      </div>

      {/* Nova seção de Compensation Pay */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Pagamento do Adiquiriente
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">FIDC ID</label>
            <input
              type="number"
              value={fidcId}
              onChange={(e) => {
                const newFidcId = Number(e.target.value);
                setFidcId(newFidcId);
                loadScheduleAmount(newFidcId); // Carrega o valor automaticamente
              }}
              className="w-full p-2 border rounded"
              min="1"
              placeholder="Digite o ID do FIDC"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Amount (Stablecoin)
            </label>
            <input
              type="text"
              value={formData.amount}
              readOnly // Torna o campo somente leitura
              className="w-full p-2 border rounded bg-gray-50"
              placeholder="Valor será preenchido automaticamente"
            />
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
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
              processing ||
              isProcessing ||
              (!isConnected && !useDemoAccount) ||
              !scheduleAmount // Desabilita se não tiver o valor carregado
            }
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
          >
            {processing || isProcessing
              ? "Processing..."
              : "Execute Compensation Pay"}
          </button>

          <div className="mt-4 text-sm text-gray-600">
            <h3 className="font-medium mb-2">Instruções:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                O valor será automaticamente definido com base na emissão do
                FIDC
              </li>
              <li>
                Será necessário aprovar o uso do token Stablecoin primeiro
              </li>
              <li>A transação será executada após a aprovação do token</li>
              <li>Os eventos da transação serão exibidos após a conclusão</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
