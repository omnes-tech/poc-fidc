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
        // Usar um provedor de testnet pública - Polygon Mumbai Testnet
        provider = new ethers.JsonRpcProvider(
          "https://ethereum-holesky-rpc.publicnode.com"
        );

        // Chave privada de uma conta de teste (sem valor real)
        // Substitua por uma chave de teste que você controla
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
      seniorSpread: number,
      useDemoWallet = false
    ) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { signer } = await getContracts(useDemoWallet);
        const rawContract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        // Ajustar a verificação de saldo para funcionar com demo wallet
        let balance;
        let provider;

        if (useDemoWallet) {
          // Se estiver usando demo wallet, não verificar saldo Ether
          // ou usar um provedor diferente para verificar o saldo
          provider = new ethers.JsonRpcProvider(
            "https://ethereum-holesky-rpc.publicnode.com"
          );
          balance = await provider.getBalance(signer.address);
        } else {
          provider = new ethers.BrowserProvider(window.ethereum);
          balance = await provider.getBalance(address!);
        }

        console.log("Current Ether balance:", ethers.formatEther(balance));

        const feeData = await provider.getFeeData();
        const estimatedGasCost =
          (feeData.gasPrice || BigInt(0)) * BigInt(1000000);
        console.log("Estimated gas cost (wei):", estimatedGasCost.toString());
        console.log(
          "Estimated gas cost (Ether):",
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
        const MIN_GRACE_PERIOD = 30;
        const MAX_GRACE_PERIOD = 365 * ONE_DAY_IN_SECONDS;

        if (gracePeriod < MIN_GRACE_PERIOD) {
          setError(
            `Período de carência muito curto. Mínimo: ${MIN_GRACE_PERIOD} segundos`
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

        const MAX_YIELD = 20000;
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
          {
            gasLimit: gasToUse,
          }
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
      isApproved: boolean,
      useDemoWallet = false
    ) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts(useDemoWallet);

        console.log(`\n=== VALIDATOR APPROVAL DEBUG ===`);
        console.log(`FIDC ID: ${fidcId}`);
        console.log(`Payable Address: ${pj}`);
        console.log(`Schedule Amount: ${scheduleAmount} Stablecoin`);
        console.log(`Collateral Amount: ${collateralAmount} Stablecoin`);
        console.log(`Is Approved: ${isApproved}`);
        console.log(`Gas Limit: ${gasLimit}`);
        console.log(`Using ${useDemoWallet ? 'demo wallet' : 'connected wallet'}`);
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
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, gasLimit]
  );

  const approveEmissionPayable = useCallback(
    async (fidcId: number, amount: string, isApproved: boolean, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Obter os contratos com o signer correto (demo ou conectado)
        const { drexContract, fidcContract, signer } = await getContracts(useDemoWallet);

        console.log(`\n=== PAYABLE APPROVAL DEBUG ===`);
        console.log(`FIDC ID: ${fidcId}`);
        console.log(`Amount: ${amount} Stablecoin`);
        console.log(`Is Approved: ${isApproved}`);
        console.log(`Using ${useDemoWallet ? 'demo wallet' : 'connected wallet'}: ${signer.address}`);
        console.log(`============================\n`);

        const amountBigInt = ethers.parseEther(amount);

        // Aprovar o token ERC20 para ser usado pelo contrato FIDC
        const approveGasLimit = 1000000;
        console.log(`Usando limite de gás fixo para approve: ${approveGasLimit.toLocaleString()} unidades`);

        // Usar o mesmo contrato ERC20 com o signer correto
        const erc20Contract = new ethers.Contract(
          ERC20Mock_address,
          erc20_abi,
          signer
        );

        const approveTx = await erc20Contract.approve(
          FIDC_Management_address,
          amountBigInt,
          { gasLimit: approveGasLimit }
        );
        await approveTx.wait();
        console.log("Token approval completed");

        // Usar o mesmo contrato FIDC com o signer correto
        const fidcContractWithSigner = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        console.log(`Usando limite de gás fixo: ${gasLimit.toLocaleString()} unidades`);

        const tx = await fidcContractWithSigner.approvedOfficialPayable(
          fidcId,
          amountBigInt,
          isApproved,
          { gasLimit }
        );
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);
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
        // Obter os detalhes do FIDC primeiro usando uma wallet qualquer (preferivelmente demo para consulta)
        const demoWalletCheck = await getContracts(true);
        const connectedWalletCheck = isConnected
          ? await getContracts(false)
          : null;

        // Obter o endereço da demo wallet independente do parâmetro useDemoWallet
        const demoWalletAddress = demoWalletCheck.signer.address;

        // Verificar quem é o manager atual do FIDC
        const fidc = await demoWalletCheck.fidcContract.fidcs(fidcId);

        console.log("Manager do FIDC:", fidc.manager);
        console.log("Endereço demo wallet:", demoWalletAddress);
        console.log("Endereço conectado:", address);

        // Verificar se o manager do FIDC é a demo wallet
        const isManagerDemoWallet =
          fidc.manager.toLowerCase() === demoWalletAddress.toLowerCase();

        // Verificar se o manager do FIDC é a wallet conectada
        const isManagerConnectedWallet =
          address && fidc.manager.toLowerCase() === address.toLowerCase();

        // Use a demo wallet APENAS se o manager for a demo wallet
        // Se o manager for a wallet conectada, use a wallet conectada
        // Se o parâmetro useDemoWallet for verdadeiro, mas o manager NÃO for a demo wallet,
        // ainda assim use a wallet correta
        const finalUseDemoWallet = isManagerDemoWallet;

        console.log(
          "Quem é o manager do FIDC?",
          isManagerDemoWallet
            ? "Demo Wallet"
            : isManagerConnectedWallet
            ? "Connected Wallet"
            : "Outro endereço"
        );
        console.log(
          "Usando wallet para transação:",
          finalUseDemoWallet ? "Demo Wallet" : "Connected Wallet"
        );

        // Obter o contrato final com o signer correto
        const { fidcContract: finalContract, signer: finalSigner } =
          await getContracts(finalUseDemoWallet);

        console.log(
          `Aprovando investidor ${investor} como ${
            type === 0 ? "Sênior" : "Subordinado"
          } no FIDC ID: ${fidcId}`
        );
        console.log(`Executando transação com: ${finalSigner.address}`);

        // Usar o contrato com o signer adequado
        const tx = await finalContract.approveInvestor(
          [investor],
          type,
          fidcId,
          {
            gasLimit,
          }
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
    [getContracts, gasLimit, address, isConnected]
  );

  const approveManager = useCallback(
    async (manager: string, useDemoWallet = true) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract, signer } = await getContracts(useDemoWallet);

        console.log(
          `Aprovando manager ${manager} usando carteira demo: ${signer.address}`
        );
        console.log([manager], { gasLimit });

        const tx = await (fidcContract as any).approveManager([manager], {
          gasLimit,
        });
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error approving manager:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, gasLimit]
  );

  // Adicionar após a função approveManager e antes da função invest
  const approvedValidator = useCallback(
    async (validator: string, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract, signer } = await getContracts(useDemoWallet);

        console.log(
          `Aprovando validator ${validator} usando carteira demo: ${signer.address}`
        );
        console.log([validator], { gasLimit });

        const tx = await (fidcContract as any).approvedValidator([validator], {
          gasLimit,
        });
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error approving validator:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, gasLimit]
  );

  const approvePayable = useCallback(
    async (payable: string, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract, signer } = await getContracts(useDemoWallet);

        console.log(
          `Aprovando payable ${payable} usando carteira demo: ${signer.address}`
        );
        console.log([payable], { gasLimit });

        const tx = await (fidcContract as any).approvePayable([payable], {
          gasLimit,
        });
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error approving payable:", err);
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

        const investorPosition = await fidcContract.getInvestorPosition(
          currentAddress!,
          fidcId
        );
        const isSenior = investorPosition.investments.some(
          (inv) => inv.isSenior
        );

        const fidcDetails = await fidcContract.fidcs(fidcId);
        const totalInvested = fidcDetails.invested;

        let seniorInvested = BigInt(0);
        for (const investment of investorPosition.investments) {
          if (investment.isSenior) {
            seniorInvested += investment.amount;
          }
        }

        const amountBigInt = ethers.parseEther(amount);

        // Aprovar o token ERC20 para ser usado pelo contrato FIDC
        console.log(
          `Aprovando ${amount} Stablecoin para uso pelo contrato FIDC`
        );
        const approveGasLimit = 3000000;

        const approveTx = await drexContract.approve(
          FIDC_Management_address,
          amountBigInt,
          { gasLimit: approveGasLimit }
        );
        await approveTx.wait();
        console.log("Aprovação concluída");

        // Fazer o investimento
        const investGasLimit = 3000000;
        console.log(`Investindo ${amount} Stablecoin no FIDC ID: ${fidcId}`);
        console.log(`Investidor: ${currentAddress}`);
        console.log(`Tipo: ${isSenior ? "Sênior" : "Subordinado"}`);

        const tx = await fidcContract.invest(fidcId, amountBigInt, {
          gasLimit: investGasLimit,
        });
        setTxHash(tx.hash);

        const receipt = await tx.wait();
        return { success: true, receipt };
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
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const amountBigInt = ethers.parseEther(amount);

        const redeemGasLimit = 3000000;
        console.log(`\n=== RESGATANDO INVESTIMENTO ===`);
        console.log(`FIDC ID: ${fidcId}`);
        console.log(`Investment ID: ${investmentId}`);
        console.log(`Valor: ${amount} Stablecoin`);
        console.log(`Investidor: ${address}`);
        console.log(
          `Limite de gás: ${redeemGasLimit.toLocaleString()} unidades`
        );
        console.log(`===========================\n`);

        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const tx = await contract.redeem(fidcId, investmentId, amountBigInt, {
          gasLimit: redeemGasLimit,
        });
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
        const { signer } = await getContracts(useDemoWallet);

        console.log(`\n=== RESGATANDO TODO O INVESTIMENTO ===`);
        console.log(`FIDC ID: ${fidcId}`);
        console.log(`Investment ID: ${investmentId}`);
        console.log(`Investidor: ${signer.address}`);
        console.log(`===========================\n`);

        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const redeemGasLimit = 3000000;
        const tx = await contract.redeemAll(fidcId, investmentId, {
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
        // Se não estiver usando demo wallet, usa o fluxo normal com carteira conectada
        if (!useDemoWallet) {
          if (!isConnected || !address) {
            throw new Error("Wallet not connected");
          }
          const { fidcContract } = await getContracts(false);

          // Verificar se o endereço conectado é o gestor
          const fidc = await fidcContract.fidcs(fidcId);
          if (fidc.manager.toLowerCase() !== address.toLowerCase()) {
            throw new Error("Only manager can use redeemAllManager");
          }

          console.log(
            `\n=== GESTOR RESGATANDO TODOS OS INVESTIMENTOS (WALLET CONECTADA) ===`
          );
          console.log(`FIDC ID: ${fidcId}`);
          console.log(`Investidores: ${investors.join(", ")}`);
          console.log(`Gestor: ${address}`);

          const tx = await fidcContract.redeemAllManager(fidcId, investors, {
            gasLimit: 5000000,
          });

          setTxHash(tx.hash);
          const receipt = await tx.wait();
          return { success: true, receipt };
        }

        // Fluxo usando demo wallet
        const { fidcContract, signer } = await getContracts(true);
        const demoAddress = signer.address;

        console.log(
          `\n=== GESTOR RESGATANDO TODOS OS INVESTIMENTOS (DEMO WALLET) ===`
        );
        console.log(`Demo Address: ${demoAddress}`);
        console.log(`FIDC ID: ${fidcId}`);
        console.log(`Investidores: ${investors.join(", ")}`);

        // Primeiro aprova a demo wallet como manager
        // const tx1 = await fidcContract.approveManager([demoAddress], {
        //   gasLimit,
        // });
        // await tx1.wait();
        // console.log("Demo wallet aprovada como manager");

        // Verifica se a aprovação funcionou
        const fidc = await fidcContract.fidcs(fidcId);
        if (fidc.manager.toLowerCase() !== demoAddress.toLowerCase()) {
          throw new Error("demo wallet nao e manager do fidc");
        }

        // Executa o redeemAllManager
        const tx2 = await fidcContract.redeemAllManager(fidcId, investors, {
          gasLimit: 5000000,
        });

        setTxHash(tx2.hash);
        const receipt = await tx2.wait();
        console.log("Transaction receipt:", receipt);

        return { success: true, receipt };
      } catch (err) {
        console.error("Error in manager redeeming all investments:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, isConnected, address, gasLimit]
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

        const drexContractAny = drexContract as any;
        console.log(
          `Realizando mint de ${amount} Stablecoin para ${recipient}`
        );
        const tx = await drexContractAny.mint(
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
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const fidc = await fidcContract.fidcs(fidcId);
        if (fidc.manager.toLowerCase() !== address!.toLowerCase()) {
          setError("Apenas o gestor pode parar um FIDC");
          return { success: false, error: "Only manager can stop FIDC" };
        }

        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const tx = await contract.stopFIDC(fidcId, { gasLimit });
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
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const fidc = await fidcContract.fidcs(fidcId);
        if (fidc.manager.toLowerCase() !== address!.toLowerCase()) {
          setError("Apenas o gestor pode iniciar a liquidação de um FIDC");
          return { success: false, error: "Only manager can liquidate FIDC" };
        }

        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const tx = await contract.initiateLiquidation(fidcId, { gasLimit });
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

  const getAllInvestors = useCallback(
    async (fidcId: number, useDemoWallet = false) => {
      try {
        const { fidcContract } = await getContracts(useDemoWallet);
        
        // Chamar a função do contrato que retorna os arrays
        const result = await fidcContract.getAllInvestors(fidcId);
        
        // Formatar os valores retornados
        const formattedResult = {
          investors: result.investors,
          isSenior: result.isSenior,
          amounts: result.amounts.map((amount: bigint) => ethers.formatEther(amount))
        };

        return formattedResult;
      } catch (err) {
        console.error("Error getting investors:", err);
        throw err;
      }
    },
    [getContracts]
  );

  const compensationPay = useCallback(
    async (fidcId: number, amount: string, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { drexContract, fidcContract, signer } = await getContracts(useDemoWallet);
        const currentAddress = useDemoWallet ? signer.address : address;

        if (!amount || isNaN(Number(amount))) {
          throw new Error("Valor inválido");
        }

        const amountBigInt = ethers.parseEther(amount);

        // Aprovar o token DREX primeiro
        console.log(`Aprovando ${amount} Stablecoin para o contrato FIDC...`);
        const approveGasLimit = 1000000;
        
        const approveTx = await drexContract.approve(
          FIDC_Management_address,
          amountBigInt,
          { gasLimit: approveGasLimit }
        );
        await approveTx.wait();
        console.log("Aprovação do Stablecoin concluída");

        // Executar o compensationPay
        console.log(`Executando compensationPay de ${amount} Stablecoin...`);
        const tx = await fidcContract.compensationPay(fidcId, amountBigInt, {
          gasLimit: 3000000,
        });

        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        console.error("Error in compensation pay:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts, address]
  );

  const getFIDCScheduleAmount = useCallback(
    async (fidcId: number, useDemoWallet = false) => {
      try {
        const { fidcContract } = await getContracts(useDemoWallet);
        const amount = await fidcContract.fidcScheduleAmount(fidcId);
        return ethers.formatEther(amount);
      } catch (err) {
        console.error("Error getting FIDC schedule amount:", err);
        throw err;
      }
    },
    [getContracts]
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
    approveManager,
    approvedValidator,
    approvePayable,
    invest,
    redeem,
    redeemAll,
    redeemAllManager,
    getFIDCDetails,
    getInvestorPosition,
    fundInvestorWallet,
    stopFIDC,
    initiateLiquidation,
    getAllInvestors,
    getContracts,
    compensationPay,
    getFIDCScheduleAmount,
  };
}
