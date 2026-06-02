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

type ThroughputResultEntry = {
  phase: "throughput";
  network: string;
  batchSize: number;
  repetition: number;
  txHashes: string[];
  startedAt: string;
  completedAt: string;
  elapsedSeconds: number | null;
  throughputTps: number | null;
  success: boolean;
  failureType: FailureType | null;
  failureMessage: string | null;
};

type ContractLike = {
  issueCertificate: (...args: unknown[]) => Promise<{
    hash: string;
    wait: () => Promise<unknown>;
  }>;
  interface: {
    getFunction: (name: string) => { inputs?: Array<{ type?: string }> } | null;
  };
};

type ThroughputParams = {
  contract: ContractLike;
  admin: { getNonce: () => Promise<number> };
  encodeBytes32: (value: string) => string;
  recipientAddress: string;
  studentName: string;
  courseName: string;
  institutionName: string;
  expiry: number;
  verificationPrefix: string;
  networkName: string;
  throughputRepeats: number;
  throughputBatchSizes: number[];
};

const defaultContractAddress = "0xf66D0eD7aC3e5E4efb69ac2a3b786ABAB6568C27";
const contractAddress = process.env.CERTIFICATE_CONTRACT_ADDRESS ?? defaultContractAddress;
const resultStorePath = path.join(process.cwd(), "metrics-throughput-results.jsonl");
const LOCALHOST_CHAIN_ID = 31337n;
const SEPOLIA_CHAIN_ID = 11155111n;

function getResultStorePath() {
  return resultStorePath;
}

