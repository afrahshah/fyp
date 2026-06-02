import { network } from "hardhat";
import { performance } from "perf_hooks";

async function main() {
    const { ethers } = await network.connect();
    const toBytes32 = (value: string) => ethers.encodeBytes32String(value);

    // Use your newly deployed bytes32-based contract address
    const contractAddress = "0x05cE48785649226C726c1aece7531E145C8b06e4";

    const contract = await ethers.getContractAt("Certificate", contractAddress);
    
    const signers = await ethers.getSigners();
    const admin = signers[0];
    const recipientAddress = signers[1] ? signers[1].address : admin.address;

    console.log(`\nConnected to Sepolia with Admin: ${admin.address}`);
    console.log(`Starting Authentic Metrics Evaluation on Contract: ${contractAddress}\n`);

    // Your exact on-chain parameters
    const studentName = toBytes32("Hadiya Mushtaq");
    const courseName = toBytes32("B.Tech Computer Science");
    const institutionName = toBytes32("NIT Srinagar");
    const expiry = 0; // No expiry
    const shareCodePrefix = "ABCD2345EFGH6789";

    // =========================================================
    // PHASE 1: LATENCY & COST (The "Rule of 30" Sequential Test)
    // =========================================================
    console.log("=========================================");
    console.log("PHASE 1: LATENCY & COST EVALUATION (n=30)");
    console.log("=========================================");
    
    const iterations = 30;
    let totalLatency = 0;
    let totalGasUsed = 0n;
    let totalCostInWei = 0n;

    for (let i = 0; i < iterations; i++) {
        process.stdout.write(`Executing Tx ${i + 1}/${iterations}... `);
        
        const startTime = performance.now();

        const uniqueCode = toBytes32(`${shareCodePrefix}${i.toString().padStart(2, "0")}`);

        try {
            const tx = await contract.issueCertificate(
                recipientAddress,
                studentName,
                courseName,
                institutionName,
                expiry,
                uniqueCode
            );

            const receipt = await tx.wait(); 
            const endTime = performance.now();

            const latencySeconds = (endTime - startTime) / 1000;
            const gasUsed = BigInt(receipt!.gasUsed);
            const gasPrice = BigInt(receipt!.gasPrice || 0);
            const txCost = gasUsed * gasPrice;

            totalLatency += latencySeconds;
            totalGasUsed += gasUsed;
            totalCostInWei += txCost;

            console.log(`Done | Latency: ${latencySeconds.toFixed(2)}s | Gas: ${gasUsed.toString()}`);
        } catch (error: any) {
            console.error("Failed:", error.message);
        }
    }

    const avgLatency = (totalLatency / iterations).toFixed(2);
    const avgGas = (totalGasUsed / 30n).toString();
    const avgCostEth = ethers.formatEther((totalCostInWei / 30n).toString());

    console.log("\n--- Phase 1 Results ---");
    console.log(`Average Latency: ${avgLatency} seconds`);
    console.log(`Average Gas Used: ${avgGas} units`);
    console.log(`Average Cost per Cert: ${avgCostEth} ETH\n`);

    // =========================================================
    // PHASE 2: THROUGHPUT (Batch Stress Testing)
    // =========================================================
    console.log("=========================================");
    console.log("PHASE 2: THROUGHPUT SCALABILITY TEST");
    console.log("=========================================");
    
    const batchSizes = [5, 10, 15]; 

    for (const batchSize of batchSizes) {
        console.log(`\nInitiating parallel batch of ${batchSize} certificates...`);
        
        let currentNonce = await admin.getNonce();
        const pendingTransactions = [];
        
        const batchStartTime = performance.now();

        for (let i = 0; i < batchSize; i++) {
            const uniqueBatchCode = toBytes32(
                `${shareCodePrefix}${batchSize.toString().padStart(2, "0")}${i.toString().padStart(2, "0")}`
            );

            const txPromise = contract.issueCertificate(
                recipientAddress,
                studentName,
                courseName,
                institutionName,
                expiry,
                uniqueBatchCode,
                { nonce: currentNonce++ } 
            );
            pendingTransactions.push(txPromise);
        }

        try {
            const txResponses = await Promise.all(pendingTransactions);
            await Promise.all(txResponses.map(tx => tx.wait()));
            
            const batchEndTime = performance.now();
            const totalTimeSeconds = (batchEndTime - batchStartTime) / 1000;
            const throughput = batchSize / totalTimeSeconds;

            console.log(`- Batch processed in: ${totalTimeSeconds.toFixed(2)} seconds`);
            console.log(`- Scalability Throughput: ${throughput.toFixed(2)} TPS (Certificates / Second)`);

        } catch (error) {
            console.error(`Batch of ${batchSize} failed due to RPC rate limit or network error.`);
        }
    }
    
    console.log("\nEvaluation Complete. Save these baseline metrics for your paper!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
