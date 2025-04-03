import { BaseContract } from 'ethers';

export interface FIDCContract extends BaseContract {
  initializeFIDC(
    _manager: string,
    _validator: string,
    _payable: string,
    _fee: number | bigint,
    _annualYield: number | bigint,
    _gracePeriod: number | bigint,
    _seniorSpread: number | bigint
  ): Promise<any>;

  approvedEmissionValidator(
    _pj: string,
    _fidcId: number | bigint,
    _scheduleAmount: bigint,
    _collateralAmount: bigint,
    _isApproved: boolean
  ): Promise<any>;

  approvedEmissionPayable(
    _fidcId: number | bigint,
    _amount: bigint,
    _isApproved: boolean
  ): Promise<any>;

  approveInvestor(
    _investor: string[],
    _type: number,
    _fidcId: number | bigint
  ): Promise<any>;

  invest(
    _fidcId: number | bigint,
    _amount: bigint
  ): Promise<any>;

  redeem(
    _fidcId: number | bigint,
    _investmentId: number | bigint,
    _amount: bigint
  ): Promise<any>;

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
      lastAccumulatedYield: bigint;
    }>;
  }>;

  stopFIDC(
    _fidcId: number | bigint
  ): Promise<any>;

  initiateLiquidation(
    _fidcId: number | bigint
  ): Promise<any>;

  setRole(
    _role: string,
    _addresses: string[]
  ): Promise<any>;
}

export interface ERC20Contract extends BaseContract {
  approve(
    spender: string,
    amount: bigint
  ): Promise<any>;

  transfer(
    to: string,
    amount: bigint
  ): Promise<any>;

  balanceOf(
    account: string
  ): Promise<bigint>;
} 