import { Contract, BigNumberish } from "ethers";

const GASLIMIT_DEFAULT = "5000000";
const SAFETY_MARGIN = 1.1;

export async function calculateGasLimit(
  contract: Contract,
  functionName: string,
  params: any[]
): Promise<BigNumberish> {
  try {
    const estimateGas = await contract[functionName].estimateGas(...params);
    const gasWithMargin = Math.ceil(Number(estimateGas) * SAFETY_MARGIN);
    return BigInt(gasWithMargin);
  } catch (error) {
    console.error(`Failed to estimate gas for ${functionName}:`, error);
    return BigInt(GASLIMIT_DEFAULT);
  }
}
