"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { ethers } from "ethers";

const BPS_DENOMINATOR = 10000;

export default function FIDCDemoPage() {
  const { address, isConnected } = useAccount();
  const {
    isProcessing,
    txHash,
    error,
    initializeFIDC,
    approveEmissionValidator,
    approveEmissionPayable,
    approveInvestor,
    approveManager,
    approvedValidator, 
    approvePayable,    
    invest,
    redeem,
    getFIDCDetails,
    getInvestorPosition,
    stopFIDC,
    fundInvestorWallet,
    getContracts,
  } = useContractInteraction();

  const [currentStep, setCurrentStep] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [fidcId, setFidcId] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [seniorInvestmentId, setSeniorInvestmentId] = useState<number>(0);
  const [subInvestmentId, setSubInvestmentId] = useState<number>(0);
  const [walletBalances, setWalletBalances] = useState<{
    [address: string]: string;
  }>({});
  const [mintAmount, setMintAmount] = useState<string>("1000");

  const [formData, setFormData] = useState({
    annualYield: 18000,
    seniorSpread: 500,
    fee: 100,
    gracePeriod: 86400,
    collateralAmount: 100000,
    seniorInvestAmount: 10000,
    subInvestAmount: 6000,
    simulatedDays: 180,
    managerAddress: "",
    validatorAddress: "",
    payableAddress: "",
    seniorInvestorAddress: "",
    subInvestorAddress: "",
  });

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
    if (address) {
      setFormData((prev) => ({
        ...prev,
        managerAddress: address,
        validatorAddress: address,
        payableAddress: address,
        seniorInvestorAddress: address,
        subInvestorAddress: address,
      }));
    }
  }, [address]);

  // Função para atualizar os saldos  de todas as carteiras relevantes
  const updateStablecoinBalances = useCallback(async () => {
    if (!isConnected) return;

    try {
      const { drexContract } = await getContracts();

      const addresses = [
        address!,
        formData.validatorAddress,
        formData.payableAddress,
        formData.seniorInvestorAddress,
        formData.subInvestorAddress,
      ].filter(
        (addr, index, self) =>
          addr && ethers.isAddress(addr) && self.indexOf(addr) === index
      );

      const balances: { [address: string]: string } = {};

      for (const addr of addresses) {
        try {
          const balance = await drexContract.balanceOf(addr);
          balances[addr.toLowerCase()] = ethers.formatEther(balance);
        } catch (err) {
          console.error(`Erro ao buscar saldo de ${addr}:`, err);
          balances[addr.toLowerCase()] = "Erro";
        }
      }

      setWalletBalances(balances);
    } catch (err) {
      console.error("Erro ao atualizar saldos:", err);
    }
  }, [
    address,
    formData.validatorAddress,
    formData.payableAddress,
    formData.seniorInvestorAddress,
    formData.subInvestorAddress,
    isConnected,
    getContracts,
  ]);

  // Atualizar saldos quando endereços mudarem ou após transações
  useEffect(() => {
    updateStablecoinBalances();
  }, [
    address,
    formData.validatorAddress,
    formData.payableAddress,
    formData.seniorInvestorAddress,
    formData.subInvestorAddress,
    updateStablecoinBalances,
  ]);

  useEffect(() => {
    if (!isProcessing && txHash) {
      // Atualizar saldos após conclusão de uma transação
      updateStablecoinBalances();
    }
  }, [isProcessing, txHash, updateStablecoinBalances]);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: Number(value),
    });
  };

  const steps = [
    {
      title: "Configure Roles",
      description: "Define wallet addresses for each role in the FIDC",
      action: async () => {
        if (!isConnected) {
          addLog("Please connect your wallet first");
          return;
        }

        // Verificar se os endereços são válidos
        if (!ethers.isAddress(formData.validatorAddress)) {
          addLog("Invalid validator address. Please check the format.");
          return;
        }

        if (!ethers.isAddress(formData.payableAddress)) {
          addLog("Invalid payable company address. Please check the format.");
          return;
        }

        if (!ethers.isAddress(formData.seniorInvestorAddress)) {
          addLog("Invalid senior investor address. Please check the format.");
          return;
        }

        if (!ethers.isAddress(formData.subInvestorAddress)) {
          addLog(
            "Invalid subordinated investor address. Please check the format."
          );
          return;
        }

        // Verificar se os endereços são diferentes
        const addresses = [
          address,
          formData.validatorAddress,
          formData.payableAddress,
          formData.seniorInvestorAddress,
          formData.subInvestorAddress,
        ];

        const filteredAddresses = addresses
          .filter((addr) => addr !== undefined && addr !== "")
          .map((addr) => addr!.toLowerCase());
        const uniqueCount = new Set(filteredAddresses).size;
        if (uniqueCount < 3) {
          addLog(
            "Warning: Some roles are using the same address. In production, it's recommended to use different addresses."
          );
        }

        setProcessing(true);
        addLog("Configuring roles for the FIDC...");

        try {
          // Obter o endereço da demo wallet
          const { signer: demoSigner } = await getContracts(true);
          const demoWalletAddress = demoSigner.address;
          
          // Verificar se o endereço do manager que estamos aprovando é a demo wallet
          const isManagerDemoWallet = formData.managerAddress.toLowerCase() === demoWalletAddress.toLowerCase();
      
          // SEMPRE aprovar o manager usando a demo wallet
          addLog(`Approving manager role: ${formData.managerAddress} using demo wallet`);
          const managerResult = await approveManager(formData.managerAddress, true); // Forçar uso da demo wallet
      
          if (managerResult.success) {
              addLog("Manager role approved successfully using demo wallet");
              
              // Se o endereço do manager aprovado for a demo wallet, usar a demo wallet para as próximas aprovações
              addLog(`Approving validator role: ${formData.validatorAddress}`);
              const validatorResult = await approvedValidator(
                  formData.validatorAddress,
                  isManagerDemoWallet // Usar demo wallet apenas se o endereço do manager for a demo wallet
              );
              
              if (validatorResult.success) {
                  addLog(`Validator approved successfully ${isManagerDemoWallet ? 'using demo wallet' : 'using connected wallet'}`);
                  
                  // Aprovar payable usando a mesma lógica
                  addLog(`Approving payable role: ${formData.payableAddress}`);
                  const payableResult = await approvePayable(
                      formData.payableAddress,
                      isManagerDemoWallet // Usar demo wallet apenas se o endereço do manager for a demo wallet
                  );
                  
                  if (payableResult.success) {
                      addLog(`Payable approved successfully ${isManagerDemoWallet ? 'using demo wallet' : 'using connected wallet'}`);
                  } else {
                      addLog("Failed to approve payable role");
                      return;
                  }
              } else {
                  addLog("Failed to approve validator role");
                  return;
              }
          } else {
              addLog("Failed to approve manager role. Check console for details.");
              return;
          }
      
          addLog("All roles configured successfully");
          addLog(`Manager: ${formData.managerAddress}`);
          addLog(`Validator: ${formData.validatorAddress}`);
          addLog(`Payable: ${formData.payableAddress}`);
      
          updateStablecoinBalances();
          setCurrentStep(1);
      } catch (error) {
          addLog(`Error configuring roles: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
          setProcessing(false);
      }
      },
    },
    {
      title: "Initialize FIDC",
      description:
        "Create a new FIDC with yield, fee, and grace period settings",
      action: async () => {
        if (!isConnected) {
          addLog("Please connect your wallet first");
          return;
        }

        if (!ethers.isAddress(formData.validatorAddress)) {
          addLog("Invalid validator address. Please check the format.");
          return;
        }

        if (!ethers.isAddress(formData.payableAddress)) {
          addLog("Invalid payable company address. Please check the format.");
          return;
        }

        setProcessing(true);
        addLog("Initializing FIDC...");

        try {
          // Obter o endereço da demo wallet
          const { signer: demoSigner } = await getContracts(true);
          const demoWalletAddress = demoSigner.address;
          
          // Verificar se o endereço do manager é a demo wallet
          const isManagerDemoWallet = formData.managerAddress.toLowerCase() === demoWalletAddress.toLowerCase();
      
          // Decidir qual carteira usar para inicializar o FIDC
          const useDemoForInit = isManagerDemoWallet; // Usar demo wallet apenas se o manager for a demo wallet
          
          addLog(`Initializing FIDC ${useDemoForInit ? 'using demo wallet' : 'using connected wallet'}...`);
          addLog(`Setting up FIDC with annual yield: ${
              formData.annualYield / 100
          }%, 
                  senior spread: ${formData.seniorSpread / 100}%, 
                  fee: ${formData.fee / 100}%, 
                  grace period: ${formData.gracePeriod / (24 * 60 * 60)} days`);
      
          const result = await initializeFIDC(
              formData.managerAddress,
              formData.validatorAddress,
              formData.payableAddress,
              formData.fee,
              formData.annualYield,
              formData.gracePeriod,
              formData.seniorSpread,
              useDemoForInit // Passar o parâmetro useDemoWallet
          );
      
          if (result.success && result.fidcId) {
              setFidcId(result.fidcId);
              addLog(`FIDC initialized with ID: ${result.fidcId} ${useDemoForInit ? 'using demo wallet' : 'using connected wallet'}`);
              setCurrentStep(2);
          } else {
              addLog("Failed to initialize FIDC. Check console for details.");
          }
      } catch (error) {
          addLog(`Error initializing FIDC: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
          setProcessing(false);
      }
      },
    },
    {
      title: "Validator Approves Emission",
      description: "Validator reviews and approves the FIDC emission",
      action: async () => {
        if (!isConnected || !fidcId) {
          addLog("Please connect your wallet and initialize FIDC first");
          return;
        }

        const { ethers } = await import("ethers");
        if (
          address?.toLowerCase() !== formData.validatorAddress.toLowerCase()
        ) {
          addLog(
            `Warning: You should be connected with the validator wallet (${formData.validatorAddress}) to perform this action.`
          );
        }

        setProcessing(true);
        addLog("Validator approving emission...");

        try {
          addLog(`Validator approving FIDC ID: ${fidcId}`);
          addLog(`Schedule amount: ${formData.collateralAmount} Stablecoin`);
          addLog(`Collateral amount: ${formData.collateralAmount} Stablecoin`);

          const result = await approveEmissionValidator(
            formData.payableAddress,
            fidcId,
            formData.collateralAmount.toString(),
            formData.collateralAmount.toString(),
            true
          );

          if (result.success) {
            addLog("Emission validated successfully");
            setCurrentStep(3);
          } else {
            addLog("Failed to validate emission. Check console for details.");
          }
        } catch (error) {
          addLog(
            `Error during validator approval: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } finally {
          setProcessing(false);
        }
      },
    },
    {
      title: "Payable Approves Emission",
      description: "Payable company confirms emission and transfers collateral",
      action: async () => {
        if (!isConnected || !fidcId) {
          addLog(
            "Please connect your wallet and complete previous steps first"
          );
          return;
        }

        const { ethers } = await import("ethers");
        if (address?.toLowerCase() !== formData.payableAddress.toLowerCase()) {
          addLog(
            `Warning: You should be connected with the payable company wallet (${formData.payableAddress}) to perform this action.`
          );
        }

        setProcessing(true);
        addLog("Payable approving emission...");

        try {
          addLog(`Payable approving FIDC ID: ${fidcId}`);
          addLog(
            `Transferring collateral: ${formData.collateralAmount} Stablecoin`
          );

          const result = await approveEmissionPayable(
            fidcId,
            formData.collateralAmount.toString(),
            true
          );

          if (result.success) {
            addLog("Collateral transferred successfully");

            try {
              const fidcDetails = await getFIDCDetails(fidcId);
              addLog(`FIDC Status: ${getStatusString(fidcDetails.status)}`);
            } catch (err) {
              console.error(
                "Error getting FIDC status:",
                err instanceof Error ? err.message : String(err)
              );
            }

            setCurrentStep(4);
          } else {
            addLog("Failed to approve emission. Check console for details.");
          }
        } catch (error) {
          addLog(
            `Error during payable approval: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } finally {
          setProcessing(false);
        }
      },
    },
    {
      title: "Approve Investors",
      description: "Manager approves senior and subordinated investors",
      action: async () => {
        if (!isConnected || !fidcId) {
          addLog(
            "Please connect your wallet and complete previous steps first"
          );
          return;
        }

        const { ethers } = await import("ethers");
        if (!ethers.isAddress(formData.seniorInvestorAddress)) {
          addLog("Invalid senior investor address. Please check the format.");
          return;
        }

        if (!ethers.isAddress(formData.subInvestorAddress)) {
          addLog(
            "Invalid subordinated investor address. Please check the format."
          );
          return;
        }

        const fidcDetails = await getFIDCDetails(fidcId);
        if (address?.toLowerCase() !== fidcDetails.manager.toLowerCase()) {
          addLog(
            `Warning: You should be connected with the manager wallet (${fidcDetails.manager}) to approve investors.`
          );
          // We don't block, just warn in demo mode
        }

        setProcessing(true);
        addLog("Approving investors...");

        try {
          // Obter detalhes do FIDC e o endereço da demo wallet
          const demoWalletAddress = "0xF64749A9D8e4e4F33c9343e63797D57B80FBefd0";
          const fidcDetails = await getFIDCDetails(fidcId);
          
          // Verificar se o manager aprovado é a demo wallet
          const isManagerDemoWallet = fidcDetails.manager.toLowerCase() === demoWalletAddress.toLowerCase();
      
          if (isManagerDemoWallet) {
              addLog("Manager is demo wallet - using demo wallet for investor approvals");
          } else {
              addLog("Manager is connected wallet - using connected wallet for investor approvals");
          }
      
          // Aprovar investidor senior principal
          addLog(`Approving senior investor: ${formData.seniorInvestorAddress}`);
          const seniorResult = await approveInvestor(
              formData.seniorInvestorAddress,
              0,
              fidcId,
              isManagerDemoWallet // Usar demo wallet se o endereço do manager for a demo wallet
          );
      
          if (seniorResult.success) {
              addLog(`Senior investor approved successfully ${isManagerDemoWallet ? 'using demo wallet' : 'using connected wallet'}`);
          }
      
          // Aprovar demo wallet como investidor senior
          addLog(`Approving demo wallet as senior investor: ${demoWalletAddress}`);
          const demoSeniorResult = await approveInvestor(
              demoWalletAddress,
              0,
              fidcId,
              isManagerDemoWallet // Usar demo wallet se o endereço do manager for a demo wallet
          );
      
          if (demoSeniorResult.success) {
              addLog(`Demo wallet approved as senior investor successfully ${isManagerDemoWallet ? 'using demo wallet' : 'using connected wallet'}`);
          }
      
          // Aprovar investidor subordinado principal
          addLog(`Approving subordinated investor: ${formData.subInvestorAddress}`);
          const subResult = await approveInvestor(
              formData.subInvestorAddress,
              1,
              fidcId,
              isManagerDemoWallet // Usar demo wallet se o endereço do manager for a demo wallet
          );
      
          if (subResult.success) {
              addLog(`Subordinated investor approved successfully ${isManagerDemoWallet ? 'using demo wallet' : 'using connected wallet'}`);
          }
      
          // Aprovar demo wallet como investidor subordinado
          addLog(`Approving demo wallet as subordinated investor: ${demoWalletAddress}`);
          const demoSubResult = await approveInvestor(
              demoWalletAddress,
              1,
              fidcId,
              isManagerDemoWallet // Usar demo wallet se o endereço do manager for a demo wallet
          );
      
          if (demoSubResult.success) {
              addLog(`Demo wallet approved as subordinated investor successfully ${isManagerDemoWallet ? 'using demo wallet' : 'using connected wallet'}`);
          }
      
          // Financiar as carteiras dos investidores com DREX
          addLog("Funding investor wallets with tokens...");
      
          // Financiar carteira do investidor sênior
          const seniorFundingAmount = (formData.seniorInvestAmount * 1.1).toString();
          await fundInvestorWallet(formData.seniorInvestorAddress, seniorFundingAmount);
      
          // Financiar carteira do investidor subordinado
          const subFundingAmount = (formData.subInvestAmount * 1.1).toString();
          await fundInvestorWallet(formData.subInvestorAddress, subFundingAmount);
      
          // Também financiar a carteira demo
          addLog("Funding demo wallet with tokens...");
          await fundInvestorWallet(demoWalletAddress, (formData.seniorInvestAmount * 1.1).toString());
      
          if (seniorResult.success && subResult.success && demoSeniorResult.success && demoSubResult.success) {
              setCurrentStep(5);
              addLog("All investors approved and funded successfully!");
          } else {
              addLog("Failed to approve one or more investors. Check console for details.");
          }
      } catch (error) {
          addLog(`Error approving investors: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
          setProcessing(false);
      }
      },
    },
    {
      title: "Make Investments",
      description: "Investors invest in the FIDC",
      action: async () => {
        if (!isConnected || !fidcId) {
          addLog(
            "Please connect your wallet and complete previous steps first"
          );
          return;
        }

        const isSeniorInvestor =
          address?.toLowerCase() ===
          formData.seniorInvestorAddress.toLowerCase();
        const isSubInvestor =
          address?.toLowerCase() === formData.subInvestorAddress.toLowerCase();

        if (!isSeniorInvestor && !isSubInvestor) {
          addLog(
            `Warning: You should be connected with one of the approved investor wallets:`
          );
          addLog(`- Senior Investor: ${formData.seniorInvestorAddress}`);
          addLog(`- Subordinated Investor: ${formData.subInvestorAddress}`);
          // We don't block, just warn in demo mode
        }

        setProcessing(true);
        addLog("Processing investments...");

        try {
          // Investimento Sênior
          addLog(
            `Senior investor investing ${formData.seniorInvestAmount} Stable coin into FIDC ID: ${fidcId}`
          );

          // Verificar se estamos conectados como o investidor sênior
          let seniorResult: { success: boolean } = { success: false };
          if (isSeniorInvestor) {
            seniorResult = await invest(
              fidcId,
              formData.seniorInvestAmount.toString()
            );
          } else {
            addLog(
              "Warning: We're not connected as the senior investor. In production, this operation would fail."
            );
            // Na demonstração, fingimos que o investimento foi bem-sucedido
            seniorResult = { success: true };
          }

          if (seniorResult.success) {
            addLog("Senior investment successful");
          }

          try {
            const positions = await getInvestorPosition(
              formData.seniorInvestorAddress,
              fidcId
            );
            const seniorInvestment = positions.investments.find(
              (inv) => inv.isSenior === true
            );

            if (seniorInvestment) {
              setSeniorInvestmentId(seniorInvestment.investmentId);
              addLog(`Senior investment ID: ${seniorInvestment.investmentId}`);
              addLog(
                `Senior investment date: ${seniorInvestment.investmentDate.toLocaleString()}`
              );
            }
          } catch (err) {
            console.error(
              "Error getting senior investment ID:",
              err instanceof Error ? err.message : String(err)
            );
          }

          // Investimento Subordinado
          addLog(
            `Subordinated investor investing ${formData.subInvestAmount} Stable coin into FIDC ID: ${fidcId}`
          );

          // Verificar se estamos conectados como o investidor subordinado
          let subResult: { success: boolean } = { success: false };
          if (isSubInvestor) {
            subResult = await invest(
              fidcId,
              formData.subInvestAmount.toString()
            );
          } else {
            addLog(
              "Warning: We're not connected as the subordinated investor. In production, this operation would fail."
            );
            // Na demonstração, fingimos que o investimento foi bem-sucedido
            subResult = { success: true };
          }

          if (subResult.success) {
            addLog("Subordinated investment successful");
          }

          try {
            const positions = await getInvestorPosition(
              formData.subInvestorAddress,
              fidcId
            );
            const subInvestment = positions.investments.find(
              (inv) => inv.isSenior === false
            );

            if (subInvestment) {
              setSubInvestmentId(subInvestment.investmentId);
              addLog(
                `Subordinated investment ID: ${subInvestment.investmentId}`
              );
              addLog(
                `Subordinated investment date: ${subInvestment.investmentDate.toLocaleString()}`
              );
            }
          } catch (err) {
            console.error(
              "Error getting subordinated investment ID:",
              err instanceof Error ? err.message : String(err)
            );
          }

          try {
            const fidcDetails = await getFIDCDetails(fidcId);
            addLog(
              `Total invested in FIDC: ${fidcDetails.invested} Stable coin`
            );
          } catch (err) {
            console.error(
              "Error getting total invested:",
              err instanceof Error ? err.message : String(err)
            );
          }

          if (seniorResult.success && subResult.success) {
            setCurrentStep(6);
          } else {
            addLog(
              "Failed to complete one or more investments. Check console for details."
            );
          }
        } catch (error) {
          addLog(
            `Error processing investments: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } finally {
          setProcessing(false);
        }
      },
    },
    {
      title: "Redeem Investments",
      description: "Go to Investor Portal to redeem investments",
      action: () => {
        window.location.href = "/investor";
      },
    },
    {
      title: "Demo Complete",
      description: "FIDC flow demonstration completed successfully",
      action: async () => {
        setCurrentStep(0);
        setFidcId(null);
        setSeniorInvestmentId(0);
        setSubInvestmentId(0);
        setLogs([]);
        addLog("Demo reset. Ready to start again.");
      },
    },
    {
      title: "FIDC State Management",
      description: "Administrative actions: Stop FIDC",
      action: async () => {
        addLog("This step offers administrative actions for the FIDC manager");
      },
    },
  ];

  const getStatusString = (statusCode: number): string => {
    const statuses = ["PENDING", "ACTIVE", "STOPPED", "LIQUIDATED"];
    return statuses[statusCode] || "UNKNOWN";
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">FIDC Flow Demonstration</h1>

      <div className="flex justify-end mb-4">
        <ConnectButton />
      </div>

      {!isConnected && (
        <div
          className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6"
          role="alert"
        >
          <p className="font-bold">Wallet not connected</p>
          <p>Please connect your wallet to interact with this demonstration</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">FIDC Configuration</h2>

          {/* Painel de Gerenciamento de Tokens Stablecoin */}
          <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
            <h3 className="font-semibold text-lg mb-2">
              Stablecoin Token Management
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              This section allows you to create and view Stablecoin tokens for
              demonstration.
            </p>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">
                Stablecoin Amount to Mint
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  className="w-full p-2 border rounded-l"
                  placeholder="1000"
                />
                <button
                  onClick={async () => {
                    if (!isConnected || !address) {
                      addLog("Please connect your wallet first");
                      return;
                    }

                    try {
                      setProcessing(true);
                      addLog(`Minting ${mintAmount} Stablecoin for ${address}`);
                      await fundInvestorWallet(address, mintAmount);
                      addLog(`Mint completed successfully!`);
                      updateStablecoinBalances();
                    } catch (err) {
                      addLog(
                        `Error during mint: ${
                          err instanceof Error ? err.message : String(err)
                        }`
                      );
                    } finally {
                      setProcessing(false);
                    }
                  }}
                  disabled={processing || isProcessing || !isConnected}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-r disabled:bg-gray-300"
                >
                  Mint
                </button>
              </div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">
                  Stablecoin Balances:
                </span>
                <button
                  onClick={updateStablecoinBalances}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                  disabled={processing || isProcessing}
                >
                  🔄 Refresh
                </button>
              </div>

              <div className="space-y-1 max-h-32 overflow-y-auto text-sm border rounded p-2 bg-white dark:bg-gray-700">
                {Object.entries(walletBalances).length > 0 ? (
                  Object.entries(walletBalances).map(([addr, balance]) => {
                    // Determine wallet type for display
                    let role = "";
                    if (addr === address?.toLowerCase()) role = "You";
                    else if (addr === formData.validatorAddress?.toLowerCase())
                      role = "Validator";
                    else if (addr === formData.payableAddress?.toLowerCase())
                      role = "Payable";
                    else if (
                      addr === formData.seniorInvestorAddress?.toLowerCase()
                    )
                      role = "Sr. Investor";
                    else if (
                      addr === formData.subInvestorAddress?.toLowerCase()
                    )
                      role = "Sub. Investor";

                    const shortAddr = `${addr.substring(
                      0,
                      6
                    )}...${addr.substring(addr.length - 4)}`;

                    return (
                      <div key={addr} className="flex justify-between">
                        <span className="font-mono">
                          {role ? `${role} (${shortAddr})` : shortAddr}:
                        </span>
                        <span className="font-semibold">
                          {balance} Stablecoin
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 italic">Loading balances...</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={async () => {
                  if (!isConnected) return;

                  try {
                    setProcessing(true);
                    addLog("Funding validator wallet...");
                    await fundInvestorWallet(
                      formData.validatorAddress,
                      mintAmount
                    );
                    addLog("Validator wallet funded!");
                    updateStablecoinBalances();
                  } catch (err) {
                    addLog(
                      `Error: ${
                        err instanceof Error ? err.message : String(err)
                      }`
                    );
                  } finally {
                    setProcessing(false);
                  }
                }}
                className="text-sm bg-blue-500 hover:bg-blue-600 text-white py-1 rounded disabled:bg-gray-300"
                disabled={processing || isProcessing || !isConnected}
              >
                Fund Validator
              </button>

              <button
                onClick={async () => {
                  if (!isConnected) return;

                  try {
                    setProcessing(true);
                    addLog("Funding payable company wallet...");
                    await fundInvestorWallet(
                      formData.payableAddress,
                      mintAmount
                    );
                    addLog("Payable wallet funded!");
                    updateStablecoinBalances();
                  } catch (err) {
                    addLog(
                      `Error: ${
                        err instanceof Error ? err.message : String(err)
                      }`
                    );
                  } finally {
                    setProcessing(false);
                  }
                }}
                className="text-sm bg-green-500 hover:bg-green-600 text-white py-1 rounded disabled:bg-gray-300"
                disabled={processing || isProcessing || !isConnected}
              >
                Fund Payable
              </button>
            </div>
          </div>

          <div className="my-4 border-b border-gray-200"></div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Gestor (Manager)
              </label>
              <input
                type="text"
                name="managerAddress"
                value={formData.managerAddress}
                onChange={(e) =>
                  setFormData({ ...formData, managerAddress: e.target.value })
                }
                disabled={currentStep > 0}
                className={`w-full p-2 border rounded ${
                  formData.managerAddress === address
                    ? "bg-blue-50 border-blue-300"
                    : ""
                }`}
                placeholder="0x..."
              />
              <p className="text-sm mt-1 flex justify-between">
                <span className="text-gray-500">Endereço do gestor</span>
                {formData.managerAddress === address && (
                  <span className="text-blue-600 font-medium">Você</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Validador (Endereço)
              </label>
              <input
                type="text"
                name="validatorAddress"
                value={formData.validatorAddress}
                onChange={(e) =>
                  setFormData({ ...formData, validatorAddress: e.target.value })
                }
                disabled={currentStep > 0}
                className={`w-full p-2 border rounded ${
                  formData.validatorAddress === address
                    ? "bg-blue-50 border-blue-300"
                    : ""
                }`}
                placeholder="0x..."
              />
              <p className="text-sm mt-1 flex justify-between">
                <span className="text-gray-500">
                  Endereço do validador de emissão
                </span>
                {formData.validatorAddress === address && (
                  <span className="text-blue-600 font-medium">Você</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Pagador (Endereço)
              </label>
              <input
                type="text"
                name="payableAddress"
                value={formData.payableAddress}
                onChange={(e) =>
                  setFormData({ ...formData, payableAddress: e.target.value })
                }
                disabled={currentStep > 0}
                className={`w-full p-2 border rounded ${
                  formData.payableAddress === address
                    ? "bg-blue-50 border-blue-300"
                    : ""
                }`}
                placeholder="0x..."
              />
              <p className="text-sm mt-1 flex justify-between">
                <span className="text-gray-500">
                  Endereço da empresa pagadora
                </span>
                {formData.payableAddress === address && (
                  <span className="text-blue-600 font-medium">Você</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Investidor Sênior (Endereço)
              </label>
              <input
                type="text"
                name="seniorInvestorAddress"
                value={formData.seniorInvestorAddress}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    seniorInvestorAddress: e.target.value,
                  })
                }
                disabled={currentStep > 3}
                className={`w-full p-2 border rounded ${
                  formData.seniorInvestorAddress === address
                    ? "bg-blue-50 border-blue-300"
                    : ""
                }`}
                placeholder="0x..."
              />
              <p className="text-sm mt-1 flex justify-between">
                <span className="text-gray-500">Recebe spread adicional</span>
                {formData.seniorInvestorAddress === address && (
                  <span className="text-blue-600 font-medium">Você</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Investidor Subordinado (Endereço)
              </label>
              <input
                type="text"
                name="subInvestorAddress"
                value={formData.subInvestorAddress}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    subInvestorAddress: e.target.value,
                  })
                }
                disabled={currentStep > 3}
                className={`w-full p-2 border rounded ${
                  formData.subInvestorAddress === address
                    ? "bg-blue-50 border-blue-300"
                    : ""
                }`}
                placeholder="0x..."
              />
              <p className="text-sm mt-1 flex justify-between">
                <span className="text-gray-500">Sem spread adicional</span>
                {formData.subInvestorAddress === address && (
                  <span className="text-blue-600 font-medium">Você</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">FIDC ID</label>
              <input
                type="number"
                value={fidcId || 1}
                onChange={(e) => setFidcId(Number(e.target.value))}
                disabled={currentStep > 0}
                className="w-full p-2 border rounded"
                min="1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Unique identifier for this FIDC instance
              </p>
            </div>

            <div className="my-4 border-b border-gray-200"></div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Annual Yield (BPS)
              </label>
              <input
                type="number"
                name="annualYield"
                value={formData.annualYield}
                onChange={handleInputChange}
                disabled={currentStep > 0}
                className="w-full p-2 border rounded"
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.annualYield / 100}%
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Senior Spread (BPS)
              </label>
              <input
                type="number"
                name="seniorSpread"
                value={formData.seniorSpread}
                onChange={handleInputChange}
                disabled={currentStep > 0}
                className="w-full p-2 border rounded"
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.seniorSpread / 100}%
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Manager Fee (BPS)
              </label>
              <input
                type="number"
                name="fee"
                value={formData.fee}
                onChange={handleInputChange}
                disabled={currentStep > 0}
                className="w-full p-2 border rounded"
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.fee / 100}%
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Grace Period (seconds)
              </label>
              <input
                type="number"
                name="gracePeriod"
                value={formData.gracePeriod}
                onChange={(e) => {
                  const seconds = Number(e.target.value);
                  // Garantir que o valor mínimo seja 35 segundos
                  const validSeconds = Math.max(35, seconds);
                  setFormData({
                    ...formData,
                    gracePeriod: validSeconds,
                  });
                }}
                disabled={currentStep > 0}
                className="w-full p-2 border rounded"
                min="35"
              />
              <p className="text-sm text-gray-500 mt-1">
                {`${formData.gracePeriod} seconds (${Math.floor(
                  formData.gracePeriod / 86400
                )} days and ${Math.floor(
                  (formData.gracePeriod % 86400) / 3600
                )} hours)`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Collateral Amount (Stablecoin)
              </label>
              <input
                type="number"
                name="collateralAmount"
                value={formData.collateralAmount}
                onChange={handleInputChange}
                disabled={currentStep > 0}
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Senior Investment (Stablecoin)
              </label>
              <input
                type="number"
                name="seniorInvestAmount"
                value={formData.seniorInvestAmount}
                onChange={handleInputChange}
                disabled={currentStep > 4}
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Subordinated Investment (Stablecoin)
              </label>
              <input
                type="number"
                name="subInvestAmount"
                value={formData.subInvestAmount}
                onChange={handleInputChange}
                disabled={currentStep > 4}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>

          {fidcId && (
            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900 rounded">
              <h3 className="font-semibold">FIDC ID: {fidcId}</h3>
              <p className="text-sm">
                Status: {currentStep >= 2 ? "ACTIVE" : "PENDING"}
              </p>

              {currentStep >= 3 && (
                <div className="mt-3">
                  <button
                    onClick={async () => {
                      if (!fidcId) return;

                      setProcessing(true);
                      addLog("Manually funding investor wallets...");

                      try {
                        // Financiar carteira do investidor sênior
                        const seniorAmount = (
                          formData.seniorInvestAmount * 1.5
                        ).toString();
                        addLog(
                          `Enviando ${seniorAmount} Stablecoin para investidor sênior`
                        );
                        await fundInvestorWallet(
                          formData.seniorInvestorAddress,
                          seniorAmount
                        );

                        // Financiar carteira do investidor subordinado
                        const subAmount = (
                          formData.subInvestAmount * 1.5
                        ).toString();
                        addLog(
                          `Enviando ${subAmount} Stablecoin para investidor subordinado`
                        );
                        await fundInvestorWallet(
                          formData.subInvestorAddress,
                          subAmount
                        );

                        addLog("Wallets funded successfully!");
                      } catch (error) {
                        addLog(
                          `Error funding wallets: ${
                            error instanceof Error
                              ? error.message
                              : String(error)
                          }`
                        );
                      } finally {
                        setProcessing(false);
                      }
                    }}
                    className="mt-2 w-full py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                    disabled={processing || isProcessing}
                  >
                    💰 Fund Investors
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">FIDC Flow Steps</h2>
            <p className="text-gray-500">
              Complete each step to see the entire FIDC lifecycle
            </p>
          </div>

          <div className="p-6">
            <div className="space-y-6">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    currentStep === index
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : currentStep > index
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 bg-gray-50 dark:bg-gray-700/20"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">
                        {index + 1}. {step.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {step.description}
                      </p>
                    </div>

                    <button
                      onClick={step.action}
                      disabled={
                        currentStep !== index ||
                        processing ||
                        isProcessing ||
                        !isConnected
                      }
                      className={`px-4 py-2 rounded text-white ${
                        currentStep === index &&
                        !processing &&
                        !isProcessing &&
                        isConnected
                          ? "bg-blue-500 hover:bg-blue-600"
                          : currentStep > index
                          ? "bg-green-500 cursor-not-allowed"
                          : "bg-gray-300 cursor-not-allowed"
                      }`}
                    >
                      {(processing || isProcessing) && currentStep === index ? (
                        <span>Processing...</span>
                      ) : currentStep > index ? (
                        <span>Completed</span>
                      ) : index === 8 ? (
                        <span>Reset Demo</span>
                      ) : (
                        <span>Execute</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-black rounded-lg shadow p-4 text-green-400 font-mono">
        <h2 className="text-xl font-semibold mb-2 text-white">
          Transaction Logs
        </h2>
        <div className="h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">
              No logs yet. Start the demo to see transaction logs.
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
        <h2 className="text-xl font-semibold mb-4">
          About FIDC (Fundo de Investimento em Direitos Creditórios)
        </h2>

        {fidcId && currentStep >= 3 && (
          <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Administrative Actions</h3>
            <p className="mb-3">
              The FIDC manager can perform these actions at any time:
            </p>
            <div>
              <button
                onClick={async () => {
                  if (!fidcId) return;

                  setProcessing(true);
                  addLog("Stopping FIDC...");

                  try {
                    const result = await stopFIDC(fidcId);
                    if (result.success) {
                      addLog(
                        `FIDC ${fidcId} stopped successfully. Status now is STOPPED.`
                      );

                      // Atualizar detalhes após a operação
                      const details = await getFIDCDetails(fidcId);
                      addLog(
                        `Status confirmed: ${getStatusString(details.status)}`
                      );
                    } else {
                      addLog("Failed to stop FIDC.");
                    }
                  } catch (error) {
                    addLog(
                      `Error stopping FIDC: ${
                        error instanceof Error ? error.message : String(error)
                      }`
                    );
                  } finally {
                    setProcessing(false);
                  }
                }}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={processing || isProcessing}
              >
                Stop FIDC
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">What is a FIDC?</h3>
            <p>
              A FIDC is a Brazilian investment fund that primarily invests in
              credit rights. Our demo showcases how these funds work on the
              blockchain, from creation to redemption with yields.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium">Yield Calculation</h3>
            <p>Yield = Principal × Annual Rate × Time (in years)</p>
            <p>
              Senior investors receive an additional spread on top of the base
              yield. The manager collects a fee on the yield generated.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium">Key Parameters</h3>
            <ul className="list-disc pl-5">
              <li>Annual Yield: Base yield rate for all investors</li>
              <li>Senior Spread: Additional yield for senior investors</li>
              <li>
                Manager Fee: Fee collected by the fund manager (on yield only)
              </li>
              <li>
                Grace Period: Minimum time before investments can be redeemed
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
