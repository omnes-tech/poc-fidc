import { BaseContract } from 'ethers';

// Define a common transaction result type
export type ContractTransaction = {
  hash: string;
  wait: () => Promise<any>;
};

export interface FIDCContract extends BaseContract {
  initializeFIDC(
    _manager: string,
    _validator: string,
    _payable: string,
    _fee: number | bigint,
    _annualYield: number | bigint,
    _gracePeriod: number | bigint,
    _seniorSpread: number | bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  getAllInvestors(
    _fidcId: number | bigint
  ): Promise<{
    investors: string[];
    isSenior: boolean[];
    amounts: bigint[];
  }>;

  compensationPay(
    _fidcId: number | bigint,
    _amount: bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  fidcScheduleAmount(
    _fidcId: number | bigint
  ): Promise<bigint>;

  approvedEmissionValidator(
    _pj: string,
    _fidcId: number | bigint,
    _scheduleAmount: bigint,
    _collateralAmount: bigint,
    _isApproved: boolean,
    overrides?: any
  ): Promise<ContractTransaction>;

  approvedOfficialPayable(
    _fidcId: number | bigint,
    _amount: bigint,
    _isApproved: boolean,
    overrides?: any
  ): Promise<ContractTransaction>;

  approveInvestor(
    _investor: string[],
    _type: number,
    _fidcId: number | bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  approveManager(
    _manager: string[],
    overrides?: any
  ): Promise<ContractTransaction>;

  approvedValidator(
    _validator: string[],
    overrides?: any
  ): Promise<ContractTransaction>;

  approvePayable(
    _payable: string[],
    overrides?: any
  ): Promise<ContractTransaction>;

  invest(
    _fidcId: number | bigint,
    _amount: bigint,
    overrides?: any
  ): Promise<ContractTransaction & { investmentId: bigint }>;

  redeem(
    _fidcId: number | bigint,
    _investmentId: number | bigint,
    _amount: bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  redeemAll(
    _fidcId: number | bigint,
    _investmentId: number | bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  redeemAllManager(
    _fidcId: number | bigint,
    _investors: string[],
    overrides?: any
  ): Promise<ContractTransaction>;

  fidcs(
    fidcId: number | bigint
  ): Promise<{
    manager: string;
    validator: string;
    payableAddress: string;
    fee: bigint;
    tokenReceivable: string;
    amount: bigint;
    invested: bigint;
    valid: boolean;
    startDate: bigint;
    endDate: bigint;
    status: number;
    annualYield: bigint;
    gracePeriod: bigint;
    seniorSpread: bigint;
    vault: string;
  }>;

  getInvestorPosition(
    _investor: string,
    _fidcId: number | bigint
  ): Promise<{
    fidcId: bigint;
    totalAmount: bigint;
    investments: Array<{
      investmentId: bigint;
      amount: bigint;
      investmentDate: bigint;
      yieldStartTime: bigint;
      isSenior: boolean;
      accumulatedYield: bigint;
    }>;
  }>;

  stopFIDC(
    _fidcId: number | bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  initiateLiquidation(
    _fidcId: number | bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  setRole(
    _role: string,
    _addresses: string[],
    overrides?: any
  ): Promise<ContractTransaction>;
}

export interface ERC20Contract extends BaseContract {
  approve(
    spender: string,
    value: bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  transfer(
    to: string,
    value: bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  balanceOf(
    account: string
  ): Promise<bigint>;

  mint(
    account: string,
    amount: bigint,
    overrides?: any
  ): Promise<ContractTransaction>;

  decimals(): Promise<number>;

  symbol(): Promise<string>;

  name(): Promise<string>;

  totalSupply(): Promise<bigint>;

  transferFrom(
    from: string,
    to: string,
    value: bigint,
    overrides?: any
  ): Promise<ContractTransaction>;
} 