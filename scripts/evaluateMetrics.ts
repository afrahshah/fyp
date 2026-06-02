import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { network } from "hardhat";

type FailureType =
  | "revert"
  | "rpc"
  | "network"
  | "rate_limit"
  | "timeout"
  | "unknown";

type SerialResultEntry = {
  phase: "serial";
  network: string;
  iteration: number;
  txHash: string | null;
  startedAt: string;
  completedAt: string;
  latencySeconds: number | null;
  gasUsed: string | null;
  gasPriceWei: string | null;
  costWei: string | null;
  success: boolean;
  failureType: FailureType | null;
  failureMessage: string | null;
};

type ContractLike = {
  issueCertificate: (...args: unknown[]) => Promise<{
    hash: string;
    wait: () => Promise<{
      gasUsed: bigint;
      gasPrice?: bigint | null;
      fee?: bigint | null;
    } | null>;
  }>;
  interface: {
    getFunction: (name: string) => { inputs?: Array<{ type?: string }> } | null;
  };
};

type SerialParams = {
  contract: ContractLike;
  provider: {
    getFeeData: () => Promise<{ gasPrice?: bigint | null }>;
  };
  ethers: { formatEther: (value: bigint | string) => string };
  encodeBytes32: (value: string) => string;
  recipientAddress: string;
  studentName: string;
  courseName: string;
  institutionName: string;
  expiry: number;
  verificationPrefix: string;
  networkName: string;
};

const defaultContractAddress = "0xf66D0eD7aC3e5E4efb69ac2a3b786ABAB6568C27";
const contractAddress = process.env.CERTIFICATE_CONTRACT_ADDRESS ?? defaultContractAddress;
const serialIterations = Number(process.env.METRICS_SERIAL_ITERATIONS ?? "30");
const resultStorePath = path.join(process.cwd(), "metrics-results.jsonl");

function assertModeIsSerialOnly() {
  const rawMode = process.env.METRICS_MODE?.toLowerCase();

  if (!rawMode || rawMode === "serial") {
    return;
  }

  throw new Error(`Invalid METRICS_MODE "${rawMode}". Only "serial" is supported.`);
}

function getResultStorePath() {
  return resultStorePath;
}

async function appendResult(entry: SerialResultEntry) {
  await mkdir(path.dirname(resultStorePath), { recursive: true });
  await appendFile(resultStorePath, `${JSON.stringify(entry)}\n`, "utf8");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function classifyError(error: unknown): FailureType {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("rate limit") || message.includes("429")) {
    return "rate_limit";
  }

  if (message.includes("timeout")) {
    return "timeout";
  }

  if (message.includes("network") || message.includes("fetch") || message.includes("socket")) {
    return "network";
  }

  if (message.includes("rpc")) {
    return "rpc";
  }

  if (message.includes("revert") || message.includes("denied") || message.includes("already exists")) {
    return "revert";
  }

  return "unknown";
}

function makeVerificationCode(prefix: string, parts: number[]) {
  const body = parts
    .map((value) => Math.abs(value).toString(36).toUpperCase().padStart(4, "0"))
    .join("")
    .slice(0, 31 - prefix.length);

  return `${prefix}${body}`.slice(0, 31);
}

