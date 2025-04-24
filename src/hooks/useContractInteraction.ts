import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useAccount, useWalletClient } from "wagmi";
import {
  FIDC_Management_address,
  ERC20Mock_address,
  collateral_address,
} from "@/constants";
import fidc_abi from "@/abis/fidc_abi";
import erc20_abi from "@/abis/erc20_abi";
import { FIDCContract, ERC20Contract } from "@/types/contracts";

/* ---------- Tipos ---------- */

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

/* ---------- Hook ---------- */

export function useContractInteraction() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gasLimit = 3_000_000;

  /* --- Util: retorna contratos + signer para o ROLE pedido --- */
  const getContracts = useCallback(
    async (
      useDemoWallet = false,
      selectedWalletAddress?: string,
      role:
        | "manager"
        | "pj"
        | "adquirente"
        | "validator"
        | "payable"
        | "demo" = "demo"
    ) => {
      const effectiveAddr = selectedWalletAddress || address;

      if (!useDemoWallet && (!walletClient || !isConnected || !effectiveAddr)) {
        throw new Error("Wallet not connected");
      }

      let provider: ethers.JsonRpcProvider | ethers.BrowserProvider;
      let signer: ethers.Signer;

      if (useDemoWallet) {
        provider = new ethers.JsonRpcProvider(
          "https://ethereum-holesky-rpc.publicnode.com"
        );

        const envKey = {
          manager: process.env.NEXT_PUBLIC_PRIVATE_KEY_MANAGER,
          pj: process.env.NEXT_PUBLIC_PRIVATE_KEY_PJ,
          adquirente: process.env.NEXT_PUBLIC_PRIVATE_KEY_ADQUIRENTE,
        }[role];

        const privateKey =
          envKey ??
          "a92e4c875f24bb830164205fc55f567dd04f6cea7b64411a7f0d781d29095c2b";

        signer = new ethers.Wallet(privateKey!, provider);
        console.log(`[DEMO] usando ${role}:`, signer.address);
      } else if (selectedWalletAddress) {
        provider = new ethers.JsonRpcProvider(
          "https://ethereum-holesky-rpc.publicnode.com"
        );
        signer = new ethers.Wallet(
          "a92e4c875f24bb830164205fc55f567dd04f6cea7b64411a7f0d781d29095c2b",
          provider
        );
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

      const collateralContract = new ethers.Contract(
        collateral_address,
        erc20_abi,
        signer
      ) as unknown as ERC20Contract;

      return {
        fidcContract,
        drexContract,
        collateralContract,
        signer,
        provider,
      };
    },
    [walletClient, isConnected, address]
  );

  /* ---------- INITIALIZE FIDC (manager) ---------- */
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
        const { signer, provider } = await getContracts(
          useDemoWallet,
          undefined,
          "manager"
        );

        const rawContract = new ethers.Contract(
          FIDC_Management_address,
          fidc_abi,
          signer
        );

        const tx = await rawContract.initializeFIDC(
          manager,
          validator,
          payable,
          fee,
          annualYield,
          gracePeriod,
          seniorSpread,
          { gasLimit }
        );

        setTxHash(tx.hash);
        const receipt = await tx.wait();

        const ev = receipt.logs.find(
          (l: any) =>
            l.topics[0] === ethers.id("FIDCCreated(uint256,address,address)")
        );
        const fidcId = ev ? Number(ethers.toNumber(ev.topics[1])) : null;

        return { success: true, fidcId, receipt };
      } catch (err: any) {
        setError(err.message);
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts]
  );

  /* ---------- INVEST ---------- */
  const invest = useCallback(
    async (fidcId: number, amount: string, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract, drexContract } = await getContracts(
          useDemoWallet,
          undefined,
          "demo"
        );

        const amountWei = ethers.parseEther(amount);

        // Primeiro aprovar o ERC20Mock (stablecoin) para o FIDC
        const approveTx = await drexContract.approve(
          FIDC_Management_address,
          amountWei,
          {
            gasLimit,
          }
        );
        await approveTx.wait();

        // Agora fazer o investimento
        const tx = await fidcContract.invest(fidcId, amountWei, {
          gasLimit,
        });

        setTxHash(tx.hash);
        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        setError(err instanceof Error ? err.message : "unknown");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts]
  );

  /* ---------- PJ – anticipation ---------- */
  const anticipation = useCallback(
    async (
      fidcId: number,
      anticipationAmount: string,
      collateralAmount: string,
      useDemoWallet = false
    ) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract, drexContract, collateralContract } =
          await getContracts(useDemoWallet, undefined, "pj");

        const antWei = ethers.parseEther(anticipationAmount);
        const colWei = ethers.parseEther(collateralAmount);

        // approve Stablecoin to FIDC
        await drexContract.approve(FIDC_Management_address, antWei, {
          gasLimit,
        });

        // approve collateral token
        await collateralContract.approve(FIDC_Management_address, colWei, {
          gasLimit,
        });

        const tx = await fidcContract.anticipation(
          antWei,
          collateral_address,
          fidcId,
          { gasLimit }
        );

        setTxHash(tx.hash);
        const receipt = await tx.wait();

        // decode main event
        const parsed = fidcContract.interface.parseLog(
          receipt.logs.find(
            (l: any) =>
              l.topics[0] ===
              ethers.id("Anticipation(uint256,address,uint256,address,uint256)")
          )!
        );

        return { success: true, event: parsed.args, receipt };
      } catch (err) {
        setError(err instanceof Error ? err.message : "unknown");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts]
  );

  /* ---------- COMPENSATION PAY (adquirente) ---------- */
  const compensationPay = useCallback(
    async (fidcId: number, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract, drexContract } = await getContracts(
          useDemoWallet,
          undefined,
          "adquirente"
        );

        const receivableAddr = await fidcContract.getFIDCReceivable(fidcId);
        const toPay = await fidcContract.balanceOf(receivableAddr);
        if (toPay === 0n) throw new Error("Nada a pagar");

        await drexContract.approve(FIDC_Management_address, toPay, {
          gasLimit,
        });

        const tx = await fidcContract.compensationPay(fidcId, toPay, {
          gasLimit,
        });

        setTxHash(tx.hash);
        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        setError(err instanceof Error ? err.message : "unknown");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts]
  );

  /* ---------- REDEEM ALL MANAGER ---------- */
  const redeemAllManager = useCallback(
    async (fidcId: number, investors: string[], useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);
      try {
        const role = "manager";
        const { fidcContract } = await getContracts(
          useDemoWallet,
          undefined,
          role
        );
        const tx = await fidcContract.redeemAllManager(fidcId, investors, {
          gasLimit: 5_000_000,
        });
        setTxHash(tx.hash);
        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        setError(err instanceof Error ? err.message : "unknown");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts]
  );

  /* ---------- GETTERS (inalterados) ---------- */
  const getFIDCDetails = useCallback(
    async (
      fidcId: number,
      useDemoWallet = false
    ): Promise<FIDCDetails | null> => {
      const { fidcContract } = await getContracts(useDemoWallet);
      try {
        const r = await fidcContract.fidcs(fidcId);
        return {
          manager: r.manager,
          validator: r.validator,
          payableAddress: r.payableAddress,
          fee: Number(r.fee),
          amount: ethers.formatEther(r.amount),
          invested: ethers.formatEther(r.invested),
          valid: r.valid,
          status: Number(r.status),
          annualYield: Number(r.annualYield),
          gracePeriod: Number(r.gracePeriod),
          seniorSpread: Number(r.seniorSpread),
        };
      } catch {
        return null;
      }
    },
    [getContracts]
  );

  /* ---------- Função para obter todos os investidores ---------- */
  const getAllInvestors = useCallback(
    async (fidcId: number, useDemoWallet = false) => {
      try {
        const { fidcContract } = await getContracts(useDemoWallet);
        const result = await fidcContract.getAllInvestors(fidcId);

        return {
          investors: result.investors,
          isSenior: result.isSenior,
          amounts: result.amounts.map((amount: bigint) =>
            ethers.formatEther(amount)
          ),
        };
      } catch (err) {
        console.error("Error getting investors:", err);
        throw err;
      }
    },
    [getContracts]
  );

  /* ---------- Função para financiar a carteira do investidor ---------- */
  const fundInvestorWallet = useCallback(
    async (investorAddress: string, amount: string, useDemoWallet = false) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { drexContract } = await getContracts(
          useDemoWallet,
          undefined,
          "manager"
        );

        // Converter o amount para Wei
        const amountWei = ethers.parseEther(amount);

        // Mintar os tokens para o endereço do investidor
        const tx = await drexContract.mint(investorAddress, amountWei, {
          gasLimit: 3_000_000,
        });

        setTxHash(tx.hash);
        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        setError(err instanceof Error ? err.message : "unknown");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts]
  );

  /* ---------- APPROVE INVESTOR ---------- */
  const approveInvestor = useCallback(
    async (
      investor: string,
      investorType: number,
      fidcId: number,
      useDemoWallet = false
    ) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { fidcContract } = await getContracts(
          useDemoWallet,
          undefined,
          "manager"
        );

        // Criar um array com o endereço do investidor, já que a função espera um array
        const investors = [investor];

        const tx = await fidcContract.approveInvestor(
          investors,
          investorType,
          fidcId,
          {
            gasLimit,
          }
        );

        setTxHash(tx.hash);
        const receipt = await tx.wait();
        return { success: true, receipt };
      } catch (err) {
        setError(err instanceof Error ? err.message : "unknown");
        return { success: false, error: err };
      } finally {
        setIsProcessing(false);
      }
    },
    [getContracts]
  );

  /* ---------- EXPORT ---------- */
  return {
    isProcessing,
    txHash,
    error,
    initializeFIDC,
    invest,
    anticipation,
    compensationPay,
    redeemAllManager,
    getFIDCDetails,
    getAllInvestors,
    fundInvestorWallet,
    approveInvestor,
  };
}
