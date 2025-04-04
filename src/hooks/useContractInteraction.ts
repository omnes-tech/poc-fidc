import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useAccount, useWalletClient } from "wagmi";
import { FIDC_Management_address, ERC20Mock_address } from "@/constants";
import fidc_abi from "@/abis/fidc_abi";
import erc20_abi from "@/abis/erc20_abi";
import { FIDCContract, ERC20Contract } from "@/types/contracts";

export function useContractInteraction() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gasLimit = 3000000;

  const getContracts = useCallback(
    async (useDemoWallet = false) => {
      if (!useDemoWallet && (!walletClient || !isConnected || !address)) {
        throw new Error("Wallet not connected");
      }
      let provider;
      let signer;
      if (useDemoWallet) {
        provider = new ethers.JsonRpcProvider(
          "https://ethereum-holesky-rpc.publicnode.com"
        );
        const demoPrivateKey =
          "a92e4c875f24bb830164205fc55f567dd04f6cea7b64411a7f0d781d29095c2b";
        signer = new ethers.Wallet(demoPrivateKey, provider);
        console.log("Usando conta de demonstração na testnet:", signer.address);
      } else {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      }
      const fidcContract = new ethers.Contract(
        FIDC_Management_address,
        fidc_abi,
        signer
      ) as unknown as FIDCContract;
      const drexContract = new ethers.Contract(
        ERC20Mock_address,
        erc20_abi,
        signer
      ) as unknown as ERC20Contract;

      return { fidcContract, drexContract, signer, provider };
    },
    [walletClient, isConnected, address]
  );

  const initializeFIDC = useCallback(
    async (
      manager: string,
      validator: string,
      payable: string,
      fee: number,
      annualYield: number,
      gracePeriod: number,
      seniorSpread: number
    ) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { signer } = await getContracts();
        const rawContract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );
        const provider = new ethers.BrowserProvider(window.ethereum);
        const balance = await provider.getBalance(address!);
        console.log("Current POL balance:", ethers.formatEther(balance));

        const feeData = await provider.getFeeData();
        const estimatedGasCost =
          (feeData.gasPrice || BigInt(0)) * BigInt(1000000);
        console.log("Estimated gas cost (wei):", estimatedGasCost.toString());
        console.log(
          "Estimated gas cost (POL):",
          ethers.formatEther(estimatedGasCost)
        );

        if (balance < estimatedGasCost) {
          setError(
            `Saldo POL insuficiente. Você tem ${ethers.formatEther(
              balance
            )} POL, mas precisa de aproximadamente ${ethers.formatEther(
              estimatedGasCost
            )} POL.`
          );
          return {
            success: false,
            error: "Insufficient POL balance for transaction",
          };
        }

        console.log("initializeFIDC parameters recebidos:", {
          manager,
          validator,
          payable,
          fee,
          annualYield,
          gracePeriod,
          seniorSpread,
        });

        if (!ethers.isAddress(manager)) {
          setError(`Endereço do gestor inválido: ${manager}`);
          return { success: false, error: "Invalid manager address" };
        }
        if (!ethers.isAddress(validator)) {
          setError(`Endereço do validador inválido: ${validator}`);
          return { success: false, error: "Invalid validator address" };
        }
        if (!ethers.isAddress(payable)) {
          setError(`Endereço do pagador inválido: ${payable}`);
          return { success: false, error: "Invalid payable address" };
        }

        const ONE_DAY_IN_SECONDS = 86400;
        const MIN_GRACE_PERIOD = ONE_DAY_IN_SECONDS;
        const MAX_GRACE_PERIOD = 365 * ONE_DAY_IN_SECONDS;

        if (gracePeriod < MIN_GRACE_PERIOD) {
          setError(
            `Período de carência muito curto. Mínimo: ${
              MIN_GRACE_PERIOD / ONE_DAY_IN_SECONDS
            } dia`
          );
          return { success: false, error: "Grace period too short" };
        }
        if (gracePeriod > MAX_GRACE_PERIOD) {
          setError(
            `Período de carência muito longo. Máximo: ${
              MAX_GRACE_PERIOD / ONE_DAY_IN_SECONDS
            } dias`
          );
          return { success: false, error: "Grace period too long" };
        }

        const MAX_SENIOR_SPREAD = 2000;
        if (seniorSpread > MAX_SENIOR_SPREAD) {
          setError(
            `Spread de senior muito alto. Máximo: ${MAX_SENIOR_SPREAD / 100}%`
          );
          return { success: false, error: "Senior spread too high" };
        }

        const MAX_FEE = 1000;
        if (fee > MAX_FEE) {
          setError(`Taxa muito alta. Máximo recomendado: ${MAX_FEE / 100}%`);
          return { success: false, error: "Fee too high" };
        }

        const MAX_YIELD = 5000;
        if (annualYield > MAX_YIELD) {
          setError(
            `Rendimento anual muito alto. Máximo recomendado: ${
              MAX_YIELD / 100
            }%`
          );
          return { success: false, error: "Annual yield too high" };
        }

        const feeParam = Number(fee);
        const annualYieldParam = Number(BigInt(annualYield));
        const gracePeriodParam = Number(BigInt(gracePeriod));
        const seniorSpreadParam = Number(BigInt(seniorSpread));

        console.log("Parâmetros ajustados para o contrato:", {
          manager,
          validator,
          payable,
          fee:
            feeParam.toString() + " BPS (" + (feeParam / 100).toFixed(2) + "%)",
          annualYield: annualYieldParam.toString() + " BPS",
          gracePeriod: gracePeriodParam.toString() + " segundos",
          seniorSpread: seniorSpreadParam.toString() + " BPS",
        });

        console.log("Using increased fixed gas limit:", gasLimit);

        console.log(
          `\n=== INICIALIZANDO FIDC ===\n` +
            `📋 ENDEREÇOS:\n` +
            `  Manager:   ${manager}\n` +
            `  Validator: ${validator}\n` +
            `  Payable:   ${payable}\n\n` +
            `💰 PARÂMETROS FINANCEIROS:\n` +
            `  Fee:         ${feeParam} BPS (${feeParam / 100}%)\n` +
            `  Yield:       ${annualYieldParam} BPS (${
              annualYieldParam / 100
            }%)\n` +
            `  Sr. Spread:  ${seniorSpreadParam} BPS (${
              seniorSpreadParam / 100
            }%)\n\n` +
            `⏱️ PERÍODO DE CARÊNCIA:\n` +
            `  ${gracePeriodParam} segundos (${Math.floor(
              gracePeriodParam / 86400
            )} dias e ${Math.floor(
              (gracePeriodParam % 86400) / 3600
            )} horas)\n\n` +
            `⛽ GÁS:\n` +
            `  Limite: ${gasLimit.toLocaleString()} unidades\n` +
            `=========================`
        );

        let gasToUse = gasLimit;
        try {
          const gasEstimate = await rawContract.initializeFIDC.estimateGas(
            manager,
            validator,
            payable,
            feeParam,
            annualYieldParam,
            gracePeriodParam,
            seniorSpreadParam
          );

          const safeGasEstimate = Math.floor(Number(gasEstimate) * 1.2);

          if (safeGasEstimate < gasLimit && safeGasEstimate >= 150000) {
            gasToUse = safeGasEstimate;
            console.log(
              `Usando estimativa de gás otimizada: ${gasToUse.toLocaleString()} unidades`
            );
          }
        } catch (gasEstimateErr) {
          console.warn(
            "Não foi possível estimar o gás, usando valor fixo:",
            gasEstimateErr
          );
        }

        const tx = await rawContract.initializeFIDC(
          manager,
          validator,
          payable,
          feeParam,
          annualYieldParam,
          gracePeriodParam,
          seniorSpreadParam,
          { gasLimit: gasToUse }
        );

        setTxHash(tx.hash);
        console.log("Transaction sent with hash:", tx.hash);
        console.log("Using gas limit:", gasToUse);

        console.log("Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        if (receipt && receipt.status === 0) {
          console.error("Transaction reverted on-chain:", receipt);

          try {
            const trace = await provider.call({
              to: tx.to,
              from: tx.from,
              data: tx.data,
              gasLimit: tx.gasLimit,
            });
            console.log("Transaction trace:", trace);
          } catch (traceErr: any) {
            if (traceErr.data || traceErr.message) {
              const errorMsg = traceErr.data || traceErr.message;
              console.error("Revert reason:", errorMsg);
              setError(`Transação revertida: ${errorMsg}`);
              return { success: false, error: `Revert reason: ${errorMsg}` };
            }
          }

          setError(
            "Transação revertida na blockchain. Verifique se os valores de rendimento, spread e taxa estão dentro dos limites permitidos."
          );
          return { success: false, error: "Transaction reverted on-chain" };
        }

        let fidcId: number | null = null;

        if (receipt && receipt.logs) {
          const event = receipt.logs.find(
            (log: any) =>
              log.topics[0] ===
              ethers.id("FIDCCreated(uint256,address,address)")
          );

          if (event && event.topics[1]) {
            fidcId = Number(ethers.toNumber(event.topics[1]));
            console.log("FIDC created with ID:", fidcId);
          } else {
            console.warn("FIDCCreated event not found in logs");
          }
        }

        return { success: true, fidcId, receipt };
      } catch (err: any) {
        console.error("Error initializing FIDC:", err);

        if (err.code === "CALL_EXCEPTION" && err.action === "sendTransaction") {
          console.log("Transaction reverted during execution");
          setError(
            "Contract execution reverted. The transaction might have failed due to contract conditions not being met."
          );
        } else if (
          err.message &&
          err.message.includes("gas required exceeds")
        ) {
          console.log("Gas estimation failed - trying with manual gas limit");
          setError(
            "Gas estimation failed. Try adjusting the transaction parameters."
          );
        } else if (
          err.message &&
          err.message.includes("enough") &&
          err.message.includes("fee")
        ) {
          setError(
            "Você não tem POL suficiente para pagar as taxas da rede. Por favor, adicione POL à sua carteira."
          );
        } else {
          setError(
            err instanceof Error ? err.message : "Unknown error occurred"
          );
        }

        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, address]
  );

  const approveEmissionValidator = useCallback(
    async (
      pj: string,
      fidcId: number,
      scheduleAmount: string,
      collateralAmount: string,
      isApproved: boolean
    ) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts();

        console.log(`\n=== VALIDATOR APPROVAL DEBUG ===`);
        console.log(`FIDC ID: ${fidcId}`);
        console.log(`Payable Address: ${pj}`);
        console.log(`Schedule Amount: ${scheduleAmount} DREX`);
        console.log(`Collateral Amount: ${collateralAmount} DREX`);
        console.log(`Is Approved: ${isApproved}`);
        console.log(`Gas Limit: ${gasLimit}`);
        console.log(`Caller Address: ${address}`);
        console.log(`============================\n`);

        const scheduleAmountBigInt = ethers.parseEther(scheduleAmount);
        const collateralAmountBigInt = ethers.parseEther(collateralAmount);

        const tx = await fidcContract.approvedEmissionValidator(
          pj,
          fidcId,
          scheduleAmountBigInt,
          collateralAmountBigInt,
          isApproved,
          { gasLimit }
        );

        setTxHash(tx.hash);
        console.log("Transaction sent with hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        return { success: true, receipt };
      } catch (err: any) {
        console.error("Error approving emission (validator):", err);

        if (err.code === -32603) {
          setError(
            "Internal JSON-RPC error. Try with different parameters or contact support."
          );
        } else if (
          err.message &&
          err.message.includes("gas required exceeds")
        ) {
          setError(
            "Transaction needs more gas than provided. Try increasing gas limit."
          );
        } else if (err.message && err.message.includes("user rejected")) {
          setError("Transaction was rejected in your wallet.");
        } else if (err.message && err.message.includes("insufficient funds")) {
          setError("You don't have enough ETH to pay for gas fees.");
        } else {
          setError(
            err instanceof Error ? err.message : "Unknown error occurred"
          );
        }

        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, address, gasLimit]
  );

  const approveEmissionPayable = useCallback(
    async (fidcId: number, amount: string, isApproved: boolean) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract, drexContract } = await getContracts();
        const amountBigInt = ethers.parseEther(amount);
        const approveGasLimit = 1000000;
        console.log(
          `Usando limite de gás fixo para approve: ${approveGasLimit.toLocaleString()} unidades`
        );
        const approveTx = await drexContract.approve(
          FIDC_Management_address,
          amountBigInt,
          { gasLimit: approveGasLimit }
        );
        await approveTx.wait();
        console.log(
          `Usando limite de gás fixo: ${gasLimit.toLocaleString()} unidades`
        );
        const tx = await fidcContract.approvedEmissionPayable(
          fidcId,
          amountBigInt,
          isApproved,
          { gasLimit }
        );
        setTxHash(tx.hash);
        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error approving emission (payable):", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, gasLimit]
  );

  const approveInvestor = useCallback(
    async (
      investor: string,
      type: number,
      fidcId: number,
      useDemoWallet = false
    ) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts(useDemoWallet);

        console.log([investor], type, fidcId, { gasLimit });

        const tx = await fidcContract.approveInvestor(
          [investor],
          type,
          fidcId,
          { gasLimit }
        );
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error approving investor:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, gasLimit]
  );

  const invest = useCallback(
    async (fidcId: number, amount: string, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract, drexContract, signer } = await getContracts(
          useDemoWallet
        );
        const currentAddress = useDemoWallet ? signer.address : address;
        const amountBigInt = ethers.parseEther(amount);
        console.log(`Investindo ${amount} Stablecoin no FIDC ID: ${fidcId}`);
        console.log(`Usando endereço: ${currentAddress}`);
        console.log(
          `Aprovando ${amount} Stablecoin para uso pelo contrato FIDC`
        );
        const approveGasLimit = 3000000;
        try {
          const approveTx = await drexContract.approve(
            FIDC_Management_address,
            amountBigInt,
            { gasLimit: approveGasLimit }
          );
          await approveTx.wait();
          console.log("Aprovação concluída com sucesso");
        } catch (approveErr) {
          console.error("Erro na aprovação:", approveErr);
          throw new Error(
            "Falha na aprovação do token: " +
              (approveErr instanceof Error
                ? approveErr.message
                : String(approveErr))
          );
        }
        const investGasLimit = 3000000;
        console.log(`Executando investimento de ${amount} Stablecoin`);
        try {
          console.log(`Investindo ${amount} Stablecoin no FIDC ID: ${fidcId}`);
          console.log(`Usando endereço: ${currentAddress}`);
          console.log(`Valor a ser investido: ${amountBigInt}`);
          const tx = await fidcContract.invest(fidcId, amountBigInt, {
            gasLimit: investGasLimit,
          });
          setTxHash(tx.hash);
          console.log("Transaction hash:", tx.hash);
          const receipt = await tx.wait();
          console.log("Receipt:", receipt);
          return { success: true, receipt };
        } catch (investErr) {
          console.error("Erro específico na transação invest:", investErr);
          throw investErr;
        }
      } catch (err) {
        console.error("Error investing:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, address]
  );

  const redeem = useCallback(
    async (fidcId: number, investmentId: number, amount: string) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts();

        const amountBigInt = ethers.parseEther(amount);

        const redeemGasLimit = 3000000;
        console.log(`\n=== RESGATANDO INVESTIMENTO ===`);
        console.log(`FIDC ID: ${fidcId}`);
        console.log(`Investment ID: ${investmentId}`);
        console.log(`Valor: ${amount} DREX`);
        console.log(`Investidor: ${address}`);
        console.log(
          `Limite de gás: ${redeemGasLimit.toLocaleString()} unidades`
        );
        console.log(`===========================\n`);

        const tx = await fidcContract.redeem(
          fidcId,
          investmentId,
          amountBigInt,
          { gasLimit: redeemGasLimit }
        );
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error redeeming investment:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, address]
  );

  const redeemAll = useCallback(
    async (fidcId: number, investmentId: number, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { signer, fidcContract } = await getContracts(useDemoWallet);

        console.log(`\n=== RESGATANDO TODO O INVESTIMENTO ===`);
        console.log(`FIDC ID: ${fidcId}`);
        console.log(`Investment ID: ${investmentId}`);
        console.log(`Investidor: ${signer.address}`);
        console.log(`===========================\n`);

        const redeemGasLimit = 3000000;
        const tx = await fidcContract.redeemAll(fidcId, investmentId, {
          gasLimit: redeemGasLimit,
        });
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error redeeming full investment:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, address]
  );

  const redeemAllManager = useCallback(
    async (fidcId: number, investors: string[], useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts(useDemoWallet);

        const fidc = await fidcContract.fidcs(fidcId);
        if (fidc.manager.toLowerCase() !== address!.toLowerCase()) {
          setError(
            "Apenas o gestor pode resgatar todos os investimentos de uma vez"
          );
          return {
            success: false,
            error: "Only manager can use redeemAllManager",
          };
        }

        console.log(`\n=== GESTOR RESGATANDO TODOS OS INVESTIMENTOS ===`);
        console.log(`FIDC ID: ${fidcId}`);
        console.log(`Investidores: ${investors.join(", ")}`);
        console.log(`Gestor: ${address}`);
        console.log(`===========================\n`);

        const redeemGasLimit = 5000000;
        const tx = await fidcContract.redeemAllManager(fidcId, investors, {
          gasLimit: redeemGasLimit,
        });
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error in manager redeeming all investments:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, address]
  );

  const getFIDCDetails = useCallback(
    async (fidcId: number, useDemoWallet = false) => {
      try {
        const { fidcContract } = await getContracts(useDemoWallet);
        const fidc = await fidcContract.fidcs(fidcId);

        return {
          manager: fidc.manager,
          validator: fidc.validator,
          payableAddress: fidc.payableAddress,
          fee: Number(fidc.fee),
          amount: ethers.formatEther(fidc.amount),
          invested: ethers.formatEther(fidc.invested),
          valid: fidc.valid,
          status: fidc.status,
          annualYield: Number(fidc.annualYield),
          gracePeriod: Number(fidc.gracePeriod),
          seniorSpread: Number(fidc.seniorSpread),
        };
      } catch (err) {
        console.error("Error getting FIDC details:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        throw err;
      }
    },
    [getContracts]
  );

  const getInvestorPosition = useCallback(
    async (investor: string, fidcId: number, useDemoWallet = false) => {
      try {
        const { fidcContract } = await getContracts(useDemoWallet);
        const position = await fidcContract.getInvestorPosition(
          investor,
          fidcId
        );

        return {
          fidcId: Number(position.fidcId),
          totalAmount: ethers.formatEther(position.totalAmount),
          investments: position.investments.map((inv) => ({
            investmentId: Number(inv.investmentId),
            amount: ethers.formatEther(inv.amount),
            investmentDate: new Date(Number(inv.investmentDate) * 1000),
            yieldStartTime: new Date(Number(inv.yieldStartTime) * 1000),
            isSenior: inv.isSenior,
          })),
        };
      } catch (err) {
        console.error("Error getting investor position:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        throw err;
      }
    },
    [getContracts]
  );

  const fundInvestorWallet = useCallback(
    async (recipient: string, amount: string, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { drexContract } = await getContracts(useDemoWallet);

        const currentBalance = await drexContract.balanceOf(recipient);
        console.log(
          `Saldo atual de ${recipient}: ${ethers.formatEther(
            currentBalance
          )} Stablecoin`
        );

        console.log(
          `Realizando mint de ${amount} Stablecoin para ${recipient}`
        );
        const tx = await drexContract.mint(
          recipient,
          ethers.parseEther(amount)
        );
        await tx.wait();
        console.log(`Mint realizado com sucesso!`);

        const newBalance = await drexContract.balanceOf(recipient);
        console.log(
          `Novo saldo de ${recipient}: ${ethers.formatEther(
            newBalance
          )} Stablecoin`
        );

        return { success: true };
      } catch (err) {
        console.error("Error funding investor wallet:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts]
  );

  const stopFIDC = useCallback(
    async (fidcId: number) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts();

        const fidc = await fidcContract.fidcs(fidcId);
        if (fidc.manager.toLowerCase() !== address!.toLowerCase()) {
          setError("Apenas o gestor pode parar um FIDC");
          return { success: false, error: "Only manager can stop FIDC" };
        }

        const tx = await fidcContract.stopFIDC(fidcId, { gasLimit });
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error stopping FIDC:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, address, gasLimit]
  );

  const initiateLiquidation = useCallback(
    async (fidcId: number) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts();

        const fidc = await fidcContract.fidcs(fidcId);
        if (fidc.manager.toLowerCase() !== address!.toLowerCase()) {
          setError("Apenas o gestor pode iniciar a liquidação de um FIDC");
          return { success: false, error: "Only manager can liquidate FIDC" };
        }

        const tx = await fidcContract.initiateLiquidation(fidcId, { gasLimit });
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error liquidating FIDC:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, address, gasLimit]
  );

  return {
    isProcessing,
    txHash,
    error,
    isConnected,
    address,
    initializeFIDC,
    approveEmissionValidator,
    approveEmissionPayable,
    approveInvestor,
    invest,
    redeem,
    redeemAll,
    redeemAllManager,
    getFIDCDetails,
    getInvestorPosition,
    fundInvestorWallet,
    stopFIDC,
    initiateLiquidation,
    getContracts,
  };
}
