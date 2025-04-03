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
    invest,
    redeem,
    getFIDCDetails,
    getInvestorPosition,
    stopFIDC,
    initiateLiquidation,
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
    annualYield: 2000,
    seniorSpread: 500,
    fee: 100,
    gracePeriod: 1 * 24 * 60 * 60,
    collateralAmount: 1000,
    seniorInvestAmount: 600,
    subInvestAmount: 400,
    simulatedDays: 180,
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
          addLog(
            "Roles will be configured in the next step during FIDC initialization"
          );
          addLog(`Manager: ${address}`);
          addLog(`Validator: ${formData.validatorAddress}`);
          addLog(`Payable: ${formData.payableAddress}`);

          updateStablecoinBalances();
          setCurrentStep(1);
        } catch (error) {
          addLog(
            `Error configuring roles: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
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
          addLog(`Setting up FIDC with annual yield: ${
            formData.annualYield / 100
          }%, 
                  senior spread: ${formData.seniorSpread / 100}%, 
                  fee: ${formData.fee / 100}%, 
                  grace period: ${formData.gracePeriod / (24 * 60 * 60)} days`);

          const result = await initializeFIDC(
            address!,
            formData.validatorAddress,
            formData.payableAddress,
            formData.fee,
            formData.annualYield,
            formData.gracePeriod,
            formData.seniorSpread
          );

          if (result.success && result.fidcId) {
            setFidcId(result.fidcId);
            addLog(`FIDC initialized with ID: ${result.fidcId}`);
            setCurrentStep(2);
          } else {
            addLog("Failed to initialize FIDC. Check console for details.");
          }
        } catch (error) {
          addLog(
            `Error initializing FIDC: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
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
          addLog(`Schedule amount: ${formData.collateralAmount} DREX`);
          addLog(`Collateral amount: ${formData.collateralAmount} DREX`);

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
          addLog(`Transferring collateral: ${formData.collateralAmount} DREX`);

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
          // Aprovar os investidores usando approveInvestor diretamente
          // Esta função já está na interface FIDCContract
          addLog(
            `Approving senior investor: ${formData.seniorInvestorAddress}`
          );

          // Aprovar investidor senior (tipo 0)
          const seniorResult = await approveInvestor(
            formData.seniorInvestorAddress,
            0,
            fidcId
          );

          if (seniorResult.success) {
            addLog("Senior investor approved successfully");
          }

          // Aprovar investidor subordinado (tipo 1)
          addLog(
            `Approving subordinated investor: ${formData.subInvestorAddress}`
          );
          const subResult = await approveInvestor(
            formData.subInvestorAddress,
            1,
            fidcId
          );

          if (subResult.success) {
            addLog("Subordinated investor approved successfully");
          }

          // Financiar as carteiras dos investidores com DREX
          addLog("Funding investor wallets with tokens...");

          // Financiar carteira do investidor sênior
          const seniorFundingAmount = (
            formData.seniorInvestAmount * 1.1
          ).toString(); // 10% a mais para garantir
          await fundInvestorWallet(
            formData.seniorInvestorAddress,
            seniorFundingAmount
          );

          // Financiar carteira do investidor subordinado
          const subFundingAmount = (formData.subInvestAmount * 1.1).toString(); // 10% a mais para garantir
          await fundInvestorWallet(
            formData.subInvestorAddress,
            subFundingAmount
          );

          if (seniorResult.success && subResult.success) {
            setCurrentStep(5);
            addLog("All investors approved and funded successfully!");
          } else {
            addLog(
              "Failed to approve one or more investors. Check console for details."
            );
          }
        } catch (error) {
          addLog(
            `Error approving investors: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
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
            `Senior investor investing ${formData.seniorInvestAmount} Stable coin`
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
            `Subordinated investor investing ${formData.subInvestAmount} Stable coin`
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
      title: "Simulate Time Passing",
      description: `Simulate ${formData.simulatedDays} days passing (grace period + investment time)`,
      action: async () => {
        if (!isConnected || !fidcId) {
          addLog(
            "Please connect your wallet and complete previous steps first"
          );
          return;
        }

        setProcessing(true);
        addLog(`Simulating ${formData.simulatedDays} days passing...`);

        try {
          addLog(
            "Note: In a real blockchain, time cannot be simulated. You would need to wait for the grace period to actually pass."
          );

          await new Promise((resolve) => setTimeout(resolve, 3000));

          addLog(`${formData.simulatedDays} days have passed (simulation)`);
          addLog("Grace period has ended");
          addLog("Investments can now be redeemed");

          setCurrentStep(7);
        } catch (error) {
          addLog(
            `Error during time simulation: ${
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
      description: "Investors redeem their investments with yield",
      action: async () => {
        if (
          !isConnected ||
          !fidcId ||
          seniorInvestmentId === 0 ||
          subInvestmentId === 0
        ) {
          addLog(
            "Please connect your wallet and complete previous steps first"
          );
          return;
        }

        // Verificar se o endereço conectado é um dos investidores aprovados
        const { ethers } = await import("ethers");
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
        addLog("Processing redemptions...");

        try {
          const seniorPrincipal = formData.seniorInvestAmount;
          const seniorAnnualRate =
            (formData.annualYield + formData.seniorSpread) / BPS_DENOMINATOR;
          const timeInYears = formData.simulatedDays / 365;
          const seniorGrossYield =
            seniorPrincipal * seniorAnnualRate * timeInYears;
          const seniorFee = seniorGrossYield * (formData.fee / BPS_DENOMINATOR);
          const seniorNetYield = seniorGrossYield - seniorFee;
          const seniorTotal = seniorPrincipal + seniorNetYield;

          addLog("Senior investor redemption expected calculation:");
          addLog(`Principal: ${seniorPrincipal.toFixed(2)} Stable coin`);
          addLog(`Gross yield: ${seniorGrossYield.toFixed(2)} Stable coin`);
          addLog(`Manager fee: ${seniorFee.toFixed(2)} Stable coin`);
          addLog(`Net yield: ${seniorNetYield.toFixed(2)} Stable coin`);
          addLog(
            `Total expected repayment: ${seniorTotal.toFixed(2)} Stable coin`
          );

          addLog("Redeeming senior investment...");

          // Verificar se estamos conectados como o investidor sênior
          let seniorResult: { success: boolean } = { success: false };
          if (isSeniorInvestor) {
            seniorResult = await redeem(
              fidcId,
              seniorInvestmentId,
              formData.seniorInvestAmount.toString()
            );
          } else {
            addLog(
              "Warning: We're not connected as the senior investor. In production, this operation would fail."
            );
            // Na demonstração, fingimos que o resgate foi bem-sucedido
            seniorResult = { success: true };
          }

          if (seniorResult.success) {
            addLog("Senior investment redeemed successfully");
          }

          const subPrincipal = formData.subInvestAmount;
          const subAnnualRate = formData.annualYield / BPS_DENOMINATOR;
          const subGrossYield = subPrincipal * subAnnualRate * timeInYears;
          const subFee = subGrossYield * (formData.fee / BPS_DENOMINATOR);
          const subNetYield = subGrossYield - subFee;
          const subTotal = subPrincipal + subNetYield;

          addLog("Subordinated investor redemption expected calculation:");
          addLog(`Principal: ${subPrincipal.toFixed(2)} Stablecoin`);
          addLog(`Gross yield: ${subGrossYield.toFixed(2)} Stablecoin`);
          addLog(`Manager fee: ${subFee.toFixed(2)} Stablecoin`);
          addLog(`Net yield: ${subNetYield.toFixed(2)} Stablecoin`);
          addLog(`Total expected repayment: ${subTotal.toFixed(2)} Stablecoin`);

          addLog("Redeeming subordinated investment...");

          // Verificar se estamos conectados como o investidor subordinado
          let subResult: { success: boolean } = { success: false };
          if (isSubInvestor) {
            subResult = await redeem(
              fidcId,
              subInvestmentId,
              formData.subInvestAmount.toString()
            );
          } else {
            addLog(
              "Warning: We're not connected as the subordinated investor. In production, this operation would fail."
            );
            // Na demonstração, fingimos que o resgate foi bem-sucedido
            subResult = { success: true };
          }

          if (subResult.success) {
            addLog("Subordinated investment redeemed successfully");
          }

          if (seniorResult.success && subResult.success) {
            setCurrentStep(8);
          } else {
            addLog(
              "Failed to complete one or more redemptions. Check console for details."
            );
          }
        } catch (error) {
          addLog(
            `Error processing redemptions: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } finally {
          setProcessing(false);
        }
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
      description: "Administrative actions: Stop FIDC or Start Liquidation",
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
                    await fundInvestorWallet(formData.validatorAddress, "1000");
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
                      formData.collateralAmount.toString()
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
                value={address || ""}
                disabled={true}
                className="w-full p-2 border rounded bg-blue-50 border-blue-300"
                placeholder="0x..."
              />
              <p className="text-sm mt-1 flex justify-between">
                <span className="text-gray-500">
                  Endereço do gestor (sua carteira conectada)
                </span>
                <span className="text-blue-600 font-medium">Você</span>
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
                Grace Period (Days)
              </label>
              <input
                type="number"
                name="gracePeriod"
                value={formData.gracePeriod / (24 * 60 * 60)}
                onChange={(e) => {
                  const days = Number(e.target.value);
                  setFormData({
                    ...formData,
                    gracePeriod: days * 24 * 60 * 60,
                  });
                }}
                disabled={currentStep > 0}
                className="w-full p-2 border rounded"
              />
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

            <div>
              <label className="block text-sm font-medium mb-1">
                Simulation Time (Days)
              </label>
              <input
                type="number"
                name="simulatedDays"
                value={formData.simulatedDays}
                onChange={handleInputChange}
                disabled={currentStep > 5}
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
            <div className="flex space-x-4">
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

              <button
                onClick={async () => {
                  if (!fidcId) return;

                  setProcessing(true);
                  addLog("Starting liquidation of FIDC...");

                  try {
                    const result = await initiateLiquidation(fidcId);
                    if (result.success) {
                      addLog(
                        `Liquidation of FIDC ${fidcId} started successfully. Status now is LIQUIDATED.`
                      );

                      // Atualizar detalhes após a operação
                      const details = await getFIDCDetails(fidcId);
                      addLog(
                        `Status confirmed: ${getStatusString(details.status)}`
                      );
                    } else {
                      addLog("Failed to start liquidation of FIDC.");
                    }
                  } catch (error) {
                    addLog(
                      `Error starting liquidation: ${
                        error instanceof Error ? error.message : String(error)
                      }`
                    );
                  } finally {
                    setProcessing(false);
                  }
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={processing || isProcessing}
              >
                Start Liquidation
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
