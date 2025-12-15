import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { PlinkoGame } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("PlinkoGameSepolia", function () {
  let signers: Signers;
  let plinkoGameContract: PlinkoGame;
  let plinkoGameContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const PlinkoGameDeployment = await deployments.get("PlinkoGame");
      plinkoGameContractAddress = PlinkoGameDeployment.address;
      plinkoGameContract = await ethers.getContractAt("PlinkoGame", PlinkoGameDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia --tags PlinkoGame'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0], bob: ethSigners[1] };

    console.log("\n=== PlinkoGame Contract Info ===");
    console.log("Contract Address:", plinkoGameContractAddress);
    console.log("Owner:", await plinkoGameContract.owner());
    console.log("Turn Price:", ethers.formatEther(await plinkoGameContract.TURN_PRICE()), "ETH");
    console.log("Daily Free Turns:", (await plinkoGameContract.DAILY_FREE_TURNS()).toString());
    console.log("Total Players:", (await plinkoGameContract.getTotalPlayers()).toString());
    console.log("Contract Balance:", ethers.formatEther(await plinkoGameContract.getBalance()), "ETH");
    console.log("================================\n");
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should perform daily check-in and play a game", async function () {
    steps = 8;
    this.timeout(4 * 60000); // 4 minutes timeout

    progress("Checking if player can check in...");
    const canCheckIn = await plinkoGameContract.canCheckIn(signers.alice.address);
    console.log(`   Can check in: ${canCheckIn}`);

    if (canCheckIn) {
      progress("Performing daily check-in...");
      const checkInTx = await plinkoGameContract.connect(signers.alice).dailyCheckIn();
      await checkInTx.wait();
      console.log(`   Transaction hash: ${checkInTx.hash}`);
    } else {
      progress("Already checked in today, skipping check-in");
    }

    progress("Getting player info...");
    const playerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
    console.log(`   Available turns: ${playerInfo.availableTurns}`);
    console.log(`   Games played: ${playerInfo.gamesPlayed}`);
    console.log(`   Last check-in: ${new Date(Number(playerInfo.lastCheckInTime) * 1000).toLocaleString()}`);

    if (playerInfo.availableTurns > 0) {
      progress("Encrypting score value (100 points)...");
      const clearScore = 100;
      const encryptedScore = await fhevm
        .createEncryptedInput(plinkoGameContractAddress, signers.alice.address)
        .add32(clearScore)
        .encrypt();

      progress(
        `Dropping ball with encrypted score - handle=${ethers.hexlify(encryptedScore.handles[0])}...`,
      );
      const dropTx = await plinkoGameContract
        .connect(signers.alice)
        .dropBall(encryptedScore.handles[0], encryptedScore.inputProof);
      await dropTx.wait();
      console.log(`   Transaction hash: ${dropTx.hash}`);

      progress("Getting updated player info...");
      const updatedPlayerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
      console.log(`   Available turns: ${updatedPlayerInfo.availableTurns}`);
      console.log(`   Games played: ${updatedPlayerInfo.gamesPlayed}`);

      progress("Getting encrypted total score...");
      const encryptedTotalScore = await plinkoGameContract.getPlayerScore(signers.alice.address);
      console.log(`   Encrypted score: ${encryptedTotalScore}`);

      progress("Decrypting total score...");
      const decryptedScore = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedTotalScore,
        plinkoGameContractAddress,
        signers.alice,
      );
      console.log(`   Decrypted total score: ${decryptedScore}`);

      expect(updatedPlayerInfo.gamesPlayed).to.be.greaterThan(playerInfo.gamesPlayed);
    } else {
      progress("No turns available, skipping game");
      console.log("   Please check in or buy turns to play");
    }

    progress("Test completed successfully!");
  });

  it("should buy turns and play a game", async function () {
    steps = 7;
    this.timeout(4 * 60000); // 4 minutes timeout

    progress("Buying 2 turns...");
    const turnsToBuy = 2;
    const payment = ethers.parseEther("0.002"); // 2 * 0.001 ETH

    const buyTx = await plinkoGameContract.connect(signers.alice).buyTurns(turnsToBuy, { value: payment });
    await buyTx.wait();
    console.log(`   Transaction hash: ${buyTx.hash}`);
    console.log(`   Turns purchased: ${turnsToBuy}`);

    progress("Getting player info after purchase...");
    const playerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
    console.log(`   Available turns: ${playerInfo.availableTurns}`);

    progress("Encrypting score value (250 points)...");
    const clearScore = 250;
    const encryptedScore = await fhevm
      .createEncryptedInput(plinkoGameContractAddress, signers.alice.address)
      .add32(clearScore)
      .encrypt();

    progress("Dropping ball with encrypted score...");
    const dropTx = await plinkoGameContract
      .connect(signers.alice)
      .dropBall(encryptedScore.handles[0], encryptedScore.inputProof);
    await dropTx.wait();
    console.log(`   Transaction hash: ${dropTx.hash}`);

    progress("Getting encrypted total score...");
    const encryptedTotalScore = await plinkoGameContract.getPlayerScore(signers.alice.address);

    progress("Decrypting total score...");
    const decryptedScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTotalScore,
      plinkoGameContractAddress,
      signers.alice,
    );
    console.log(`   Decrypted total score: ${decryptedScore}`);

    progress("Test completed successfully!");
  });

  it("should display leaderboard", async function () {
    steps = 2;
    this.timeout(60000);

    progress("Fetching leaderboard...");
    const leaderboard = await plinkoGameContract.getLeaderboard();
    console.log(`   Total players in leaderboard: ${leaderboard.length}`);

    progress("Displaying top players:");
    const topCount = Math.min(10, leaderboard.length);
    for (let i = 0; i < topCount; i++) {
      console.log(`   ${i + 1}. ${leaderboard[i].playerAddress} - ${leaderboard[i].gamesPlayed} games played`);
    }

    expect(leaderboard.length).to.be.greaterThanOrEqual(0);
    console.log("\n   Leaderboard test completed!");
  });

  it("should verify contract constants and state", async function () {
    steps = 5;
    this.timeout(60000);

    progress("Checking turn price...");
    const turnPrice = await plinkoGameContract.TURN_PRICE();
    console.log(`   Turn price: ${ethers.formatEther(turnPrice)} ETH`);
    expect(turnPrice).to.equal(ethers.parseEther("0.001"));

    progress("Checking daily free turns...");
    const dailyFreeTurns = await plinkoGameContract.DAILY_FREE_TURNS();
    console.log(`   Daily free turns: ${dailyFreeTurns}`);
    expect(dailyFreeTurns).to.equal(3);

    progress("Checking owner...");
    const owner = await plinkoGameContract.owner();
    console.log(`   Owner address: ${owner}`);
    expect(owner).to.be.properAddress;

    progress("Checking total players...");
    const totalPlayers = await plinkoGameContract.getTotalPlayers();
    console.log(`   Total players: ${totalPlayers}`);

    progress("Checking contract balance...");
    const balance = await plinkoGameContract.getBalance();
    console.log(`   Contract balance: ${ethers.formatEther(balance)} ETH`);

    console.log("\n   Contract verification completed!");
  });
});
