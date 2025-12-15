import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { PlinkoGame, PlinkoGame__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("PlinkoGame")) as PlinkoGame__factory;
  const plinkoGameContract = (await factory.deploy()) as PlinkoGame;
  const plinkoGameContractAddress = await plinkoGameContract.getAddress();

  return { plinkoGameContract, plinkoGameContractAddress };
}

describe("PlinkoGame", function () {
  let signers: Signers;
  let plinkoGameContract: PlinkoGame;
  let plinkoGameContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      charlie: ethSigners[3],
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet - use PlinkoGameSepolia.ts instead`);
      this.skip();
    }

    ({ plinkoGameContract, plinkoGameContractAddress } = await deployFixture());
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await plinkoGameContract.owner()).to.equal(signers.deployer.address);
    });

    it("should have correct constants", async function () {
      expect(await plinkoGameContract.TURN_PRICE()).to.equal(ethers.parseEther("0.001"));
      expect(await plinkoGameContract.DAILY_FREE_TURNS()).to.equal(3);
      expect(await plinkoGameContract.SECONDS_PER_DAY()).to.equal(86400);
    });

    it("should start with zero total players", async function () {
      expect(await plinkoGameContract.getTotalPlayers()).to.equal(0);
    });
  });

  describe("Daily Check-in", function () {
    it("should allow first-time check-in", async function () {
      const canCheckIn = await plinkoGameContract.canCheckIn(signers.alice.address);
      expect(canCheckIn).to.be.true;

      const tx = await plinkoGameContract.connect(signers.alice).dailyCheckIn();
      await expect(tx).to.emit(plinkoGameContract, "CheckedIn");

      const playerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
      expect(playerInfo.availableTurns).to.equal(3);
      expect(playerInfo.gamesPlayed).to.equal(0);
    });

    it("should not allow check-in twice in the same day", async function () {
      await plinkoGameContract.connect(signers.alice).dailyCheckIn();

      await expect(plinkoGameContract.connect(signers.alice).dailyCheckIn()).to.be.revertedWith(
        "Already checked in today",
      );
    });

    it("should allow check-in after 24 hours", async function () {
      await plinkoGameContract.connect(signers.alice).dailyCheckIn();

      // Fast forward 24 hours
      await time.increase(86400);

      const tx = await plinkoGameContract.connect(signers.alice).dailyCheckIn();
      await expect(tx).to.emit(plinkoGameContract, "CheckedIn");

      const playerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
      expect(playerInfo.availableTurns).to.equal(6); // 3 + 3
    });

    it("should add player to player list on first check-in", async function () {
      await plinkoGameContract.connect(signers.alice).dailyCheckIn();
      expect(await plinkoGameContract.getTotalPlayers()).to.equal(1);

      await plinkoGameContract.connect(signers.bob).dailyCheckIn();
      expect(await plinkoGameContract.getTotalPlayers()).to.equal(2);
    });
  });

  describe("Buy Turns", function () {
    it("should allow buying turns with correct payment", async function () {
      const turnsToBuy = 5;
      const payment = ethers.parseEther("0.005"); // 5 * 0.001 ETH

      const tx = await plinkoGameContract.connect(signers.alice).buyTurns(turnsToBuy, { value: payment });
      await expect(tx).to.emit(plinkoGameContract, "TurnsPurchased").withArgs(signers.alice.address, turnsToBuy, payment);

      const playerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
      expect(playerInfo.availableTurns).to.equal(5);
    });

    it("should not allow buying with incorrect payment", async function () {
      const turnsToBuy = 5;
      const incorrectPayment = ethers.parseEther("0.004"); // Wrong amount

      await expect(plinkoGameContract.connect(signers.alice).buyTurns(turnsToBuy, { value: incorrectPayment }))
        .to.be.revertedWith("Incorrect payment amount");
    });

    it("should not allow buying zero turns", async function () {
      await expect(plinkoGameContract.connect(signers.alice).buyTurns(0, { value: 0 }))
        .to.be.revertedWith("Must buy at least 1 turn");
    });

    it("should add first-time buyer to player list", async function () {
      await plinkoGameContract.connect(signers.alice).buyTurns(1, { value: ethers.parseEther("0.001") });
      expect(await plinkoGameContract.getTotalPlayers()).to.equal(1);
    });
  });

  describe("Drop Ball (Game Play)", function () {
    it("should allow dropping a ball with available turns", async function () {
      // Give Alice some turns
      await plinkoGameContract.connect(signers.alice).dailyCheckIn();

      // Encrypt a score value (e.g., 100 points)
      const clearScore = 100;
      const encryptedScore = await fhevm
        .createEncryptedInput(plinkoGameContractAddress, signers.alice.address)
        .add32(clearScore)
        .encrypt();

      const tx = await plinkoGameContract
        .connect(signers.alice)
        .dropBall(encryptedScore.handles[0], encryptedScore.inputProof);

      await expect(tx).to.emit(plinkoGameContract, "GamePlayed");
      await expect(tx).to.emit(plinkoGameContract, "ScoreUpdated");

      const playerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
      expect(playerInfo.availableTurns).to.equal(2); // 3 - 1
      expect(playerInfo.gamesPlayed).to.equal(1);
    });

    it("should not allow dropping ball without turns", async function () {
      const clearScore = 100;
      const encryptedScore = await fhevm
        .createEncryptedInput(plinkoGameContractAddress, signers.alice.address)
        .add32(clearScore)
        .encrypt();

      await expect(
        plinkoGameContract.connect(signers.alice).dropBall(encryptedScore.handles[0], encryptedScore.inputProof),
      ).to.be.revertedWith("No turns available");
    });

    it("should accumulate encrypted scores correctly", async function () {
      // Give Alice some turns
      await plinkoGameContract.connect(signers.alice).dailyCheckIn();

      // First drop - score 50
      const clearScore1 = 50;
      const encryptedScore1 = await fhevm
        .createEncryptedInput(plinkoGameContractAddress, signers.alice.address)
        .add32(clearScore1)
        .encrypt();

      await plinkoGameContract.connect(signers.alice).dropBall(encryptedScore1.handles[0], encryptedScore1.inputProof);

      // Second drop - score 75
      const clearScore2 = 75;
      const encryptedScore2 = await fhevm
        .createEncryptedInput(plinkoGameContractAddress, signers.alice.address)
        .add32(clearScore2)
        .encrypt();

      await plinkoGameContract.connect(signers.alice).dropBall(encryptedScore2.handles[0], encryptedScore2.inputProof);

      // Decrypt and verify total score
      const encryptedTotalScore = await plinkoGameContract.getPlayerScore(signers.alice.address);
      const decryptedScore = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedTotalScore,
        plinkoGameContractAddress,
        signers.alice,
      );

      expect(decryptedScore).to.equal(clearScore1 + clearScore2);
    });

    it("should track games played correctly", async function () {
      await plinkoGameContract.connect(signers.alice).dailyCheckIn();

      for (let i = 0; i < 3; i++) {
        const encryptedScore = await fhevm
          .createEncryptedInput(plinkoGameContractAddress, signers.alice.address)
          .add32(10)
          .encrypt();

        await plinkoGameContract.connect(signers.alice).dropBall(encryptedScore.handles[0], encryptedScore.inputProof);
      }

      const playerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
      expect(playerInfo.gamesPlayed).to.equal(3);
      expect(playerInfo.availableTurns).to.equal(0);
    });
  });

  describe("Leaderboard", function () {
    it("should return empty leaderboard initially", async function () {
      const leaderboard = await plinkoGameContract.getLeaderboard();
      expect(leaderboard.length).to.equal(0);
    });

    it("should return sorted leaderboard by games played", async function () {
      // Alice plays 3 games
      await plinkoGameContract.connect(signers.alice).dailyCheckIn();
      for (let i = 0; i < 3; i++) {
        const encryptedScore = await fhevm
          .createEncryptedInput(plinkoGameContractAddress, signers.alice.address)
          .add32(100)
          .encrypt();
        await plinkoGameContract.connect(signers.alice).dropBall(encryptedScore.handles[0], encryptedScore.inputProof);
      }

      // Bob plays 1 game
      await plinkoGameContract.connect(signers.bob).dailyCheckIn();
      const bobEncryptedScore = await fhevm
        .createEncryptedInput(plinkoGameContractAddress, signers.bob.address)
        .add32(50)
        .encrypt();
      await plinkoGameContract.connect(signers.bob).dropBall(bobEncryptedScore.handles[0], bobEncryptedScore.inputProof);

      // Charlie plays 5 games
      await plinkoGameContract.connect(signers.charlie).buyTurns(5, { value: ethers.parseEther("0.005") });
      for (let i = 0; i < 5; i++) {
        const encryptedScore = await fhevm
          .createEncryptedInput(plinkoGameContractAddress, signers.charlie.address)
          .add32(200)
          .encrypt();
        await plinkoGameContract
          .connect(signers.charlie)
          .dropBall(encryptedScore.handles[0], encryptedScore.inputProof);
      }

      const leaderboard = await plinkoGameContract.getLeaderboard();
      expect(leaderboard.length).to.equal(3);

      // Check sorting (descending by games played)
      expect(leaderboard[0].playerAddress).to.equal(signers.charlie.address);
      expect(leaderboard[0].gamesPlayed).to.equal(5);

      expect(leaderboard[1].playerAddress).to.equal(signers.alice.address);
      expect(leaderboard[1].gamesPlayed).to.equal(3);

      expect(leaderboard[2].playerAddress).to.equal(signers.bob.address);
      expect(leaderboard[2].gamesPlayed).to.equal(1);
    });
  });

  describe("Owner Functions", function () {
    it("should allow owner to withdraw funds", async function () {
      // Players buy turns to add funds to contract
      await plinkoGameContract.connect(signers.alice).buyTurns(10, { value: ethers.parseEther("0.01") });

      const contractBalance = await plinkoGameContract.getBalance();
      expect(contractBalance).to.equal(ethers.parseEther("0.01"));

      const initialOwnerBalance = await ethers.provider.getBalance(signers.deployer.address);

      const tx = await plinkoGameContract.connect(signers.deployer).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const finalOwnerBalance = await ethers.provider.getBalance(signers.deployer.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance - gasUsed + ethers.parseEther("0.01"));

      expect(await plinkoGameContract.getBalance()).to.equal(0);
    });

    it("should not allow non-owner to withdraw", async function () {
      await expect(plinkoGameContract.connect(signers.alice).withdraw()).to.be.revertedWith(
        "Only owner can call this function",
      );
    });

    it("should not allow withdrawal with zero balance", async function () {
      await expect(plinkoGameContract.connect(signers.deployer).withdraw()).to.be.revertedWith("No balance to withdraw");
    });

    it("should allow owner to transfer ownership", async function () {
      await plinkoGameContract.connect(signers.deployer).transferOwnership(signers.alice.address);
      expect(await plinkoGameContract.owner()).to.equal(signers.alice.address);
    });

    it("should not allow non-owner to transfer ownership", async function () {
      await expect(plinkoGameContract.connect(signers.alice).transferOwnership(signers.bob.address)).to.be.revertedWith(
        "Only owner can call this function",
      );
    });

    it("should not allow transfer to zero address", async function () {
      await expect(plinkoGameContract.connect(signers.deployer).transferOwnership(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid new owner address");
    });
  });

  describe("View Functions", function () {
    it("should return correct player info", async function () {
      await plinkoGameContract.connect(signers.alice).dailyCheckIn();

      const playerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
      expect(playerInfo.availableTurns).to.equal(3);
      expect(playerInfo.gamesPlayed).to.equal(0);
      expect(playerInfo.lastCheckInTime).to.be.greaterThan(0);
    });

    it("should return zero values for non-existent player", async function () {
      const playerInfo = await plinkoGameContract.getPlayerInfo(signers.alice.address);
      expect(playerInfo.availableTurns).to.equal(0);
      expect(playerInfo.gamesPlayed).to.equal(0);
      expect(playerInfo.lastCheckInTime).to.equal(0);
    });

    it("should correctly check if player can check in", async function () {
      // Before first check-in
      expect(await plinkoGameContract.canCheckIn(signers.alice.address)).to.be.true;

      // After first check-in
      await plinkoGameContract.connect(signers.alice).dailyCheckIn();
      expect(await plinkoGameContract.canCheckIn(signers.alice.address)).to.be.false;

      // After 24 hours
      await time.increase(86400);
      expect(await plinkoGameContract.canCheckIn(signers.alice.address)).to.be.true;
    });
  });
});