async function appendResult(entry: ThroughputResultEntry) {
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

function resolveNetworkName(chainId: bigint, reportedName?: string) {
  if (chainId === LOCALHOST_CHAIN_ID) {
    return "localhost";
  }

  if (chainId === SEPOLIA_CHAIN_ID) {
    return "sepolia";
  }

  return reportedName ?? "unknown";
}

function assertSupportedNetwork(networkName: string, chainId: bigint) {
  if (
    (networkName === "localhost" && chainId === LOCALHOST_CHAIN_ID) ||
    (networkName === "sepolia" && chainId === SEPOLIA_CHAIN_ID)
  ) {
    return;
  }

  throw new Error(
    `evaluateMetrics2 only supports localhost and sepolia. Connected to "${networkName}" (chainId ${chainId}).`
  );
}

function getThroughputRepeats(networkName: string) {
  const configured = process.env.METRICS_THROUGHPUT_REPEATS;

  if (configured) {
    const parsed = Number(configured);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
    throw new Error(`Invalid METRICS_THROUGHPUT_REPEATS "${configured}". Expected a positive integer.`);
  }

  return networkName === "sepolia" ? 1 : 3;
}

function getThroughputBatchSizes(networkName: string) {
  const configured = process.env.METRICS_BATCH_SIZES;
  const rawValue = configured ?? (networkName === "sepolia" ? "20" : "5,10,15");
  const parsed = rawValue
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (parsed.length === 0) {
    throw new Error(`Invalid METRICS_BATCH_SIZES "${rawValue}". Expected comma-separated positive integers.`);
  }

  return parsed;
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

async function runThroughputBatches(params: ThroughputParams) {
  const {
    contract,
    admin,
    encodeBytes32,
    recipientAddress,
    studentName,
    courseName,
    institutionName,
    expiry,
    verificationPrefix,
    networkName,
    throughputRepeats,
    throughputBatchSizes,
  } = params;

  console.log("=========================================");
  console.log("THROUGHPUT SCALABILITY TEST");
  console.log("=========================================");

  for (const batchSize of throughputBatchSizes) {
    const entries: ThroughputResultEntry[] = [];
    console.log(`\nBatch size ${batchSize}`);

    for (let repetition = 1; repetition <= throughputRepeats; repetition += 1) {
      const startedAt = new Date().toISOString();
      const batchStartTime = performance.now();

      try {
        let nonce = await admin.getNonce();
        const txResponses = await Promise.all(
          Array.from({ length: batchSize }, (_, index) => {
            const verificationCode = encodeBytes32(
              makeVerificationCode(verificationPrefix, [
                batchSize,
                repetition,
                index,
                Date.now() & 0xffff,
              ])
            );

            return contract.issueCertificate(
              recipientAddress,
              studentName,
              courseName,
              institutionName,
              expiry,
              verificationCode,
              { nonce: nonce++ }
            );
          })
        );

        const txHashes = txResponses.map((tx) => tx.hash);
        await Promise.all(txResponses.map((tx) => tx.wait()));

        const elapsedSeconds = (performance.now() - batchStartTime) / 1000;
        const throughputTps = batchSize / elapsedSeconds;
        const entry: ThroughputResultEntry = {
          phase: "throughput",
          network: networkName,
          batchSize,
          repetition,
          txHashes,
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedSeconds,
          throughputTps,
          success: true,
          failureType: null,
          failureMessage: null,
        };

        entries.push(entry);
        await appendResult(entry);
        console.log(
          `Rep ${repetition}/${throughputRepeats} | OK | Time: ${elapsedSeconds.toFixed(2)}s | TPS: ${throughputTps.toFixed(2)}`
        );
      } catch (error) {
        const entry: ThroughputResultEntry = {
          phase: "throughput",
          network: networkName,
          batchSize,
          repetition,
          txHashes: [],
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedSeconds: null,
          throughputTps: null,
          success: false,
          failureType: classifyError(error),
          failureMessage: getErrorMessage(error),
        };

        entries.push(entry);
        await appendResult(entry);
        console.log(
          `Rep ${repetition}/${throughputRepeats} | FAIL | ${entry.failureType} | ${entry.failureMessage}`
        );
      }
    }

    printThroughputSummary(batchSize, entries);
  }
}

function printThroughputSummary(batchSize: number, entries: ThroughputResultEntry[]) {
  const successful = entries.filter((entry) => entry.success);
  const throughputValues = successful
    .map((entry) => entry.throughputTps)
    .filter((value): value is number => value !== null);
  const range = minmax(throughputValues);
  const successRate = entries.length === 0 ? 0 : (successful.length / entries.length) * 100;

  console.log(`--- Throughput Summary | Batch ${batchSize} ---`);
  console.log(`Successful Repetitions: ${successful.length}/${entries.length} (${successRate.toFixed(2)}%)`);

  if (successful.length === 0) {
    console.log("No valid throughput sample collected.");
    return;
  }

  console.log(`Mean TPS: ${formatStat(mean(throughputValues))}`);
  console.log(`TPS Range: ${formatStat(range?.min ?? null)} - ${formatStat(range?.max ?? null)}`);
  console.log(`TPS Std Dev: ${formatStat(stddev(throughputValues))}`);
}

async function main() {
  const { ethers } = await network.connect();
  const toBytes32 = (value: string) => ethers.encodeBytes32String(value);
  const connectedNetwork = await ethers.provider.getNetwork();
  const networkName = resolveNetworkName(connectedNetwork.chainId, connectedNetwork.name);

  assertSupportedNetwork(networkName, connectedNetwork.chainId);

  const throughputRepeats = getThroughputRepeats(networkName);
  const throughputBatchSizes = getThroughputBatchSizes(networkName);

  const contract = await ethers.getContractAt("Certificate", contractAddress);
  const metricsContract = contract as unknown as ContractLike;
  assertIssueCertificateShape(metricsContract);

  const signers = await ethers.getSigners();
  const admin = signers[0];
  const recipientAddress = signers[1] ? signers[1].address : admin.address;

  console.log(`\nConnected to ${networkName} with Admin: ${admin.address}`);
  console.log(`Starting Throughput Evaluation on Contract: ${contractAddress}`);
  console.log(`Batch sizes: ${throughputBatchSizes.join(", ")}`);
  console.log(`Repeats per batch: ${throughputRepeats}`);
  console.log(`Results file: ${getResultStorePath()}`);
  if (networkName === "sepolia") {
    console.log("Warning: Sepolia throughput is a practical public-network measurement and will be lower and noisier than localhost.");
  }
  console.log("");

  const studentName = toBytes32("Hadiya Mushtaq");
  const courseName = toBytes32("B.Tech Computer Science");
  const institutionName = toBytes32("NIT Srinagar");
  const expiry = 0;
  const verificationPrefix = "ABCD";

  await runThroughputBatches({
    contract: metricsContract,
    admin,
    encodeBytes32: toBytes32,
    recipientAddress,
    studentName,
    courseName,
    institutionName,
    expiry,
    verificationPrefix,
    networkName,
    throughputRepeats,
    throughputBatchSizes,
  });

  console.log(`\nEvaluation complete. Raw results saved to ${getResultStorePath()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