function mean(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]) {
  if (values.length < 2) {
    return null;
  }

  const average = mean(values);
  if (average === null) {
    return null;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function minmax(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function formatStat(value: number | null, digits = 2) {
  return value === null ? "n/a" : value.toFixed(digits);
}

function assertIssueCertificateShape(contract: ContractLike) {
  const fragment = contract.interface.getFunction("issueCertificate");

  if (!fragment) {
    throw new Error("Certificate.issueCertificate() is missing from the configured ABI");
  }

  const inputTypes = (fragment.inputs ?? []).map((input) => input.type);
  const expected = ["address", "bytes32", "bytes32", "bytes32", "uint64", "bytes32"];

  if (inputTypes.length !== expected.length || inputTypes.some((type, index) => type !== expected[index])) {
    throw new Error(
      `Certificate.issueCertificate() shape mismatch. Expected ${expected.join(", ")} but got ${inputTypes.join(", ")}`
    );
  }
}

async function runSerialLatencyAndCost(params: SerialParams) {
  const {
    contract,
    provider,
    ethers,
    encodeBytes32,
    recipientAddress,
    studentName,
    courseName,
    institutionName,
    expiry,
    verificationPrefix,
    networkName,
  } = params;

  const results: SerialResultEntry[] = [];

  console.log("=========================================");
  console.log(`PHASE 1: LATENCY & COST EVALUATION (n=${serialIterations})`);
  console.log("=========================================");

  for (let iteration = 1; iteration <= serialIterations; iteration += 1) {
    const startedAt = new Date().toISOString();
    const verificationCode = encodeBytes32(
      makeVerificationCode(verificationPrefix, [1, iteration, Date.now() & 0xffff])
    );

    try {
      const startTime = performance.now();
      const tx = await contract.issueCertificate(
        recipientAddress,
        studentName,
        courseName,
        institutionName,
        expiry,
        verificationCode
      );

      const receipt = await tx.wait();
      const latencySeconds = (performance.now() - startTime) / 1000;
      const feeData = await provider.getFeeData();
      const gasUsed = receipt?.gasUsed ?? null;
      const gasPrice = receipt?.gasPrice ?? receipt?.fee ?? feeData.gasPrice ?? null;
      const costWei = gasUsed !== null && gasPrice !== null ? gasUsed * gasPrice : null;
      const entry: SerialResultEntry = {
        phase: "serial",
        network: networkName,
        iteration,
        txHash: tx.hash,
        startedAt,
        completedAt: new Date().toISOString(),
        latencySeconds,
        gasUsed: gasUsed?.toString() ?? null,
        gasPriceWei: gasPrice?.toString() ?? null,
        costWei: costWei?.toString() ?? null,
        success: true,
        failureType: null,
        failureMessage: null,
      };

      results.push(entry);
      await appendResult(entry);
      console.log(
        `Tx ${iteration}/${serialIterations} | OK | Latency: ${latencySeconds.toFixed(2)}s | Gas: ${entry.gasUsed ?? "n/a"}`
      );
    } catch (error) {
      const entry: SerialResultEntry = {
        phase: "serial",
        network: networkName,
        iteration,
        txHash: null,
        startedAt,
        completedAt: new Date().toISOString(),
        latencySeconds: null,
        gasUsed: null,
        gasPriceWei: null,
        costWei: null,
        success: false,
        failureType: classifyError(error),
        failureMessage: getErrorMessage(error),
      };

      results.push(entry);
      await appendResult(entry);
      console.log(
        `Tx ${iteration}/${serialIterations} | FAIL | ${entry.failureType} | ${entry.failureMessage}`
      );
    }
  }

  printSerialSummary(results, ethers);
}

function printSerialSummary(
  results: SerialResultEntry[],
  ethers: { formatEther: (value: bigint | string) => string }
) {
  const successful = results.filter((entry) => entry.success);
  const failed = results.length - successful.length;
  const latencies = successful
    .map((entry) => entry.latencySeconds)
    .filter((value): value is number => value !== null);
  const gasValues = successful
    .map((entry) => entry.gasUsed)
    .filter((value): value is string => value !== null)
    .map((value) => Number(value));
  const gasPriceValues = successful
    .map((entry) => entry.gasPriceWei)
    .filter((value): value is string => value !== null)
    .map((value) => Number(value));
  const totalCostWei = successful.reduce((sum, entry) => sum + BigInt(entry.costWei ?? "0"), 0n);
  const latencyRange = minmax(latencies);
  const averageCostWei = successful.length > 0 ? totalCostWei / BigInt(successful.length) : null;

  console.log("\n--- Phase 1 Results ---");
  console.log(`Attempts: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed}`);

  if (successful.length === 0) {
    console.log("No valid sample collected.");
    return;
  }

  console.log(`Mean Latency: ${formatStat(mean(latencies))} seconds`);
  console.log(
    `Latency Range: ${formatStat(latencyRange?.min ?? null)}s - ${formatStat(latencyRange?.max ?? null)}s`
  );
  console.log(`Latency Std Dev: ${formatStat(stddev(latencies))} seconds`);
  console.log(`Mean Gas Used: ${formatStat(mean(gasValues), 0)} units`);
  console.log(`Mean Gas Price: ${formatStat(mean(gasPriceValues), 0)} wei`);
  console.log(
    `Mean Cost per Cert: ${averageCostWei === null ? "n/a" : ethers.formatEther(averageCostWei)} ETH`
  );
}

async function main() {
  const { ethers } = await network.connect();
  const toBytes32 = (value: string) => ethers.encodeBytes32String(value);
  const networkName = process.env.HARDHAT_NETWORK ?? "unknown";

  assertModeIsSerialOnly();

  const contract = await ethers.getContractAt("Certificate", contractAddress);
  const metricsContract = contract as unknown as ContractLike;
  assertIssueCertificateShape(metricsContract);

  const signers = await ethers.getSigners();
  const admin = signers[0];
  const recipientAddress = signers[1] ? signers[1].address : admin.address;

  console.log(`\nConnected to ${networkName} with Admin: ${admin.address}`);
  console.log(`Starting Latency & Cost Evaluation on Contract: ${contractAddress}`);
  console.log(`Results file: ${getResultStorePath()}\n`);

  const studentName = toBytes32("Hadiya Mushtaq");
  const courseName = toBytes32("B.Tech Computer Science");
  const institutionName = toBytes32("NIT Srinagar");
  const expiry = 0;
  const verificationPrefix = "ABCD";

  await runSerialLatencyAndCost({
    contract: metricsContract,
    provider: ethers.provider,
    ethers,
    encodeBytes32: toBytes32,
    recipientAddress,
    studentName,
    courseName,
    institutionName,
    expiry,
    verificationPrefix,
    networkName,
  });

  console.log(`\nEvaluation complete. Raw results saved to ${getResultStorePath()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
