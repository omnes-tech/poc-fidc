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
      const { fidcContract, drexContract } = await getContracts();
      const stablecoinBal = await drexContract.balanceOf(
        FIDC_Management_address
      );
      setStablecoinBalance(ethers.formatEther(stablecoinBal));
      addLog(`Stablecoin balance: ${ethers.formatEther(stablecoinBal)}`);
      const receivableAddress = await fidcContract.getFIDCReceivable(fidcId);
      if (receivableAddress) {
        const receivablesBal = await fidcContract.balanceOf(receivableAddress);
        setReceivablesBalance(ethers.formatEther(receivablesBal));
        addLog(`Receivables balance: ${ethers.formatEther(receivablesBal)}`);
      }
    } catch (error) {
      console.error("Error updating balances:", error);
    }
  }, [fidcId, getContracts]);

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
      const newAmount = ethers.parseEther(amount.toString());
      addLog(
        `Processing anticipation of ${newAmount} tokens for FIDC ID: ${anticipationFidcId}...`
      );

      const pjWallet = await getWallet("pj");
      addLog(`Using pj wallet: ${pjWallet.address}`);

      const collateralContract = Collateral__factory.connect(
        collateral_address,
        pjWallet
      );

      const approveTx = await collateralContract.approve(
        FIDC_Management_address,
        newAmount
      );
      addLog(`Approval transaction sent: ${approveTx.hash}`);
      setTxHash(approveTx.hash);

      const approveReceipt = await approveTx.wait();
      addLog(`Approval transaction confirmed: ${approveReceipt?.hash}`);

      const fidcContract = Fidc__factory.connect(
        FIDC_Management_address,
        pjWallet
      );

      addLog("Sending anticipation transaction...");
      const anticipationTx = await fidcContract.anticipation(
        newAmount,
        collateral_address,
        anticipationFidcId,
        { gasLimit: 1000000 }
      );

      addLog(`Anticipation transaction sent: ${anticipationTx.hash}`);
      setTxHash(anticipationTx.hash);

      const receipt = await anticipationTx.wait();
      addLog("Anticipation transaction confirmed!");

      const events = await parseEvents(receipt, fidcContract);
      events.forEach((event) => {
        addLog(`Event: ${event.name}`);
      });

      const anticipationEvent = events.find(
        (event) => event.name === "Anticipation"
      );

      if (anticipationEvent) {
        const { args } = anticipationEvent;
        addLog(`Anticipation processed for FIDC ID: ${args[0]}`);
        addLog(`PJ Address: ${args[1]}`);
        addLog(`Amount: ${ethers.formatEther(args[2])}`);
        addLog(`Collateral Token: ${args[3]}`);
        addLog(`Required Collateral: ${ethers.formatEther(args[4])}`);
      }

      await updateBalances();
      addLog("Anticipation completed successfully");

      return {
        receipt,
        events,
        anticipationEvent,
      };
    } catch (err: any) {
      setError(err.message || "Error processing anticipation");
      addLog(`Error: ${err.message || "Unknown error"}`);
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

      addLog("Getting receivable address...");
      const receivableAddress = await fidcContract.getFIDCReceivable(
        compensationFidcId
      );
      addLog(`Receivable address: ${receivableAddress}`);

      const erc20Contract = Erc20__factory.connect(
        collateral_address,
        adquiWallet
      );

      addLog("Getting receivable balance...");
      const toPay = await erc20Contract.balanceOf(receivableAddress);
      const toPayFormatted = Number(ethers.formatEther(toPay));
      addLog(`Amount to pay: ${toPay}`);
      addLog(`Amount to pay formatted: ${toPayFormatted}`);

      addLog("Sending compensation transaction...");
      const compensationTx = await fidcContract.compensationPay(
        receivableAddress,
        toPayFormatted,
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
