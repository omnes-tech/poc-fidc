"use client";
import {
  adminAddresses,
  collateral_address,
  ERC20Mock_address,
  FIDC_Management_address,
  cartao_address,
  duplicata_address,
} from "@/constants";
import {
  Fidc__factory,
  Erc20__factory,
  Collateral__factory,
} from "@/contracts";
import { ethers } from "ethers";
import { useCallback, useEffect, useState, useMemo } from "react";
import { debounce } from "lodash";

interface ContractState {
  fidcId: number | null;
  balances: {
    stablecoin: string;
    receivables: string;
  };
  transaction: {
    isProcessing: boolean;
    error: string | null;
    hash: string | null;
  };
  logs: string[];
}

export function useContract() {
  // Estado combinado
  const [state, setState] = useState<ContractState>({
    fidcId: null,
    balances: {
      stablecoin: "0",
      receivables: "0",
    },
    transaction: {
      isProcessing: false,
      error: null,
      hash: null,
    },
    logs: [],
  });

  // Helpers para atualizar partes específicas do estado
  const updateState = useCallback((updates: Partial<ContractState>) => {
    setState((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const updateBalanceState = useCallback(
    (updates: Partial<ContractState["balances"]>) => {
      setState((prev) => ({
        ...prev,
        balances: {
          ...prev.balances,
          ...updates,
        },
      }));
    },
    []
  );

  const updateTransactionState = useCallback(
    (updates: Partial<ContractState["transaction"]>) => {
      setState((prev) => ({
        ...prev,
        transaction: {
          ...prev.transaction,
          ...updates,
        },
      }));
    },
    []
  );

  // Função de log otimizada
  const addLog = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, `${new Date().toLocaleTimeString()}: ${message}`],
    }));
  }, []);

  const clearLogs = useCallback(() => {
    setState((prev) => ({
      ...prev,
      logs: [],
    }));
  }, []);

  // Primeiro, vamos memoizar o provider
  const memoizedProvider = useMemo(() => {
    const rpc =
      "https://eth-holesky.g.alchemy.com/v2/l_xElq5FQnfgvTtAPWMxME5joa3hZI46";
    return new ethers.JsonRpcProvider(rpc);
  }, []);

  // Agora vamos memoizar os contratos usando o provider memoizado
  const memoizedContracts = useMemo(() => {
    return {
      fidcContract: Fidc__factory.connect(
        FIDC_Management_address,
        memoizedProvider
      ),
      drexContract: Erc20__factory.connect(ERC20Mock_address, memoizedProvider),
    };
  }, [memoizedProvider]);

  // Atualizar a função getProvider para usar o provider memoizado
  const getProvider = useCallback(() => {
    return memoizedProvider;
  }, [memoizedProvider]);

  const updateBalances = useCallback(async () => {
    if (!state.fidcId) return;

    try {
      const provider = await getProvider();
      const { fidcContract, drexContract } = await memoizedContracts;

      // Atualiza saldo de stablecoin
      const stablecoinBal = await drexContract.balanceOf(
        FIDC_Management_address
      );
      updateBalanceState({ stablecoin: ethers.formatEther(stablecoinBal) });
      addLog(
        `Verificando saldo de Stablecoin: ${ethers.formatEther(stablecoinBal)}`
      );

      // Obtém endereço do receivable do FIDC
      const receivableAddress = await fidcContract.getFIDCReceivable(
        state.fidcId
      );
      addLog(
        `Endereço dos Recebíveis do FIDC ${state.fidcId}: ${receivableAddress}`
      );

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
          updateBalanceState({
            receivables: ethers.formatEther(receivablesBal),
          });
          addLog(
            `Saldo de Recebíveis do FIDC: ${ethers.formatEther(receivablesBal)}`
          );
        } catch (error) {
          console.error("Error getting receivables balance:", error);
          addLog(`Error getting receivables balance: ${error}`);
        }
      } else {
        updateBalanceState({ receivables: "0" });
        addLog("Nenhum endereço de recebíveis encontrado para este FIDC");
      }
    } catch (error) {
      console.error("Error updating balances:", error);
      addLog(`Erro ao atualizar saldos: ${error}`);
    }
  }, [
    state.fidcId,
    memoizedContracts,
    updateBalanceState,
    addLog,
    getProvider,
  ]);

  const debouncedUpdateBalances = useMemo(
    () =>
      debounce(async () => {
        if (!state.fidcId) return;
        await updateBalances();
      }, 500),
    [state.fidcId, updateBalances]
  );

  async function getWallet(
    type:
      | "pj"
      | "adqui"
      | "manager"
      | "demo"
      | "pj_or_investor1"
      | "pj_or_investor2"
      | "pj_or_investor3"
      | "pj_or_investor4"
  ) {
    const privateKey =
      type === "pj"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_PJ
        : type === "adqui"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_ADQUIRENTE
        : type === "demo"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_DEMO
        : type === "manager"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_MANAGER
        : type === "pj_or_investor1"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_PJ_OR_INVESTOR1
        : type === "pj_or_investor2"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_PJ_OR_INVESTOR2
        : type === "pj_or_investor3"
        ? process.env.NEXT_PUBLIC_PRIVATE_KEY_PJ_OR_INVESTOR3
        : process.env.NEXT_PUBLIC_PRIVATE_KEY_PJ_OR_INVESTOR4;

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
      addLog(
        `Parsing ${receipt.logs.length} logs from transaction ${receipt.hash}`
      );
      for (const log of receipt.logs) {
        try {
          // Log raw log data para depuração
          addLog(`Log address: ${log.address}`);
          addLog(`Log topics: ${JSON.stringify(log.topics)}`);

          // Verifica se o log pertence ao nosso contrato
          if (
            log.address.toLowerCase() === contractInstance.target.toLowerCase()
          ) {
            addLog(`✓ Log pertence ao contrato ${log.address}`);
          } else {
            addLog(
              `✗ Log de outro contrato ${log.address} != ${contractInstance.target}`
            );
            // Tente identificar qual contrato emitiu o evento
            try {
              // Código específico apenas para FIDC
              if (
                contractInstance.interface.fragments.some(
                  (f: any) => f.name === "initializeFIDC"
                )
              ) {
                const fidcInterface = Fidc__factory.createInterface();
                const parsedFromFidc = fidcInterface.parseLog({
                  topics: log.topics as string[],
                  data: log.data,
                });
                if (parsedFromFidc) {
                  addLog(`Evento identificado do FIDC: ${parsedFromFidc.name}`);
                  events.push({
                    name: parsedFromFidc.name,
                    args: parsedFromFidc.args,
                  });
                  continue;
                }
              }

              // Código específico apenas para ERC20
              if (
                contractInstance.interface.fragments.some(
                  (f: any) => f.name === "transfer"
                )
              ) {
                const erc20Interface = Erc20__factory.createInterface();
                const parsedFromErc20 = erc20Interface.parseLog({
                  topics: log.topics as string[],
                  data: log.data,
                });
                if (parsedFromErc20) {
                  addLog(
                    `Evento identificado do ERC20: ${parsedFromErc20.name}`
                  );
                  events.push({
                    name: parsedFromErc20.name,
                    args: parsedFromErc20.args,
                  });
                  continue;
                }
              }
            } catch (innerError) {
              // Ignora erro ao tentar parsear com outra interface
            }
          }

          // Tenta fazer o parse usando a interface do contrato
          const parsedLog = contractInstance.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });

          if (parsedLog) {
            addLog(`✓ Evento parseado com sucesso: ${parsedLog.name}`);
            events.push({ name: parsedLog.name, args: parsedLog.args });
          } else {
            addLog(`✗ Não foi possível parsear o log`);
          }
        } catch (error: any) {
          addLog(`⚠️ Erro ao parsear log: ${error.message}`);
          continue;
        }
      }
    } else {
      addLog(`⚠️ Nenhum log encontrado no recibo da transação`);
    }

    addLog(`Total de eventos encontrados: ${events.length}`);
    return events;
  }

  async function onInitializeFIDC() {
    try {
      updateTransactionState({ isProcessing: true });
      updateTransactionState({ error: null });
      addLog("Initializing FIDC...");

      const managerWallet = await getWallet("manager");
      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        managerWallet
      );
      const fidcConfig = { fee: 100, annual: 1800, grace: 35, senior: 500 };

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
      updateTransactionState({ hash: initializeTx.hash });

      const receipt = await initializeTx.wait();
      addLog("Transaction confirmed!");

      const events = await parseEvents(receipt, fidcContract);

      // Procura especificamente pelo evento FIDCCreated
      const fidcCreatedEvent = events.find(
        (event) => event.name === "FIDCCreated"
      );

      if (fidcCreatedEvent) {
        const { args } = fidcCreatedEvent;
        addLog("=== FIDC Criado com Sucesso ===");
        addLog(`ID do FIDC: ${args[0]}`);
        addLog(`Endereço do Gestor: ${args[1]}`);
        addLog(`Contrato de Recebíveis: ${args[2]}`);
        addLog("============================");

        // Atualiza o estado com o novo FIDC ID
        updateState({ fidcId: args[0] });
      } else {
        addLog("Warning: FIDCCreated event not found in transaction logs");
      }

      // Registra outros eventos que possam ter ocorrido
      events
        .filter((event) => event.name !== "FIDCCreated")
        .forEach((event) => {
          addLog(`Additional event emitted: ${event.name}`);
        });

      await updateBalances();
      addLog("FIDC initialization completed successfully");

      return {
        receipt,
        events,
        fidcCreatedEvent: fidcCreatedEvent
          ? {
              fidcId: fidcCreatedEvent.args[0],
              managerAddress: fidcCreatedEvent.args[1],
              receivableContract: fidcCreatedEvent.args[2],
            }
          : null,
      };
    } catch (err: any) {
      updateTransactionState({
        error: err.message || "Error initializing FIDC",
      });
      addLog(`Error: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      updateTransactionState({ isProcessing: false });
    }
  }

  async function onInvestFIDC(
    investFidcId: number,
    amount: number,
    investorType: "senior" | "subordinado",
    investorWalletType:
      | "demo"
      | "pj_or_investor1"
      | "pj_or_investor2"
      | "pj_or_investor3"
      | "pj_or_investor4"
  ) {
    try {
      updateTransactionState({ isProcessing: true });
      updateTransactionState({ error: null });
      const newAmount = ethers.parseEther(amount.toString());

      addLog(
        `Iniciando processo de investimento para FIDC ID: ${investFidcId}...`
      );
      addLog(`Tipo de investidor: ${investorType}`);
      addLog(`Tipo de carteira do investidor: ${investorWalletType}`);

      // Primeiro, precisamos que o manager aprove o investidor
      const managerWallet = await getWallet("manager");
      addLog(`Usando carteira do manager: ${managerWallet.address}`);

      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        managerWallet
      );

      // Obtém o endereço do investidor baseado no tipo
      let investorAddress: string;
      switch (investorWalletType) {
        case "demo":
          const demoWallet = await getWallet("demo");
          investorAddress = demoWallet.address;
          break;
        case "pj_or_investor1":
          investorAddress = adminAddresses.pj_or_investor1_address;
          break;
        case "pj_or_investor2":
          investorAddress = adminAddresses.pj_or_investor2_address;
          break;
        case "pj_or_investor3":
          investorAddress = adminAddresses.pj_or_investor3_address;
          break;
        case "pj_or_investor4":
          investorAddress = adminAddresses.pj_or_investor4_address;
          break;
        default:
          throw new Error("Tipo de carteira de investidor inválido");
      }

      addLog(`Endereço do investidor: ${investorAddress}`);

      // Aprova o investidor
      addLog("Aprovando investidor...");
      const approveInvestorTx = await fidcContract.approveInvestor(
        [investorAddress],
        investorType === "senior" ? 0 : 1,
        investFidcId
      );
      await approveInvestorTx.wait();
      addLog("Investidor aprovado com sucesso!");

      // Obtém a carteira do investidor
      const investorWallet = await getWallet(investorWalletType);
      addLog(`Usando carteira do investidor: ${investorWallet.address}`);

      // Conecta ao contrato FIDC usando a carteira do investidor
      const investorFidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        investorWallet
      );

      // Verifica saldo de quotas antes do investimento
      const quotasBeforeInvestment = await investorFidcContract.balanceOf(
        investorWallet.address
      );
      addLog(
        `Quotas antes do investimento: ${ethers.formatEther(
          quotasBeforeInvestment
        )}`
      );

      // Aprova o valor do investimento
      addLog("Aprovando valor do investimento...");
      const erc20Contract = Erc20__factory.connect(
        ERC20Mock_address,
        investorWallet
      );
      const approveTx = await erc20Contract.approve(
        FIDC_Management_address,
        newAmount
      );

      addLog(`Transação de aprovação enviada: ${approveTx.hash}`);
      updateTransactionState({ hash: approveTx.hash });

      const approveReceipt = await approveTx.wait();
      addLog("Aprovação confirmada!");

      // Parse dos eventos de aprovação
      const approveEvents = await parseEvents(approveReceipt, erc20Contract);
      approveEvents.forEach((event) => {
        addLog(`Evento de aprovação: ${event.name}`);
      });

      // Realiza o investimento
      addLog("Enviando transação de investimento...");
      const investTx = await investorFidcContract.invest(
        investFidcId,
        newAmount
      );

      addLog(`Transação de investimento enviada: ${investTx.hash}`);
      updateTransactionState({ hash: investTx.hash });

      const investReceipt = await investTx.wait();
      addLog("Investimento confirmado!");

      // Verifica saldo de quotas após o investimento
      const quotasAfterInvestment = await investorFidcContract.balanceOf(
        investorWallet.address
      );
      const quotasMinted = quotasAfterInvestment - quotasBeforeInvestment;
      addLog(
        `Quotas após investimento: ${ethers.formatEther(quotasAfterInvestment)}`
      );
      addLog(`Total de quotas emitidas: ${ethers.formatEther(quotasMinted)}`);

      // Parse dos eventos do investimento
      const investEvents = await parseEvents(
        investReceipt,
        investorFidcContract
      );
      investEvents.forEach((event) => {
        addLog(`Evento de investimento: ${event.name}`);
      });

      // Atualiza os saldos
      await updateBalances();

      addLog("Processo de investimento concluído com sucesso!");

      return {
        approveReceipt,
        approveEvents,
        investReceipt,
        investEvents,
        quotasMinted: ethers.formatEther(quotasMinted),
      };
    } catch (err: any) {
      updateTransactionState({
        error: err.message || "Erro ao processar investimento",
      });
      addLog(`Erro: ${err.message || "Erro desconhecido"}`);
      throw err;
    } finally {
      updateTransactionState({ isProcessing: false });
    }
  }

  async function onAnticipation(
    anticipationFidcId: number,
    amount: number,
    guaranteeType: "consignado" | "cartao" | "duplicata"
  ) {
    try {
      updateTransactionState({ isProcessing: true });
      updateTransactionState({ error: null });
      const requestedAmount = ethers.parseEther(amount.toString());
      const requiredAmount = (requestedAmount * BigInt(120)) / BigInt(100);

      addLog(
        `Iniciando antecipação...
        Amount solicitado: ${ethers.formatEther(requestedAmount)} Stablecoin
        Garantia necessária: ${ethers.formatEther(
          requiredAmount
        )} ${guaranteeType}`
      );

      const pjWallet = await getWallet("pj");
      addLog(`Usando carteira PJ: ${pjWallet.address}`);
      if (
        pjWallet.address.toLowerCase() !==
        adminAddresses.pj_address.toLowerCase()
      ) {
        throw new Error("Endereço incorreto para operação de PJ");
      }

      // Seleciona o contrato baseado no tipo de garantia
      let guaranteeContract;
      let guaranteeAddress;
      switch (guaranteeType) {
        case "consignado":
          guaranteeContract = Collateral__factory.connect(
            collateral_address,
            pjWallet
          );
          guaranteeAddress = collateral_address;
          break;
        case "cartao":
          guaranteeContract = Erc20__factory.connect(cartao_address, pjWallet);
          guaranteeAddress = cartao_address;
          break;
        case "duplicata":
          guaranteeContract = Erc20__factory.connect(
            duplicata_address,
            pjWallet
          );
          guaranteeAddress = duplicata_address;
          break;
        default:
          throw new Error("Tipo de garantia inválido");
      }

      const currentBalance = await guaranteeContract.balanceOf(
        pjWallet.address
      );
      addLog(
        `Saldo atual de ${guaranteeType}: ${ethers.formatEther(currentBalance)}`
      );

      if (currentBalance < requiredAmount) {
        addLog(
          `Saldo insuficiente. Realizando mint do ${guaranteeType} necessário...`
        );
        const mintTx = await guaranteeContract.mint(
          pjWallet.address,
          requiredAmount
        );
        await mintTx.wait();
        addLog(
          `Mint de ${ethers.formatEther(
            requiredAmount
          )} ${guaranteeType} realizado`
        );
      }

      addLog(`Aprovando uso do ${guaranteeType} pelo contrato FIDC...`);
      const approveTx = await guaranteeContract.approve(
        FIDC_Management_address,
        requiredAmount
      );
      await approveTx.wait();
      addLog(`Aprovação do ${guaranteeType} concluída`);

      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        pjWallet
      );

      addLog("Enviando transação de antecipação...");
      const anticipationTx = await fidcContract.anticipation(
        requestedAmount,
        guaranteeAddress,
        anticipationFidcId,
        { gasLimit: 1000000 }
      );

      addLog(`Transação enviada: ${anticipationTx.hash}`);
      updateTransactionState({ hash: anticipationTx.hash });

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
          Garantia: ${args[3]}
          Garantia Required: ${ethers.formatEther(args[4])}
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
      updateTransactionState({
        error: err.message || "Erro no processo de antecipação",
      });
      addLog(`Erro: ${err.message || "Erro desconhecido"}`);
      throw err;
    } finally {
      updateTransactionState({ isProcessing: false });
    }
  }

  async function onCompensation(compensationFidcId: number) {
    try {
      updateTransactionState({ isProcessing: true });
      updateTransactionState({ error: null });
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
      updateTransactionState({ hash: compensationTx.hash });

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
        addLog(`Garantia Token: ${args[3]}`);
        addLog(`Garantia Amount: ${ethers.formatEther(args[4])}`);
        addLog(`Is External Garantia: ${args[5]}`);
      }

      await updateBalances();
      addLog("Compensation payment completed successfully");

      return { receipt, events, compensationEvent };
    } catch (err: any) {
      updateTransactionState({
        error: err.message || "Error processing compensation",
      });
      addLog(`Error: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      updateTransactionState({ isProcessing: false });
    }
  }

  async function onRedeem(redeemFidcId: number) {
    try {
      updateTransactionState({ isProcessing: true });
      updateTransactionState({ error: null });
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
      updateTransactionState({ hash: redeemTx.hash });

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
      updateTransactionState({
        error: err.message || "Error processing redemption",
      });
      addLog(`Error: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      updateTransactionState({ isProcessing: false });
    }
  }

  async function onGetAllInvestors(fidcId: number) {
    addLog(`Getting all investors for FIDC ID: ${fidcId}`);
    const demoWallet = await getWallet("demo");
    const fidcContract = Fidc__factory.connect(
      FIDC_Management_address,
      demoWallet
    );
    addLog(`Getting all investors for FIDC ID: ${fidcId}`);
    const investors = await fidcContract.getAllInvestors(fidcId);
    console.log(investors);
    addLog(`Investors: ${investors}`);
    return investors;
  }

  async function onGetFIDC(id: number) {
    try {
      addLog(`Verificando FIDC ID: ${id}`);
      const demoWallet = await getWallet("demo");
      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        demoWallet
      );

      // Verifica o endereço do receivable
      const receivableAddress = await fidcContract.getFIDCReceivable(id);
      addLog(`Endereço do receivable: ${receivableAddress}`);

      if (receivableAddress === ethers.ZeroAddress) {
        addLog("FIDC não encontrado: endereço do receivable é zero");
        updateState({ fidcId: null });
        updateBalanceState({ stablecoin: "0", receivables: "0" });
        return null;
      }

      // Primeiro atualiza o FIDC ID
      updateState({ fidcId: Number(id) });

      // Aguarda um momento para garantir que os valores sejam atualizados corretamente
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Busca os saldos em uma única operação
      const provider = await getProvider();
      const { drexContract } = await memoizedContracts;
      const receivableContract = Erc20__factory.connect(
        receivableAddress,
        provider
      );

      const [stablecoinBal, receivablesBal] = await Promise.all([
        drexContract.balanceOf(FIDC_Management_address),
        receivableContract.balanceOf(FIDC_Management_address),
      ]);

      // Atualiza os dois saldos de uma vez
      updateBalanceState({
        stablecoin: ethers.formatEther(stablecoinBal),
        receivables: ethers.formatEther(receivablesBal),
      });

      // Obtém detalhes adicionais do FIDC
      const fidc = await fidcContract.fidcs(id);

      return {
        ...fidc,
        receivableAddress,
      };
    } catch (error: any) {
      addLog(`Erro ao verificar FIDC: ${error.message}`);
      updateState({ fidcId: null });
      updateBalanceState({ stablecoin: "0", receivables: "0" });
      return null;
    }
  }

  async function debugTransactionEvents(txHash: string) {
    try {
      updateTransactionState({ isProcessing: true });
      addLog(`Depurando transação: ${txHash}`);

      const provider = await getProvider();
      addLog(`Obtendo recibo da transação...`);

      // Obter o recibo da transação
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        addLog(`⚠️ Recibo não encontrado para a transação ${txHash}`);
        return;
      }

      addLog(`Recibo encontrado. Logs: ${receipt.logs.length}`);

      // Obter o código do contrato para descobrir que interface usar
      const contractAddress = receipt.to;
      addLog(`Contrato alvo: ${contractAddress}`);

      // Tentar com várias interfaces
      addLog(`Tentando com interface FIDC...`);
      const fidcContract = Fidc__factory.connect(
        contractAddress || "",
        provider
      );
      const fidcEvents = await parseEvents(receipt, fidcContract);

      addLog(`Tentando com interface ERC20...`);
      const erc20Contract = Erc20__factory.connect(
        contractAddress || "",
        provider
      );
      const erc20Events = await parseEvents(receipt, erc20Contract);

      addLog(`Tentando com interface Collateral...`);
      const collateralContract = Collateral__factory.connect(
        contractAddress || "",
        provider
      );
      const collateralEvents = await parseEvents(receipt, collateralContract);

      // Retornar todos os eventos encontrados
      const allEvents = [
        ...fidcEvents,
        ...erc20Events,
        ...collateralEvents,
      ].filter(
        // Remover duplicatas
        (event, index, self) =>
          index ===
          self.findIndex(
            (e) =>
              e.name === event.name &&
              JSON.stringify(e.args) === JSON.stringify(event.args)
          )
      );

      addLog(`Total de eventos únicos encontrados: ${allEvents.length}`);

      // Exibir cada evento encontrado
      allEvents.forEach((event) => {
        addLog(`Evento: ${event.name}`);
        addLog(
          `Argumentos: ${JSON.stringify(
            Object.values(event.args).map((arg) =>
              typeof arg === "bigint" ? arg.toString() : arg
            )
          )}`
        );
      });

      return { receipt, events: allEvents };
    } catch (err: any) {
      updateTransactionState({
        error: err.message || "Erro ao depurar transação",
      });
      addLog(`Erro: ${err.message || "Erro desconhecido"}`);
    } finally {
      updateTransactionState({ isProcessing: false });
    }
  }

  const memoizedInterfaces = useMemo(
    () => ({
      fidcInterface: Fidc__factory.createInterface(),
      erc20Interface: Erc20__factory.createInterface(),
    }),
    []
  );

  useEffect(() => {
    if (state.fidcId) updateBalances();
  }, [state.fidcId, updateBalances]);

  return {
    fidcId: state.fidcId,
    setFidcId: (id: number | null) => updateState({ fidcId: id }),
    onGetFIDC,
    stablecoinBalance: state.balances.stablecoin,
    receivablesBalance: state.balances.receivables,
    updateBalances,
    onInitializeFIDC,
    onInvestFIDC,
    onAnticipation,
    onCompensation,
    onRedeem,
    logs: state.logs,
    addLog,
    clearLogs,
    isProcessing: state.transaction.isProcessing,
    error: state.transaction.error,
    txHash: state.transaction.hash,
    debugTransactionEvents,
    onGetAllInvestors,
  };
}
