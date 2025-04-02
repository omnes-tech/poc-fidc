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

  const getContracts = useCallback(async () => {
    if (!walletClient || !isConnected || !address) {
      throw new Error("Wallet not connected");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

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

    return { fidcContract, drexContract, signer };
  }, [walletClient, isConnected, address]);

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

        // Estimar o custo de gás
        const feeData = await provider.getFeeData();
        const estimatedGasCost =
          (feeData.gasPrice || BigInt(0)) * BigInt(1000000);
        console.log("Estimated gas cost (wei):", estimatedGasCost.toString());
        console.log(
          "Estimated gas cost (POL):",
          ethers.formatEther(estimatedGasCost)
        );

        // Verificar se há saldo suficiente
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

        // Imprimir os valores dos parâmetros para debugging
        console.log("initializeFIDC parameters recebidos:", {
          manager,
          validator,
          payable,
          fee,
          annualYield,
          gracePeriod,
          seniorSpread,
        });

        // Verificar se algum dos endereços é inválido
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

        // Validar parâmetros de acordo com as limitações do contrato
        // Período de carência: entre 1 e 365 dias
        const ONE_DAY_IN_SECONDS = 86400;
        const MIN_GRACE_PERIOD = ONE_DAY_IN_SECONDS; // 1 dia em segundos
        const MAX_GRACE_PERIOD = 365 * ONE_DAY_IN_SECONDS; // 365 dias em segundos

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

        // Validar spread de senior: máximo 20% (2000 BPS)
        const MAX_SENIOR_SPREAD = 2000; // 20% em BPS
        if (seniorSpread > MAX_SENIOR_SPREAD) {
          setError(
            `Spread de senior muito alto. Máximo: ${MAX_SENIOR_SPREAD / 100}%`
          );
          return { success: false, error: "Senior spread too high" };
        }

        // Validar taxa: deve ser razoável (assumimos máximo de 10%)
        const MAX_FEE = 1000; // 10% em BPS
        if (fee > MAX_FEE) {
          setError(`Taxa muito alta. Máximo recomendado: ${MAX_FEE / 100}%`);
          return { success: false, error: "Fee too high" };
        }

        // Validar rendimento anual (baseado na interface, parece ter um máximo)
        const MAX_YIELD = 5000; // 50% em BPS (assumindo um limite razoável)
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

        // Tentar fazer uma estimativa mais precisa do gás se o gás fixo for muito alto
        let gasToUse = gasLimit;
        try {
          // Estimar o gás necessário para a transação
          const gasEstimate = await rawContract.initializeFIDC.estimateGas(
            manager,
            validator,
            payable,
            feeParam,
            annualYieldParam,
            gracePeriodParam,
            seniorSpreadParam
          );

          // Adicionar uma margem de segurança de 20% à estimativa
          const safeGasEstimate = Math.floor(Number(gasEstimate) * 1.2);

          // Usar a estimativa se for menor que o limite fixo, mas não menos que 150,000
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

        // Preparar os dados da transação com gasLimit ajustado
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

        // Esperando o recibo da transação
        console.log("Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        // Se a transação foi confirmada mas o status é 0, isso significa que ela reverteu na blockchain
        if (receipt && receipt.status === 0) {
          console.error("Transaction reverted on-chain:", receipt);

          // Tentar buscar mais detalhes sobre o motivo da reversão
          try {
            // Usar o trace de execução para tentar encontrar o motivo da reversão
            const trace = await provider.call({
              to: tx.to,
              from: tx.from,
              data: tx.data,
              gasLimit: tx.gasLimit,
            });
            console.log("Transaction trace:", trace);
          } catch (traceErr: any) {
            // Se a chamada falhar com uma mensagem específica, podemos extrair o motivo da reversão
            if (traceErr.data || traceErr.message) {
              const errorMsg = traceErr.data || traceErr.message;
              console.error("Revert reason:", errorMsg);
              setError(`Transação revertida: ${errorMsg}`);
              return { success: false, error: `Revert reason: ${errorMsg}` };
            }
          }

          // Se não conseguirmos extrair um motivo específico, usamos uma mensagem genérica
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

        // Verificar se o erro está relacionado à execução revertida
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
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

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

        // Criar uma instância do contrato com o signer que inclui as opções de overrides
        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        // Chamar o método do contrato com overrides como último parâmetro
        const tx = await contract.approvedEmissionValidator(
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
        
        // Tratamento de erros
        if (err.code === -32603) {
          setError("Internal JSON-RPC error. Try with different parameters or contact support.");
        } else if (err.message && err.message.includes("gas required exceeds")) {
          setError("Transaction needs more gas than provided. Try increasing gas limit.");
        } else if (err.message && err.message.includes("user rejected")) {
          setError("Transaction was rejected in your wallet.");
        } else if (err.message && err.message.includes("insufficient funds")) {
          setError("You don't have enough ETH to pay for gas fees.");
        } else {
          setError(err instanceof Error ? err.message : "Unknown error occurred");
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
        const { drexContract } = await getContracts();
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const amountBigInt = ethers.parseEther(amount);

        // Usando contrato ERC20 com método raw para poder passar opções de transação
        const erc20Contract = new ethers.Contract(
          ERC20Mock_address,
          erc20_abi,
          signer
        );

        // Aprovação do token ERC20
        const approveGasLimit = 1000000;
        console.log(
          `Usando limite de gás fixo para approve: ${approveGasLimit.toLocaleString()} unidades`
        );

        const approveTx = await erc20Contract.approve(
          FIDC_Management_address,
          amountBigInt,
          { gasLimit: approveGasLimit }
        );
        await approveTx.wait();

        // Criar nova instância do contrato FIDC
        const fidcContract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

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
    async (investor: string, type: number, fidcId: number) => {
      setIsProcessing(true);
      setError(null);

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Criar nova instância do contrato com signer
        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const tx = await contract.approveInvestor(
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
    async (fidcId: number, amount: string) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract, drexContract } = await getContracts();
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Verificar a posição atual do investidor para determinar se é sênior ou subordinado
        const investorPosition = await fidcContract.getInvestorPosition(
          address!,
          fidcId
        );
        const isSenior = investorPosition.investments.some(
          (inv) => inv.isSenior
        );

        // Buscar detalhes do FIDC
        const fidcDetails = await fidcContract.fidcs(fidcId);
        const totalInvested = fidcDetails.invested;

        // Obter a posição de todos os investimentos e calcular quanto é senior
        const allPositions = await fidcContract.getInvestorPosition(
          address!,
          fidcId
        );
        let seniorInvested = BigInt(0);

        // Como não temos acesso direto a todo o valor de investimentos senior,
        // podemos usar esta abordagem apenas para validação da proporção no lado do cliente
        for (const investment of allPositions.investments) {
          if (investment.isSenior) {
            seniorInvested += investment.amount;
          }
        }

        // Validar a proporção sênior/subordinado (MIN_SENIOR_RATIO = 50%)
        // Este teste só se aplica para investimentos subordinados
        if (!isSenior) {
          const amountBigInt = ethers.parseEther(amount);
          const newTotalInvested = totalInvested + amountBigInt;
          const MIN_SENIOR_RATIO = 5000; // 50% em BPS

          // Calcular nova proporção senior após este investimento
          const seniorRatioBps =
            (seniorInvested * BigInt(10000)) / newTotalInvested;

          if (seniorRatioBps < BigInt(MIN_SENIOR_RATIO)) {
            setError(
              `Proporção mínima de investimento sênior não atingida. Proporção atual: ${
                Number(seniorRatioBps) / 100
              }%. Mínimo necessário: ${MIN_SENIOR_RATIO / 100}%`
            );
            return { success: false, error: "Senior ratio too low" };
          }
        }

        const amountBigInt = ethers.parseEther(amount);

        // Usar contrato ERC20 raw para poder passar opções de transação
        const erc20Contract = new ethers.Contract(
          ERC20Mock_address,
          erc20_abi,
          signer
        );

        // Aprovação do token
        const approveGasLimit = 3000000;
        console.log(
          `Usando limite de gás fixo para approve: ${approveGasLimit.toLocaleString()} unidades`
        );

        const approveTx = await erc20Contract.approve(
          FIDC_Management_address,
          amountBigInt,
          { gasLimit: approveGasLimit }
        );
        await approveTx.wait();

        // Investimento
        const investGasLimit = 3000000;
        console.log(
          `Usando limite de gás fixo para investimento: ${investGasLimit.toLocaleString()} unidades`
        );

        console.log(`Investindo ${amount} DREX no FIDC ID: ${fidcId}`);
        console.log(`Investidor: ${address}`);
        console.log(`Tipo: ${isSenior ? "Sênior" : "Subordinado"}`);

        // Criar nova instância do contrato
        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const tx = await contract.invest(
          fidcId, 
          amountBigInt,
          { gasLimit: investGasLimit }
        );
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
        console.log(`Valor: ${amount} DREX`);
        console.log(`Investidor: ${address}`);
        console.log(
          `Limite de gás: ${redeemGasLimit.toLocaleString()} unidades`
        );
        console.log(`===========================\n`);

        // Criar nova instância do contrato
        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const tx = await contract.redeem(
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

  const getFIDCDetails = useCallback(
    async (fidcId: number) => {
      try {
        const { fidcContract } = await getContracts();
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
    async (investor: string, fidcId: number) => {
      try {
        const { fidcContract } = await getContracts();
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

  // Função para enviar tokens DREX para endereços de investidores
  const fundInvestorWallet = useCallback(
    async (recipient: string, amount: string) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { drexContract } = await getContracts();

        // Verificar o saldo atual
        const currentBalance = await drexContract.balanceOf(recipient);
        console.log(
          `Saldo atual de ${recipient}: ${ethers.formatEther(
            currentBalance
          )} DREX`
        );

        // Verificar se o contrato tem método mint (caso seja um contrato de teste)
        const drexContractAny = drexContract as any;
        if (typeof drexContractAny.mint === "function") {
          console.log(`Realizando mint de ${amount} DREX para ${recipient}`);
          const tx = await drexContractAny.mint(
            recipient,
            ethers.parseEther(amount)
          );
          await tx.wait();
          console.log(`Mint realizado com sucesso!`);
        } else {
          // Caso não tenha mint, tentar transferir do próprio endereço
          console.log(`Transferindo ${amount} DREX para ${recipient}`);
          const tx = await drexContract.transfer(
            recipient,
            ethers.parseEther(amount)
          );
          await tx.wait();
          console.log(`Transferência realizada com sucesso!`);
        }

        // Verificar o novo saldo
        const newBalance = await drexContract.balanceOf(recipient);
        console.log(
          `Novo saldo de ${recipient}: ${ethers.formatEther(newBalance)} DREX`
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

  // Parar um FIDC (status STOPPED)
  const stopFIDC = useCallback(
    async (fidcId: number) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts();
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Verificar se quem chamou é o manager
        const fidc = await fidcContract.fidcs(fidcId);
        if (fidc.manager.toLowerCase() !== address!.toLowerCase()) {
          setError("Apenas o gestor pode parar um FIDC");
          return { success: false, error: "Only manager can stop FIDC" };
        }

        // Criar nova instância do contrato
        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const tx = await contract.stopFIDC(
          fidcId,
          { gasLimit }
        );
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

  // Iniciar liquidação de um FIDC (status LIQUIDATED)
  const initiateLiquidation = useCallback(
    async (fidcId: number) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts();
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Verificar se quem chamou é o manager
        const fidc = await fidcContract.fidcs(fidcId);
        if (fidc.manager.toLowerCase() !== address!.toLowerCase()) {
          setError("Apenas o gestor pode iniciar a liquidação de um FIDC");
          return { success: false, error: "Only manager can liquidate FIDC" };
        }

        // Criar nova instância do contrato
        const contract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const tx = await contract.initiateLiquidation(
          fidcId,
          { gasLimit }
        );
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
    getFIDCDetails,
    getInvestorPosition,
    stopFIDC,
    initiateLiquidation,
    fundInvestorWallet,
    getContracts,
  };
}
