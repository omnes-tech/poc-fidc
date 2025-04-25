"use client";
import {
  adminAddresses,
  collateral_address,
  ERC20Mock_address,
  FIDC_Management_address,
} from "@/constants";
import {
  Fidc__factory,
  Erc20__factory,
  Collateral__factory,
} from "@/contracts";
import { ethers } from "ethers";
import { useCallback, useEffect, useState } from "react";

export function useContract() {
  const [fidcId, setFidcId] = useState<number | null>(null);
  const [stablecoinBalance, setStablecoinBalance] = useState<string>("0");
  const [receivablesBalance, setReceivablesBalance] = useState<string>("0");
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const getContracts = useCallback(async () => {
    const provider = await getProvider();
    const fidcContract = Fidc__factory.connect(
      FIDC_Management_address,
      provider
    );
    const drexContract = Erc20__factory.connect(ERC20Mock_address, provider);
    return { fidcContract, drexContract };
  }, []);

  const updateBalances = useCallback(async () => {
    if (!fidcId) return;

    try {
      const provider = await getProvider();
      const { fidcContract, drexContract } = await getContracts();

      // Atualiza saldo de stablecoin
      const stablecoinBal = await drexContract.balanceOf(
        FIDC_Management_address
      );
      setStablecoinBalance(ethers.formatEther(stablecoinBal));
      addLog(`Stablecoin balance: ${ethers.formatEther(stablecoinBal)}`);

      // Obtém endereço do receivable do FIDC
      const receivableAddress = await fidcContract.getFIDCReceivable(fidcId);
      addLog(`Receivable address for FIDC ${fidcId}: ${receivableAddress}`);

      if (receivableAddress && receivableAddress !== ethers.ZeroAddress) {
        // Conecta ao contrato de receivables usando o provider obtido
        const receivableContract = Erc20__factory.connect(
          receivableAddress,
          provider
        );

        try {
          // Obtém o saldo de receivables do contrato FIDC
          const receivablesBal = await receivableContract.balanceOf(
            FIDC_Management_address
          );
          setReceivablesBalance(ethers.formatEther(receivablesBal));
          addLog(
            `Receivables balance of FIDC: ${ethers.formatEther(receivablesBal)}`
          );
        } catch (error) {
          console.error("Error getting receivables balance:", error);
          addLog(`Error getting receivables balance: ${error}`);
        }
      } else {
        setReceivablesBalance("0");
        addLog("No receivable address found for this FIDC");
      }
    } catch (error) {
      console.error("Error updating balances:", error);
      addLog(`Error updating balances: ${error}`);
    }
  }, [fidcId, getContracts, addLog]);

  async function getProvider() {
    const rpc =
      "https://eth-holesky.g.alchemy.com/v2/UTe3D7JmoPvgh36ldqaV-7BlAeQ0oCgx";
    const provider = new ethers.JsonRpcProvider(rpc);
    return provider;
  }

  async function getWallet(type: "pj" | "adqui" | "manager" | "demo") {
    const privateKey =
      type === "pj"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_PJ
        : type === "adqui"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_ADQUIRENTE
        : type === "demo"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_DEMO
        : process.env.NEXT_PUBLIC_PRIVATE_KEY_MANAGER;

    const provider = await getProvider();
    const wallet = new ethers.Wallet(privateKey!, provider);
    return wallet;
  }

  async function parseEvents(
    receipt: ethers.TransactionReceipt | null,
    contractInstance: any
  ) {
    const events = [];
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsedLog = contractInstance.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsedLog) {
            events.push({ name: parsedLog.name, args: parsedLog.args });
          }
        } catch (error) {
          continue;
        }
      }
    }
    return events;
  }

  async function onInitializeFIDC() {
    try {
      setIsProcessing(true);
      setError(null);
      addLog("Initializing FIDC...");

      const managerWallet = await getWallet("manager");
      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        managerWallet
      );
      const fidcConfig = { fee: 100, annual: 1800, grace: 86400, senior: 500 };

      addLog(`Using manager wallet: ${managerWallet.address}`);
      addLog("Sending initializeFIDC transaction...");

      const initializeTx = await fidcContract.initializeFIDC(
        adminAddresses.manager_address,
        adminAddresses.pj_address,
        adminAddresses.adqui_address,
        fidcConfig.fee,
        fidcConfig.annual,
        fidcConfig.grace,
        fidcConfig.senior
      );

      addLog(`Transaction sent: ${initializeTx.hash}`);
      setTxHash(initializeTx.hash);

      const receipt = await initializeTx.wait();
      addLog("Transaction confirmed!");

      const events = await parseEvents(receipt, fidcContract);
      events.forEach((event) => {
        addLog(`Event emitted: ${event.name}`);
      });

      const fidcCreatedEvent = events.find(
        (event) => event.name === "FIDCCreated"
      );

      const newFidcId = fidcCreatedEvent ? fidcCreatedEvent.args[0] : null;

      if (newFidcId) {
        setFidcId(newFidcId);
        addLog(`New FIDC created with ID: ${newFidcId}`);
      }

      await updateBalances();
      addLog("FIDC initialization completed successfully");

      return {
        receipt,
        events,
        fidcId: newFidcId,
      };
    } catch (err: any) {
      setError(err.message || "Error initializing FIDC");
      addLog(`Error: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }

  async function onInvestFIDC(investFidcId: number, amount: number) {
    try {
      setIsProcessing(true);
      setError(null);
      const newAmount = ethers.parseEther(amount.toString());
      addLog(`Investing ${newAmount} tokens in FIDC ID: ${investFidcId}...`);

      const demoWallet = await getWallet("demo");
      addLog(`Using demo wallet: ${demoWallet.address}`);

      const erc20Contract = Erc20__factory.connect(
        ERC20Mock_address,
        demoWallet
      );
      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        demoWallet
      );

      // Verificar saldo de quotas antes do investimento
      const quotasBeforeInvestment = await fidcContract.balanceOf(
        demoWallet.address
      );
      addLog(
        `Quotas before investment: ${ethers.formatEther(
          quotasBeforeInvestment
        )}`
      );

      addLog("Sending approve transaction...");
      const approveTx = await erc20Contract.approve(
        FIDC_Management_address,
        newAmount
      );

      addLog(`Approval transaction sent: ${approveTx.hash}`);
      setTxHash(approveTx.hash);

      const approveReceipt = await approveTx.wait();
      addLog("Approval transaction confirmed!");

      const approveEvents = await parseEvents(approveReceipt, erc20Contract);
      approveEvents.forEach((event) => {
        addLog(`Approval event: ${event.name}`);
        if (event.name === "Approval") {
          addLog(
            `Approved: ${event.args[0]} -> ${
              event.args[1]
            }: ${ethers.formatEther(event.args[2])} tokens`
          );
        }
      });

      addLog("Sending investment transaction...");
      const investTx = await fidcContract.invest(investFidcId, newAmount);

      addLog(`Investment transaction sent: ${investTx.hash}`);
      setTxHash(investTx.hash);

      const investReceipt = await investTx.wait();
      addLog("Investment transaction confirmed!");

      // Verificar saldo de quotas após o investimento
      const quotasAfterInvestment = await fidcContract.balanceOf(
        demoWallet.address
      );
      const quotasMinted = quotasAfterInvestment - quotasBeforeInvestment;
      addLog(
        `Quotas after investment: ${ethers.formatEther(quotasAfterInvestment)}`
      );
      addLog(`Total quotas minted: ${ethers.formatEther(quotasMinted)}`);

      const investEvents = await parseEvents(investReceipt, fidcContract);
      investEvents.forEach((event) => {
        addLog(`Investment event: ${event.name}`);
        if (event.name === "Investment" || event.name === "QuotasMinted") {
          addLog(
            `Investment details: ${JSON.stringify(
              event.args.map((arg: any) => arg.toString())
            )}`
          );
        }
      });

      await updateBalances();
      addLog("Investment completed successfully");

      return {
        approveReceipt,
        approveEvents,
        investReceipt,
        investEvents,
        quotasMinted: ethers.formatEther(quotasMinted),
      };
    } catch (err: any) {
      setError(err.message || "Error investing in FIDC");
      addLog(`Error: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }

  async function onAnticipation(anticipationFidcId: number, amount: number) {
    try {
      setIsProcessing(true);
      setError(null);
      const requestedAmount = ethers.parseEther(amount.toString());
      // Calcula o colateral necessário (120% do amount solicitado)
      const requiredCollateral = (requestedAmount * 120n) / 100n;

      addLog(
        `Iniciando antecipação...
        Amount solicitado: ${ethers.formatEther(requestedAmount)} Stablecoin
        Colateral necessário: ${ethers.formatEther(
          requiredCollateral
        )} Collateral`
      );

      // Usar a carteira PJ correta
      const pjWallet = await getWallet("pj");
      addLog(`Usando carteira PJ: ${pjWallet.address}`);

      // Verificar se é o endereço PJ correto
      if (
        pjWallet.address.toLowerCase() !==
        adminAddresses.pj_address.toLowerCase()
      ) {
        throw new Error("Endereço incorreto para operação de PJ");
      }

      // Verificar e fornecer colateral se necessário
      const collateralContract = Collateral__factory.connect(
        collateral_address,
        pjWallet
      );

      const currentCollateral = await collateralContract.balanceOf(
        pjWallet.address
      );
      addLog(`Colateral atual da PJ: ${ethers.formatEther(currentCollateral)}`);

      if (currentCollateral < requiredCollateral) {
        addLog(
          "Colateral insuficiente. Realizando mint do colateral necessário..."
        );
        const mintTx = await collateralContract.mint(
          pjWallet.address,
          requiredCollateral
        );
        await mintTx.wait();
        addLog(
          `Mint de ${ethers.formatEther(
            requiredCollateral
          )} colateral realizado`
        );
      }

      // Aprovar o contrato FIDC para usar o colateral
      addLog("Aprovando uso do colateral pelo contrato FIDC...");
      const approveTx = await collateralContract.approve(
        FIDC_Management_address,
        requiredCollateral
      );
      await approveTx.wait();
      addLog("Aprovação do colateral concluída");

      // Realizar a antecipação
      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        pjWallet
      );

      addLog("Enviando transação de antecipação...");
      const anticipationTx = await fidcContract.anticipation(
        requestedAmount,
        collateral_address,
        anticipationFidcId,
        { gasLimit: 1000000 }
      );

      addLog(`Transação enviada: ${anticipationTx.hash}`);
      setTxHash(anticipationTx.hash);

      const receipt = await anticipationTx.wait();
      addLog("Transação confirmada!");

      const events = await parseEvents(receipt, fidcContract);
      events.forEach((event) => {
        addLog(`Evento: ${event.name}`);
      });

      const anticipationEvent = events.find(
        (event) => event.name === "Anticipation"
      );

      if (anticipationEvent) {
        const { args } = anticipationEvent;
        addLog(`
          Antecipação processada:
          FIDC ID: ${args[0]}
          PJ: ${args[1]}
          Amount: ${ethers.formatEther(args[2])} Stablecoin
          Colateral: ${args[3]}
          Colateral Required: ${ethers.formatEther(args[4])}
        `);
      }

      await updateBalances();
      addLog("Processo de antecipação concluído com sucesso");

      return {
        receipt,
        events,
        anticipationEvent,
      };
    } catch (err: any) {
      setError(err.message || "Erro no processo de antecipação");
      addLog(`Erro: ${err.message || "Erro desconhecido"}`);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }

  async function onCompensation(compensationFidcId: number) {
    try {
      setIsProcessing(true);
      setError(null);
      addLog(
        `Processing compensation payment for FIDC ID: ${compensationFidcId}...`
      );

      const adquiWallet = await getWallet("adqui");
      addLog(`Using adquirente wallet: ${adquiWallet.address}`);

      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        adquiWallet
      );

      // Obtém endereço do receivable do FIDC
      addLog("Getting receivable address...");
      const receivableAddress = await fidcContract.getFIDCReceivable(
        compensationFidcId
      );
      addLog(`Receivable address: ${receivableAddress}`);

      if (!receivableAddress || receivableAddress === ethers.ZeroAddress) {
        throw new Error("No receivable address found for this FIDC");
      }

      // Conecta ao contrato de receivables
      const receivableContract = Erc20__factory.connect(
        receivableAddress,
        adquiWallet
      );

      // Obtém o saldo de receivables do FIDC
      const receivablesBal = await receivableContract.balanceOf(
        FIDC_Management_address
      );
      const receivablesAmount = ethers.formatEther(receivablesBal);
      addLog(`Receivables to compensate: ${receivablesAmount}`);

      // Conecta ao contrato de stablecoin (ERC20Mock)
      const stablecoinContract = Erc20__factory.connect(
        ERC20Mock_address,
        adquiWallet
      );

      // Verifica o saldo de stablecoins do adquirente
      const adquiBalance = await stablecoinContract.balanceOf(
        adquiWallet.address
      );
      addLog(
        `Current adquirente stablecoin balance: ${ethers.formatEther(
          adquiBalance
        )}`
      );

      // Se o saldo for insuficiente, faz o mint
      if (adquiBalance < receivablesBal) {
        addLog("Insufficient stablecoin balance. Minting required amount...");
        const mintTx = await stablecoinContract.mint(
          adquiWallet.address,
          receivablesBal
        );
        await mintTx.wait();
        addLog(`Minted ${receivablesAmount} stablecoins to adquirente`);
      }

      // Aprova o FIDC para gastar os stablecoins
      addLog("Approving FIDC to spend stablecoins...");
      const approveTx = await stablecoinContract.approve(
        FIDC_Management_address,
        receivablesBal
      );
      await approveTx.wait();
      addLog(`Approved ${receivablesAmount} stablecoins for FIDC`);

      // Executa a compensação
      addLog("Sending compensation transaction...");
      const compensationTx = await fidcContract.compensationPay(
        compensationFidcId,
        receivablesBal,
        { gasLimit: 1000000 }
      );

      addLog(`Compensation transaction sent: ${compensationTx.hash}`);
      setTxHash(compensationTx.hash);

      const receipt = await compensationTx.wait();
      addLog("Compensation transaction confirmed!");

      const events = await parseEvents(receipt, fidcContract);
      events.forEach((event) => {
        addLog(`Event: ${event.name}`);
      });

      const compensationEvent = events.find(
        (event) => event.name === "CompensationProcessed"
      );

      if (compensationEvent) {
        const { args } = compensationEvent;
        addLog(`Compensation processed for FIDC ID: ${args[0]}`);
        addLog(`Adquirente: ${args[1]}`);
        addLog(`Amount: ${ethers.formatEther(args[2])}`);
        addLog(`Collateral Token: ${args[3]}`);
        addLog(`Collateral Amount: ${ethers.formatEther(args[4])}`);
        addLog(`Is External Collateral: ${args[5]}`);
      }

      await updateBalances();
      addLog("Compensation payment completed successfully");

      return { receipt, events, compensationEvent };
    } catch (err: any) {
      setError(err.message || "Error processing compensation");
      addLog(`Error: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }

  async function onRedeem(redeemFidcId: number) {
    try {
      setIsProcessing(true);
      setError(null);
      addLog(`Processing redemption for FIDC ID: ${redeemFidcId}...`);

      const managerWallet = await getWallet("manager");
      addLog(`Using manager wallet: ${managerWallet.address}`);

      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        managerWallet
      );

      addLog("Sending redemption transaction...");
      const redeemTx = await fidcContract.redeemAllManager(redeemFidcId, {
        gasLimit: 1000000,
      });

      addLog(`Redemption transaction sent: ${redeemTx.hash}`);
      setTxHash(redeemTx.hash);

      const receipt = await redeemTx.wait();
      addLog("Redemption transaction confirmed!");

      const events = await parseEvents(receipt, fidcContract);
      events.forEach((event) => {
        addLog(`Event: ${event.name}`);
      });
      console.log(events.map((e) => e.name));
      const redemptionEvents = events.filter(
        (e) => e.name === "FIDCRedemption"
      );

      if (redemptionEvents && redemptionEvents.length > 0) {
        addLog(`Found ${redemptionEvents.length} redemption events`);

        redemptionEvents.forEach((event, index) => {
          const { args } = event;
          addLog(`Redemption #${index + 1}:`);
          addLog(`FIDC ID: ${args[0]}`);
          addLog(`Investor: ${args[1]}`);
          addLog(`Investment Amount: ${ethers.formatEther(args[2])}`);
          addLog(`Gross Yield: ${ethers.formatEther(args[3])}`);
          addLog(`Net Yield: ${ethers.formatEther(args[4])}`);
          addLog(`Manager Fee: ${ethers.formatEther(args[5])}`);
          addLog(`Quotas Burned: ${args[6]}`);
          addLog(`Is Senior: ${args[7]}`);
          addLog(
            `Investment Date: ${new Date(
              Number(args[8]) * 1000
            ).toLocaleString()}`
          );
          addLog(
            `Redemption Date: ${new Date(
              Number(args[9]) * 1000
            ).toLocaleString()}`
          );
        });
      }

      await updateBalances();
      addLog("Redemption completed successfully");

      return {
        receipt,
        events,
        redemptionEvents,
      };
    } catch (err: any) {
      setError(err.message || "Error processing redemption");
      addLog(`Error: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }

  async function onGetFIDC(id: number) {
    addLog(`Getting FIDC ID: ${id}`);
    const demoWallet = await getWallet("demo");
    const fidcContract = Fidc__factory.connect(
      FIDC_Management_address,
      demoWallet
    );
    const fidc = await fidcContract.fidcs(id);
    if (fidc[7].toString() === "true") {
      addLog(`FIDC found: ${id}`);
      setFidcId(Number(id));
      return fidc;
    }
    addLog("FIDC not found");
    return null;
  }

  useEffect(() => {
    if (fidcId) updateBalances();
  }, [fidcId]);

  return {
    fidcId,
    setFidcId,
    onGetFIDC,
    stablecoinBalance,
    receivablesBalance,
    updateBalances,
    onInitializeFIDC,
    onInvestFIDC,
    onAnticipation,
    onCompensation,
    onRedeem,
    logs,
    addLog,
    clearLogs,
    isProcessing,
    error,
    txHash,
  };
}
